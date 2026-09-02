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
 * excluded automatically — no special-casing needed.
 *
 * A MutationObserver watches each wrapper's own subtree (descendants only,
 * never the wrapper itself — that would just be reacting to our own writes)
 * for class/style changes. This catches accordion open/close AND
 * hide-zero-filters.js hiding groups asynchronously after Finsweet's list
 * settles, so the wrapper always recalculates against current visible content.
 *
 * NOTE: tua-body-scroll-lock is intentionally NOT used here. Scrolling is
 * fully handled by the wheel handler below via direct wrapper.scrollTop
 * writes — bodyScrollLock.lock() is unnecessary for that, and calling it
 * repeatedly sets overflow:hidden on <body>/<html>, which suppresses the
 * page's native scrollbar site-wide on every page using this filter.
 *
 * Desktop only (>= 992px).
 * Works across all .qs-filter-wrapper instances on the page.
 */

export function functionFilterScroll() {
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

    /**
     * Sum direct children of .qs-form-wrapper + flex gap.
     * Uses offsetHeight (visible rendered height) — NOT scrollHeight, which
     * includes hidden accordion overflow and caches stale expanded values.
     * A hidden group (display:none) contributes 0 automatically.
     */
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
      // Temporarily disable overflow so layout can reflow freely.
      // Must use setProperty('important') because our injected CSS uses !important.
      wrapper.style.setProperty('overflow-y', 'hidden', 'important');
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';

      // Force layout flush before measuring
      void wrapper.offsetHeight;

      const naturalHeight = getNaturalHeight(wrapper);
      const rect = wrapper.getBoundingClientRect();

      // Use rect.top when it reflects a settled pinned position.
      // Fall back to 120px safety offset if rect.top is unreliable (pre-pin).
      const topOffset = (rect.top > 0 && rect.top < window.innerHeight)
        ? rect.top
        : 120;
      const viewportAvailable = Math.max(window.innerHeight - topOffset - 40, 200);
      const targetHeight = Math.min(naturalHeight, viewportAvailable);
      const maxScroll = Math.max(naturalHeight - targetHeight, 0);

      // Clamp scroll position before restoring overflow
      if (wrapper.scrollTop > maxScroll) wrapper.scrollTop = maxScroll;

      wrapper.style.height = `${targetHeight}px`;
      wrapper.style.maxHeight = `${targetHeight}px`;

      // Force second layout flush before restoring scroll
      void wrapper.offsetHeight;
      wrapper.style.setProperty('overflow-y', 'auto', 'important');
    }

    // ── Document-level capture wheel handler ──────────────────────────────────
    // MUST be on document at capture phase.
    // ScrollSmoother (normalizeScroll:true) intercepts wheel events before they
    // reach element-level listeners. Capture phase fires before ScrollSmoother
    // processes the event, allowing us to preventDefault and handle it ourselves.

    const wheelHandler = (e) => {
      wrappers.forEach(wrapper => {
        const rect = wrapper.getBoundingClientRect();

        // Check if pointer is over this wrapper
        const over =
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom;
        if (!over) return;

        // Calculate real scroll boundary from current DOM state
        const naturalHeight = getNaturalHeight(wrapper);
        const topOffset = (rect.top > 0 && rect.top < window.innerHeight)
          ? rect.top
          : 120;
        const viewportAvailable = Math.max(window.innerHeight - topOffset - 40, 200);
        const targetHeight = Math.min(naturalHeight, viewportAvailable);
        const maxScroll = Math.max(naturalHeight - targetHeight, 0);

        // No overflow → let page scroll
        if (maxScroll <= 0) return;

        const atTop    = wrapper.scrollTop <= 0;
        const atBottom = wrapper.scrollTop >= maxScroll - 1;
        const goingUp  = e.deltaY < 0;
        const goingDown = e.deltaY > 0;

        // At boundary → hand back to page scroll
        if ((atTop && goingUp) || (atBottom && goingDown)) return;

        // Consume event and scroll filter wrapper
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
      // Init height after layout settles (GSAP pin needs time to activate)
      setTimeout(() => setDynamicHeight(wrapper), 300);

      // Accordion click — Finsweet JS expands accordion asynchronously.
      // 200ms is sufficient for DOM to settle after a 0s CSS transition.
      const heads = wrapper.querySelectorAll(
        '.qs-accordion-head-filters, .qs-accordion-button-expertise'
      );
      heads.forEach(head => {
        head.addEventListener('click', () => {
          setTimeout(() => setDynamicHeight(wrapper), 200);
        });
      });

      // Watch this wrapper's own subtree for class/style changes on
      // DESCENDANTS (never the wrapper itself — that would just react to
      // our own setDynamicHeight writes). This catches:
      //   - accordion groups opening/closing
      //   - hide-zero-filters.js adding a "hide-filter" class + display:none
      //     to groups with zero results, asynchronously after Finsweet's
      //     list settles — the root cause of the "meet the team" height
      //     including groups that get hidden a moment later.
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

    // ── Global recalculation ──────────────────────────────────────────────────

    // Recalculate once on first scroll — GSAP pin fully active by then,
    // so rect.top gives the true pinned position for viewportAvailable
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