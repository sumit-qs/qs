/**
 * Desktop-only reveal of the article side panel as you scroll the article.
 * Hooks: .qs-progress-wrapper (scroll region), .qs-article-fixed-link-wrapper
 * (the panel that slides in via xPercent). Disabled below 1280px (panel hidden);
 * re-runs its setup when the breakpoint changes.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { myEase } from "../../config/variables.js";
gsap.registerPlugin(ScrollTrigger);

export function functionFixedReveal() {
	const wrappers = Array.from(document.querySelectorAll('.qs-progress-wrapper'));
	if (!wrappers.length) return;

	let triggers = [];
	const mql = window.matchMedia('(max-width: 1279px)');

	function killAllTriggers() {
		triggers.forEach((st) => st && st.kill());
		triggers = [];
	}

	function hideAllPanelsMobile() {
		const panels = document.querySelectorAll('.qs-article-fixed-link-wrapper');
		panels.forEach((panel) => {
			gsap.killTweensOf(panel);
			gsap.set(panel, { display: 'none', xPercent: 0 });
		});
	}

	function setupDesktop() {
		killAllTriggers();
		wrappers.forEach((wrapper) => {
			const panel = wrapper.querySelector('.qs-article-fixed-link-wrapper') || document.querySelector('.qs-article-fixed-link-wrapper');
			if (!panel) return;
			// Initial hidden state for desktop; will reveal on enter
			gsap.set(panel, { display: 'none', xPercent: 0, willChange: 'transform' });
			const st = ScrollTrigger.create({
				trigger: wrapper,
				start: 'top top',
				end: 'bottom bottom',
				onEnter: () => {
					gsap.killTweensOf(panel);
					gsap.set(panel, { display: '' });
					gsap.to(panel, { xPercent: 100, duration: 0.4, ease: myEase, overwrite: 'auto' });
				},
				onEnterBack: () => {
					gsap.killTweensOf(panel);
					gsap.set(panel, { display: '' });
					gsap.to(panel, { xPercent: 100, duration: 0.4, ease: myEase, overwrite: 'auto' });
				},
				onLeave: () => {
					gsap.killTweensOf(panel);
					gsap.to(panel, { xPercent: 0, duration: 0.35, ease: myEase, overwrite: 'auto', onComplete: () => gsap.set(panel, { display: 'none' }) });
				},
				onLeaveBack: () => {
					gsap.killTweensOf(panel);
					gsap.to(panel, { xPercent: 0, duration: 0.35, ease: myEase, overwrite: 'auto', onComplete: () => gsap.set(panel, { display: 'none' }) });
				}
			});
			// If already within active range upon creation, animate in now
			if (st.isActive) {
				gsap.set(panel, { display: '' });
				gsap.to(panel, { xPercent: 100, duration: 0.4, ease: myEase, overwrite: 'auto' });
			}
			triggers.push(st);
		});
		ScrollTrigger.refresh();
	}

	function applyMode() {
		if (mql.matches) {
			// Mobile: never show
			killAllTriggers();
			hideAllPanelsMobile();
		} else {
			// Desktop: enable behavior
			setupDesktop();
		}
	}

	applyMode();
	// Listen for breakpoint changes
	if (mql.addEventListener) mql.addEventListener('change', applyMode);
	else if (mql.addListener) mql.addListener(applyMode);
}

if (typeof window !== 'undefined') {
	window.functionFixedReveal = functionFixedReveal;
}
