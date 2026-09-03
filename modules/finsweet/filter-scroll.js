/**
 * Filter Scroll — Desktop UX enhancement for .qs-filter-wrapper
 *
 * Architecture notes:
 *
 * GSAP ScrollSmoother (normalizeScroll: true) intercepts ALL wheel events at
 * the browser level and routes them to its smooth scroll system. Element-level
 * wheel listeners never fire. The only reliable interception point is a
 * document-level listener at CAPTURE phase with { passive: false }.
 *
 * Height is calculated by summing .qs-form-wrapper direct children offsetHeights
 * + flex gap — avoids stale scrollHeight caused by Webflow accordion collapsed
 * content retaining overflow in the browser scroll model. Hidden accordion
 * groups (display:none, e.g. from hide-zero-filters.js) contribute 0 and are
 * excluded automatically.
 *
 * SCROLLTRIGGER REFRESH ON FILTER CHANGE:
 * The filter sidebar is pinned via GSAP ScrollTrigger (sticky-filters.js).
 * When Finsweet filters results, the content column shrinks but ScrollTrigger's
 * pin-spacer keeps its original height, leaving blank space below filtered results.
 *
 * ScrollTrigger.refresh() fixes this — but ScrollTrigger is fully encapsulated
 * inside the ES module bundle and not accessible from window. It is passed in
 * as a parameter from scripts.js where it IS in scope after registerPlugin().
 *
 * The refresh runs after `transitionend` on the CMS list — the event fired by
 * filters.js GSAP card animations (opacity + transform, 0.36s) which is the
 * exact moment layout has fully settled after a filter change.
 *
 * NOTE: tua-body-scroll-lock is intentionally NOT used. Scrolling is handled
 * by the wheel handler via direct wrapper.scrollTop writes. bodyScrollLock.lock()
 * sets overflow:hidden on <body>/<html>, suppressing the page scrollbar site-wide.
 *
 * @param {object} ScrollTrigger — passed in from scripts.js after registerPlugin
 *
 * Desktop only (>= 992px). Works across all .qs-filter-wrapper instances.
 */

export function functionFilterScroll(ScrollTrigger) {
  if (window.innerWidth < 992) return;

  function initFilterScroll() {
    const wrappers = document.querySelectorAll('.qs-filter-wrapper');
    if (!wrappers.length) return;

    // ── Scrollbar styles ──────────────────────────────────────────────────────
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

    // ── Height helpers ────────────────────────────────────────────────────────

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

    // ── Document-level capture wheel handler ──────────────────────────────────

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

    // ── Per-wrapper setup ─────────────────────────────────────────────────────

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

      // Watch wrapper subtree for class/style changes on descendants.
      // Catches accordion open/close and hide-zero-filters.js mutations.
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

    // ── ScrollTrigger refresh via transitionend ───────────────────────────────
    // filters.js animates filtered cards via GSAP (opacity + transform, 0.36s).
    // transitionend on the list fires once per card when animation completes.
    // We debounce so refresh() runs once after ALL cards have transitioned —
    // at that point layout is fully settled and ScrollTrigger measures correctly,
    // collapsing the blank space left by the stale pin-spacer height.

    const resultsList = document.querySelector('[fs-list-element="list"]');
    if (resultsList && ScrollTrigger) {
      let refreshTimer = null;
      resultsList.addEventListener('transitionend', (e) => {
        if (e.propertyName !== 'opacity' && e.propertyName !== 'transform') return;
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(() => {
          ScrollTrigger.refresh();
        }, 50);
      });
    }

    // ── Global recalculation ──────────────────────────────────────────────────

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