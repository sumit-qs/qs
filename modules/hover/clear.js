/**
 * "Clear / reset" button hover: spins the icon 360° on hover/focus.
 * Hooks: .qs-clear-wrapper > .qs-reset-wrapper (the rotating icon).
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionHoverClear() {
	const init = () => {
		const clears = Array.from(document.querySelectorAll('.qs-clear-wrapper'));
		if (!clears.length) return;

		clears.forEach((el) => {
			const target = el.querySelector('.qs-reset-wrapper');
			if (!target) return;

			gsap.set(target, { rotate: 0 });

			const enter = () => {
				gsap.killTweensOf(target);
				gsap.to(target, { rotate: "-=360", duration: 0.6, ease: myEase });
			};

			const leave = () => {
				gsap.killTweensOf(target);
				gsap.to(target, { rotate: 0, duration: 0.6, ease: myEase });
			};

			el.addEventListener('mouseenter', enter);
			el.addEventListener('mouseleave', leave);
			el.addEventListener('focusin', enter);
			el.addEventListener('focusout', leave);
		});
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
}

