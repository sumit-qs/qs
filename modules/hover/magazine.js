/**
 * Magazine card hover: lifts the card up slightly on hover/focus.
 * Hooks: [card="magazine"]. Respects prefers-reduced-motion.
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionMagazine() {
	const init = () => {
		const cards = Array.from(document.querySelectorAll('[card="magazine"]'));
		if (!cards.length) return;

		cards.forEach((card) => {
			const enter = () => {
				if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
				gsap.to(card, { y: -20, duration: 0.4, ease: myEase, overwrite: "auto" });
			};
			const leave = () => {
				if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
				gsap.to(card, { y: 0, duration: 0.3, ease: myEase, overwrite: "auto" });
			};
			card.addEventListener("pointerenter", enter);
			card.addEventListener("pointerleave", leave);
			card.addEventListener("focusin", enter);
			card.addEventListener("focusout", leave);
		});
	};

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", init, { once: true });
	} else {
		init();
	}
}
