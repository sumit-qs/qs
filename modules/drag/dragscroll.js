/**
 * Attribute-driven GSAP horizontal drag scrolling (ES module).
 *
 * <div qs-drag="all" class="qs-drag-all">
 *   <div class="qs-drag-track">...cards, including links...</div>
 * </div>
 *
 * qs-drag="all": active at every width.
 * qs-drag="responsive": active at/below qs-drag-breakpoint (default 991px).
 * Track: first [qs-drag-track], otherwise first .qs-drag-track.
 * Keep the matching horizontal-row/overflow CSS and call functionDragScroll()
 * after the markup exists. Existing imports and named exports are preserved.
 * Requires GSAP with Draggable and InertiaPlugin, as in the original module.
 *
 * Initialize immediately: offscreen lazy images must never gate dragging.
 * Each image load/error, CMS mutation and layout resize refreshes bounds.
 * Pointer travel is measured independently of rendered track displacement,
 * including at an edge and when a swipe returns to its starting position.
 */
import { gsap } from "gsap";
import { Draggable, InertiaPlugin } from "gsap/all";

gsap.registerPlugin(Draggable, InertiaPlugin);

const CONTAINER_SEL = '[qs-drag="all"], [qs-drag="responsive"]';
const DEFAULT_BREAKPOINT = 991;
const CLICK_MOVE_THRESHOLD = 8; // CSS pixels; also used by Draggable.
const CLICK_BLOCK_MS = 800; // Covers delayed/duplicate release clicks.
const controllers = new WeakMap();

const getTrack = (container) =>
  container.querySelector("[qs-drag-track]") ||
  container.querySelector(".qs-drag-track");

function getBounds(container, track) {
  const style = window.getComputedStyle(container);
  const left = parseFloat(style.paddingLeft) || 0;
  const right = parseFloat(style.paddingRight) || 0;
  // clientWidth excludes borders. Reserve both paddings at the end of travel.
  const availableWidth = Math.max(0, container.clientWidth - left - right);
  return { minX: Math.min(0, availableWidth - track.scrollWidth), maxX: 0 };
}

/** Capture only properties this utility/Draggable changes, not whole styles. */
function saveStyles(track) {
  const saved = [];
  const remember = (element, properties) => {
    for (const property of properties) {
      saved.push([element, property, element.style.getPropertyValue(property),
        element.style.getPropertyPriority(property)]);
    }
  };
  remember(track, ["cursor", "user-select", "-webkit-user-select", "-webkit-touch-callout"]);
  // Draggable sets/removes touch-action recursively, including on descendants.
  const seen = new WeakSet();
  const captureNew = () => [track, ...track.querySelectorAll("*")].forEach((element) => {
    if (!seen.has(element)) {
      seen.add(element);
      remember(element, ["touch-action"]);
    }
  });
  captureNew();
  const restore = () => {
    for (const [element, property, value, priority] of saved) {
      if (value) element.style.setProperty(property, value, priority);
      else element.style.removeProperty(property);
    }
  };
  return { captureNew, restore };
}

