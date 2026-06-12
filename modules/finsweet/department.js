/**
 * De-duplicates repeated department options in a Finsweet filter dropdown.
 * Hooks: .qs-department-option — keeps the first of each (case-insensitive) label
 * and removes the rest. Re-runs via a MutationObserver as Finsweet populates the
 * list.
 */
export function functionFinsweetDepartment() {
  const init = () => {
    const CLASS = '.qs-department-option'; // each option element
    const DEDUPE = () => {
      const seen = new Set();
      document.querySelectorAll(CLASS).forEach((el) => {
        const key = (el.textContent || '').trim().toLowerCase();
        if (key && seen.has(key)) {
          el.remove();
        } else if (key) {
          seen.add(key);
        }
      });
    };

    // run once on init
    DEDUPE();

    // re-run when Finsweet/Webflow updates the list
    const obs = new MutationObserver(() => DEDUPE());
    obs.observe(document.body, { childList: true, subtree: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}