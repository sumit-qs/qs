/**
 * Generic link hover that reveals an icon sliding in from the left.
 * Hooks: [hover="link"] containing [target="icon"]. Same timeline pattern as the
 * other hover/* modules. Respects prefers-reduced-motion.
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionHoverLinkNoIcon() {
	const init = () => {
		const links = Array.from(document.querySelectorAll('[hover="link"]'));
		if (!links.length) return;

		links.forEach((el) => {
			const icons = Array.from(el.querySelectorAll('[target="icon"]'));
			if (!icons.length) return;

			const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

			gsap.set(icons, { xPercent: -100, x: 0, force3D: true, willChange: 'transform' });

			const tl = gsap.timeline({ paused: true, defaults: { duration: 0.22, ease: myEase, overwrite: 'auto' } });
			tl.to(icons, { xPercent: 0, x: 0 }, 0);

			const enter = () => { if (!prefersReducedMotion) tl.timeScale(1).play(); };
			const leave = () => { if (!prefersReducedMotion) tl.timeScale(1.6).reverse(); };

			el.addEventListener('pointerenter', enter);
			el.addEventListener('pointerleave', leave);
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

