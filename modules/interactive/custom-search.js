/**
 * Custom CMS Search
 *
 * Wires a search input to a CMS list using data attributes only.
 * No DOM proximity requirements — the input finds its list by ID reference.
 *
 * Usage:
 *   Search input:  data-search-input="my-list"
 *   CMS list:      data-search-list="my-list"
 *   Each CMS item: data-search-item  (optional — falls back to direct children)
 *
 * Multiple independent search instances on the same page are supported.
 * The search is case-insensitive and matches any substring in the item's text.
 */

import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionCustomSearch() {
  const inputs = document.querySelectorAll("[data-search-input]");
  if (!inputs.length) return;

  inputs.forEach((input) => {
    const listId = input.getAttribute("data-search-input");
    const list = document.querySelector(`[data-search-list="${listId}"]`);
    if (!list) return;

    const getItems = () => {
      const tagged = list.querySelectorAll("[data-search-item]");
      return tagged.length
        ? Array.from(tagged)
        : Array.from(list.children);
    };

    const showAll = () => {
      getItems().forEach((item) => {
        item.style.removeProperty("display");
        gsap.killTweensOf(item);
        gsap.to(item, { opacity: 1, y: 0, duration: 0.3, ease: myEase });
      });
    };

    const filter = (query) => {
      const q = query.trim().toLowerCase();

      if (!q) {
        showAll();
        return;
      }

      const items = getItems();
      const matched = [];
      const unmatched = [];

      items.forEach((item) => {
        const text = (item.innerText || item.textContent || "").toLowerCase();
        text.includes(q) ? matched.push(item) : unmatched.push(item);
      });

      // Hide unmatched
      unmatched.forEach((item) => {
        gsap.killTweensOf(item);
        gsap.to(item, {
          opacity: 0,
          y: 8,
          duration: 0.15,
          ease: myEase,
          onComplete: () => (item.style.display = "none"),
        });
      });

      // Show matched with stagger
      matched.forEach((item) => {
        item.style.removeProperty("display");
        gsap.killTweensOf(item);
      });

      gsap.fromTo(
        matched,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, ease: myEase, stagger: 0.03 }
      );
    };

    let debounceTimer;
    input.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => filter(e.target.value), 150);
    });
  });
}