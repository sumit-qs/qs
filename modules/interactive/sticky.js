/**
 * Generic sticky bottom bar that animates in after scrolling 300px and hides
 * again when the footer comes into view or the user dismisses it.
 * Hooks: .qs-sticky-bar (the bar), .qs-sticky-close (dismiss), .qs-footer-wrapper.
 * Forced to position:fixed via inline !important styles because ScrollSmoother's
 * transformed wrapper otherwise breaks fixed positioning; a delayedCall re-asserts
 * the hidden state to override late-firing Webflow IX2 tweens.
 * NOTE: this module is intentionally verbose with console.log debugging — consider
 * stripping those logs before a production launch.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { myEase } from "../../config/variables.js";
gsap.registerPlugin(ScrollTrigger);

export function functionSticky() {
	console.log('[QS Sticky] functionSticky called');

	const bar = document.querySelector('.qs-sticky-bar');
	if (!bar) {
		console.warn('[QS Sticky] .qs-sticky-bar NOT FOUND — aborting');
		return;
	}
	console.log('[QS Sticky] bar found:', bar, '| parent:', bar.parentElement);

	const footer = document.querySelector('.qs-footer-wrapper');
	console.log('[QS Sticky] footer:', footer ? 'found' : 'NOT FOUND');

	// Force hidden state immediately — ScrollSmoother.create() fires refreshEnd before
	// functionSticky() is called, so we can't rely on that event. Setup runs synchronously.
	function applyHiddenState() {
		gsap.killTweensOf(bar);
		bar.style.removeProperty('translate');
		bar.style.removeProperty('rotate');
		bar.style.removeProperty('scale');
		bar.style.cssText = 'position:fixed !important; bottom:0 !important; left:0 !important; width:100% !important; z-index:9998 !important; visibility:visible !important; opacity:1 !important; pointer-events:auto !important;';
		gsap.set(bar, { x: 0, y: 0, xPercent: 0, yPercent: 100 });
	}
	applyHiddenState();
	console.log('[QS Sticky] initial hidden state applied — transform:', bar.style.transform);

	let isVisible = false;
	let closedByUser = false;

	function showBar() {
		console.log('[QS Sticky] showBar() called — isVisible:', isVisible, '| closedByUser:', closedByUser);
		if (isVisible || closedByUser) return;
		isVisible = true;
		gsap.to(bar, { x: 0, y: 0, xPercent: 0, yPercent: 0, duration: 0.6, ease: myEase, overwrite: true });
		console.log('[QS Sticky] → animating IN (yPercent 0)');
	}

	function hideBar() {
		console.log('[QS Sticky] hideBar() called — isVisible:', isVisible);
		if (!isVisible) return;
		isVisible = false;
		gsap.to(bar, { x: 0, y: 0, xPercent: 0, yPercent: 100, duration: 0.6, ease: myEase, overwrite: true });
		console.log('[QS Sticky] → animating OUT (yPercent 100)');
	}

	const closeBtn = bar.querySelector('.qs-sticky-close');
	console.log('[QS Sticky] close button:', closeBtn ? 'found' : 'NOT FOUND');
	if (closeBtn) {
		closeBtn.addEventListener('click', (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('[QS Sticky] close clicked');
			closedByUser = true;
			hideBar();
		});
	}

	// Set up scroll triggers immediately (ScrollTrigger is ready after ScrollSmoother.create())
	let footerHiding = false;

	const stShow = ScrollTrigger.create({
		start: 300,
		end: 99999999,
		onEnter: () => {
			console.log('[QS Sticky] stShow onEnter — scrolled past 300px | footerHiding:', footerHiding);
			if (!footerHiding) showBar();
		},
		onLeaveBack: () => {
			console.log('[QS Sticky] stShow onLeaveBack — scrolled back above 300px');
			hideBar();
		},
	});
	console.log('[QS Sticky] ScrollTriggers set up — stShow.isActive:', stShow.isActive);

	if (footer) {
		ScrollTrigger.create({
			trigger: footer,
			start: 'top bottom',
			onEnter: () => {
				console.log('[QS Sticky] footer onEnter — footer entering viewport');
				footerHiding = true;
				hideBar();
			},
			onLeaveBack: () => {
				console.log('[QS Sticky] footer onLeaveBack — footer left viewport');
				footerHiding = false;
				if (stShow.isActive && !closedByUser) showBar();
			},
		});
	}

	// Webflow IX2 tweens fire asynchronously after init — re-assert hidden state after a tick
	gsap.delayedCall(0.3, () => {
		if (!isVisible) {
			console.log('[QS Sticky] delayedCall: re-asserting hidden state (killing any late Webflow tweens)');
			applyHiddenState();
		}
	});
}
