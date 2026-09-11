/**
 * limitless-people.js — Custom CMS Load for the limitless-collection-wrapper component.
 *
 * Replaces Finsweet CMS Load for this specific component.
 * Targets the collection by class name, making it immune to DOM order
 * and other collection lists on the page (e.g. conference header lists).
 *
 * Hook: .limitless-collection-wrapper (on the Collection List Wrapper element)
 * Requires: Webflow native pagination ON, Limit items via component property.
 */

export function functionLimitlessPeople() {
  const wrapper = document.querySelector('.limitless-collection-wrapper');
  if (!wrapper) return;

  const itemsContainer = wrapper.querySelector('.w-dyn-items');
  const pagination = wrapper.querySelector('.w-pagination-wrapper');
  const nextButton = pagination?.querySelector('.w-pagination-next');
  const previousButton = pagination?.querySelector('.w-pagination-previous');
  const pageCount = pagination?.querySelector('.w-page-count');

  if (!itemsContainer || !pagination || !nextButton) return;

  // Hide previous button — load more pattern only moves forward
  if (previousButton) {
    previousButton.style.display = 'none';
  }

  let nextUrl = nextButton.href;
  let loading = false;

  nextButton.addEventListener('click', async (event) => {
    event.preventDefault();

    if (!nextUrl || loading) return;

    loading = true;
    nextButton.style.pointerEvents = 'none';
    nextButton.setAttribute('aria-busy', 'true');

    try {
      const response = await fetch(nextUrl);

      if (!response.ok) {
        throw new Error(`Failed to load CMS page: ${response.status}`);
      }

      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      // Target our collection specifically by class — immune to DOM order
      const remoteWrapper = doc.querySelector('.limitless-collection-wrapper');
      const remoteItemsContainer = remoteWrapper?.querySelector('.w-dyn-items');

      if (!remoteItemsContainer) {
        throw new Error('Remote limitless collection could not be found.');
      }

      // Append new items to current list
      Array.from(remoteItemsContainer.children)
        .filter(item => item.classList.contains('w-dyn-item'))
        .forEach(item => {
          itemsContainer.appendChild(document.adoptNode(item));
        });

      // Get next page URL from the remote collection's pagination
      const remoteNext = remoteWrapper.querySelector('.w-pagination-next');
      nextUrl = remoteNext && remoteNext.getAttribute('aria-hidden') !== 'true'
        ? remoteNext.href
        : null;

      // Update page count display if present
      const remotePageCount = remoteWrapper.querySelector('.w-page-count');
      if (pageCount && remotePageCount) {
        pageCount.textContent = remotePageCount.textContent;
      }

      // Hide button when no more pages remain
      if (!nextUrl) {
        nextButton.style.display = 'none';
      }

    } catch (error) {
      console.warn('[QS] Limitless People load failed:', error);
    } finally {
      loading = false;
      nextButton.style.pointerEvents = '';
      nextButton.removeAttribute('aria-busy');
    }
  });
}