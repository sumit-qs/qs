import { gsap } from "gsap";
import { ScrollSmoother, ScrollTrigger } from "gsap/all";
import { myEase } from "../../config/variables.js";

// QSIM gate — page scroll lock while the gate is visible.
//
// Scope: acts ONLY on  .qs-gate.is-qsim[data-gate="qsim-gate"]  — on any other
// page / gate it silently no-ops. It does NOT replace gate.js: gate.js still
// owns showing/hiding the gate, download blocking, form-submit unlock and
// localStorage. This module only READS the gate's state (data-qs-gate-visible /
// display) and, for as long as the gate is visible:
//
//   - freezes the page behind it (nothing but the gate container scrolls);
//   - forwards wheel / touch input made anywhere on the gate (e.g. over the
//     blurred area outside the container) to the container;
//   - releases the page again when the gate hides / is removed (form submit);
//   - animates the container: it opens COLLAPSED (default 50vh, anchored to the
//     bottom of the viewport over the blurred page), smoothly EXPANDS to 100vh as
//     soon as the user scrolls down inside it, and smoothly COLLAPSES back to 50vh
//     when the user scrolls up past its top.
//
// Consequence (by design): while locked the page cannot be scrolled back above
// 1200px, so on QSIM articles the gate stays until the form is submitted —
// exactly like the download-click case in gate.js.
//
// Desktop freeze  : ScrollSmoother.paused(true) — the same mode scripts.js uses
//                   for the consent panel. Applied only once the smooth scroll has
//                   settled, otherwise the snap could move the page back under
//                   1200px and gate.js would hide the gate again.
// Touch / Safari  : the global scroll normalizer (if any) is disabled and
//                   html/body overflow is set to hidden; previous values restored.
//
// Webflow hooks:
//   gate       -> .qs-gate  + combo class .is-qsim  + attribute data-gate="qsim-gate"
//   container  -> [data-gate-scroll]  (fallback: .test-qsim-01), a child of the gate:
//                 position absolute; bottom 0; left 0; width 100%; height 50vh; overflow auto.
//                 Optional attributes on the container:
//                   data-gate-collapsed="50"   collapsed height in vh (default 50 — keep equal to the Webflow height)
//                   data-gate-duration="0.8"   expand / collapse duration in seconds (default 0.8)
export function functionQsimGate() {
  const GATE_SELECTOR = '.qs-gate.is-qsim[data-gate="qsim-gate"]';
  const INNER_SELECTOR = '[data-gate-scroll], .test-qsim-01';
  const SETTLE_MAX_MS = 1500; // max wait for ScrollSmoother to settle before locking anyway

  const gate = document.querySelector(GATE_SELECTOR);
  if (!gate) return;
  if (gate.dataset.qsimGateBound === 'true') return; // never bind twice
  const inner = gate.querySelector(INNER_SELECTOR);
  if (!inner) return;
  gate.dataset.qsimGateBound = 'true';

  const docEl = document.documentElement;
  const collapsedVh = parseFloat(inner.dataset.gateCollapsed) || 50;
  const duration = parseFloat(inner.dataset.gateDuration) || 0.8;

  let locked = false;
  let pending = 0;               // requestAnimationFrame id while waiting for the smoother to settle
  let smootherPaused = false;    // true if WE paused the smoother
  let normalizerOff = null;      // normalizer WE disabled (touch / Safari path)
  let savedOverflow = null;      // html/body overflow before we hid it (touch / Safari path)
  let lastTouchY = 0;
  let expanded = false;          // container is (or is animating towards) 100vh
  let animating = false;         // expand / collapse tween running
  let collapsing = false;        // collapse tween running (input ignored)
  let tween = null;
  let wasVisible = false;
  let bound = false;
  let observer = null;

  const isVisible = () => gate.dataset.qsGateVisible === 'true';
  const isRemoved = () => gate.style.display === 'none';

  const getSmoother = () => {
    try { return typeof ScrollSmoother.get === 'function' ? ScrollSmoother.get() : null; }
    catch (_) { return null; }
  };

  // ---- expand / collapse ----------------------------------------------------
  const killTween = () => {
    if (tween) { tween.kill(); tween = null; }
    animating = false;
    collapsing = false;
  };
  const resetHeight = () => {
    killTween();
    gsap.set(inner, { clearProps: 'height' }); // back to the Webflow (collapsed) height
    expanded = false;
  };
  const expand = () => {
    if (expanded) return;
    killTween();
    expanded = true;
    animating = true;
    tween = gsap.to(inner, {
      height: '100vh',
      duration,
      ease: myEase,
      onComplete: () => { tween = null; animating = false; }
    });
  };
  const collapse = () => {
    if (!expanded || collapsing) return;
    killTween();
    expanded = false;
    animating = true;
    collapsing = true;
    tween = gsap.to(inner, {
      height: collapsedVh + 'vh',
      duration,
      ease: myEase,
      onComplete: () => {
        tween = null;
        animating = false;
        collapsing = false;
        gsap.set(inner, { clearProps: 'height' });
      }
    });
  };

  // ---- lock / unlock --------------------------------------------------------
  const applyLock = () => {
    pending = 0;
    if (locked || !isVisible()) return;
    locked = true;
    inner.style.overscrollBehaviorY = 'contain';
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
      savedOverflow = { html: docEl.style.overflow, body: document.body.style.overflow };
      docEl.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
  };

  const requestLock = () => {
    if (locked || pending || !isVisible()) return;
    const smoother = getSmoother();
    if (!smoother || typeof smoother.paused !== 'function' || smoother.paused()) {
      applyLock();
      return;
    }
    // Wait until the smoothed scroll position has caught up with the native one.
    const start = performance.now();
    const tick = () => {
      if (!isVisible()) { pending = 0; return; }
      const settled = Math.abs(smoother.scrollTop() - window.scrollY) < 1;
      if (settled || performance.now() - start > SETTLE_MAX_MS) applyLock();
      else pending = requestAnimationFrame(tick);
    };
    pending = requestAnimationFrame(tick);
  };

  const unlock = () => {
    if (pending) { cancelAnimationFrame(pending); pending = 0; }
    killTween(); // keep the current height — the gate is sliding out
    inner.style.overscrollBehaviorY = '';
    if (!locked) return;
    locked = false;
    if (smootherPaused) {
      smootherPaused = false;
      const smoother = getSmoother();
      if (smoother && smoother.paused()) smoother.paused(false);
    }
    if (normalizerOff) {
      normalizerOff.enable();
      normalizerOff = null;
    }
    if (savedOverflow) {
      docEl.style.overflow = savedOverflow.html;
      document.body.style.overflow = savedOverflow.body;
      savedOverflow = null;
    }
  };

  // ---- input forwarding (window capture: runs before GSAP's handlers) -------
  // Input over the container itself scrolls it natively. Input anywhere else on
  // the gate (e.g. the blurred area) is forwarded to the container.
  const onWheel = (e) => {
    if (!locked || !gate.contains(e.target)) return;
    if (collapsing) { e.preventDefault(); return; } // ignore input while collapsing
    if (e.deltaY > 0) {
      expand();                                      // scrolling down -> 50vh to 100vh
    } else if (e.deltaY < 0 && expanded && !animating && inner.scrollTop <= 0) {
      e.preventDefault();
      collapse();                                    // scrolling up past the top -> 100vh to 50vh
      return;
    }
    if (inner.contains(e.target)) return;
    e.preventDefault();
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? inner.clientHeight : 1;
    inner.scrollTop += e.deltaY * unit;
  };

  const onTouchStart = (e) => {
    if (e.touches && e.touches[0]) lastTouchY = e.touches[0].clientY;
  };
  const onTouchMove = (e) => {
    if (!locked || !e.touches || !e.touches[0]) return;
    const y = e.touches[0].clientY;
    const dy = y - lastTouchY;
    lastTouchY = y;
    if (!gate.contains(e.target)) return;
    if (collapsing) { e.preventDefault(); return; }
    if (dy < -2) {
      expand();                                      // finger up = scrolling down
    } else if (dy > 2 && expanded && !animating && inner.scrollTop <= 0) {
      e.preventDefault();
      collapse();                                    // finger down at the top = scrolling up past it
      return;
    }
    if (inner.contains(e.target)) return;
    e.preventDefault();
    inner.scrollTop -= dy;
  };

  // Safety net: the consent panel (scripts.js) un-pauses the smoother when it closes.
  const onScroll = () => {
    if (!locked) return;
    const smoother = getSmoother();
    if (smoother && typeof smoother.paused === 'function' && !smoother.paused()) {
      smoother.paused(true);
      smootherPaused = true;
    }
  };

  const bind = () => {
    if (bound) return;
    bound = true;
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    window.addEventListener('scroll', onScroll, { passive: true });
  };

  const destroy = () => {
    unlock();
    if (observer) { observer.disconnect(); observer = null; }
    if (!bound) return;
    bound = false;
    window.removeEventListener('wheel', onWheel, { capture: true });
    window.removeEventListener('touchstart', onTouchStart, { capture: true });
    window.removeEventListener('touchmove', onTouchMove, { capture: true });
    window.removeEventListener('scroll', onScroll);
  };

  // Follow gate.js: it flips data-qs-gate-visible and finally sets display:none.
  const onGateChange = () => {
    if (isRemoved()) { destroy(); return; }
    const visible = isVisible();
    if (visible && !wasVisible) {
      resetHeight();       // gate just (re)opened — container starts collapsed, at its top
      inner.scrollTop = 0;
      requestLock();
    } else if (!visible && wasVisible) {
      unlock();            // gate hiding (e.g. form submit): free the page
    }
    wasVisible = visible;
  };

  if (isRemoved()) return; // gate.js already hid it (visitor converted before)
  bind();
  wasVisible = isVisible();
  if (wasVisible) requestLock();
  observer = new MutationObserver(onGateChange);
  observer.observe(gate, { attributes: true, attributeFilter: ['data-qs-gate-visible', 'style'] });
}