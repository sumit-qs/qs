export function initHubspotPopup() {
  document.querySelectorAll('[qs-hubspot-popup]').forEach((el) => {
    const popupCode = el.getAttribute('qs-hubspot-popup');
    if (!popupCode) return;

    el.classList.add('hs-cta-trigger-button');
    el.classList.add(`hs-cta-trigger-button-${popupCode}`);
  });
}