/**
 * Filter Scroll — Desktop UX enhancement for .qs-filter-wrapper
 *
 * - Filter panel scrolls independently from page
 * - Scroll hands back to page at logical top/bottom
 * - Dynamic height based on CURRENT accordion state
 * - Prevents stale scrollHeight from creating blank scroll space
 * - Scrollbar hidden by default, thin on hover
 * - GSAP-aware
 * - Desktop only (>= 992px)
 */

export function functionFilterScroll() {
  // Desktop only
  if (window.innerWidth < 992) return;

  function initFilterScroll() {
    const wrappers = document.querySelectorAll('.qs-filter-wrapper');
    if (!wrappers.length) return;

    /*
     * Store the REAL scroll range ourselves.
     *
     * We intentionally do NOT rely on wrapper.scrollHeight because
     * Webflow accordion collapsed content can leave stale scrollable
     * overflow in the browser's scroll model.
     */
    const logicalMaxScroll = new WeakMap();

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
        background: rgba(0, 0, 0, 0.15);
        border-radius: 4px;
      }

      .qs-filter-wrapper:hover::-webkit-scrollbar-track {
        background: transparent;
      }
    `;

    document.head.appendChild(style);

    function setDynamicHeight(wrapper) {
      /*
       * Stop any previous GSAP scroll tween.
       *
       * Otherwise a tween created before an accordion collapsed could
       * continue trying to scroll toward the OLD scroll position.
       */
      if (window.gsap) {
        window.gsap.killTweensOf(wrapper);
      }

      const inner = wrapper.querySelector(
        '.qs-form-container, form, .qs-form-wrapper'
      );

      /*
       * Temporarily FORCE scrolling off.
       *
       * setProperty(..., 'important') is required because our injected
       * overflow-y:auto rule also uses !important.
       */
      wrapper.style.setProperty('overflow-y', 'hidden', 'important');

      /*
       * Remove previous calculated size so the wrapper/inner can settle
       * into the accordion's CURRENT DOM state.
       */
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';

      // Force browser layout reconciliation.
      void wrapper.offsetHeight;

      /*
       * IMPORTANT:
       * offsetHeight represents the currently visible accordion state.
       * Do not use scrollHeight here.
       */
      const naturalHeight = inner
        ? inner.offsetHeight
        : wrapper.offsetHeight;

      const rect = wrapper.getBoundingClientRect();

      const viewportAvailable = Math.max(
        window.innerHeight - rect.top - 40,
        200
      );

      /*
       * Wrapper either:
       *
       * 1. hugs content when everything fits
       * 2. caps at available viewport height when content is taller
       */
      const targetHeight = Math.min(
        naturalHeight,
        viewportAvailable
      );

      wrapper.style.height = `${targetHeight}px`;
      wrapper.style.maxHeight = `${targetHeight}px`;

      /*
       * Calculate OUR real scrolling boundary from the visible content,
       * instead of trusting wrapper.scrollHeight.
       */
      const realMaxScroll = Math.max(
        naturalHeight - targetHeight,
        0
      );

      logicalMaxScroll.set(wrapper, realMaxScroll);

      /*
       * If an accordion closes while the filter was scrolled farther down,
       * immediately pull scrollTop back inside the new valid range.
       *
       * This removes the blank space below the final visible option.
       */
      if (wrapper.scrollTop > realMaxScroll) {
        wrapper.scrollTop = realMaxScroll;
      }

      // Force another layout reconciliation before restoring scrolling.
      void wrapper.offsetHeight;

      wrapper.style.setProperty('overflow-y', 'auto', 'important');
    }

    wrappers.forEach(wrapper => {
      setDynamicHeight(wrapper);

      /*
       * Accordion heads.
       *
       * Accordion transition is 0s, but double rAF allows Webflow/Finsweet
       * state classes and layout to finish updating before measurement.
       */
      const heads = wrapper.querySelectorAll(
        '.qs-accordion-head-filters, .qs-accordion-button-expertise'
      );

      heads.forEach(head => {
        head.addEventListener('click', () => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              setDynamicHeight(wrapper);
            });
          });
        });
      });

      /*
       * Safety clamp.
       *
       * This also catches scrollbar dragging / browser-native scrolling.
       * Even if the browser temporarily reports stale scrollHeight,
       * the user cannot enter the phantom blank-scroll region.
       */
      wrapper.addEventListener('scroll', () => {
        const maxScroll = logicalMaxScroll.get(wrapper) ?? 0;

        if (wrapper.scrollTop > maxScroll) {
          wrapper.scrollTop = maxScroll;
        }

        if (wrapper.scrollTop < 0) {
          wrapper.scrollTop = 0;
        }
      });

      wrapper.addEventListener(
        'wheel',
        function (e) {
          /*
           * NEVER use:
           *
           * wrapper.scrollHeight - wrapper.clientHeight
           *
           * because scrollHeight is exactly the stale value causing
           * the phantom blank scrolling.
           */
          const maxScroll = logicalMaxScroll.get(wrapper) ?? 0;

          // Nothing inside needs scrolling.
          if (maxScroll <= 0) return;

          const atTop = wrapper.scrollTop <= 0;
          const atBottom = wrapper.scrollTop >= maxScroll - 1;

          const goingUp = e.deltaY < 0;
          const goingDown = e.deltaY > 0;

          /*
           * At filter boundary → give scrolling back to the page.
           */
          if (
            (atTop && goingUp) ||
            (atBottom && goingDown)
          ) {
            return;
          }

          e.preventDefault();
          e.stopPropagation();

          const targetScroll = Math.min(
            Math.max(wrapper.scrollTop + e.deltaY, 0),
            maxScroll
          );

          if (window.gsap) {
            window.gsap.to(wrapper, {
              scrollTop: targetScroll,
              duration: 0.25,
              ease: 'power2.out',
              overwrite: 'auto'
            });
          } else {
            wrapper.scrollTop = targetScroll;
          }
        },
        { passive: false }
      );
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth < 992) return;

      wrappers.forEach(wrapper => {
        setDynamicHeight(wrapper);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initFilterScroll
    );
  } else {
    initFilterScroll();
  }
}