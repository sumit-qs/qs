/**
 * Pins the article overlay header while its wrapper scrolls past.
 * Hooks: .qs-progress-wrapper (scroll region) containing
 * .qs-article-overlay-wrapper (the element pinned from top→top until bottom→top).
 * Pinned inside #smooth-content so it co-operates with ScrollSmoother.
 * Exported as functionStickyProgress (alias) — that's the name scripts.js imports.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function functionFixedProgressBar() {
  const wrappers = document.querySelectorAll(".qs-progress-wrapper");
  wrappers.forEach((wrapper) => {
    const overlay = wrapper.querySelector(".qs-article-overlay-wrapper");
    if (!overlay) return;
    const pinnedContainerEl = overlay.closest('#smooth-content') || undefined;
    ScrollTrigger.create({
      trigger: wrapper,
      start: "top top",
      end: "bottom top",
      pin: overlay,
      pinSpacing: false,
      anticipatePin: 1,
      pinReparent: true,
      pinnedContainer: pinnedContainerEl
    });
  });
}

// Alias to keep scripts.js import working
export function functionStickyProgress() {
  return functionFixedProgressBar();
}
