/**
 * Filter Scroll — Desktop UX enhancement for .qs-filter-wrapper
 *
 * Intercepts wheel events over the left filter panel so the filter list
 * scrolls independently from the page. Once the filter list hits its
 * top or bottom boundary, scroll control passes back to the page.
 *
 * - Measures true visible height by summing .qs-form-wrapper direct
 *   children offsetHeights + flex gap — fixes scrollbar track length
 * - Wheel boundary uses wrapper.scrollHeight which is reliable for
 *   scroll range even when inflated, since height is capped correctly
 * - Dynamic height: hugs content when collapsed, caps at viewport when expanded
 * - Recalculates on first scroll (GSAP pin not active at init)
 * - Scrollbar hidden by default, thin 4px bar appears on hover
 * - Click listeners on accordion heads recalculate height after open/close
 * - GSAP-aware: uses gsap.to(wrapper, {scrollTop}) when GSAP is present
 * - Desktop only: no-ops below 992px (Webflow tablet breakpoint)
 * - Works across all .qs-filter-wrapper instances on the page
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
      // Sum direct children of .qs-form-wrapper + flex gaps
      // This gives true visible height regardless of accordion state
      // Do NOT use .qs-form-wrapper offsetHeight — it includes
      // overflow from collapsed accordion content
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
      if (window.gsap) window.gsap.killTweensOf(wrapper);

      wrapper.style.setProperty('overflow-y', 'hidden', 'important');
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';

      // Force layout flush before measuring
      void wrapper.offsetHeight;

      const naturalHeight = getNaturalHeight(wrapper);
      const rect = wrapper.getBoundingClientRect();

      // Cap rect.top — before GSAP pin activates rect.top can be
      // large and cause underestimation of available space
      const topOffset = Math.min(rect.top, 200);
      const viewportAvailable = Math.max(
        window.innerHeight - topOffset - 40,
        200
      );

      const targetHeight = Math.min(naturalHeight, viewportAvailable);

      // Clamp scrollTop before restoring scroll
      const maxScroll = Math.max(naturalHeight - targetHeight, 0);
      if (wrapper.scrollTop > maxScroll) {
        wrapper.scrollTop = maxScroll;
      }

      wrapper.style.height = `${targetHeight}px`;
      wrapper.style.maxHeight = `${targetHeight}px`;

      void wrapper.offsetHeight;
      wrapper.style.setProperty('overflow-y', 'auto', 'important');
    }

    wrappers.forEach(wrapper => {
      setDynamicHeight(wrapper);

      // Accordion heads — 0s transition, double rAF reads settled DOM
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

      wrapper.addEventListener('wheel', function (e) {
        // Use scrollHeight for wheel boundary — reliable for scroll
        // range even when inflated, because height is capped correctly
        const maxScroll = wrapper.scrollHeight - wrapper.clientHeight;
        if (maxScroll <= 0) return;

        const atTop    = wrapper.scrollTop <= 0;
        const atBottom = wrapper.scrollTop >= maxScroll - 1;
        const goingUp  = e.deltaY < 0;
        const goingDown = e.deltaY > 0;

        if ((atTop && goingUp) || (atBottom && goingDown)) return;

        e.preventDefault();
        e.stopPropagation();

        if (window.gsap) {
          window.gsap.to(wrapper, {
            scrollTop: Math.min(
              Math.max(wrapper.scrollTop + e.deltaY, 0),
              maxScroll
            ),
            duration: 0.25,
            ease: 'power2.out',
            overwrite: 'auto'
          });
        } else {
          wrapper.scrollTop += e.deltaY;
        }
      }, { passive: false });
    });

    // Recalculate once after first scroll
    // GSAP pin is not active at DOMContentLoaded so rect.top
    // is the unpinned position — first scroll settles it correctly
    let recalcOnScroll = true;
    window.addEventListener('scroll', () => {
      if (recalcOnScroll) {
        recalcOnScroll = false;
        wrappers.forEach(setDynamicHeight);
      }
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