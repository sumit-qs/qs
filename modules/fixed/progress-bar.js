/**
 * Pins the article overlay header while its wrapper scrolls past.
 * Hooks: .qs-progress-wrapper (scroll region) containing
 * .qs-article-overlay-wrapper (the element pinned from top→top until bottom→top).
 * Pinned inside #smooth-content so it co-operates with ScrollSmoother.
 * Exported as functionStickyProgress (alias) — that's the name scripts.js imports.
 *
 * Scoped reveal (combo class "is-article"):
 * By default the overlay is visible in its normal in-flow position before the
 * pin kicks in (unchanged — every existing page keeps this behaviour). Add the
 * "is-article" combo class to .qs-article-overlay-wrapper to opt a page into a
 * different treatment: the overlay stays hidden in its default/unpinned spot
 * and only animates into view the moment it starts sticking (the same
 * ScrollTrigger "top top" point that starts the pin) — mirroring the
 * fromTo/autoAlpha/yPercent reveal pattern used by the sign-up bar
 * (modules/fixed/bar.js) and the insights gate (modules/interactive/gate.js).
 * It hides again the same way if the reader scrolls back up above the article.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { myEase } from "../../config/variables.js";

gsap.registerPlugin(ScrollTrigger);

export function functionFixedProgressBar() {
  const wrappers = document.querySelectorAll(".qs-progress-wrapper");
  wrappers.forEach((wrapper) => {
    const overlay = wrapper.querySelector(".qs-article-overlay-wrapper");
    if (!overlay) return;
    const pinnedContainerEl = overlay.closest('#smooth-content') || undefined;

    // Opt-in scoping: only pages/components with this combo class get the
    // hide-until-sticky treatment. Everywhere else behaves exactly as before.
    const isArticleScoped = overlay.classList.contains('is-article');

    let revealed = false;

    const revealOverlay = () => {
      if (revealed) return;
      revealed = true;
      gsap.killTweensOf(overlay);
      gsap.to(overlay, { duration: 0.5, autoAlpha: 1, yPercent: 0, ease: myEase });
    };
    const hideOverlay = (instant) => {
      if (!revealed && !instant) return;
      revealed = false;
      gsap.killTweensOf(overlay);
      if (instant) {
        gsap.set(overlay, { autoAlpha: 0, yPercent: -100 });
      } else {
        gsap.to(overlay, { duration: 0.4, autoAlpha: 0, yPercent: -100, ease: myEase });
      }
    };

    if (isArticleScoped) {
      // Start hidden, tucked just above its own box, same recipe the sign-up
      // bar / gate use for their entrance state.
      hideOverlay(true);
    }

    const scrollTriggerConfig = {
      trigger: wrapper,
      start: "top top",
      end: "bottom top",
      pin: overlay,
      pinSpacing: false,
      anticipatePin: 1,
      pinReparent: true,
      pinnedContainer: pinnedContainerEl
    };

    if (isArticleScoped) {
      scrollTriggerConfig.onEnter = revealOverlay;
      scrollTriggerConfig.onEnterBack = revealOverlay;
      scrollTriggerConfig.onLeaveBack = () => hideOverlay(false);
    }

    const st = ScrollTrigger.create(scrollTriggerConfig);

    // Page can already be scrolled into the pinned range on load (deep link,
    // refresh mid-article) — reveal immediately rather than waiting for the
    // next onEnter, same safeguard sticky-appear.js uses for its panel.
    if (isArticleScoped && st.isActive) {
      revealOverlay();
    }
  });
}

// Alias to keep scripts.js import working
export function functionStickyProgress() {
  return functionFixedProgressBar();
}