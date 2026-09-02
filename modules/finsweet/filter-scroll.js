/**
 * Filter Scroll — Desktop UX enhancement for .qs-filter-wrapper
 *
 * GSAP ScrollSmoother (normalizeScroll: true) intercepts ALL wheel events.
 * Must use document capture phase to intercept before ScrollSmoother.
 * tua-body-scroll-lock loads async — poll for it.
 * Height uses offsetHeight sum of .qs-form-wrapper children + flex gap.
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

    /**
     * Calculate viewportAvailable using rect.top ONLY when the wrapper
     * is actually visible in the viewport (pinned state).
     * When rect.top is outside [0, innerHeight], the filter is off-screen
     * and we cannot trust it for height calculations — skip the update.
     */
    function setDynamicHeight(wrapper, forceUpdate = false) {
      const rect = wrapper.getBoundingClientRect();
      const inViewport = rect.top >= 0 && rect.top < window.innerHeight;

      // Only update height when wrapper is in viewport (pinned),
      // or when explicitly forced (e.g. accordion click, filter change).
      if (!inViewport && !forceUpdate) return;

      wrapper.style.setProperty('overflow-y', 'hidden', 'important');
      wrapper.style.height = 'auto';
      wrapper.style.maxHeight = 'none';
      void wrapper.offsetHeight;

      const naturalHeight = getNaturalHeight(wrapper);

      // Use actual rect.top when pinned, safe fallback otherwise
      const topOffset = inViewport ? rect.top : 120;
      const viewportAvailable = Math.max(window.innerHeight - topOffset - 40, 200);
      const targetHeight = Math.min(naturalHeight, viewportAvailable);
      const maxScroll = Math.max(naturalHeight - targetHeight, 0);

      if (wrapper.scrollTop > maxScroll) wrapper.scrollTop = maxScroll;

      wrapper.style.height = `${targetHeight}px`;
      wrapper.style.maxHeight = `${targetHeight}px`;
      void wrapper.offsetHeight;
      wrapper.style.setProperty('overflow-y', 'auto', 'important');

      if (window.bodyScrollLock?.lock) {
        window.bodyScrollLock.lock(wrapper);
      }
    }

    function waitForBSL(wrapper, attempts = 0) {
      if (window.bodyScrollLock?.lock) {
        window.bodyScrollLock.lock(wrapper);
        return;
      }
      if (attempts > 30) return;
      setTimeout(() => waitForBSL(wrapper, attempts + 1), 100);
    }

    // ── Wheel handler ─────────────────────────────────────────────────────────

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

      const wrapper = activeWrapper;
      const rect = wrapper.getBoundingClientRect();
      const naturalHeight = getNaturalHeight(wrapper);
      const topOffset = (rect.top >= 0 && rect.top < window.innerHeight) ? rect.top : 120;
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
    };

    document.addEventListener('wheel', wheelHandler, { passive: false, capture: true });

    // ── Per-wrapper setup ─────────────────────────────────────────────────────

    wrappers.forEach(wrapper => {
      waitForBSL(wrapper);

      // Initial height — forced since wrapper may not be in viewport yet.
      // Uses fallback topOffset (120) until scroll positions it correctly.
      setTimeout(() => setDynamicHeight(wrapper, true), 300);

      // Accordion clicks — force update regardless of viewport position
      const heads = wrapper.querySelectorAll(
        '.qs-accordion-head-filters, .qs-accordion-button-expertise'
      );
      heads.forEach(head => {
        head.addEventListener('click', () => {
          setTimeout(() => setDynamicHeight(wrapper, true), 200);
        });
      });

      // Filter form changes (e.g. meet-the-team default selection hides items)
      const form = wrapper.querySelector('form[fs-list-element="filters"]');
      if (form) {
        form.addEventListener('change', () => {
          setTimeout(() => setDynamicHeight(wrapper, true), 200);
        });
        form.addEventListener('input', () => {
          setTimeout(() => setDynamicHeight(wrapper, true), 200);
        });

        // Watch CMS list for Finsweet show/hide changes (display:none on items)
        const list = document.querySelector('[fs-list-element="list"]');
        if (list) {
          const filterObserver = new MutationObserver(() => {
            clearTimeout(wrapper._filterObserverTimer);
            wrapper._filterObserverTimer = setTimeout(() => {
              setDynamicHeight(wrapper, true);
            }, 150);
          });
          filterObserver.observe(list, {
            subtree: true,
            attributes: true,
            attributeFilter: ['style'],
          });
        }
      }
    });

    // ── Scroll listener: recalculate while filter scrolls into position ───────
    // Runs on every scroll until all wrappers have been updated while in-viewport.
    // This handles the case where setDynamicHeight(force) at init uses the
    // fallback topOffset (120) because the wrapper isn't pinned yet.
    // Once the user scrolls the filter into view, we get the real rect.top.

    const updatedWrappers = new WeakSet();

    const scrollHandler = () => {
      let allUpdated = true;
      wrappers.forEach(wrapper => {
        if (updatedWrappers.has(wrapper)) return;
        const rect = wrapper.getBoundingClientRect();
        const inViewport = rect.top >= 0 && rect.top < window.innerHeight;
        if (inViewport) {
          setDynamicHeight(wrapper, true);
          updatedWrappers.add(wrapper);
        } else {
          allUpdated = false;
        }
      });
      // Remove listener once all wrappers have been updated in-viewport
      if (allUpdated) {
        window.removeEventListener('scroll', scrollHandler);
      }
    };

    window.addEventListener('scroll', scrollHandler, { passive: true });

    window.addEventListener('resize', () => {
      if (window.innerWidth < 992) return;
      wrappers.forEach(w => setDynamicHeight(w, true));
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initFilterScroll);
  } else {
    initFilterScroll();
  }
}