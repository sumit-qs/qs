import { getStoredUtms, UTM_KEYS } from "../hubspot/utm-capture.js";

// HubSpot softgate — custom frontend + HubSpot Forms API.
//
// Scope: acts ONLY on  .qs-gate.is-hubspot  — on any other page / gate it
// silently no-ops. It does NOT replace gate.js: gate.js still owns showing and
// hiding the gate, the 1200px scroll trigger, download blocking, localStorage
// and the cross-tab sync, exactly as it does on live.
//
// WHY NOT hbspt.forms.create: the embed hit three edge cases at once — it may
// render in an iframe (so the Webflow theme can't reach it), it did not enforce
// required fields, and the consent checkbox could not be made blocking. This is
// the same architecture as the QS Subscribe journey and what Periti specified
// in §6.2: our own markup and validation, POSTed to the Forms API. The markup
// reuses the Webflow class `qs-form-field-gate`, so the fields inherit the live
// gate's styling from Webflow itself. No Webflow native form classes (w-input /
// w-select) are applied — every rule we add is scoped under
// `.qs-gate.is-hubspot`, so nothing outside this staging gate is affected.
//
// Submission (§2 / §6.2):
//   - unlock fires the moment validation passes, BEFORE the POST, so the reader
//     never waits on HubSpot and a failed call cannot withhold the report;
//   - POST uses keepalive so it survives the page navigating to the PDF;
//   - context.hutk is attached only when the hubspotutk cookie exists. The
//     consent guard deletes that cookie whenever analytics consent is refused,
//     so a rejecting visitor is never linked to their browsing history;
//   - errors are logged, never surfaced as a blocked unlock.
//
// Webflow hooks:
//   gate   -> .qs-gate  + combo class .is-hubspot
//   mount  -> <div qs-hsform="gate"
//                  data-portal-id="26055784"
//                  data-form-id="a71677bf-99e6-4af3-86b0-e8b990d45ad2"
//                  data-region="eu1"
//                  data-subscription-type-id="REQUIRED — from Periti"
//                  data-report-name="{{ CMS Name }}"
//                  data-require-work-email="false"
//                  data-consent-countries=""></div>
//
//   data-consent-countries  empty (default) = consent checkbox always shown and
//                           always required. Set to "Italy,France" to switch to
//                           the conditional behaviour in §4 of the spec.
//   data-require-work-email "true" blocks free email domains client-side.
//                           Default false — §4 allows personal domains.
//   extra download buttons  -> any element with [qs-gate-download].
export function functionHubspotGate() {
  const GATE_SELECTOR = '.qs-gate.is-hubspot';
  const MOUNT_SELECTOR = '[qs-hsform="gate"]';
  const EXTRA_DOWNLOAD_SELECTOR = '[qs-gate-download]';
  const REPORT_FIELD = 'softgate_report'; // rename if Periti finalise a different internal name

  const DEFAULTS = {
    portalId: '26055784',
    formId: 'a71677bf-99e6-4af3-86b0-e8b990d45ad2',
    region: 'eu1',
  };

  const CONSENT_TEXT = 'I agree to receive relevant communications from QS.';
  const PROCESS_TEXT = 'By submitting this form, you agree to receive relevant emails from QS. You can unsubscribe anytime.';

  const NAME_RE = /^[A-Za-z\s\-']+$/;
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const FREE_DOMAINS = [
    'gmail.com', 'yahoo.com', 'yahoo.co.uk', 'yahoo.co.in', 'hotmail.com', 'hotmail.co.uk',
    'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'mail.com',
    'gmx.com', 'yandex.com', 'proton.me', 'protonmail.com', 'rediffmail.com', 'qq.com', '163.com',
  ];

  const COUNTRIES = [
    'Afghanistan','Albania','Algeria','Andorra','Angola','Antigua and Barbuda','Argentina','Armenia','Australia','Austria','Azerbaijan','Bahamas','Bahrain','Bangladesh','Barbados','Belarus','Belgium','Belize','Benin','Bhutan','Bolivia','Bosnia and Herzegovina','Botswana','Brazil','Brunei','Bulgaria','Burkina Faso','Burundi','Cabo Verde','Cambodia','Cameroon','Canada','Central African Republic','Chad','Chile','China','Colombia','Comoros','Congo','Costa Rica','Croatia','Cuba','Cyprus','Czech Republic','Denmark','Djibouti','Dominica','Dominican Republic','Ecuador','Egypt','El Salvador','Equatorial Guinea','Eritrea','Estonia','Eswatini','Ethiopia','Fiji','Finland','France','Gabon','Gambia','Georgia','Germany','Ghana','Greece','Grenada','Guatemala','Guinea','Guinea-Bissau','Guyana','Haiti','Honduras','Hungary','Iceland','India','Indonesia','Iran','Iraq','Ireland','Israel','Italy','Jamaica','Japan','Jordan','Kazakhstan','Kenya','Kiribati','Kuwait','Kyrgyzstan','Laos','Latvia','Lebanon','Lesotho','Liberia','Libya','Liechtenstein','Lithuania','Luxembourg','Madagascar','Malawi','Malaysia','Maldives','Mali','Malta','Marshall Islands','Mauritania','Mauritius','Mexico','Micronesia','Moldova','Monaco','Mongolia','Montenegro','Morocco','Mozambique','Myanmar','Namibia','Nauru','Nepal','Netherlands','New Zealand','Nicaragua','Niger','Nigeria','North Korea','North Macedonia','Norway','Oman','Pakistan','Palau','Palestine','Panama','Papua New Guinea','Paraguay','Peru','Philippines','Poland','Portugal','Qatar','Romania','Russia','Rwanda','Saint Kitts and Nevis','Saint Lucia','Saint Vincent and the Grenadines','Samoa','San Marino','Sao Tome and Principe','Saudi Arabia','Senegal','Serbia','Seychelles','Sierra Leone','Singapore','Slovakia','Slovenia','Solomon Islands','Somalia','South Africa','South Korea','South Sudan','Spain','Sri Lanka','Sudan','Suriname','Sweden','Switzerland','Syria','Taiwan','Tajikistan','Tanzania','Thailand','Timor-Leste','Togo','Tonga','Trinidad and Tobago','Tunisia','Turkey','Turkmenistan','Tuvalu','Uganda','Ukraine','United Arab Emirates','United Kingdom','United States','Uruguay','Uzbekistan','Vanuatu','Vatican City','Venezuela','Vietnam','Yemen','Zambia','Zimbabwe',
  ];

  // ---- setup ----------------------------------------------------------------
  const gate = document.querySelector(GATE_SELECTOR);
  if (!gate) return;
  if (gate.dataset.qsHubspotGateBound === 'true') return;
  const mount = gate.querySelector(MOUNT_SELECTOR);
  if (!mount) {
    console.warn('[QS] .qs-gate.is-hubspot found but no [qs-hsform="gate"] mount inside it');
    return;
  }
  gate.dataset.qsHubspotGateBound = 'true';

  const portalId = mount.getAttribute('data-portal-id') || DEFAULTS.portalId;
  const formId = mount.getAttribute('data-form-id') || DEFAULTS.formId;
  const region = mount.getAttribute('data-region') || DEFAULTS.region;
  const subscriptionTypeId = parseInt(mount.getAttribute('data-subscription-type-id'), 10);
  const requireWorkEmail = mount.getAttribute('data-require-work-email') === 'true';
  const consentCountries = (mount.getAttribute('data-consent-countries') || '')
    .split(',').map((c) => c.trim()).filter(Boolean);

  const endpoint = `https://api-${region}.hsforms.com/submissions/v3/integration/submit/${portalId}/${formId}`;

  const DEBUG = (() => {
    try {
      if (new URLSearchParams(location.search).get('qsdebug') === 'gate') return true;
      return localStorage.getItem('qs:debug:gate') === '1';
    } catch (_) { return false; }
  })();
  const log = (...a) => { if (DEBUG) console.log('%c[QS gate-hs]', 'color:#e8a33d;font-weight:600', ...a); };

  if (!subscriptionTypeId) {
    console.warn('[QS] data-subscription-type-id is missing — consent will be sent as consentToProcess only, with no subscription opt-in recorded. Ask Periti for the "Insights" subscription type ID.');
  }

  let unlocked = false;
  let submitting = false;

  // ---- markup ---------------------------------------------------------------
  const field = (name, label, type) => `
    <div class="qs-gate-hs-field" data-field="${name}">
      <label class="qs-gate-hs-label" for="qs-gate-hs-${name}">${label}<span class="qs-gate-hs-req">*</span></label>
      <input class="qs-form-field-gate" id="qs-gate-hs-${name}" name="${name}" type="${type}" autocomplete="${name === 'email' ? 'email' : name === 'firstname' ? 'given-name' : 'family-name'}">
      <span class="qs-gate-hs-error" aria-live="polite"></span>
    </div>`;

  mount.innerHTML = `
    <div class="qs-gate-hs" role="form" aria-label="Unlock the insights">
      <div class="qs-gate-hs-grid">
        ${field('firstname', 'Name', 'text')}
        ${field('lastname', 'Surname', 'text')}
        ${field('email', 'Work Email', 'email')}
        <div class="qs-gate-hs-field" data-field="country">
          <label class="qs-gate-hs-label" for="qs-gate-hs-country">Country<span class="qs-gate-hs-req">*</span></label>
          <div class="qs-gate-hs-select-wrap">
            <select class="qs-form-field-gate" id="qs-gate-hs-country" name="country" autocomplete="country-name">
              <option value="" disabled selected>Please Select</option>
              ${COUNTRIES.map((c) => `<option value="${c}">${c}</option>`).join('')}
            </select>
            <span class="qs-gate-hs-arrow" aria-hidden="true">&#9662;</span>
          </div>
          <span class="qs-gate-hs-error" aria-live="polite"></span>
        </div>
      </div>

      <div class="qs-gate-hs-footer">
        <div class="qs-gate-hs-field qs-gate-hs-consent-field" data-field="consent" hidden>
          <label class="qs-gate-hs-consent">
            <input type="checkbox" id="qs-gate-hs-consent" name="consent">
            <span class="qs-gate-hs-consent-box" aria-hidden="true"></span>
            <span class="qs-gate-hs-consent-text">${CONSENT_TEXT}<span class="qs-gate-hs-req">*</span></span>
          </label>
          <span class="qs-gate-hs-error" aria-live="polite"></span>
        </div>

        <div class="qs-gate-hs-actions">
          <button type="button" class="qs-gate-hs-submit">Submit</button>
        </div>
      </div>

      <p class="qs-gate-hs-msg" role="status" aria-live="polite"></p>
    </div>`;

  const root = mount.querySelector('.qs-gate-hs');
  const els = {
    firstname: root.querySelector('#qs-gate-hs-firstname'),
    lastname: root.querySelector('#qs-gate-hs-lastname'),
    email: root.querySelector('#qs-gate-hs-email'),
    country: root.querySelector('#qs-gate-hs-country'),
    consent: root.querySelector('#qs-gate-hs-consent'),
  };
  const consentField = root.querySelector('.qs-gate-hs-consent-field');
  const button = root.querySelector('.qs-gate-hs-submit');
  const msg = root.querySelector('.qs-gate-hs-msg');

  // ---- consent visibility ---------------------------------------------------
  // Default: always shown, always required. With data-consent-countries set,
  // it appears only for those countries (§4 Italy / France behaviour).
  const consentApplies = () => !consentCountries.length
    || consentCountries.indexOf(els.country.value) !== -1;

  const syncConsentVisibility = () => {
    const show = consentApplies();
    consentField.hidden = !show;
    if (!show) {
      els.consent.checked = false;
      setError('consent', '');
    }
  };
  consentField.hidden = false;
  syncConsentVisibility();
  els.country.addEventListener('change', syncConsentVisibility);

  // ---- validation -----------------------------------------------------------
  // Function declaration, not a const — syncConsentVisibility() above runs
  // before this point in source order and must be able to call it.
  function setError(name, text) {
    const wrap = root.querySelector(`[data-field="${name}"]`);
    if (!wrap) return;
    wrap.classList.toggle('is-error', !!text);
    const slot = wrap.querySelector('.qs-gate-hs-error');
    if (slot) slot.textContent = text || '';
  }

  const clearOnEdit = (name) => {
    const el = els[name];
    if (!el) return;
    ['input', 'change'].forEach((evt) => el.addEventListener(evt, () => setError(name, '')));
  };
  Object.keys(els).forEach(clearOnEdit);

  const validate = () => {
    const values = {
      firstname: els.firstname.value.trim(),
      lastname: els.lastname.value.trim(),
      email: els.email.value.trim(),
      country: els.country.value,
      consent: els.consent.checked,
    };
    let ok = true;

    if (!values.firstname) { setError('firstname', 'Please enter your name.'); ok = false; }
    else if (!NAME_RE.test(values.firstname)) { setError('firstname', 'Letters only, please.'); ok = false; }

    if (!values.lastname) { setError('lastname', 'Please enter your surname.'); ok = false; }
    else if (!NAME_RE.test(values.lastname)) { setError('lastname', 'Letters only, please.'); ok = false; }

    if (!values.email) { setError('email', 'Please enter your email address.'); ok = false; }
    else if (!EMAIL_RE.test(values.email)) { setError('email', 'Please enter a valid email address.'); ok = false; }
    else if (requireWorkEmail && FREE_DOMAINS.indexOf(values.email.split('@')[1].toLowerCase()) !== -1) {
      setError('email', 'Please use your work email address.'); ok = false;
    }

    if (!values.country) { setError('country', 'Please select your country.'); ok = false; }

    if (consentApplies() && !values.consent) {
      setError('consent', 'Please tick the box to continue.'); ok = false;
    }

    return ok ? values : null;
  };

  // ---- unlock ---------------------------------------------------------------
  // Hand control back to gate.js via the signal it already listens for.
  // `form.dispatchEvent(new Event('submit'))` fires the event WITHOUT submitting.
  const unlock = () => {
    if (unlocked) return;
    unlocked = true;
    releaseExtraDownloads();
    const dummy = document.createElement('form');
    dummy.setAttribute('qs-gate-unlock', '');
    dummy.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none;';
    document.body.appendChild(dummy);
    dummy.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    dummy.remove();
    log('unlock dispatched');
  };

  // ---- extra download blocking (staging only, additive to gate.js) ----------
  const getExtraDownloads = () => Array.from(document.querySelectorAll(EXTRA_DOWNLOAD_SELECTOR));
  const blockExtraClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    gate.style.display = '';
    gate.style.visibility = 'visible';
    gate.style.opacity = '1';
    gate.dataset.qsGateVisible = 'true';
    gate.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const holdExtraDownloads = () => {
    getExtraDownloads().forEach((link) => {
      link.addEventListener('click', blockExtraClick, { capture: true });
      link.style.opacity = '0.4';
      link.style.pointerEvents = 'auto';
      link.style.cursor = 'not-allowed';
      if (link.tagName === 'A') {
        link.setAttribute('target', '_blank'); // autocapture needs the click before navigation
        link.setAttribute('rel', 'noopener');
      }
    });
  };
  function releaseExtraDownloads() {
    getExtraDownloads().forEach((link) => {
      link.removeEventListener('click', blockExtraClick, { capture: true });
      link.style.opacity = '';
      link.style.cursor = '';
    });
  }
  holdExtraDownloads();

  // ---- payload --------------------------------------------------------------
  const getCookie = (name) => {
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : null;
  };

  const resolveReportName = () => {
    const attr = mount.getAttribute('data-report-name');
    if (attr && attr.trim() && attr.indexOf('{{') === -1) return attr.trim();
    const heading = document.querySelector('.content-insight h1, h1');
    if (heading && heading.textContent.trim()) return heading.textContent.trim();
    return (document.title || '').split('|')[0].trim();
  };

  const buildPayload = (values) => {
    const fields = [
      { objectTypeId: '0-1', name: 'firstname', value: values.firstname },
      { objectTypeId: '0-1', name: 'lastname', value: values.lastname },
      { objectTypeId: '0-1', name: 'email', value: values.email },
      { objectTypeId: '0-1', name: 'country', value: values.country },
    ];

    const utms = getStoredUtms();
    UTM_KEYS.forEach((key) => {
      if (utms[key]) fields.push({ objectTypeId: '0-1', name: key, value: utms[key] });
    });

    const report = resolveReportName();
    if (report) fields.push({ objectTypeId: '0-1', name: REPORT_FIELD, value: report });

    const payload = {
      fields,
      context: {
        pageUri: window.location.href,
        pageName: document.title,
      },
      legalConsentOptions: {
        consent: {
          consentToProcess: true,
          text: PROCESS_TEXT,
        },
      },
    };

    // Only link this submission to a browsing history when the visitor's
    // analytics consent left the cookie in place.
    const hutk = getCookie('hubspotutk');
    if (hutk) payload.context.hutk = hutk;

    if (subscriptionTypeId && consentApplies()) {
      payload.legalConsentOptions.consent.communications = [{
        value: !!values.consent,
        subscriptionTypeId,
        text: CONSENT_TEXT,
      }];
    }

    return payload;
  };

  // ---- submit ---------------------------------------------------------------
  const submit = () => {
    if (submitting || unlocked) return;
    msg.textContent = '';
    msg.className = 'qs-gate-hs-msg';

    const values = validate();
    if (!values) {
      msg.textContent = 'Please complete the highlighted fields.';
      msg.className = 'qs-gate-hs-msg is-error';
      const firstError = root.querySelector('.is-error .qs-form-field-gate, .is-error input');
      if (firstError) firstError.focus();
      return;
    }

    submitting = true;
    button.disabled = true;
    button.textContent = 'Submitting…';

    const payload = buildPayload(values);
    log('payload', payload);
    log('hutk attached?', !!payload.context.hutk);

    // §2: unlock first. The report never waits on HubSpot.
    unlock();

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
      .then((res) => res.json().then((data) => ({ ok: res.ok, status: res.status, data })))
      .then((result) => {
        if (!result.ok) {
          console.warn('[QS] HubSpot softgate submission rejected', result.status, result.data);
          log('error response', result.data);
          return;
        }
        log('submitted OK', result.data);
      })
      .catch((err) => {
        console.warn('[QS] HubSpot softgate submission failed', err);
      })
      .finally(() => {
        submitting = false;
        button.disabled = false;
        button.textContent = 'Submit';
      });
  };

  button.addEventListener('click', submit);

  // Enter-key submit. Deliberately NOT a <form>: gate.js listens for `submit`
  // in the capture phase, so a real form would unlock the gate before
  // validation ever ran.
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      e.preventDefault();
      submit();
    }
  });

  log('ready', { endpoint, subscriptionTypeId, requireWorkEmail, consentCountries });
}