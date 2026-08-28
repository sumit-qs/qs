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
 * - GSAP-aware: uses gsap.to(wrapper, {scrollTop}) when GSAP is present
 *   so it stays in sync with ScrollTrigger.normalizeScroll on Safari
 * - Desktop only: no-ops below 992px (Webflow tablet breakpoint)
 * - Works across all .qs-filter-wrapper instances on the page
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
        background: rgba(0,0,0,0.15);
        border-radius: 4px;
      }
      .qs-filter-wrapper:hover::-webkit-scrollbar-track {
        background: transparent;
      }
    `;
    document.head.appendChild(style);

    function setDynamicHeight(wrapper) {
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';
      wrapper.style.overflow = 'hidden';

      const inner = wrapper.querySelector('.qs-form-container, form, .qs-form-wrapper');
      const naturalHeight = inner ? inner.offsetHeight : wrapper.offsetHeight;
      const rect = wrapper.getBoundingClientRect();
      const viewportAvailable = window.innerHeight - rect.top - 40;

      if (naturalHeight <= viewportAvailable) {
        wrapper.style.height = naturalHeight + 'px';
        wrapper.style.maxHeight = naturalHeight + 'px';
      } else {
        wrapper.style.height = Math.max(viewportAvailable, 200) + 'px';
        wrapper.style.maxHeight = Math.max(viewportAvailable, 200) + 'px';
      }

      wrapper.style.overflow = '';
    }

    wrappers.forEach(wrapper => {
      setDynamicHeight(wrapper);

      // Accordion heads — no CSS transition (0s), so double rAF
      // is sufficient to read the settled post-click DOM state
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
            scrollTop: Math.min(Math.max(wrapper.scrollTop + e.deltaY, 0), maxScroll),
            duration: 0.25,
            ease: 'power2.out',
            overwrite: 'auto'
          });
        } else {
          wrapper.scrollTop += e.deltaY;
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