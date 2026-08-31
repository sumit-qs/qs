/**
 * Filter Scroll — Desktop UX enhancement for .qs-filter-wrapper
 *
 * The page uses tua-body-scroll-lock which prevents all wheel/touch scroll
 * on elements not explicitly whitelisted. bodyScrollLock.lock(wrapper)
 * whitelists each filter wrapper, enabling native browser scroll on it.
 *
 * setDynamicHeight sets explicit height = true visible content height
 * (sum of .qs-form-wrapper children + flex gap) so the browser reconciles
 * scrollHeight correctly and the scrollbar track is proportional.
 *
 * Desktop only (>= 992px).
 */

export function functionFilterScroll() {
  if (window.innerWidth < 992) return;

  function initFilterScroll() {
    const wrappers = document.querySelectorAll('.qs-filter-wrapper');
    if (!wrappers.length) return;

    const style = document.createElement('style');
    style.textContent = `
      .qs-filter-wrapper {
        overflow-y: auto !important;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      .qs-filter-wrapper::-webkit-scrollbar {
        width: 0px !important;
        background: transparent !important;
      }
      .qs-filter-wrapper:hover {
        scrollbar-width: thin !important;
      }
      .qs-filter-wrapper:hover::-webkit-scrollbar {
        width: 4px !important;
      }
      .qs-filter-wrapper:hover::-webkit-scrollbar-thumb {
        background: rgba(0,0,0,0.15);
        border-radius: 4px;
      }
      .qs-filter-wrapper:hover::-webkit-scrollbar-track {
        background: transparent;
      }
    `;
    document.head.appendChild(style);

    function getFlexGap(el) {
      const gap = parseFloat(getComputedStyle(el).gap || '0');
      return isNaN(gap) ? 0 : gap;
    }

    function getNaturalHeight(wrapper) {
      const formWrapper = wrapper.querySelector('.qs-form-wrapper');
      if (formWrapper) {
        const children = [...formWrapper.children];
        const gap = getFlexGap(formWrapper);
        const sumHeights = children.reduce((acc, el) => acc + el.offsetHeight, 0);
        const totalGaps = Math.max(children.length - 1, 0) * gap;
        return sumHeights + totalGaps;
      }
      const inner = wrapper.querySelector('.qs-form-container, form');
      return inner ? inner.offsetHeight : wrapper.offsetHeight;
    }

    function setDynamicHeight(wrapper) {
      wrapper.style.setProperty('overflow-y', 'hidden', 'important');
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';
      void wrapper.offsetHeight;

      const naturalHeight = getNaturalHeight(wrapper);
      const viewportAvailable = Math.max(window.innerHeight * 0.85, 200);
      const targetHeight = Math.min(naturalHeight, viewportAvailable);
      const maxScroll = Math.max(naturalHeight - targetHeight, 0);

      if (wrapper.scrollTop > maxScroll) {
        wrapper.scrollTop = maxScroll;
      }

      wrapper.style.height = `${targetHeight}px`;
      wrapper.style.maxHeight = `${targetHeight}px`;
      void wrapper.offsetHeight;
      wrapper.style.setProperty('overflow-y', 'auto', 'important');

      // Re-whitelist after overflow change
      if (window.bodyScrollLock?.lock) {
        window.bodyScrollLock.lock(wrapper);
      }
    }

    wrappers.forEach(wrapper => {
      // Whitelist wrapper with tua-body-scroll-lock
      // Without this, the scroll lock library prevents all scroll on this element
      if (window.bodyScrollLock?.lock) {
        window.bodyScrollLock.lock(wrapper);
      }

      setTimeout(() => setDynamicHeight(wrapper), 300);

      const heads = wrapper.querySelectorAll(
        '.qs-accordion-head-filters, .qs-accordion-button-expertise'
      );
      heads.forEach(head => {
        head.addEventListener('click', () => {
          setTimeout(() => setDynamicHeight(wrapper), 200);
        });
      });
    });

    let recalcDone = false;
    window.addEventListener('scroll', () => {
      if (recalcDone) return;
      recalcDone = true;
      wrappers.forEach(setDynamicHeight);
    }, { passive: true });

    window.addEventListener('resize', () => {
      if (window.innerWidth < 992) return;
      wrappers.forEach(setDynamicHeight);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilterScroll);
  } else {
    initFilterScroll();
  }
}