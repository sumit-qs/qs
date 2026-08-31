/**
 * Filter Scroll — Desktop UX enhancement for .qs-filter-wrapper
 *
 * Intercepts wheel events over the left filter panel so the filter list
 * scrolls independently from the page. Once the filter list hits its
 * top or bottom boundary, scroll control passes back to the page.
 *
 * - Dynamic height: hugs content when collapsed, caps at viewport when expanded
 * - Scrollbar hidden by default, thin 4px bar appears on hover
 * - Click listeners on accordion heads recalculate height after open/close
 * - Forces layout reflow before measuring to flush stale scrollbar geometry
 * - Clamps scrollTop when height shrinks
 * - GSAP-aware: uses gsap.to(wrapper, { scrollTop }) when GSAP is present
 * - Desktop only: no-ops below 992px
 * - Works across all .qs-filter-wrapper instances
 */

export function functionFilterScroll() {
  // Desktop only
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
        background: rgba(0, 0, 0, 0.15);
        border-radius: 4px;
      }

      .qs-filter-wrapper:hover::-webkit-scrollbar-track {
        background: transparent;
      }
    `;

    document.head.appendChild(style);

    function setDynamicHeight(wrapper) {
      const inner = wrapper.querySelector(
        '.qs-form-container, form, .qs-form-wrapper'
      );

      /*
       * 1. Fully disable wrapper scrolling while recalculating.
       *
       * Important:
       * The injected stylesheet uses overflow-y: auto !important,
       * so we need !important here as well.
       */
      wrapper.style.setProperty(
        'overflow-y',
        'hidden',
        'important'
      );

      wrapper.style.transition = 'none';
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';

      /*
       * 2. Force browser layout flush.
       *
       * This makes sure the accordion's current opened/closed state
       * has actually been committed before we measure it.
       */
      void wrapper.offsetHeight;

      /*
       * 3. Measure CURRENT visible filter height.
       *
       * offsetHeight is intentional here.
       * Do NOT use scrollHeight for naturalHeight.
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
       * Wrapper hugs content when content fits.
       *
       * If content exceeds viewport, wrapper is capped
       * to the available viewport height.
       */
      const newHeight = Math.min(
        naturalHeight,
        viewportAvailable
      );

      /*
       * 4. Calculate the real valid scroll distance
       * from CURRENT visible content.
       */
      const realMaxScroll = Math.max(
        naturalHeight - newHeight,
        0
      );

      /*
       * If accordion collapse makes the content shorter,
       * make sure we don't remain scrolled into old blank space.
       */
      if (wrapper.scrollTop > realMaxScroll) {
        wrapper.scrollTop = realMaxScroll;
      }

      /*
       * 5. Temporarily collapse the scroll viewport.
       *
       * This forces the browser to discard the previous
       * native scrollbar geometry / expanded-state calculation.
       */
      wrapper.style.height = '0px';
      wrapper.style.maxHeight = '0px';

      void wrapper.offsetHeight;

      /*
       * 6. Apply the newly calculated CURRENT height.
       */
      wrapper.style.height = `${newHeight}px`;
      wrapper.style.maxHeight = `${newHeight}px`;

      /*
       * Force another layout pass while overflow is still disabled.
       */
      void wrapper.offsetHeight;

      /*
       * 7. Restore native scrolling only after dimensions settle.
       */
      wrapper.style.setProperty(
        'overflow-y',
        'auto',
        'important'
      );
    }

    wrappers.forEach(wrapper => {
      /*
       * Initial calculation
       */
      setDynamicHeight(wrapper);

      /*
       * Accordion heads
       *
       * Accordion transition is 0s, therefore double rAF
       * allows the DOM/layout to settle before measurement.
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
       * Independent filter scrolling
       */
      wrapper.addEventListener(
        'wheel',
        function (e) {
          const maxScroll =
            wrapper.scrollHeight - wrapper.clientHeight;

          /*
           * Filter doesn't need internal scrolling.
           * Let page consume the wheel event.
           */
          if (maxScroll <= 0) return;

          const atTop =
            wrapper.scrollTop <= 0;

          const atBottom =
            wrapper.scrollTop >= maxScroll - 1;

          const goingUp =
            e.deltaY < 0;

          const goingDown =
            e.deltaY > 0;

          /*
           * Once filter reaches its scrolling boundary,
           * return scrolling control to the page.
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
            Math.max(
              wrapper.scrollTop + e.deltaY,
              0
            ),
            maxScroll
          );

          /*
           * GSAP scrolling keeps this compatible with
           * ScrollTrigger.normalizeScroll() on Safari/iOS.
           */
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

    /*
     * Recalculate height on viewport resize.
     */
    window.addEventListener('resize', () => {
      if (window.innerWidth < 992) return;

      wrappers.forEach(wrapper => {
        setDynamicHeight(wrapper);
      });
    });
  }

  /*
   * Initialise safely depending on page load state.
   */
  if (document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      initFilterScroll
    );
  } else {
    initFilterScroll();
  }
}