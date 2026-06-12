/**
 * Re-orders a Finsweet / Webflow list so "Upcoming" items appear first.
 *
 * Works on the webinars list ([fs-list-element="list"]), the bento-grid variant
 * (.qs-grid-bento[role="list"]) and the draggable "Recommended" list. An item's
 * status is read from its badge (.label-change / .qs-badge-wrapper > .label).
 * Because Finsweet re-renders asynchronously, this polls briefly on init and then
 * uses a MutationObserver to re-apply the order whenever Finsweet moves items.
 */
function reorderList(list) {
  const items = [...list.querySelectorAll(':scope > [role="listitem"]')];
  if (!items.length) return false;

  const upcoming = [];
  const rest = [];

  items.forEach((item) => {
    const badge = item.querySelector('.label-change') || item.querySelector('.qs-badge-wrapper > .label');
    const status = badge ? badge.textContent.trim().toLowerCase() : '';
    if (status === 'upcoming') {
      upcoming.push(item);
    } else {
      rest.push(item);
    }
  });

  if (!upcoming.length) return true;

  upcoming.reverse();
  upcoming.forEach((item) => list.appendChild(item));
  rest.forEach((item) => list.appendChild(item));
  return true;
}

// After initial ordering, watch a list and re-apply order whenever Finsweet moves items.
// Disconnect before reordering to prevent our own appends from re-triggering the observer.
function watchAndReorder(list) {
  const mo = new MutationObserver(() => {
    mo.disconnect();
    reorderList(list);
    mo.observe(list, { childList: true });
  });
  mo.observe(list, { childList: true });
}

export function functionOrdering() {
  const settled = new WeakSet(); // tracks lists already reordered and watched
  let attempts = 0;

  function reorder() {
    attempts++;

    // Main filtered list (webinars page)
    const mainList = document.querySelector('[fs-list-element="list"]');
    // Bento grid variant (no fs-list-element attribute)
    const bentoList = document.querySelector('.qs-grid-bento[role="list"]');
    // Draggable "Recommended for you" list
    const draggableList = document.querySelector('[drag="dynamic"] [role="list"]');

    if (!mainList && !bentoList && !draggableList) return false;

    let allSettled = true;

    [mainList, bentoList, draggableList].forEach((list) => {
      if (!list || settled.has(list)) return;
      allSettled = false;
      if (reorderList(list)) {
        settled.add(list);
        watchAndReorder(list);
      }
    });

    // Stop the interval only when every found list has been settled
    return allSettled;
  }

  const interval = setInterval(() => {
    if (reorder() || attempts > 40) clearInterval(interval);
  }, 300);
}
