/**
 * Filter Scroll — Desktop UX enhancement for .qs-filter-wrapper
 *
 * - Filter panel scrolls independently from page
 * - Scroll hands back to page at top/bottom boundary
 * - Height derived from summing .qs-form-wrapper children + flex gap
 * - maxScroll calculated live on every wheel event — no stale cache
 * - Viewport cap uses 85vh — stable regardless of rect.top timing
 * - Recalculates height on first scroll, accordion click, and resize
 * - Scrollbar hidden by default, thin on hover
 * - GSAP-aware scroll
 * - Desktop only (>= 992px)
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
        const sumHeights = children.reduce(
          (acc, el) => acc + el.offsetHeight, 0
        );
        const totalGaps = Math.max(children.length - 1, 0) * gap;
        return sumHeights + totalGaps;
      }
      const inner = wrapper.querySelector('.qs-form-container, form');
      return inner ? inner.offsetHeight : wrapper.offsetHeight;
    }

    function getMaxScroll(wrapper) {
      const naturalHeight = getNaturalHeight(wrapper);
      const viewportAvailable = Math.max(window.innerHeight * 0.85, 200);
      const targetHeight = Math.min(naturalHeight, viewportAvailable);
      return Math.max(naturalHeight - targetHeight, 0);
    }

    function setDynamicHeight(wrapper) {
      if (window.gsap) window.gsap.killTweensOf(wrapper);

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
    }

    wrappers.forEach(wrapper => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setDynamicHeight(wrapper);
        });
      });

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
        // Calculate live — never read from cache or scrollHeight
        const maxScroll = getMaxScroll(wrapper);
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