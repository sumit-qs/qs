/**
 * Animation + UX layer on top of a Finsweet CMS Filter list.
 *
 * Finsweet does the actual filtering; this module adds the polish:
 *   - fades/staggers cards out and back in as the visible set changes
 *     (watched via a MutationObserver on each item's inline `display` style),
 *   - smoothly scrolls back up to the .qs-section on user filter changes
 *     (skips the initial programmatic change on the team pages listed inside),
 *   - guarantees that clearing / deselecting all filters shows every item again.
 * Hooks: form[fs-list-element="filters"], [fs-list-element="list"], list items
 * with [role="listitem"], and the card wrappers inside them.
 */
import { gsap } from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { myEase } from "../../config/variables.js";
gsap.registerPlugin(ScrollToPlugin);

export function functionFinsweetFilters() {
  const init = () => {
    const form = document.querySelector('form[fs-list-element="filters"]');
    const list = document.querySelector('[fs-list-element="list"]');
    if (!form || !list) return;

    // Pages where we want to SKIP the first auto-scroll caused by programmatic filter changes
    const noInitialScrollPaths = [
      "/about-us/meet-the-team-qs-new",
      "/about-us/meet-the-team"
    ];

    const isNoInitialScrollPage = noInitialScrollPaths.some((path) =>
      window.location.pathname.startsWith(path)
    );

    let hasSkippedInitialScroll = false;

    const listItems = () => Array.from(list.querySelectorAll('[role="listitem"]'));
    const isVisible = (el) => el && el.offsetParent !== null;
    const cardOf = (li) =>
      li.querySelector(
        ".qs-conference-wrapper, .qs-people-card-wrapper, .qs-card-asset-wrapper, .qs-career-wrapper"
      ) || li;

    const cleanup = (targets) => {
      targets.forEach((el) => {
        el.style.removeProperty("opacity");
        el.style.removeProperty("transform");
        el.style.removeProperty("transition");
      });
    };

    const inAnim = (lis) => {
      const cards = lis.map(cardOf);
      if (!cards.length) return;
      cleanup(cards);
      if (window.gsap) {
        gsap.killTweensOf(cards);
        gsap.fromTo(
          cards,
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.4,
            ease: myEase,
            stagger: { each: 0.04, amount: 0.25 }
          }
        );
      } else {
        cards.forEach((el, i) => {
          el.style.opacity = 0;
          el.style.transform = "translateY(20px)";
          setTimeout(() => {
            el.style.transition = "opacity .36s ease, transform .36s ease";
            el.style.opacity = 1;
            el.style.transform = "translateY(0)";
          }, i * 35);
        });
      }
    };

    const outAnim = (lis) => {
      const cards = lis.map(cardOf);
      if (!cards.length) return;
      if (window.gsap) {
        gsap.killTweensOf(cards);
        gsap.to(cards, { opacity: 0, y: 16, duration: 0.16, ease: myEase });
      } else {
        cards.forEach((el) => {
          setTimeout(() => {
            el.style.transition = "opacity .18s ease, transform .18s ease";
            el.style.opacity = 0;
            el.style.transform = "translateY(16px)";
          }, 0);
        });
      }
    };

    const clearEl = document.querySelector('[fs-list-element="clear"]');
    let isResetting = false;

    const scrubVisuals = () => {
      form.querySelectorAll(".w-checkbox-input, .w-radio-input").forEach((proxy) => {
        proxy.classList.remove("w--redirected-checked", "w--redirected-focus");
        proxy.setAttribute("aria-checked", "false");
      });
    };

    const hasAnyActiveFilter = () => {
      const controls = Array.from(
        form.querySelectorAll('[fs-list-element="filter"], [fs-list-field]')
      );
      const anyControl = controls.some((el) => {
        const tag = el.tagName;
        if (tag === "SELECT") return el.value !== "" && el.value != null;
        if (tag === "INPUT") {
          const type = el.type;
          if (type === "checkbox" || type === "radio") return el.checked;
          return (el.value || "").trim() !== "";
        }
        if (tag === "TEXTAREA") return (el.value || "").trim() !== "";
        return false;
      });

      const anyProxyChecked =
        form.querySelectorAll(
          ".w-checkbox-input.w--redirected-checked, .w-radio-input.w--redirected-checked"
        ).length > 0;

      return anyControl || anyProxyChecked;
    };

    const ensureAllWhenNoneSelected = () => {
      if (isResetting) return;
      if (hasAnyActiveFilter()) return;
      isResetting = true;
      if (clearEl) clearEl.click();
      setTimeout(() => {
        const items = listItems();
        items.forEach((li) => {
          li.style.removeProperty("display");
        });
        const cards = items.map(cardOf);
        cleanup(cards);
        scrubVisuals();
        inAnim(items.filter(isVisible));
        isResetting = false;
      }, 80);
    };

    let t;

    const scheduleInAnim = (delay = 80) => {
      clearTimeout(t);
      t = setTimeout(() => {
        const nowVisible = listItems().filter(isVisible);
        inAnim(nowVisible);
      }, delay);
    };

    // Smoothly scroll the viewport to the top of the nearest .qs-section
    let __lastScrollTs = 0;
    const scrollToFiltersSection = (targetEl) => {
      const now = Date.now();
      if (now - __lastScrollTs < 300) return;
      __lastScrollTs = now;

      const section =
        targetEl?.closest?.(".qs-section") ||
        form.closest?.(".qs-section") ||
        document.querySelector(".qs-section");
      if (!section) return;

      const sectionTop = section.getBoundingClientRect().top + window.pageYOffset;
      const targetY = Math.max(0, sectionTop - 32);
      if (Math.abs(window.pageYOffset - targetY) < 8) return;

      try {
        gsap.killTweensOf(window);
        gsap.to(window, {
          scrollTo: { y: section, autoKill: true, offsetY: 32 },
          duration: 0.5,
          ease: myEase,
          overwrite: "auto"
        });
      } catch (_) {
        window.scrollTo({ top: targetY, behavior: "smooth" });
      }
    };

    const run = () => {
      const currentlyVisible = listItems().filter(isVisible);
      outAnim(currentlyVisible);
      scheduleInAnim(100);
    };

    const handleUserChange = (e) => {
      const isProgrammatic = e?.isTrusted === false;

      if (!isResetting) {
        if (isProgrammatic) {
          hasSkippedInitialScroll = true;
        } else if (isNoInitialScrollPage && !hasSkippedInitialScroll) {
          hasSkippedInitialScroll = true;
        } else {
          scrollToFiltersSection(e?.target);
        }
      }
      run();
    };

    form.addEventListener("input", handleUserChange);
    form.addEventListener("change", handleUserChange);

    // increased from 20ms → 100ms to give FS time to re-apply remaining active filters
    const onFormChange = () => setTimeout(ensureAllWhenNoneSelected, 100);
    form.addEventListener("change", onFormChange);
    form.addEventListener("input", onFormChange);

    const ensureVisibleFallback = () => {
      if (isResetting) return;
      if (hasAnyActiveFilter()) return;
      const visibleCount = listItems().filter(isVisible).length;
      if (visibleCount === 0) {
        const items = listItems();
        items.forEach((li) => li.style.removeProperty("display"));
        const cards = items.map(cardOf);
        cleanup(cards);
        scrubVisuals();
        inAnim(items);
      }
    };

    // increased from 150ms → 400ms for same reason
    form.addEventListener("change", () => setTimeout(ensureVisibleFallback, 400));

    document.addEventListener("click", (e) => {
      const btn = e.target.closest('[fs-list-element="clear"]');
      if (!btn) return;
      if (isResetting) return;
      isResetting = true;
      setTimeout(() => {
        const items = listItems();
        items.forEach((li) => {
          li.style.removeProperty("display");
        });
        const cards = items.map(cardOf);
        cleanup(cards);
        scrubVisuals();
        inAnim(items.filter(isVisible));
        isResetting = false;
      }, 80);
    });

    const displayFrom = (styleString = "") => {
      const match = styleString.match(/display\s*:\s*([^;]+)/i);
      return match ? match[1].trim() : "";
    };

    const mo = new MutationObserver((mutations) => {
      let shouldAnimate = false;
      for (const mutation of mutations) {
        if (mutation.type !== "attributes") continue;
        if (mutation.attributeName !== "style") continue;
        const previous = displayFrom(mutation.oldValue || "");
        const current = mutation.target.style.display || "";
        if (previous !== current) {
          shouldAnimate = true;
          break;
        }
      }
      if (!shouldAnimate) return;
      scheduleInAnim(60);
    });

    const observeListItems = () => {
      mo.disconnect();
      listItems().forEach((li) =>
        mo.observe(li, {
          attributes: true,
          attributeFilter: ["style"],
          attributeOldValue: true
        })
      );
    };

    observeListItems();

    const listObserver = new MutationObserver(() => {
      observeListItems();
      scheduleInAnim(100);
    });
    listObserver.observe(list, { childList: true });

    const css = document.createElement("style");
    css.textContent =
      `.qs-conference-wrapper{ will-change: transform, opacity; }` +
      `.qs-people-card-wrapper{ will-change: transform, opacity; }` +
      `.qs-card-asset-wrapper{ will-change: transform, opacity; }` +
      `.qs-career-wrapper{ will-change: transform, opacity; }`;
    document.head.appendChild(css);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
}