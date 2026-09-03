/**
 * Pins a vertical element (e.g. a filters column) while its parent scrolls —
 * desktop only (>=991px), via gsap.matchMedia so it auto-reverts on mobile.
 * Hooks: [scroll="vertical-pin"] (pinned element) inside [trigger="vertical-pin"]
 * (defines the scroll distance). Idempotent — safe to call more than once.
 *
 * DYNAMIC REFRESH:
 * The pin end value is calculated from parentTrigger.offsetHeight at init.
 * When Finsweet filters results, the content column shrinks but ScrollTrigger
 * keeps the stale end value, leaving blank space. We watch the CMS list for
 * item visibility changes (Finsweet hides items via display:none) and rebuild
 * the ScrollTrigger with fresh measurements once layout has settled.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/all";
import { getIOSOptimizedConfig } from "../../config/nativescroll.js";

gsap.registerPlugin(ScrollTrigger);

export function functionScrollPinVertical() {
  if (functionScrollPinVertical._mm) {
    functionScrollPinVertical._mm.revert();
  }
  const mm = (functionScrollPinVertical._mm = gsap.matchMedia());

  mm.add("(min-width: 991px)", () => {
    const targets = document.querySelectorAll('[scroll="vertical-pin"]');
    if (targets.length === 0) return;

    // Store ScrollTrigger instances per target so we can kill and rebuild them
    const triggers = new Map();

    function buildTrigger(target) {
      const parentTrigger = target.closest('[trigger="vertical-pin"]');
      if (!parentTrigger) return;

      // Kill existing instance before rebuilding
      if (triggers.has(target)) {
        triggers.get(target).kill();
        triggers.delete(target);
      }

      const distance = parentTrigger.offsetHeight - target.offsetHeight;

      const st = gsap.to(target, {
        scrollTrigger: getIOSOptimizedConfig({
          trigger: target,
          start: "top 32px",
          end: `+=${distance}`,
          scrub: true,
          pin: true,
        }),
      });

      // gsap.to returns a tween; the ScrollTrigger is on it
      const stInstance = ScrollTrigger.getById(st?.scrollTrigger?.vars?.id)
        || st?.scrollTrigger
        || ScrollTrigger.getAll().find(s => s.pin === target);

      if (stInstance) triggers.set(target, stInstance);
    }

    targets.forEach(buildTrigger);

    // Watch CMS list for Finsweet filter changes — items get display:none
    // which shrinks the content column. Rebuild the pin with fresh offsetHeight.
    const resultsList = document.querySelector('[fs-list-element="list"]');
    if (resultsList) {
      let rebuildTimer = null;

      const listObserver = new MutationObserver(() => {
        clearTimeout(rebuildTimer);
        // Wait for Finsweet animations to complete (filters.js uses 0.36s GSAP)
        rebuildTimer = setTimeout(() => {
          targets.forEach(buildTrigger);
          ScrollTrigger.refresh();
        }, 500);
      });

      listObserver.observe(resultsList, {
        subtree: true,
        attributes: true,
        attributeFilter: ['style'],
        childList: true,
      });
    }
  });
}