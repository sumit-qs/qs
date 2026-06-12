/**
 * Share panel toggle. Hooks: [share='open'] (trigger) and .qs-share-top (the
 * panel, containing .s-share-wrapper). Opens with a staggered slide/fade of the
 * share items; closes on the next outside trigger click.
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionToggleShare() {
	const triggerSelector = "[share='open']";
	const topEl = document.querySelector('.qs-share-top');
	if (!topEl) return;

	const interactiveArea = topEl;

	const getItems = () => {
		const wrap = topEl.querySelector('.s-share-wrapper');
		if (!wrap) return [];
		const kids = Array.from(wrap.children);
		return kids.length ? kids : [wrap];
	};

	let isOpen = false;
	let tl = null;
	const OPEN_DUR = 0.3;
	const CLOSE_DUR = 0.2;

	function openPanel() {
		const items = getItems();
		if (tl) tl.kill();
		gsap.killTweensOf([topEl, ...items]);
		gsap.set(topEl, { display: 'flex', visibility: 'hidden', opacity: 0, pointerEvents: 'none' });
		gsap.set(items, { opacity: 0, xPercent: 50, willChange: 'transform,opacity' });
		tl = gsap.timeline({ defaults: { ease: myEase } });
		tl.set(topEl, { visibility: 'visible' });
		tl.to(topEl, { opacity: 1, duration: OPEN_DUR * 0.9 }, 0)
		  .to(items, { opacity: 1, xPercent: 0, duration: OPEN_DUR, stagger: { each: 0.08 } }, 0);
		tl.add(() => { try { items.forEach(el => el.style.removeProperty('will-change')); } catch(_) {} });
		tl.set(topEl, { pointerEvents: 'auto' });
		isOpen = true;
	}

	function closePanel() {
		const items = getItems();
		if (tl) tl.kill();
		gsap.killTweensOf([topEl, ...items]);
		gsap.set(topEl, { pointerEvents: 'none' });
		tl = gsap.timeline({
			onComplete: () => {
				gsap.set(topEl, { display: 'none', clearProps: 'opacity,visibility,pointer-events' });
				gsap.set(items, { clearProps: 'opacity,transform' });
			}
		});
		tl.to(topEl, { opacity: 0, duration: CLOSE_DUR * 0.9, ease: myEase }, 0)
		  .to(items, { opacity: 0, xPercent: 50, duration: CLOSE_DUR, ease: myEase, stagger: { each: 0.06 } }, 0);
		isOpen = false;
	}

	document.querySelectorAll(triggerSelector).forEach((trigger) => {
		trigger.addEventListener('click', (e) => {
			const target = e.target;
			const insidePanel = interactiveArea && target && interactiveArea.contains(target);
			if (isOpen && insidePanel) {
				return;
			}
			e.preventDefault();
			e.stopPropagation();
			if (isOpen) closePanel(); else openPanel();
		});
	});
}
