/**
 * Link arrow hover: slides the arrow icon across on hover/focus.
 * Hooks: .qs-link-wrapper > .qs-link-arrow > .qs-link-icon-visible.
 * Same paused-timeline pattern as hover/button.js; snaps end states to avoid
 * sub-pixel drift on rapid hover. Respects prefers-reduced-motion.
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionHoverLinkIcon() {
	const init = () => {
		const links = Array.from(document.querySelectorAll('.qs-link-wrapper'));
		if (!links.length) return;

		links.forEach((el) => {
			const arrow = el.querySelector('.qs-link-arrow');
			if (!arrow) return;
			const icons = Array.from(arrow.querySelectorAll('.qs-link-icon-visible'));
			if (!icons.length) return;

			const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

			// Ensure the icon track clips properly to avoid flicker at edges
			gsap.set(arrow, { overflow: 'hidden' });
			gsap.set(icons, { xPercent: 0, x: 0, force3D: true, willChange: 'transform' });

			const tl = gsap.timeline({ paused: true, defaults: { duration: 0.2, ease: 'none', overwrite: 'auto' } });
			tl.to(icons, { xPercent: 100, lazy: false }, 0);
			// Snap end-states to avoid residual sub-pixel positions during rapid hover-in/out
			tl.eventCallback('onComplete', () => gsap.set(icons, { xPercent: 100, x: 0 }));
			tl.eventCallback('onReverseComplete', () => gsap.set(icons, { xPercent: 0, x: 0 }));

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