/** Independent of GSAP's animation-frame callbacks and its click heuristic. */
function installClickGuard(track) {
  const doc = track.ownerDocument;
  const win = doc.defaultView;
  const pointerEvents = "PointerEvent" in win;
  const options = { capture: true, passive: true };
  let active = null;
  let blockedUntil = 0;
  let lastTouch = -Infinity;
  let removeGestureListeners = () => {};

  const markMoved = () => {
    if (active) active.moved = true;
  };
  const measure = (point) => {
    if (active && point && Math.max(
      Math.abs(point.clientX - active.x),
      Math.abs(point.clientY - active.y)
    ) >= CLICK_MOVE_THRESHOLD) markMoved();
  };
  const pointFor = (event) => {
    if (!active) return null;
    if (active.kind === "touch") {
      return Array.from(event.changedTouches || []).find(
        (touch) => touch.identifier === active.id
      );
    }
    return active.kind !== "pointer" || event.pointerId === active.id ? event : null;
  };
  const finish = (cancelled = false) => {
    if (!active) return;
    blockedUntil = active.moved || cancelled ? Date.now() + CLICK_BLOCK_MS : 0;
    active = null;
    removeGestureListeners();
  };
  const onMove = (event) => measure(pointFor(event));
  const onEnd = (event) => {
    const point = pointFor(event);
    if (!point) return; // Another finger/pointer ending is not our release.
    if (active.kind === "touch") lastTouch = Date.now();
    measure(point); // A quick swipe may have no intermediate rendered frame.
    finish(event.type.endsWith("cancel"));
  };
  const onBlur = () => finish(true);
  const onStart = (event) => {
    if (event.type === "mousedown" && Date.now() - lastTouch < 800) return;
    if (event.button != null && event.button !== 0) return;
    if (event.isPrimary === false) { markMoved(); return; }
    if (event.touches && event.touches.length !== 1) { markMoved(); return; }
    if (active) { markMoved(); return; }
    const kind = event.type === "touchstart" ? "touch" : pointerEvents ? "pointer" : "mouse";
    if (kind === "touch") lastTouch = Date.now();
    const point = kind === "touch" ? event.changedTouches[0] : event;
    blockedUntil = 0; // A fresh intentional tap must never inherit an old drag.
    active = { kind, id: point.pointerId ?? point.identifier, x: point.clientX,
      y: point.clientY, moved: false };
    const types = kind === "pointer" ? ["pointermove", "pointerup", "pointercancel"]
      : kind === "touch" ? ["touchmove", "touchend", "touchcancel"] : ["mousemove", "mouseup"];
    doc.addEventListener(types[0], onMove, options);
    types.slice(1).forEach((type) => doc.addEventListener(type, onEnd, options));
    win.addEventListener("blur", onBlur);
    removeGestureListeners = () => {
      doc.removeEventListener(types[0], onMove, true);
      types.slice(1).forEach((type) => doc.removeEventListener(type, onEnd, true));
      win.removeEventListener("blur", onBlur);
    };
  };
  const onClick = (event) => {
    if ((active && active.moved) || Date.now() < blockedUntil) {
      event.preventDefault();
      event.stopImmediatePropagation();
      // Keep the short-lived guard for duplicate native/GSAP clicks.
      // Do not exempt detail === 0: GSAP can generate an element.click().
    }
  };
  const onKeyDown = (event) => {
    if (event.key === "Enter" || event.key === " ") blockedUntil = 0;
  };
  const startTypes = pointerEvents ? ["pointerdown"] : ["touchstart", "mousedown"];
  startTypes.forEach((type) => track.addEventListener(type, onStart, options));
  // Register before Draggable so its synthetic clicks are guarded too.
  track.addEventListener("click", onClick, true);
  track.addEventListener("keydown", onKeyDown, true);
  return {
    markMoved,
    destroy() {
      removeGestureListeners();
      active = null;
      blockedUntil = 0;
      startTypes.forEach((type) => track.removeEventListener(type, onStart, true));
      track.removeEventListener("click", onClick, true);
      track.removeEventListener("keydown", onKeyDown, true);
    },
  };
}

