/**
 * Sticky article CTA bar that docks to the bottom of the viewport while the
 * reader is inside the article body, then tucks away again.
 * Hooks: .qs-progress-wrapper (scroll region) > .qs-article-bar-wrapper (the bar),
 * .qs-article-bar-close (dismiss button), optional [data-bottom-offset].
 * It appears 2s after entering the region; the close button hides it for the
 * session (userClosed). While fixed, the bar is reparented to <body> so that
 * position:fixed works inside ScrollSmoother's transformed #smooth-content, and
 * is restored to its original place on unfix.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { myEase } from "../../config/variables.js";
gsap.registerPlugin(ScrollTrigger);

export function functionFixedBar() {
	const wrappers = document.querySelectorAll('.qs-progress-wrapper');
	wrappers.forEach((wrapper) => {
		const el = wrapper.querySelector('.qs-article-bar-wrapper');
		if (!el) return;
		const bottomOffset = parseInt(wrapper.getAttribute('data-bottom-offset') || '0', 10);
		let timer = null;
		let fixed = false;
		let userClosed = false;
		const originalParent = el.parentNode;
		const nextSibling = el.nextSibling;
		const closeBtn = el.querySelector('.qs-article-bar-close');

		const showClose = () => {
			if (!closeBtn) return;
			gsap.set(closeBtn, { display: '' });
		};
		const hideClose = () => {
			if (!closeBtn) return;
			gsap.set(closeBtn, { display: 'none' });
		};

		if (closeBtn) {
			closeBtn.addEventListener('click', (e) => {
				e.preventDefault();
				e.stopPropagation();
				userClosed = true;
				if (timer) { clearTimeout(timer); timer = null; }
				hideClose();
				animateDownThenUnfix();
			});
		}
		const animateDownThenUnfix = () => {
			if (!fixed) return;
			gsap.killTweensOf(el);
			gsap.to(el, { yPercent: 100, duration: 0.5, ease: myEase, onComplete: () => unfix() });
		};
		const fix = () => {
			if (fixed || userClosed) return;
			const inSmooth = el.closest('#smooth-content');
			if (inSmooth) document.body.appendChild(el);
			gsap.set(el, { position: 'fixed', bottom: 0, left: 0, width: '100%', zIndex: 1000, display: 'flex', yPercent: 100 });
			gsap.to(el, { yPercent: 0, duration: 0.6, ease: myEase });
			fixed = true;
			showClose();
		};
		const unfix = () => {
			if (!fixed) return;
			gsap.killTweensOf(el);
			if (originalParent && el.parentNode !== originalParent) {
				if (nextSibling && nextSibling.parentNode === originalParent) {
					originalParent.insertBefore(el, nextSibling);
				} else {
					originalParent.appendChild(el);
				}
			}
			gsap.set(el, { position: 'absolute', bottom: 0, left: 0, width: '100%', yPercent: 0 });
			fixed = false;
		};
		ScrollTrigger.create({
			trigger: wrapper,
			start: "top top",
            end: "bottom bottom",
			// end: () => `bottom bottom-=${Math.max(0, el.offsetHeight - (isNaN(bottomOffset) ? 0 : bottomOffset)) + 128}`,
			invalidateOnRefresh: true,
			onUpdate: (self) => {
				if (self.progress >= 1) {
					hideClose();
				} else if (fixed && !userClosed) {
					showClose();
				}
			},
			onEnter: () => {
				if (timer) clearTimeout(timer);
				if (!userClosed) timer = setTimeout(fix, 2000);
			},
			onEnterBack: () => {
				if (timer) clearTimeout(timer);
				if (!userClosed) timer = setTimeout(fix, 2000);
			},
			onLeave: () => {
				if (timer) clearTimeout(timer);
				unfix();
				hideClose();
			},
			onLeaveBack: () => {
				if (timer) clearTimeout(timer);
				animateDownThenUnfix();
			}
		});
	});
}

if (typeof window !== 'undefined') {
	window.functionFixedBar = functionFixedBar;
}
