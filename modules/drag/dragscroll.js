/**
 * Generic drag-scroll utility — attribute-driven, for any repeating/section
 * content (collection lists, card grids, etc.) that needs to become a
 * horizontal draggable track on smaller breakpoints, or on all breakpoints.
 *
 * Markup pattern:
 *   <div qs-drag="all" class="qs-drag-all">          <!-- OR -->
 *   <div qs-drag="responsive" class="qs-drag-responsive">
 *     <div class="qs-drag-track"> ...cards / collection items... </div>
 *   </div>
 *
 * qs-drag="all"         → drag-scroll active at every screen size.
 *                          Pair with .qs-drag-all in CSS to force the track
 *                          into a horizontal flex row permanently.
 * qs-drag="responsive"  → drag-scroll only activates at/below the breakpoint
 *                          (default: max-width 991px — Webflow tablet).
 *                          Pair with .qs-drag-responsive in CSS behind the
 *                          same max-width media query, so the desktop layout
 *                          (grid/flex-wrap, per Figma) is untouched above it.
 *
 * The class is your CSS switch (row layout, overflow, gap, etc.) — the
 * attribute is the JS hook. Same split as the case study bento component
 * (is-responsive-drag class + drag="dynamic" attribute).
 *
 * Track element — required, marks what actually gets dragged:
 *   [qs-drag-track]  or  class="qs-drag-track"   (first match inside container wins)
 *
 * Optional per-instance override (on the [qs-drag] container):
 *   qs-drag-breakpoint="767"   custom max-width px for "responsive" mode
 *
 * Bounds auto-recalculate on window resize AND whenever the track's children
 * change — covers Finsweet/CMS collection lists that render after page load.
 */

import { gsap } from "gsap";
import { Draggable, InertiaPlugin, ScrollTrigger } from "gsap/all";

gsap.registerPlugin(Draggable, InertiaPlugin, ScrollTrigger);

/* DELETE AFTER FEATURE IS FIXED — one-time environment dump */
(() => {
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  const normalizer = typeof ScrollTrigger.normalizeScroll === "function"
    ? ScrollTrigger.normalizeScroll()
    : null;
  console.log('[qs-drag] ENV', {
    ua: navigator.userAgent,
    hasTouch,
    maxTouchPoints: navigator.maxTouchPoints,
    scrollTriggerIsTouch: ScrollTrigger.isTouch,          // 0 mouse-only, 1 touch-only, 2 both
    normalizeScrollActive: !!normalizer,                   // true = ScrollTrigger is intercepting touch globally
  });
})();
/* DELETE AFTER FEATURE IS FIXED */

const ALL_SEL            = '[qs-drag="all"]';
const RESPONSIVE_SEL     = '[qs-drag="responsive"]';
const TRACK_ATTR         = "qs-drag-track";
const TRACK_CLASS        = "qs-drag-track";
const BREAKPOINT_ATTR    = "qs-drag-breakpoint";
const DEFAULT_BREAKPOINT = 991; // px, max-width — Webflow tablet and below

// container -> { instance, onResize, observer }
const instanceMap = new WeakMap();

const getTrack = (container) =>
  container.querySelector(`[${TRACK_ATTR}]`) ||
  container.querySelector(`.${TRACK_CLASS}`);

const getBounds = (container, track) => {
  const style          = window.getComputedStyle(container);
  const paddingLeft    = parseFloat(style.paddingLeft) || 0;
  const paddingRight   = parseFloat(style.paddingRight) || 0;
  const containerWidth = container.offsetWidth;
  const trackWidth     = track.scrollWidth;

  /* DELETE AFTER FEATURE IS FIXED */
  console.log(`[qs-drag] getBounds`, {
    containerWidth,
    trackWidth,
    paddingLeft,
    paddingRight,
    minX: containerWidth - trackWidth - paddingRight + paddingLeft,
    maxX: 0,
    overflows: trackWidth > containerWidth,
  });
  /* DELETE AFTER FEATURE IS FIXED */

  return {
    minX: containerWidth - trackWidth - paddingRight + paddingLeft,
    maxX: 0,
  };
};

const clampToBounds = (container, track, instance) => {
  const b = getBounds(container, track);
  if (instance.x < b.minX) {
    gsap.to(track, { x: b.minX, duration: 0.2 });
    instance.update();
  }
  if (instance.x > b.maxX) {
    gsap.to(track, { x: b.maxX, duration: 0.2 });
    instance.update();
  }
};

// Resolves when all <img> elements inside track are loaded
function waitForImages(track) {
  const images = Array.from(track.querySelectorAll("img"));
  const pending = images.filter((img) => !img.complete);
  if (pending.length === 0) return Promise.resolve();
  return new Promise((resolve) => {
    let count = pending.length;
    const done = () => { if (--count === 0) resolve(); };
    pending.forEach((img) => {
      img.addEventListener("load",  done, { once: true });
      img.addEventListener("error", done, { once: true });
    });
  });
}