function setupDrag(container, track) {
  const styles = saveStyles(track);
  const guard = installClickGuard(track);
  const instance = Draggable.create(track, {
    type: "x",
    inertia: true,
    bounds: getBounds(container, track),
    cursor: "grab",
    activeCursor: "grabbing",
    edgeResistance: 0.85,
    dragClickables: true,
    minimumMovement: CLICK_MOVE_THRESHOLD,
    allowNativeTouchScrolling: true,
    onDragStart: guard.markMoved,
  })[0];
  // Horizontal gestures belong to Draggable; vertical page panning stays native.
  track.style.touchAction = "pan-y";

  let frame = 0;
  let destroyed = false;
  const refresh = () => {
    frame = 0;
    if (!destroyed) instance.applyBounds(getBounds(container, track));
  };
  const scheduleRefresh = () => {
    if (!destroyed && !frame) frame = window.requestAnimationFrame(refresh);
  };
  const resizeObserver = typeof ResizeObserver === "function"
    ? new ResizeObserver(scheduleRefresh) : null;
  const observeSizes = () => {
    if (!resizeObserver) return;
    resizeObserver.disconnect();
    resizeObserver.observe(container);
    resizeObserver.observe(track);
    // A fixed-width track's scrollWidth can change without its own box resizing.
    Array.from(track.children).forEach((child) => resizeObserver.observe(child));
  };
  const observer = new MutationObserver((records) => {
    if (records.some((record) => record.type === "childList")) {
      styles.captureNew();
      observeSizes();
    }
    scheduleRefresh();
  });
  observer.observe(track, { childList: true, subtree: true, attributes: true,
    attributeFilter: ["src", "srcset", "sizes", "width", "height", "class", "hidden"] });
  observeSizes();
  window.addEventListener("resize", scheduleRefresh);
  // Capture load/error: neither event bubbles. Works for newly added images too.
  track.addEventListener("load", scheduleRefresh, true);
  track.addEventListener("error", scheduleRefresh, true);
  refresh();

  return {
    refresh: scheduleRefresh,
    destroy() {
      destroyed = true;
      if (frame) window.cancelAnimationFrame(frame);
      observer.disconnect();
      if (resizeObserver) resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleRefresh);
      track.removeEventListener("load", scheduleRefresh, true);
      track.removeEventListener("error", scheduleRefresh, true);
      guard.destroy();
      instance.kill(); // Also stops the instance's inertia tween.
      gsap.set(track, { x: 0 });
      styles.restore();
    },
  };
}

/** Safe to call again after CMS content is inserted; no duplicate listeners. */
export function functionDragScroll() {
  document.querySelectorAll(CONTAINER_SEL).forEach((container) => {
    const track = getTrack(container);
    const mode = container.getAttribute("qs-drag");
    const value = parseInt(container.getAttribute("qs-drag-breakpoint"), 10);
    const breakpoint = Number.isFinite(value) && value >= 0 ? value : DEFAULT_BREAKPOINT;
    const previous = controllers.get(container);
    if (previous && previous.track === track && previous.mode === mode &&
        previous.breakpoint === breakpoint) {
      previous.update();
      return;
    }
    if (previous) previous.destroy();
    if (!track) { controllers.delete(container); return; }

    const mq = mode === "responsive"
      ? window.matchMedia(`(max-width: ${breakpoint}px)`) : null;
    let live = null;
    const update = () => {
      if (!mq || mq.matches) {
        if (!live) live = setupDrag(container, track); // Never wait for images.
        else live.refresh();
      } else if (live) {
        live.destroy();
        live = null;
      }
    };
    if (mq) {
      if (mq.addEventListener) mq.addEventListener("change", update);
      else mq.addListener(update); // Older Safari.
    }
    controllers.set(container, { track, mode, breakpoint, update, destroy() {
      if (mq) {
        if (mq.removeEventListener) mq.removeEventListener("change", update);
        else mq.removeListener(update);
      }
      if (live) live.destroy();
      live = null;
    } });
    update();
  });
}

/** Optional cleanup for page transitions/unmounting; call before removing markup. */
export function destroyDragScroll(root = document) {
  const containers = Array.from(root.querySelectorAll(CONTAINER_SEL));
  if (root.matches && root.matches(CONTAINER_SEL)) containers.unshift(root);
  containers.forEach((container) => {
    const controller = controllers.get(container);
    if (controller) controller.destroy();
    controllers.delete(container);
  });
}

/** Original QSIM divider API and <= 4 / > 4 behavior are unchanged. */
export function functionQsimDivider() {
  document.querySelectorAll(".qsim-list-wrapper.qs-drag-responsive").forEach((wrapper) => {
    const list = wrapper.querySelector(".qsim-list");
    if (!list) return;
    const count = list.querySelectorAll(".qsim-list-item").length;
    wrapper.setAttribute("data-qsim-count", count <= 4 ? "few" : "many");
  });
}
