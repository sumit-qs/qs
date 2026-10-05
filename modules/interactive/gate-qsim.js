import { gsap } from "gsap";
import { ScrollSmoother, ScrollTrigger } from "gsap/all";
import { myEase } from "../../config/variables.js";

// QSIM gate — scroll hand-off + expand/collapse (page first, then the gate's container).
//
// Scope: acts ONLY on  .qs-gate.is-qsim[data-gate="qsim-gate"]  — on any other
// page / gate it silently no-ops. It does NOT replace gate.js: gate.js still
// owns showing/hiding the gate, download blocking, form-submit unlock and
// localStorage. This module only reads the gate's state (data-qs-gate-visible /
// display) and, while the gate is visible, decides WHO scrolls:
//
//   1. Gate is visible: the container sits at the bottom of the viewport,
//      COLLAPSED (default 50vh) over the blurred page. The PAGE scrolls (footer included).
//   2. Page reaches its very end -> the container smoothly EXPANDS to 100% of the
//      viewport and scrolls its own content (page is frozen).
//   3. Scrolling up at the container's top -> the container smoothly COLLAPSES
//      back to 50vh, and only then does the page scroll again.
//
// Same behaviour when the gate was opened by a download click.
// When gate.js removes the gate (form submit) everything is released/unbound.
//
// Webflow hooks:
//   gate       -> .qs-gate  + combo class .is-qsim  + attribute data-gate="qsim-gate"
//   container  -> [data-gate-scroll]  (fallback: .test-qsim-01), a child of the gate;
//                 position absolute, bottom 0, left 0, width 100%, height 50vh, overflow auto.
//                 Optional attributes on the container:
//                   data-gate-collapsed="50"   collapsed height in vh (default 50 — keep in sync with the Webflow height)
//                   data-gate-duration="0.8"   expand / collapse duration in seconds (default 0.8)
export function functionQsimGate() {
  const GATE_SELECTOR = '.qs-gate.is-qsim[data-gate="qsim-gate"]';
  const INNER_SELECTOR = '[data-gate-scroll], .test-qsim-01';
  const END_TOLERANCE = 4; // px — page counts as "at the end" within this distance

  const gate = document.querySelector(GATE_SELECTOR);
  if (!gate) return;
  if (gate.dataset.qsimGateBound === 'true') return; // never bind twice
  const inner = gate.querySelector(INNER_SELECTOR);
  if (!inner) return;
  gate.dataset.qsimGateBound = 'true';

  const collapsedVh = parseFloat(inner.dataset.gateCollapsed) || 50;
  const duration = parseFloat(inner.dataset.gateDuration) || 0.8;

  let active = false;        // true while the container (not the page) owns scrolling
  let collapsing = false;    // true during the collapse animation (input is ignored)
  let armed = true;          // after a hand-back the page must leave the end / user must push down to re-engage
  let smootherPaused = false;
  let normalizerOff = null;
  let tween = null;
  let bound = false;
  let observer = null;
  let wasVisible = false;
  let lastTouchY = 0;

  const isVisible = () => gate.dataset.qsGateVisible === 'true';
  const isRemoved = () => gate.style.display === 'none';

  const getSmoother = () => {
    try { return typeof ScrollSmoother.get === 'function' ? ScrollSmoother.get() : null; }
    catch (_) { return null; }
  };
  const pageMax = () => {
    try { return ScrollTrigger.maxScroll(window); }
    catch (_) { return document.documentElement.scrollHeight - window.innerHeight; }
  };
  const atPageEnd = () => pageMax() - window.scrollY <= END_TOLERANCE;
  const canScroll = () => inner.scrollHeight > inner.clientHeight + 1 || inner.clientHeight < gate.clientHeight;

  // ---- expand / collapse animation ------------------------------------------
  const killTween = () => {
    if (tween) { tween.kill(); tween = null; }
  };
  const resetHeight = () => {
    killTween();
    gsap.set(inner, { clearProps: 'height' }); // back to the Webflow (collapsed) height
    collapsing = false;
  };
  const expand = () => {
    killTween();
    tween = gsap.to(inner, {
      height: '100vh',
      duration,
      ease: myEase,
      onComplete: () => { tween = null; }
    });
  };
  const collapse = (done) => {
    killTween();
    collapsing = true;
    inner.style.overflowY = 'hidden';
    tween = gsap.to(inner, {
      height: collapsedVh + 'vh',
      duration,
      ease: myEase,
      onComplete: () => {
        tween = null;
        gsap.set(inner, { clearProps: 'height' });
        collapsing = false;
        if (done) done();
      }
    });
  };

  // ---- scroll ownership -----------------------------------------------------
  // Container takes over: freeze the page, expand, let the container scroll natively.
  // Desktop: ScrollSmoother.paused(true) (same mode scripts.js uses for the consent panel).
  // Touch / Safari (no smoother): disable the global normalizer, if one exists.
  const engage = () => {
    if (active || !isVisible() || !canScroll()) return;
    active = true;
    inner.style.overflowY = 'auto';
    inner.style.overscrollBehaviorY = 'contain'; // hand-back is handled by us, not by native scroll chaining
    const smoother = getSmoother();
    if (smoother && typeof smoother.paused === 'function') {
      if (!smoother.paused()) {
        smoother.paused(true);
        smootherPaused = true;
      }
    } else {
      const normalizer = ScrollTrigger.normalizeScroll();
      if (normalizer && typeof normalizer.disable === 'function') {
        normalizer.disable();
        normalizerOff = normalizer;
      }
    }
    expand();
  };

  // Page takes over again. keepHeight: leave the container's height as is (gate is being removed).
  const release = (keepHeight) => {
    inner.style.overflowY = 'hidden';
    inner.style.overscrollBehaviorY = '';
    if (!keepHeight) resetHeight();
    if (!active) return;
    active = false;
    if (smootherPaused) {
      smootherPaused = false;
      const smoother = getSmoother();
      if (smoother && smoother.paused()) smoother.paused(false);
    }
    if (normalizerOff) {
      normalizerOff.enable();
      normalizerOff = null;
    }
  };

  // Container is at its top and the user scrolls up: collapse first, then give the page back.
  const beginHandBack = () => {
    if (!active || collapsing) return;
    armed = false;
    collapse(() => release(false));
  };

  const sync = () => {
    if (!isVisible()) return;
    if (!atPageEnd()) {
      armed = true;
      if (active && !collapsing) release(false); // page moved unexpectedly (layout shift etc.)
    } else if (!active && armed) {
      engage();
    }
  };

  // ---- input handlers (window capture: run before GSAP's nested-scroll handling) ----
  const onWheel = (e) => {
    if (!isVisible()) return;
    if (active) {
      if (collapsing) { e.preventDefault(); return; }
      if (e.deltaY < 0 && inner.scrollTop <= 0) {
        e.preventDefault();
        beginHandBack();
      }
    } else if (e.deltaY > 0 && atPageEnd()) {
      armed = true; // page already at its end and the user keeps pushing down
      engage();
    }
  };

  const onTouchStart = (e) => {
    if (e.touches && e.touches[0]) lastTouchY = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (!active || !isVisible() || !e.touches || !e.touches[0]) return;
    const y = e.touches[0].clientY;
    const dy = y - lastTouchY; // > 0: finger moving down = scrolling up
    lastTouchY = y;
    if (collapsing) { e.preventDefault(); return; }
    if (inner.scrollTop <= 0 && dy > 2) {
      e.preventDefault();
      beginHandBack();
    }
  };

  const onScroll = () => sync();

  const bind = () => {
    if (bound) return;
    bound = true;
    inner.style.overflowY = 'hidden'; // page scrolls first; JS opens the container at the page end
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
  };

  const destroy = () => {
    release(true);
    killTween();
    if (observer) { observer.disconnect(); observer = null; }
    if (!bound) return;
    bound = false;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onWheel, { capture: true });
    window.removeEventListener('touchstart', onTouchStart, { capture: true });
    window.removeEventListener('touchmove', onTouchMove, { capture: true });
  };

  // Follow gate.js: it flips data-qs-gate-visible and finally sets display:none.
  const onGateChange = () => {
    if (isRemoved()) { destroy(); return; }
    const visible = isVisible();
    if (visible && !wasVisible) {
      resetHeight();       // gate just (re)opened — container starts collapsed, at its top
      inner.scrollTop = 0;
      armed = true;
      sync();              // e.g. download click while the page is already at its end
    } else if (!visible && wasVisible) {
      release(true);       // gate is sliding out (submit): free the page, don't snap the height
    }
    wasVisible = visible;
  };

  if (isRemoved()) return; // gate.js already hid it (visitor converted before)
  bind();
  wasVisible = isVisible();
  observer = new MutationObserver(onGateChange);
  observer.observe(gate, { attributes: true, attributeFilter: ['data-qs-gate-visible', 'style'] });
}