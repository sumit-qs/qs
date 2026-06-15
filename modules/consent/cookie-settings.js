/**
 * Cookie Policy Page — Wire "Cookie Settings" button to Finsweet Consent Pro
 * preferences panel.
 *
 * The Cookie Policy page lives at /terms-and-conditions/cookie-policy inside
 * the Legals CMS template. The button is rendered via a CMS Rich Text embed
 * and has no ID or class (Webflow strips them from embed fields), so we target
 * the only <button> on the page and guard by its text content.
 *
 * Finsweet Consent Pro mounts inside a Shadow DOM on a plain <div> with no
 * class or ID, so a standard querySelector won't reach the preferences button
 * — we walk all shadow roots to find it.
 *
 * Hook: only activates on pathname === '/terms-and-conditions/cookie-policy'
 * so it is completely inert on every other Legals template page.
 */

export function functionCookieSettingsButton() {
  if (window.location.pathname !== '/terms-and-conditions/cookie-policy') return;

  const cookieBtn = document.querySelector('button');
  if (!cookieBtn || cookieBtn.textContent.trim() !== 'Cookie Settings') return;

  cookieBtn.addEventListener('click', function () {
    // Walk all shadow roots to find Finsweet's open-preferences button
    const allEls = document.querySelectorAll('*');
    for (let i = 0; i < allEls.length; i++) {
      if (allEls[i].shadowRoot) {
        const fsBtn = allEls[i].shadowRoot.querySelector('[fs-consent-element="open-preferences"]');
        if (fsBtn) {
          fsBtn.click();
          return;
        }
      }
    }
    console.warn('[QS] Finsweet preferences button not found in any shadow root');
  });
}
