/**
 * Pins a vertical element (e.g. a filters column) while its parent scrolls —
 * desktop only (>=991px), via gsap.matchMedia so it auto-reverts on mobile.
 * Hooks: [scroll="vertical-pin"] (pinned element) inside [trigger="vertical-pin"]
 * (defines the scroll distance). Idempotent — safe to call more than once.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/all";
import { getIOSOptimizedConfig } from "../../config/nativescroll.js";

gsap.registerPlugin(ScrollTrigger);

export function functionScrollPinVertical() {
  // Use responsive setup so it initializes only on >=991px and cleans up on resize
  // Make it idempotent in case this initializer is called multiple times
  if (functionScrollPinVertical._mm) {
    functionScrollPinVertical._mm.revert();
  }
  const mm = (functionScrollPinVertical._mm = gsap.matchMedia());

  mm.add("(min-width: 991px)", () => {
    const targets = document.querySelectorAll('[scroll="vertical-pin"]');
    if (targets.length === 0) return; // Guard against empty NodeList

    targets.forEach((target) => {
      const parentTrigger = target.closest('[trigger="vertical-pin"]');
      if (!parentTrigger) return;
      const distance = parentTrigger.offsetHeight - target.offsetHeight;
      gsap.to(target, {
        scrollTrigger: getIOSOptimizedConfig({
          trigger: target,
          start: "top 32px",
          end: `+=${distance}`,
          scrub: true,
          pin: true,
        }),
      });
    });

    // Anything created in this scope will be reverted automatically
    // when the media query stops matching (i.e., width < 991px)
  });
}