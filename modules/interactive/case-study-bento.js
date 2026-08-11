/**
 * Case-study bento: reads [qs-bento="card-count"] to determine how many
 * cards to show, hides unused columns via data-attribute selectors, writes
 * data-cs-count on the grid for CSS layout switching, and swaps orientation
 * combo classes on the visible cards.
 *
 * Show/hide targets:  [qs-bento="card-one"] … [qs-bento="card-four"]
 *                     direct children of [qs-bento="case-study"]
 *                     targeted via data-attributes only — no plain class selectors
 *
 * Drag (mobile/tablet, < 992px):
 *   .qs-case-study-wrap.is-responsive-drag  → gets drag="dynamic" added/removed
 *   .qs-grid-bento.is-responsive-drag       → becomes the .track (CSS handles
 *                                             display:flex + row layout)
 *   functionDragDynamic() hooks [drag="dynamic"] > .track automatically,
 *   so we just toggle the attribute and re-initialise on breakpoint change.
 *
 * Orientation rule (desktop ≥ 992px only):
 *   1 card  → card-one horizontal
 *   2 cards → all base
 *   3 cards → card-one horizontal
 *   4 cards → card-one horizontal
 *   mobile  → all base
 *
 * readCount() scopes to the nearest .qs-case-study-wrap ancestor so
 * multiple instances on one page each read their own counter.
 */

import { gsap } from "gsap";
import { Draggable, InertiaPlugin } from "gsap/all";

gsap.registerPlugin(Draggable, InertiaPlugin);

const GRID_SEL       = '[qs-bento="case-study"]';
const COUNT_SEL      = '[qs-bento="card-count"]';
const WRAP_DRAG_SEL  = '.qs-case-study-wrap.is-responsive-drag';
const CARD_SLOTS     = ["card-one", "card-two", "card-three", "card-four"];
const CARD_ROOT_SEL  = ".qs-card-asset-wrapper-draggable";
const BASE_CLASS     = "is-base-cs-card";
const HORIZ_CLASS    = "is-horizontal-cs-card";
const ORIENTED_SEL   = `.${BASE_CLASS}, .${HORIZ_CLASS}`;
const DESKTOP_QUERY  = "(min-width: 992px)";

// Keyed by wrap element — one Draggable instance per component instance.
const draggableMap = new WeakMap();

export function functionCaseStudyBento() {
  const grids = Array.from(document.querySelectorAll(GRID_SEL));
  if (!grids.length) return;

  const desktop = window.matchMedia(DESKTOP_QUERY);

  // ------------------------------------------------------------------
  // Read count — scoped to nearest .qs-case-study-wrap
  // ------------------------------------------------------------------
  const readCount = (grid) => {
    const wrap = grid.closest('.qs-case-study-wrap') || grid.parentElement;
    const countEl = wrap ? wrap.querySelector(COUNT_SEL) : null;
    const raw = countEl ? countEl.textContent.trim() : "4";
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 4;
  };

  // ------------------------------------------------------------------
  // Show / hide column slots (data-attributes only)
  // ------------------------------------------------------------------
  const applyVisibility = (grid, count) => {
    CARD_SLOTS.forEach((slot, index) => {
      const col = grid.querySelector(`[qs-bento="${slot}"]`);
      if (!col) return;
      col.style.display = index < count ? "" : "none";
    });
  };

  // ------------------------------------------------------------------
  // Orientation swap
  // ------------------------------------------------------------------
  const applyOrientation = (cardRoot, horizontal) => {
    const nodes = [cardRoot, ...cardRoot.querySelectorAll(ORIENTED_SEL)];
    nodes.forEach((node) => {
      node.classList.toggle(HORIZ_CLASS, horizontal);
      node.classList.toggle(BASE_CLASS, !horizontal);
    });
  };

  const getCardRoot = (col) =>
    col.matches(CARD_ROOT_SEL) ? col : col.querySelector(CARD_ROOT_SEL);

  // ------------------------------------------------------------------
  // Drag: init / destroy scoped to one wrap element
  // ------------------------------------------------------------------
  const initDrag = (wrap, grid) => {
    // grid doubles as the .track — CSS gives it display:flex on mobile
    const existing = draggableMap.get(wrap);
    if (existing) return; // already live

    const getBounds = () => {
      const containerWidth = wrap.offsetWidth;
      const trackWidth     = grid.scrollWidth;
      const style          = window.getComputedStyle(wrap);
      const pl = parseFloat(style.paddingLeft)  || 0;
      const pr = parseFloat(style.paddingRight) || 0;
      return {
        minX: containerWidth - trackWidth - pr + pl,
        maxX: 0,
      };
    };

    const clamp = (instance) => {
      const b = getBounds();
      if (instance.x < b.minX) {
        gsap.to(grid, { x: b.minX, duration: 0.2 });
        instance.update();
      }
      if (instance.x > b.maxX) {
        gsap.to(grid, { x: b.maxX, duration: 0.2 });
        instance.update();
      }
    };

    const instance = Draggable.create(grid, {
      type: "x",
      inertia: true,
      bounds: getBounds,
      cursor: "grab",
      edgeResistance: 0.85,
    })[0];

    instance.applyBounds(getBounds());
    clamp(instance);

    const onResize = () => {
      instance.applyBounds(getBounds());
      clamp(instance);
    };
    window.addEventListener("resize", onResize);

    draggableMap.set(wrap, { instance, onResize });
  };

  const destroyDrag = (wrap, grid) => {
    const stored = draggableMap.get(wrap);
    if (!stored) return;
    stored.instance.kill();
    window.removeEventListener("resize", stored.onResize);
    // Reset any residual transform left by GSAP
    gsap.set(grid, { x: 0 });
    draggableMap.delete(wrap);
  };

  // ------------------------------------------------------------------
  // Main update per grid instance
  // ------------------------------------------------------------------
  const update = (grid) => {
    const count     = readCount(grid);
    const isDesktop = desktop.matches;
    const wrap      = grid.closest(WRAP_DRAG_SEL);

    grid.setAttribute("data-cs-count", String(count));
    applyVisibility(grid, count);

    // Orientation
    CARD_SLOTS.forEach((slot, index) => {
      if (index >= count) return;
      const col = grid.querySelector(`[qs-bento="${slot}"]`);
      if (!col) return;
      const cardRoot = getCardRoot(col);
      if (!cardRoot) return;
      applyOrientation(cardRoot, isDesktop && index === 0 && count !== 2);
    });

    // Drag toggle
    if (!wrap) return; // component doesn't have is-responsive-drag — skip

    if (isDesktop) {
      // Remove drag attribute + kill instance when switching to desktop
      wrap.removeAttribute("drag");
      destroyDrag(wrap, grid);
    } else {
      // Add drag attribute so functionDragDynamic() can also find it if
      // called independently; initialise our own instance here.
      wrap.setAttribute("drag", "dynamic");
      initDrag(wrap, grid);
    }
  };

  const updateAll = () => grids.forEach(update);

  updateAll();

  if (typeof desktop.addEventListener === "function") {
    desktop.addEventListener("change", updateAll);
  } else if (typeof desktop.addListener === "function") {
    desktop.addListener(updateAll); // Safari < 14
  }

  grids.forEach((grid) => {
    new MutationObserver((records) => {
      const structural = records.some(
        (r) => r.type === "childList" && (r.addedNodes.length || r.removedNodes.length)
      );
      if (structural) update(grid);
    }).observe(grid, { childList: true });
  });
}