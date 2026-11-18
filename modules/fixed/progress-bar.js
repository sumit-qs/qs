
/**
 * Article Progress Bar
 *
 * Default:
 * Preserves the original GSAP ScrollTrigger pinning.
 *
 * With .is-article:
 * - Hidden before the sticky range
 * - Reveals when pinning becomes active
 * - Hides when scrolling above the sticky range
 * - Hidden again after leaving the bottom of the range
 *
 * Uses opacity + clip-path instead of yPercent
 * to avoid interfering with GSAP pin transforms.
 */

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function functionFixedProgressBar() {
  const wrappers = document.querySelectorAll(
    ".qs-progress-wrapper"
  );

  wrappers.forEach((wrapper) => {
    const overlay = wrapper.querySelector(
      ".qs-article-overlay-wrapper"
    );

    if (!overlay) return;

    const pinnedContainerEl =
      overlay.closest("#smooth-content") || undefined;

    const isArticle = overlay.classList.contains("is-article");

    // Original behaviour for all non-article instances.
    if (!isArticle) {
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

      return;
    }

    // -----------------------------------------
    // ARTICLE-ONLY REVEAL
    // -----------------------------------------

    let visible = false;

    // Initial hidden state.
    // Do not transform the element being pinned.
    gsap.set(overlay, {
      opacity: 0,
      visibility: "hidden",
      clipPath: "inset(0 0 100% 0)"
    });

    function setVisibility(shouldShow, instant = false) {
      if (visible === shouldShow && !instant) return;

      visible = shouldShow;

      gsap.killTweensOf(overlay);

      if (instant) {
        gsap.set(overlay, {
          opacity: shouldShow ? 1 : 0,
          visibility: shouldShow ? "visible" : "hidden",
          clipPath: shouldShow
            ? "inset(0 0 0% 0)"
            : "inset(0 0 100% 0)"
        });

        return;
      }

      if (shouldShow) {
        gsap.set(overlay, {
          visibility: "visible"
        });

        gsap.to(overlay, {
          opacity: 1,
          clipPath: "inset(0 0 0% 0)",
          duration: 0.45,
          ease: "power2.out",
          overwrite: true
        });
      } else {
        gsap.to(overlay, {
          opacity: 0,
          clipPath: "inset(0 0 100% 0)",
          duration: 0.3,
          ease: "power2.in",
          overwrite: true,
          onComplete: () => {
            if (!visible) {
              gsap.set(overlay, {
                visibility: "hidden"
              });
            }
          }
        });
      }
    }

    function syncVisibility(self, instant = false) {
      setVisibility(self.isActive, instant);
    }

    // -----------------------------------------
    // ORIGINAL PIN + VISIBILITY SYNCHRONIZATION
    // -----------------------------------------

    const trigger = ScrollTrigger.create({
      trigger: wrapper,
      start: "top top",
      end: "bottom top",

      pin: overlay,
      pinSpacing: false,
      anticipatePin: 1,
      pinReparent: true,
      pinnedContainer: pinnedContainerEl,

      // Called when entering or leaving pin range.
      onToggle: (self) => {
        syncVisibility(self);
      },

      // Keeps state synchronized while scrolling.
      onUpdate: (self) => {
        syncVisibility(self);
      },

      // Handles responsive resizing and refreshes.
      onRefresh: (self) => {
        syncVisibility(self, true);
      }
    });

    // Handles initial load, including deep links
    // and restoring a previously scrolled position.
    syncVisibility(trigger, true);
  });
}

// Keep the existing scripts.js import working.
export function functionStickyProgress() {
  return functionFixedProgressBar();
}
