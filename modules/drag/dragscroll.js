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
import { Draggable, InertiaPlugin } from "gsap/all";

gsap.registerPlugin(Draggable, InertiaPlugin);

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
  const style        = window.getComputedStyle(container);
  const paddingLeft   = parseFloat(style.paddingLeft) || 0;
  const paddingRight  = parseFloat(style.paddingRight) || 0;
  const containerWidth = container.offsetWidth;
  const trackWidth     = track.scrollWidth;
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

function initDrag(container, track) {
  if (instanceMap.has(container)) return; // already live

  const instance = Draggable.create(track, {
    type: "x",
    inertia: true,
    bounds: () => getBounds(container, track),
    cursor: "grab",
    edgeResistance: 0.85,
  })[0];

  instance.applyBounds(getBounds(container, track));
  clampToBounds(container, track, instance);

  const onResize = () => {
    instance.applyBounds(getBounds(container, track));
    clampToBounds(container, track, instance);
  };
  window.addEventListener("resize", onResize);

  // Re-measure when track content changes late (e.g. CMS list finishes render)
  const observer = new MutationObserver((records) => {
    const structural = records.some(
      (r) => r.type === "childList" && (r.addedNodes.length || r.removedNodes.length)
    );
    if (structural) onResize();
  });
  observer.observe(track, { childList: true });

  instanceMap.set(container, { instance, onResize, observer });
}

function destroyDrag(container, track) {
  const stored = instanceMap.get(container);
  if (!stored) return;
  stored.instance.kill();
  window.removeEventListener("resize", stored.onResize);
  stored.observer.disconnect();
  gsap.set(track, { x: 0 }); // reset residual transform from GSAP
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