/**
 * Filter Scroll — Desktop UX enhancement for .qs-filter-wrapper
 *
 * Intercepts wheel events over the left filter panel so the filter list
 * scrolls independently from the page. Once the filter list hits its
 * top or bottom boundary, scroll control passes back to the page.
 *
 * - Measures true visible height by summing .qs-form-wrapper direct
 *   children offsetHeights + flex gap — avoids stale scrollHeight cache
 * - Dynamic height: hugs content when collapsed, caps at viewport when expanded
 * - Scrollbar hidden by default, thin 4px bar appears on hover
 * - Click listeners on accordion heads recalculate height after open/close
 * - logicalMaxScroll WeakMap drives scroll boundary — never trusts
 *   wrapper.scrollHeight which can be stale after accordion collapse
 * - GSAP-aware: uses gsap.to(wrapper, {scrollTop}) when GSAP is present
 *   so it stays in sync with ScrollTrigger.normalizeScroll on Safari
 * - Desktop only: no-ops below 992px (Webflow tablet breakpoint)
 * - Works across all .qs-filter-wrapper instances on the page
 */

export function functionFilterScroll() {
  if (window.innerWidth < 992) return;

  function initFilterScroll() {
    const wrappers = document.querySelectorAll('.qs-filter-wrapper');
    if (!wrappers.length) return;

    // Stores the real scroll boundary per wrapper — never use scrollHeight
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
      // .qs-form-wrapper is flex column — sum children + gaps
      const formWrapper = wrapper.querySelector('.qs-form-wrapper');
      if (formWrapper) {
        const children = [...formWrapper.children];
        const gap = getFlexGap(formWrapper);
        const sumHeights = children.reduce((acc, el) => acc + el.offsetHeight, 0);
        const totalGaps = Math.max(children.length - 1, 0) * gap;
        return sumHeights + totalGaps;
      }
      // Fallback for other filter wrapper structures
      const inner = wrapper.querySelector('.qs-form-container, form');
      return inner ? inner.offsetHeight : wrapper.offsetHeight;
    }

    function setDynamicHeight(wrapper) {
      if (window.gsap) window.gsap.killTweensOf(wrapper);

      // Temporarily disable overflow so layout can reflow freely
      wrapper.style.setProperty('overflow-y', 'hidden', 'important');
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';

      // Force layout flush
      void wrapper.offsetHeight;

      const naturalHeight = getNaturalHeight(wrapper);
      const rect = wrapper.getBoundingClientRect();
      const viewportAvailable = Math.max(window.innerHeight - rect.top - 40, 200);
      const targetHeight = Math.min(naturalHeight, viewportAvailable);
      const realMaxScroll = Math.max(naturalHeight - targetHeight, 0);

      logicalMaxScroll.set(wrapper, realMaxScroll);

      // Clamp scrollTop if it now exceeds the real boundary
      if (wrapper.scrollTop > realMaxScroll) {
        wrapper.scrollTop = realMaxScroll;
      }

      wrapper.style.height = `${targetHeight}px`;
      wrapper.style.maxHeight = `${targetHeight}px`;

      // Force another flush before restoring scroll
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

      // Safety clamp on native scroll (scrollbar drag etc.)
      wrapper.addEventListener('scroll', () => {
        const maxScroll = logicalMaxScroll.get(wrapper) ?? 0;
        if (wrapper.scrollTop > maxScroll) wrapper.scrollTop = maxScroll;
        if (wrapper.scrollTop < 0) wrapper.scrollTop = 0;
      });

      wrapper.addEventListener('wheel', function (e) {
        // Always use logicalMaxScroll — never wrapper.scrollHeight
        const maxScroll = logicalMaxScroll.get(wrapper) ?? 0;
        if (maxScroll <= 0) return;

        const atTop    = wrapper.scrollTop <= 0;
        const atBottom = wrapper.scrollTop >= maxScroll - 1;
        const goingUp  = e.deltaY < 0;
        const goingDown = e.deltaY > 0;

        if ((atTop && goingUp) || (atBottom && goingDown)) return;

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
      }, { passive: false });
    });

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