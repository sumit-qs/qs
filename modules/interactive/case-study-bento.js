/**
 * Case-study bento: reads [qs-bento="card-count"] to determine how many
 * cards to show, hides unused columns via data-attribute selectors, writes
 * data-cs-count on the grid for CSS layout switching, and swaps orientation
 * combo classes on the visible cards.
 *
 * Show/hide targets: [qs-bento="card-one"] … [qs-bento="card-four"]
 * These are direct children of [qs-bento="case-study"] (qs-grid-bento).
 * Targeted exclusively via data-attributes — no class selectors touched.
 *
 * Orientation rule (matches Figma flows):
 *   1 card  → card-one horizontal
 *   2 cards → all base
 *   3 cards → card-one horizontal
 *   4 cards → card-one horizontal
 *   mobile  → all base (slider handles layout)
 *
 * Combo classes swapped on the card root + any descendant already carrying
 * either class (keeps in sync with Webflow component structure automatically).
 */

const GRID_ATTR      = 'qs-bento="case-study"';
const GRID_SEL       = '[qs-bento="case-study"]';
const COUNT_SEL      = '[qs-bento="card-count"]';
const CARD_SLOTS     = ["card-one", "card-two", "card-three", "card-four"];
const CARD_ROOT_SEL  = ".qs-card-asset-wrapper-draggable";
const BASE_CLASS     = "is-base-cs-card";
const HORIZ_CLASS    = "is-horizontal-cs-card";
const ORIENTED_SEL   = `.${BASE_CLASS}, .${HORIZ_CLASS}`;
const DESKTOP_QUERY  = "(min-width: 992px)";

export function functionCaseStudyBento() {
  const grids = Array.from(document.querySelectorAll(GRID_SEL));
  if (!grids.length) return;

  const desktop = window.matchMedia(DESKTOP_QUERY);

  // ------------------------------------------------------------------
  // Read count
  // The count field is a hidden text block inside the component whose
  // text content is set by the [# Card Count] component property.
  // We look for it relative to the grid's parent component root so each
  // instance reads its own value.
  // ------------------------------------------------------------------
  const readCount = (grid) => {
    // Walk up to find the nearest ancestor that contains [qs-bento="card-count"]
    // (could be a sibling of the grid or a parent wrapper — scope to the
    // closest common ancestor rather than document-wide to support multiple
    // instances on one page).
    const root = grid.closest('[qs-bento="case-study-wrap"]') || grid.parentElement;
    const countEl = root ? root.querySelector(COUNT_SEL) : document.querySelector(COUNT_SEL);
    const raw = countEl ? countEl.textContent.trim() : "4";
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 1 && n <= 4 ? n : 4;
  };

  // ------------------------------------------------------------------
  // Show / hide column slots
  // ------------------------------------------------------------------
  const applyVisibility = (grid, count) => {
    CARD_SLOTS.forEach((slot, index) => {
      const col = grid.querySelector(`[qs-bento="${slot}"]`);
      if (!col) return;
      col.style.display = index < count ? "" : "none";
    });
  };

  // ------------------------------------------------------------------
  // Orientation swap (combo classes only on card internals)
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
  // Main update per grid instance
  // ------------------------------------------------------------------
  const update = (grid) => {
    const count = readCount(grid);

    grid.setAttribute("data-cs-count", String(count));
    applyVisibility(grid, count);

    const isDesktop = desktop.matches;

    CARD_SLOTS.forEach((slot, index) => {
      if (index >= count) return; // hidden — skip orientation
      const col = grid.querySelector(`[qs-bento="${slot}"]`);
      if (!col) return;
      const cardRoot = getCardRoot(col);
      if (!cardRoot) return;

      // card-one is horizontal on desktop for all counts except 2
      const horizontal = isDesktop && index === 0 && count !== 2;
      applyOrientation(cardRoot, horizontal);
    });
  };

  const updateAll = () => grids.forEach(update);

  updateAll();

  // Breakpoint change: flip card-one back to base on mobile
  if (typeof desktop.addEventListener === "function") {
    desktop.addEventListener("change", updateAll);
  } else if (typeof desktop.addListener === "function") {
    desktop.addListener(updateAll); // Safari < 14
  }

  // If a parent MutationObserver (e.g. Finsweet) re-renders the grid
  // children, re-apply. Structural childList changes only.
  grids.forEach((grid) => {
    new MutationObserver((records) => {
      const structural = records.some(
        (r) => r.type === "childList" && (r.addedNodes.length || r.removedNodes.length)
      );
      if (structural) update(grid);
    }).observe(grid, { childList: true });
  });
}