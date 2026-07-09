/**
 * Hides filter options with a facet count of 0.
 * Hooks: [fs-list-element="facet-count"], .qs-department-option
 * Active on: any page with fs-list filters (solutions, etc.)
 */
export function functionHideZeroFilters() {
  function hideZero() {
    document.querySelectorAll('[fs-list-element="facet-count"]').forEach(el => {
      const count = el.textContent.trim();
      const listItem = el.closest('.qs-department-option');
      if (!listItem) return;
      listItem.style.display = count === '0' ? 'none' : '';
    });
  }

  // Run after FS renders
  setTimeout(hideZero, 800);

  // Re-run when list updates (filter changes update counts)
  const list = document.querySelector('[fs-list-element="list"]');
  if (list) {
    new MutationObserver(hideZero).observe(list, { childList: true, subtree: true, attributes: true });
  }
}