function setupDrag(container, track) {
  // touch-action defaults to "auto" (confirmed via diagnostic: both container
  // and track read "auto"), which leaves the browser free to treat a real
  // finger's gesture (which almost never moves on a perfectly straight axis)
  // as native vertical page-panning and claim it before GSAP's JS ever turns
  // it into a horizontal drag — mouse input has no such native-panning
  // concept, so it was never affected. "pan-y" cedes vertical panning to the
  // browser (so the page still scrolls normally) while taking the horizontal
  // axis away from native handling entirely, leaving it to Draggable.
  track.style.touchAction = "pan-y";
  container.style.touchAction = "pan-y";

  /* DELETE AFTER FEATURE IS FIXED */
  const containerStyle = window.getComputedStyle(container);
  const trackStyle     = window.getComputedStyle(track);
  console.log(`[qs-drag] initDrag`, {
    container,
    track,
    trackScrollWidth: track.scrollWidth,
    trackOffsetWidth: track.offsetWidth,
    containerOffsetWidth: container.offsetWidth,
    trackComputedFlexWrap: trackStyle.flexWrap,
    trackComputedWidth: trackStyle.width,
    containerTouchAction: containerStyle.touchAction, // should be "auto"/"none" — not "pan-y" fighting the drag
    trackTouchAction: trackStyle.touchAction,
  });
  /* DELETE AFTER FEATURE IS FIXED */

  const instance = Draggable.create(track, {
    type: "x",
    inertia: true,
    bounds: () => getBounds(container, track),
    cursor: "grab",
    edgeResistance: 0.85,
    // Every card is wrapped in an <a> (qsim-content-card-wrapper). Draggable's
    // default (dragClickables: false) ignores a press that starts on a
    // clickable element so the link's own click/tap still works — which means
    // it ignores EVERY real touch here, since a finger has no way to land
    // outside the anchor. dragClickables:true lets the drag start there too;
    // GSAP still tells a real tap (no movement) from a drag (movement past
    // its threshold) on its own, so tapping a card to open the article is
    // unaffected.
    dragClickables: true,
    onPress() {
      /* DELETE AFTER FEATURE IS FIXED */
      console.log('[qs-drag] onPress fired', { container, track });
      /* DELETE AFTER FEATURE IS FIXED */
      // ScrollTrigger.normalizeScroll(true) (see config/nativescroll.js) hijacks
      // touchstart/touchmove globally on iOS to smooth page-scroll momentum.
      // That global listener can swallow/compete with Draggable's own touch
      // handling on the same gesture. Pausing it for the duration of the drag
      // removes that conflict without disabling it site-wide.
      const normalizer = ScrollTrigger.normalizeScroll();
      if (normalizer) normalizer.disable();
    },
    onRelease() {
      /* DELETE AFTER FEATURE IS FIXED */
      console.log('[qs-drag] onRelease fired', { container, track });
      /* DELETE AFTER FEATURE IS FIXED */
      const normalizer = ScrollTrigger.normalizeScroll();
      if (normalizer) normalizer.enable();
    },
  })[0];

  instance.applyBounds(getBounds(container, track));
  clampToBounds(container, track, instance);

  const onResize = () => {
    instance.applyBounds(getBounds(container, track));
    clampToBounds(container, track, instance);
  };
  window.addEventListener("resize", onResize);

  const observer = new MutationObserver((records) => {
    const structural = records.some(
      (r) => r.type === "childList" && (r.addedNodes.length || r.removedNodes.length)
    );
    if (structural) onResize();
  });
  observer.observe(track, { childList: true });

  instanceMap.set(container, { instance, onResize, observer });
}

function initDrag(container, track) {
  if (instanceMap.has(container)) return; // already live
  // Card widths are fixed by CSS, so bounds are correct before images paint —
  // create the Draggable right away instead of waiting on every <img> to load.
  // Cards 2+ sit outside the viewport horizontally (that's the whole point of
  // a drag track), so with loading="lazy" images those never fire load/error
  // until they're dragged into view — which never happens if creation is
  // gated on them first. That was a deadlock: Draggable never got created at
  // all. Recalculating bounds once images do load is kept as a safety net.
  setupDrag(container, track);
  waitForImages(track).then(() => {
    const stored = instanceMap.get(container);
    if (stored) stored.onResize();
  });
}

function destroyDrag(container, track) {
  const stored = instanceMap.get(container);
  if (!stored) return;
  stored.instance.kill();
  window.removeEventListener("resize", stored.onResize);
  stored.observer.disconnect();
  gsap.set(track, { x: 0 });
  instanceMap.delete(container);
}

export function functionDragScroll() {
  // ------------------------------------------------------------------
  // qs-drag="all" — always draggable, no breakpoint logic
  // ------------------------------------------------------------------
  document.querySelectorAll(ALL_SEL).forEach((container) => {
    const track = getTrack(container);
    if (!track) return;
    initDrag(container, track);
  });

  // ------------------------------------------------------------------
  // qs-drag="responsive" — draggable only at/below breakpoint
  // ------------------------------------------------------------------
  document.querySelectorAll(RESPONSIVE_SEL).forEach((container) => {
    const track = getTrack(container);
    if (!track) return;

    const breakpoint =
      parseInt(container.getAttribute(BREAKPOINT_ATTR), 10) || DEFAULT_BREAKPOINT;
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);

    const update = () => {
      if (mq.matches) {
        initDrag(container, track);
      } else {
        destroyDrag(container, track);
      }
    };

    update();

    if (typeof mq.addEventListener === "function") {
      mq.addEventListener("change", update);
    } else if (typeof mq.addListener === "function") {
      mq.addListener(update); // Safari < 14
    }
  });
}

export function functionQsimDivider() {
  document.querySelectorAll('.qsim-list-wrapper.qs-drag-responsive').forEach((wrapper) => {
    const list = wrapper.querySelector('.qsim-list');
    if (!list) return;

    const count = list.querySelectorAll('.qsim-list-item').length;
    wrapper.setAttribute('data-qsim-count', count <= 4 ? 'few' : 'many');
  });
}