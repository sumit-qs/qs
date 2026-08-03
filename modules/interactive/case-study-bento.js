/**
 * Case-study bento: decides which card in the grid renders horizontally.
 *
 * Column / row spans are handled entirely in CSS (see case-study-bento.css) —
 * this module only swaps the orientation combo classes, because a CMS list
 * renders the same component instance for every item.
 *
 * Rule (matches the Figma flows):
 *   1 card  → item 1 horizontal
 *   2 cards → all base
 *   3 cards → item 1 horizontal
 *   4 cards → item 1 horizontal
 *   mobile  → always base (draggable slider shows one full-width card)
 *
 * Hooks:
 *   [qs-bento="case-study"]        the qs-grid-bento collection list
 *   .qs-card-asset-wrapper-draggable   the card root inside each qs-column
 *   .is-base-cs-card / .is-horizontal-cs-card
 *                                  combo classes authored in Webflow; every
 *                                  element carrying either one gets swapped,
 *                                  so adding the combo to a new element in
 *                                  Webflow needs no change here.
 *
 * Also writes data-cs-count on the grid, for CSS fallbacks and debugging.
 */

const GRID_SELECTOR = '[qs-bento="case-study"]';
const CARD_SELECTOR = ".qs-card-asset-wrapper-draggable";
const BASE_CLASS = "is-base-cs-card";
const HORIZONTAL_CLASS = "is-horizontal-cs-card";
const ORIENTED_SELECTOR = `.${BASE_CLASS}, .${HORIZONTAL_CLASS}`;
const DESKTOP_QUERY = "(min-width: 992px)";

export function functionCaseStudyBento() {
	const grids = Array.from(document.querySelectorAll(GRID_SELECTOR));
	if (!grids.length) return;

	const desktop = window.matchMedia(DESKTOP_QUERY);

	/** One card root per CMS item. */
	const getCards = (grid) =>
		Array.from(grid.children)
			.map((item) => (item.matches(CARD_SELECTOR) ? item : item.querySelector(CARD_SELECTOR)))
			.filter(Boolean);

	/**
	 * The combo lives on the wrapper plus qs-card-asset-top / -bottom. Rather
	 * than hardcode those three, collect whatever already carries one of the two
	 * classes — that keeps this in sync with the Webflow component by itself.
	 *
	 * Both combos have equal specificity (.a.b), so exactly one must be present
	 * at a time or source order silently decides the winner.
	 */
	const applyOrientation = (card, horizontal) => {
		const nodes = [card, ...card.querySelectorAll(ORIENTED_SELECTOR)];
		nodes.forEach((node) => {
			node.classList.toggle(HORIZONTAL_CLASS, horizontal);
			node.classList.toggle(BASE_CLASS, !horizontal);
		});
	};

	const update = (grid) => {
		const cards = getCards(grid);
		const count = cards.length;
		if (!count) return;

		grid.setAttribute("data-cs-count", String(count));

		const isDesktop = desktop.matches;
		cards.forEach((card, index) => {
			applyOrientation(card, isDesktop && index === 0 && count !== 2);
		});
	};

	const updateAll = () => grids.forEach(update);

	updateAll();

	// Breakpoint changes flip the first card back to base for the mobile slider.
	if (typeof desktop.addEventListener === "function") {
		desktop.addEventListener("change", updateAll);
	} else if (typeof desktop.addListener === "function") {
		desktop.addListener(updateAll); // Safari < 14
	}

	// Finsweet fs-list can re-render the items after our first pass, which would
	// drop the classes we just swapped. Re-apply when the item set changes.
	grids.forEach((grid) => {
		const observer = new MutationObserver((records) => {
			const structural = records.some(
				(r) => r.type === "childList" && (r.addedNodes.length || r.removedNodes.length)
			);
			if (structural) update(grid);
		});
		observer.observe(grid, { childList: true });
	});
}