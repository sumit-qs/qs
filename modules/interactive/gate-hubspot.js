import { ScrollTrigger } from "gsap/all";
import { getStoredUtms, UTM_KEYS } from "../hubspot/utm-capture.js";

// HubSpot softgate — staging layer for the HubSpot-form softgate.
//
// Scope: acts ONLY on  .qs-gate.is-hubspot  — on any other page / gate it
// silently no-ops. It does NOT replace gate.js: gate.js still owns showing and
// hiding the gate, the 1200px scroll trigger, download blocking, localStorage
// and the cross-tab sync, exactly as it does on live. This module only:
//
//   - renders the native HubSpot form into [qs-hsform="gate"] inside the gate;
//   - injects UTM values + the report name into the form's hidden fields;
//   - tells gate.js to unlock, by dispatching a real `submit` event from a
//     hidden dummy form — the same signal gate.js already listens for.
//
// Why the dummy form: the HubSpot embed submits over XHR (and may render inside
// an iframe), so no native `submit` event ever reaches this document and
// gate.js's delegated listener would never fire. Dispatching one from a real
// in-document <form> hits gate.js's existing handler untouched. Note that
// `form.dispatchEvent(new Event('submit'))` fires the event WITHOUT submitting
// anything — nothing navigates, nothing is posted.
//
// Unlock timing: fired on `onFormSubmit` — after client-side validation, BEFORE
// the POST — so the reader never waits on HubSpot and a failed HubSpot call can
// never withhold the report (Periti spec §2, IMPORTANT).
//
// Webflow hooks:
//   gate   -> .qs-gate  + combo class .is-hubspot
//   mount  -> a plain div inside the gate, where the Webflow form used to sit:
//             <div qs-hsform="gate"
//                  data-portal-id="26055784"
//                  data-form-id="a71677bf-99e6-4af3-86b0-e8b990d45ad2"
//                  data-region="eu1"
//                  data-report-name="{{ CMS Name }}"></div>
//             Every data-* is optional and falls back to the constants below /
//             the article <h1> / document.title.
//   extra download buttons (optional) -> any element with [qs-gate-download].
//             gate.js already blocks `.qs-fixed-button` captioned exactly
//             "Download" and links in `.qs-article-downlaod-wrapper`; this
//             attribute blocks anything else on the staging page whose label
//             doesn't match that exact string (e.g. "Download now").
export function functionHubspotGate() {
  const GATE_SELECTOR = '.qs-gate.is-hubspot';
  const MOUNT_SELECTOR = '[qs-hsform="gate"]';
  const EXTRA_DOWNLOAD_SELECTOR = '[qs-gate-download]';
  const EMBED_SRC = '//js-eu1.hsforms.net/forms/embed/v2.js';
  const REPORT_FIELD = 'softgate_report'; // rename if Periti finalise a different internal name

  const DEFAULTS = {
    portalId: '26055784',
    formId: 'a71677bf-99e6-4af3-86b0-e8b990d45ad2',
    region: 'eu1',
  };

  const gate = document.querySelector(GATE_SELECTOR);
  if (!gate) return;
  if (gate.dataset.qsHubspotGateBound === 'true') return; // never bind twice
  const mount = gate.querySelector(MOUNT_SELECTOR);
  if (!mount) {
    console.warn('[QS] .qs-gate.is-hubspot found but no [qs-hsform="gate"] mount inside it');
    return;
  }
  gate.dataset.qsHubspotGateBound = 'true';

  const portalId = mount.getAttribute('data-portal-id') || DEFAULTS.portalId;
  const formId = mount.getAttribute('data-form-id') || DEFAULTS.formId;
  const region = mount.getAttribute('data-region') || DEFAULTS.region;
  if (!mount.id) mount.id = 'qs-hsform-gate';

  let unlocked = false;

  // ---- unlock ---------------------------------------------------------------
  // Hand control straight back to gate.js via the signal it already handles.
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
  };

  // ---- extra download blocking (staging only, additive to gate.js) ----------
  const getExtraDownloads = () => Array.from(document.querySelectorAll(EXTRA_DOWNLOAD_SELECTOR));

  const blockExtraClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Mirror gate.js's blockClick: force the gate open and scroll it into view.
    gate.style.display = '';
    gate.dataset.qsGateVisible = 'true';
    gate.style.visibility = 'visible';
    gate.style.opacity = '1';
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

  const releaseExtraDownloads = () => {
    getExtraDownloads().forEach((link) => {
      link.removeEventListener('click', blockExtraClick, { capture: true });
      link.style.opacity = '';
      link.style.cursor = '';
    });
  };

  // ---- hidden field injection ----------------------------------------------
  // HubSpot inputs are React-controlled: a plain `input.value = x` is discarded
  // on the next render, so use the native setter + input/change events.
  // `ownerDocument` keeps this working when the form renders inside an iframe.
  const setFieldValue = (input, value) => {
    if (!input || value == null || value === '') return;
    try {
      const view = input.ownerDocument.defaultView || window;
      const proto = input.tagName === 'TEXTAREA'
        ? view.HTMLTextAreaElement.prototype
        : view.HTMLInputElement.prototype;
      Object.getOwnPropertyDescriptor(proto, 'value').set.call(input, value);
    } catch (_) {
      input.value = value;
    }
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const toFormElement = (maybeForm) => {
    if (!maybeForm) return null;
    if (maybeForm.nodeType === 1) return maybeForm;
    if (maybeForm[0] && maybeForm[0].nodeType === 1) return maybeForm[0];
    return null;
  };

  const resolveReportName = () => {
    const attr = mount.getAttribute('data-report-name');
    if (attr && attr.trim() && attr.indexOf('{{') === -1) return attr.trim();
    const heading = document.querySelector('.content-insight h1, h1');
    if (heading && heading.textContent.trim()) return heading.textContent.trim();
    return (document.title || '').split('|')[0].trim();
  };

  const populateHiddenFields = (formEl) => {
    if (!formEl) return;
    const utms = getStoredUtms();
    UTM_KEYS.forEach((key) => {
      setFieldValue(formEl.querySelector(`input[name="${key}"]`), utms[key]);
    });
    setFieldValue(formEl.querySelector(`input[name="${REPORT_FIELD}"]`), resolveReportName());
  };

  // ---- embed ----------------------------------------------------------------
  const loadEmbedScript = () => {
    if (window.hbspt && window.hbspt.forms) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const existing = document.querySelector(`script[src="${EMBED_SRC}"]`);
      if (existing) {
        existing.addEventListener('load', resolve);
        existing.addEventListener('error', reject);
        if (window.hbspt && window.hbspt.forms) resolve();
        return;
      }
      const script = document.createElement('script');
      script.src = EMBED_SRC;
      script.charset = 'utf-8';
      script.type = 'text/javascript';
      script.addEventListener('load', resolve);
      script.addEventListener('error', reject);
      document.head.appendChild(script);
    });
  };

  // Fallback for the iframe case: HubSpot posts its form events to window.
  window.addEventListener('message', (event) => {
    const d = event && event.data;
    if (!d || d.type !== 'hsFormCallback') return;
    if (d.eventName === 'onFormSubmit' || d.eventName === 'onFormSubmitted') unlock();
  });

  holdExtraDownloads();

  loadEmbedScript()
    .then(() => {
      window.hbspt.forms.create({
        portalId,
        formId,
        region,
        target: `#${mount.id}`,

        onFormReady(form) {
          populateHiddenFields(toFormElement(form));
          try { ScrollTrigger.refresh(); } catch (_) { /* noop */ }
        },

        onFormSubmit() { unlock(); },   // validated, not yet POSTed — unlock now
        onFormSubmitted() { unlock(); } // belt and braces
      });
    })
    .catch(() => {
      console.warn('[QS] HubSpot forms embed failed to load — gate form not rendered');
    });
}