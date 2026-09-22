/**
 * Custom CMS Search
 *
 * Wires a search input to one or more CMS lists using data attributes only.
 * No DOM proximity requirements — the input finds its lists by ID reference.
 *
 * Usage:
 *   Search input:        data-search-input="my-list"
 *   CMS list:            data-search-list="my-list"
 *   Each CMS item:       data-search-item              (optional, falls back to direct children)
 *
 * V02: targets ALL lists matching data-search-list value.
 *
 * V03: Single unified result list
 *   Collections wrapper: data-attribute [custom-search="collection-container"]
 *   Result wrapper:      data-attribute [custom-search="result-wrapper"]      (hidden by default)
 *   Result list:         data-attribute [custom-search="result-list"]
 *   Unique value el:     data-attribute [custom-search="unique-value"]        (hidden text inside each item, holds slug)
 *
 * V03 behaviour:
 *   - On search: hides collection-container, shows result-wrapper, clones matching
 *     items from all source lists into result-list, deduplicates by unique-value.
 *   - On clear: restores collection-container, hides result-wrapper, clears result-list.
 */

import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionCustomSearch() {
  const inputs = document.querySelectorAll("[data-search-input]");
  if (!inputs.length) return;

  inputs.forEach((input) => {
    const listId = input.getAttribute("data-search-input");
    const lists = Array.from(document.querySelectorAll(`[data-search-list="${listId}"]`));
    if (!lists.length) return;

    // V03 elements
    const collectionsContainer = document.querySelector('[custom-search="collection-container"]');
    const resultWrapper = document.querySelector('[custom-search="result-wrapper"]');
    const resultList = document.querySelector('[custom-search="result-list"]');
    const isV3 = !!(collectionsContainer && resultWrapper && resultList);

    // ── Helpers ──────────────────────────────────────────────────────────────

    const getItems = () => lists.flatMap((list) => {
      const tagged = list.querySelectorAll("[data-search-item]");
      return tagged.length ? Array.from(tagged) : Array.from(list.children);
    });

    const getSlug = (item) => {
      const el = item.querySelector('[custom-search="unique-value"]');
      return el ? (el.innerText || el.textContent || "").trim().toLowerCase() : null;
    };

    // ── V02: show/hide within source lists ───────────────────────────────────

    const showAllV2 = () => {
      getItems().forEach((item) => {
        item.style.removeProperty("display");
        gsap.killTweensOf(item);
        gsap.to(item, { opacity: 1, y: 0, duration: 0.3, ease: myEase });
      });
    };

    const filterV2 = (q) => {
      const items = getItems();
      const matched = [];
      const unmatched = [];

      items.forEach((item) => {
        const text = (item.innerText || item.textContent || "").toLowerCase();
        text.includes(q) ? matched.push(item) : unmatched.push(item);
      });

      unmatched.forEach((item) => {
        gsap.killTweensOf(item);
        gsap.to(item, {
          opacity: 0, y: 8, duration: 0.15, ease: myEase,
          onComplete: () => (item.style.display = "none"),
        });
      });

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

    // ── V03: unified result list ─────────────────────────────────────────────

    const clearResultList = () => {
      while (resultList.firstChild) resultList.removeChild(resultList.firstChild);
    };

    const showCollections = () => {
      clearResultList();
      collectionsContainer.style.removeProperty("display");
      resultWrapper.style.display = "none";
      showAllV2();
    };

    const filterV3 = (q) => {
      clearResultList();
      const seen = new Set();
      const clones = [];

      getItems().forEach((item) => {
        const text = (item.innerText || item.textContent || "").toLowerCase();
        if (!text.includes(q)) return;

        const slug = getSlug(item);
        if (slug && seen.has(slug)) return; // deduplicate
        if (slug) seen.add(slug);

        const clone = item.cloneNode(true);
        clone.style.removeProperty("display");
        clone.style.opacity = "0";
        resultList.appendChild(clone);
        clones.push(clone);
      });

      // Swap visibility
      collectionsContainer.style.display = "none";
      resultWrapper.style.removeProperty("display");

      // Animate clones in
      if (clones.length) {
        gsap.fromTo(
          clones,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.3, ease: myEase, stagger: 0.03 }
        );
      }
    };

    // ── Main filter dispatcher ───────────────────────────────────────────────

    const filter = (query) => {
      const q = query.trim().toLowerCase();

      if (!q) {
        if (isV3) showCollections();
        else showAllV2();
        return;
      }

      if (isV3) filterV3(q);
      else filterV2(q);
    };

    // ── Events ───────────────────────────────────────────────────────────────

    let debounceTimer;
    input.addEventListener("input", (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => filter(e.target.value), 150);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") e.preventDefault();
    });
  });
}