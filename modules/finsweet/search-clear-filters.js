/**
 * Clears active filters when user focuses the search input.
 * Hooks: input[fs-list-field="*"], [fs-list-element="clear"]
 * Active on: /about-us/meet-the-team
 */
export function functionSearchClearFilters() {
  const searchInput = document.querySelector('input[fs-list-field="*"]');
  const clearEl = document.querySelector('[fs-list-element="clear"]');
  if (!searchInput || !clearEl) return;

  let hasCleared = false;

  searchInput.addEventListener('focus', () => {
    if (hasCleared) return;
    const form = document.querySelector('form[fs-list-element="filters"]');
    if (!form) return;
    const hasActiveFilter = [...form.querySelectorAll('input[type="checkbox"]')].some(el => el.checked);
    if (hasActiveFilter) {
      clearEl.click();
      console.log('[QS Search] Cleared active filters on search focus');
    }
    hasCleared = true;
  });

  const form = document.querySelector('form[fs-list-element="filters"]');
  if (form) {
    form.addEventListener('change', () => {
      const anyChecked = [...form.querySelectorAll('input[type="checkbox"]')].some(el => el.checked);
      if (anyChecked) hasCleared = false;
    });
  }
}