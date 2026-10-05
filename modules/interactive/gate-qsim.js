import { ScrollSmoother, ScrollTrigger } from "gsap/all";

// QSIM gate — scroll hand-off (page first, then the gate's inner container).
//
// Scope: acts ONLY on  .qs-gate.is-qsim[data-gate="qsim-gate"]  — on any other
// page / gate it silently no-ops. It does NOT replace gate.js: gate.js still
// owns showing/hiding the gate, download blocking, form-submit unlock and
// localStorage. This module only reads the gate's state (data-qs-gate-visible /
// display) and, while the gate is visible, decides WHO scrolls:
//
//   1. Page scrolls first (behind the overlay), footer included.
//   2. Once the page is at its very end, the inner container scrolls.
//   3. Scrolling up: the container scrolls back to its top, then the page scrolls.
//
// Same behaviour when the gate was opened by a download click.
// When gate.js removes the gate (form submit) everything is released/unbound.
//
// Webflow hooks:
//   gate       -> .qs-gate  + combo class .is-qsim  + attribute data-gate="qsim-gate"
//   container  -> [data-gate-scroll]  (fallback: .test-qsim-01), a child of the gate;
//                 it holds the original .qs-gate-wrapper + the extra sections.
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

  let active = false;        // true while the container (not the page) owns scrolling
  let armed = true;          // after a hand-back the page must leave the end before re-engaging
  let smootherPaused = false;
  let normalizerOff = null;
  let bound = false;
  let observer = null;
  let wasVisible = false;

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
  const canScroll = () => inner.scrollHeight > inner.clientHeight + 1;

  // Container takes over: freeze the page, let the container scroll natively.
  // Desktop: ScrollSmoother.paused(true) (same mode scripts.js uses for the consent panel).
  // Touch / Safari (no smoother): disable the global normalizer, if one exists.
  const engage = () => {
    if (active || !isVisible() || !canScroll()) return;
    active = true;
    inner.style.overflowY = 'auto';
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
  };

  // Page takes over again.
  const release = () => {
    inner.style.overflowY = 'hidden';
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

  const sync = () => {
    if (!isVisible()) return;
    if (!atPageEnd()) {
      armed = true;
      if (active) release(); // page moved (touch: native scroll-chaining from container top)
    } else if (!active && armed) {
      engage();
    }
  };

  // Window capture: runs before GSAP's nested-scroll handling stops propagation.
  const onWheel = (e) => {
    if (!isVisible()) return;
    if (active) {
      // Container already at its top and user scrolls up -> hand back to the page
      if (e.deltaY < 0 && inner.scrollTop <= 0) {
        e.preventDefault();
        armed = false;
        release();
      }
    } else if (e.deltaY > 0 && atPageEnd()) {
      // Page already at its end and user keeps scrolling down -> container takes over
      armed = true;
      engage();
    }
  };

  const onScroll = () => sync();

  const bind = () => {
    if (bound) return;
    bound = true;
    inner.style.overflowY = 'hidden'; // page scrolls first; JS opens the container at the page end
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
  };

  const destroy = () => {
    release();
    if (observer) { observer.disconnect(); observer = null; }
    if (!bound) return;
    bound = false;
    window.removeEventListener('scroll', onScroll);
    window.removeEventListener('wheel', onWheel, { capture: true });
  };

  // Follow gate.js: it flips data-qs-gate-visible and finally sets display:none.
  const onGateChange = () => {
    if (isRemoved()) { destroy(); return; }
    const visible = isVisible();
    if (visible && !wasVisible) {
      inner.scrollTop = 0; // gate just (re)opened — container starts at its top
      armed = true;
      sync();              // e.g. download click while the page is already at its end
    } else if (!visible && wasVisible) {
      release();
    }
    wasVisible = visible;
  };

  if (isRemoved()) return; // gate.js already hid it (visitor converted before)
  bind();
  wasVisible = isVisible();
  observer = new MutationObserver(onGateChange);
  observer.observe(gate, { attributes: true, attributeFilter: ['data-qs-gate-visible', 'style'] });
}