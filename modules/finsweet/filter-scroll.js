/**
 * Filter Scroll — Desktop UX enhancement for .qs-filter-wrapper
 *
 * Architecture notes:
 *
 * GSAP ScrollSmoother (normalizeScroll: true) intercepts ALL wheel events at
 * the browser level. The only reliable interception point is a document-level
 * listener at CAPTURE phase with { passive: false }.
 *
 * tua-body-scroll-lock loads async — poll for it and whitelist each wrapper.
 *
 * Height is calculated by summing .qs-form-wrapper direct children offsetHeights
 * + flex gap. Hidden accordion groups (display:none, e.g. from hide-zero-filters.js)
 * naturally contribute 0 and are excluded automatically.
 *
 * TWO-PHASE CONFIDENCE MODEL (replaces all fixed-timeout guessing):
 *
 *   Phase 1 "unconfident" — applied immediately on load. Height = natural
 *   content height, NO viewport cap, NO internal scroll. This is always safe:
 *   there is no ceiling to crop against, so nothing can ever be cut off.
 *
 *   Phase 2 "confident" — entered once rect.top has been verified stable
 *   across consecutive animation frames (layout has settled), OR the wrapper
 *   is confirmed visible during a scroll event. Only then do we trust rect.top
 *   enough to compute a tight viewport cap and enable internal scroll.
 *
 * A MutationObserver watches the wrapper's own subtree (descendants only,
 * never the wrapper itself) for class/style changes — this catches both
 * accordion open/close AND hide-zero-filters.js hiding groups, in one place.
 *
 * Desktop only (>= 992px). Works across all .qs-filter-wrapper instances.
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
     * Hidden groups (display:none, from hide-zero-filters.js or a collapsed
     * accordion) contribute offsetHeight:0 automatically — no special-casing
     * needed, this always reflects the CURRENT visible content only.
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

    /**
     * Phase 1 — unconfident: height = natural content, no cap, no scroll.
     * Always safe. Never crops. This is the state a wrapper starts in and
     * stays in until we've verified its real viewport position.
     */
    function applyUnconfidentHeight(wrapper) {
      wrapper.style.setProperty('overflow-y', 'hidden', 'important');
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';
      void wrapper.offsetHeight;

      const naturalHeight = getNaturalHeight(wrapper);

      wrapper.style.height = `${naturalHeight}px`;
      wrapper.style.maxHeight = 'none';
      void wrapper.offsetHeight;
      wrapper.style.setProperty('overflow-y', 'auto', 'important');

      if (window.bodyScrollLock?.lock) window.bodyScrollLock.lock(wrapper);
    }

    /**
     * Phase 2 — confident: rect.top is trusted. Cap to available viewport
     * space and enable internal scroll if content exceeds it.
     * Floor is min(naturalHeight, 250) — never crops below a sane closed-
     * accordion minimum, never forces more height than content actually has.
     */
    function applyConfidentHeight(wrapper) {
      wrapper.style.setProperty('overflow-y', 'hidden', 'important');
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';
      void wrapper.offsetHeight;

      const naturalHeight = getNaturalHeight(wrapper);
      const rect = wrapper.getBoundingClientRect();
      const topOffset = Math.max(rect.top, 0);
      const floor = Math.min(naturalHeight, 250);
      const viewportAvailable = Math.max(window.innerHeight - topOffset - 40, floor);
      const targetHeight = Math.min(naturalHeight, viewportAvailable);
      const maxScroll = Math.max(naturalHeight - targetHeight, 0);

      if (wrapper.scrollTop > maxScroll) wrapper.scrollTop = maxScroll;

      wrapper.style.height = `${targetHeight}px`;
      wrapper.style.maxHeight = `${targetHeight}px`;
      void wrapper.offsetHeight;
      wrapper.style.setProperty('overflow-y', 'auto', 'important');

      if (window.bodyScrollLock?.lock) window.bodyScrollLock.lock(wrapper);
    }

    function recalc(wrapper) {
      if (wrapper._filterScrollConfident) {
        applyConfidentHeight(wrapper);
      } else {
        applyUnconfidentHeight(wrapper);
      }
    }

    /**
     * Verify rect.top has settled (layout stable across 3 consecutive
     * animation frames) rather than trusting a fixed timeout. Replaces
     * all previous magic-number delays.
     */
    function waitForStableRect(wrapper, onStable, maxFrames = 60) {
      let lastTop = null;
      let stableCount = 0;
      let frame = 0;

      function check() {
        if (wrapper._filterScrollConfident) return; // already confirmed via scroll
        frame++;
        const top = wrapper.getBoundingClientRect().top;
        if (lastTop !== null && Math.abs(top - lastTop) < 0.5) {
          stableCount++;
        } else {
          stableCount = 0;
        }
        lastTop = top;

        if (stableCount >= 3 || frame >= maxFrames) {
          onStable();
          return;
        }
        requestAnimationFrame(check);
      }
      requestAnimationFrame(check);
    }

    function confirmConfident(wrapper) {
      if (wrapper._filterScrollConfident) return;
      wrapper._filterScrollConfident = true;
      applyConfidentHeight(wrapper);
    }

    // ── BSL polling ───────────────────────────────────────────────────────────

    function waitForBSL(wrapper, attempts = 0) {
      if (window.bodyScrollLock?.lock) {
        window.bodyScrollLock.lock(wrapper);
        return;
      }
      if (attempts > 30) return;
      setTimeout(() => waitForBSL(wrapper, attempts + 1), 100);
    }

    // ── Document-level capture wheel handler ──────────────────────────────────
    // Pointer being over the wrapper while wheeling guarantees it's on-screen,
    // so rect.top here is always trustworthy — no fallback needed.

    const wheelHandler = (e) => {
      let activeWrapper = null;
      for (const wrapper of wrappers) {
        const rect = wrapper.getBoundingClientRect();
        if (
          e.clientX >= rect.left && e.clientX <= rect.right &&
          e.clientY >= rect.top  && e.clientY <= rect.bottom
        ) {
          activeWrapper = wrapper;
          break;
        }
      }
      if (!activeWrapper) return;

      // Being scrolled over confirms visibility — upgrade confidence
      confirmConfident(activeWrapper);

      const wrapper = activeWrapper;
      const naturalHeight = getNaturalHeight(wrapper);
      const rect = wrapper.getBoundingClientRect();
      const floor = Math.min(naturalHeight, 250);
      const viewportAvailable = Math.max(window.innerHeight - rect.top - 40, floor);
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
    };

    document.addEventListener('wheel', wheelHandler, { passive: false, capture: true });

    // ── Per-wrapper setup ─────────────────────────────────────────────────────

    wrappers.forEach(wrapper => {
      wrapper._filterScrollConfident = false;

      waitForBSL(wrapper);

      // Phase 1 immediately — always safe, never crops
      applyUnconfidentHeight(wrapper);

      // Upgrade to Phase 2 once layout genuinely settles
      waitForStableRect(wrapper, () => confirmConfident(wrapper));

      // Accordion click — recalc at current confidence level
      const heads = wrapper.querySelectorAll(
        '.qs-accordion-head-filters, .qs-accordion-button-expertise'
      );
      heads.forEach(head => {
        head.addEventListener('click', () => {
          setTimeout(() => recalc(wrapper), 200);
        });
      });

      // Filter form changes
      const form = wrapper.querySelector('form[fs-list-element="filters"]');
      if (form) {
        form.addEventListener('change', () => setTimeout(() => recalc(wrapper), 150));
        form.addEventListener('input',  () => setTimeout(() => recalc(wrapper), 150));
      }

      // Watch the wrapper's OWN subtree for class/style changes on
      // descendants — catches accordion open/close AND hide-zero-filters.js
      // hiding groups (adds "hide-filter" class + display:none), both of
      // which change what getNaturalHeight() should sum.
      // Ignore mutations on the wrapper itself — those are our own writes.
      const selfObserver = new MutationObserver((mutations) => {
        const relevant = mutations.some(m => m.target !== wrapper);
        if (!relevant) return;
        clearTimeout(wrapper._filterScrollMutationTimer);
        wrapper._filterScrollMutationTimer = setTimeout(() => recalc(wrapper), 150);
      });
      selfObserver.observe(wrapper, {
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style'],
      });
    });

    // ── Scroll-based confidence upgrade ───────────────────────────────────────
    // For wrappers not yet confident (e.g. starting off-screen), confirm once
    // they scroll into view. Self-removing once all wrappers are confident.

    const scrollConfirm = () => {
      let allConfident = true;
      wrappers.forEach(wrapper => {
        if (wrapper._filterScrollConfident) return;
        const rect = wrapper.getBoundingClientRect();
        if (rect.top >= 0 && rect.top < window.innerHeight) {
          confirmConfident(wrapper);
        } else {
          allConfident = false;
        }
      });
      if (allConfident) window.removeEventListener('scroll', scrollConfirm);
    };
    window.addEventListener('scroll', scrollConfirm, { passive: true });

    window.addEventListener('resize', () => {
      if (window.innerWidth < 992) return;
      wrappers.forEach(recalc);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilterScroll);
  } else {
    initFilterScroll();
  }
}