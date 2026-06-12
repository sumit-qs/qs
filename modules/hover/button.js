/**
 * Button icon hover: slides the icon across on hover/focus.
 * Hooks: .qs-button-wrapper > .qs-button-icon-wrapper > .qs-icon-embed.
 * One paused GSAP timeline per button, played on pointerenter/focusin and
 * reversed (faster) on leave. Respects prefers-reduced-motion. This paused-
 * timeline pattern is shared by the other hover/* modules.
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionHoverButton() {
	const init = () => {
		const buttons = Array.from(document.querySelectorAll('.qs-button-wrapper'));
		if (!buttons.length) return;

		buttons.forEach((btn) => {
			const wrapper = btn.querySelector('.qs-button-icon-wrapper');
			if (!wrapper) return;
			const icons = Array.from(wrapper.querySelectorAll('.qs-icon-embed'));
			if (!icons.length) return;

			const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

			// Initial state and rendering hints
			gsap.set(icons, { xPercent: 0, x: 0, force3D: true, willChange: 'transform' });

			// Single timeline per button to avoid overlapping tweens
			const tl = gsap.timeline({ paused: true, defaults: { duration: 0.22, ease: myEase, overwrite: 'auto' } });
			tl.to(icons, { xPercent: 100 }, 0);

			const enter = () => { if (!prefersReducedMotion) tl.timeScale(1).play(); };
			const leave = () => { if (!prefersReducedMotion) tl.timeScale(1.6).reverse(); };

			btn.addEventListener('pointerenter', enter);
			btn.addEventListener('pointerleave', leave);
			btn.addEventListener('focusin', enter);
			btn.addEventListener('focusout', leave);
		});
	};

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init, { once: true });
	} else {
		init();
	}
}

