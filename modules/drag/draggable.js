/**
 * Horizontal drag-scroll carousel using GSAP Draggable + InertiaPlugin.
 * Hooks: [drag="dynamic"] (container) > .track (the dragged element).
 * Bounds are computed from container/track widths (accounting for padding) and
 * recalculated on resize, with the track clamped back inside bounds.
 */
import { gsap } from "gsap";
import { Draggable, InertiaPlugin } from "gsap/all";

gsap.registerPlugin(Draggable, InertiaPlugin);

export function functionDragDynamic() {
  const containers = document.querySelectorAll('[drag="dynamic"]');
  containers.forEach((container) => {
    const track = container.querySelector('.track');
    if (!track) return;
    const style = window.getComputedStyle(container);
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    let draggableInstance;
    function getBounds() {
      const containerWidth = container.offsetWidth;
      const trackWidth = track.scrollWidth;
      const minX = containerWidth - trackWidth - paddingRight + paddingLeft;
      const maxX = 0;
      return { minX, maxX };
    }
    draggableInstance = Draggable.create(track, {
      type: "x",
      inertia: true,
      bounds: getBounds,
      cursor: "grab",
      edgeResistance: 0.85
    })[0];
    draggableInstance.applyBounds(getBounds());
    if (draggableInstance.x < getBounds().minX) {
      gsap.to(track, { x: getBounds().minX, duration: 0 });
      draggableInstance.update();
    }
    if (draggableInstance.x > getBounds().maxX) {
      gsap.to(track, { x: getBounds().maxX, duration: 0 });
      draggableInstance.update();
    }
    window.addEventListener('resize', () => {
      if (draggableInstance) {
        draggableInstance.applyBounds(getBounds());
        if (draggableInstance.x < getBounds().minX) {
          gsap.to(track, { x: getBounds().minX, duration: 0.2 });
          draggableInstance.update();
        }
        if (draggableInstance.x > getBounds().maxX) {
          gsap.to(track, { x: getBounds().maxX, duration: 0.2 });
          draggableInstance.update();
        }
      }
    });
  });
}