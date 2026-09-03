/**
 * Filter Scroll — Desktop UX enhancement for .qs-filter-wrapper
 *
 * GSAP ScrollSmoother (normalizeScroll: true) intercepts ALL wheel events.
 * Must use document capture phase. tua-body-scroll-lock NOT used.
 * Height uses offsetHeight sum of .qs-form-wrapper children + flex gap.
 * MutationObserver catches accordion + hide-zero-filters.js mutations.
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
      const rect = wrapper.getBoundingClientRect();
      const topOffset = (rect.top > 0 && rect.top < window.innerHeight)
        ? rect.top
        : 120;
      const viewportAvailable = Math.max(window.innerHeight - topOffset - 40, 200);
      const targetHeight = Math.min(naturalHeight, viewportAvailable);
      const maxScroll = Math.max(naturalHeight - targetHeight, 0);

      if (wrapper.scrollTop > maxScroll) wrapper.scrollTop = maxScroll;

      wrapper.style.height = `${targetHeight}px`;
      wrapper.style.maxHeight = `${targetHeight}px`;
      void wrapper.offsetHeight;
      wrapper.style.setProperty('overflow-y', 'auto', 'important');
    }

    const wheelHandler = (e) => {
      wrappers.forEach(wrapper => {
        const rect = wrapper.getBoundingClientRect();
        const over =
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom;
        if (!over) return;

        const naturalHeight = getNaturalHeight(wrapper);
        const topOffset = (rect.top > 0 && rect.top < window.innerHeight)
          ? rect.top
          : 120;
        const viewportAvailable = Math.max(window.innerHeight - topOffset - 40, 200);
        const targetHeight = Math.min(naturalHeight, viewportAvailable);
        const maxScroll = Math.max(naturalHeight - targetHeight, 0);

        if (maxScroll <= 0) return;

        const atTop    = wrapper.scrollTop <= 0;
        const atBottom = wrapper.scrollTop >= maxScroll - 1;
        const goingUp  = e.deltaY < 0;
        const goingDown = e.deltaY > 0;

        if ((atTop && goingUp) || (atBottom && goingDown)) return;

        e.preventDefault();
        e.stopPropagation();

        wrapper.scrollTop = Math.min(
          Math.max(wrapper.scrollTop + e.deltaY, 0),
          maxScroll
        );
      });
    };

    document.addEventListener('wheel', wheelHandler, { passive: false, capture: true });

    wrappers.forEach(wrapper => {
      setTimeout(() => setDynamicHeight(wrapper), 300);

      const heads = wrapper.querySelectorAll(
        '.qs-accordion-head-filters, .qs-accordion-button-expertise'
      );
      heads.forEach(head => {
        head.addEventListener('click', () => {
          setTimeout(() => setDynamicHeight(wrapper), 200);
        });
      });

      const selfObserver = new MutationObserver((mutations) => {
        const relevant = mutations.some(m => m.target !== wrapper);
        if (!relevant) return;
        clearTimeout(wrapper._filterScrollMutationTimer);
        wrapper._filterScrollMutationTimer = setTimeout(() => {
          setDynamicHeight(wrapper);
        }, 150);
      });
      selfObserver.observe(wrapper, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
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