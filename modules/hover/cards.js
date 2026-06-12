/**
 * Card hover: subtly scales the card's image and slides any link arrow.
 * Hooks: [hover="card"]; the image is found via a list of candidate selectors
 * (.qs-card-asset-image, img, …) and the arrow via .qs-link-arrow .qs-link-icon-visible.
 * One paused timeline per card. Respects prefers-reduced-motion.
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionHoverCards() {
	const init = () => {
		const cards = Array.from(document.querySelectorAll('[hover="card"]'));
		if (!cards.length) return;

		cards.forEach((el) => {
			// Robustly find the visual asset to scale across varied card structures
			const candidateSelectors = [
				'.qs-card-circle-wrapper .qs-asset',
				'.qs-card-asset-image',
				'.qs-card-asset-wrapper img',
				'.qs-people-card-wrapper img',
				'.qs-conference-wrapper img',
				'.qs-career-wrapper img',
				'.qs-asset',
				'img'
			];
			const candidates = Array.from(el.querySelectorAll(candidateSelectors.join(', ')));
			const asset = candidates.find((n) => !n.closest('.qs-link-arrow')) || null;

			const linkWrapper = el.querySelector('.qs-link-wrapper');
			const linkIcons = linkWrapper ? Array.from(linkWrapper.querySelectorAll('.qs-link-arrow .qs-link-icon-visible')) : [];

			const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

			if (asset) gsap.set(asset, { scale: 1, transformOrigin: 'center center', force3D: true, willChange: 'transform' });
			if (linkIcons.length) gsap.set(linkIcons, { xPercent: 0, x: 0, force3D: true, willChange: 'transform' });

			// Build a single timeline per card for reliable play/reverse behavior
			const tl = gsap.timeline({ paused: true, defaults: { ease: myEase, overwrite: 'auto' } });
			if (asset) tl.to(asset, { scale: 1.05, duration: 0.9 }, 0);
			if (linkIcons.length) tl.to(linkIcons, { xPercent: 100, duration: 0.22 }, 0);

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

