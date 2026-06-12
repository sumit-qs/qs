/**
 * Service-bar link hover: nudges the label and its highlight upward.
 * Hooks: .qs-service-bar-link containing .label and .qs-service-bar-link-highlight.
 * Baseline y is read from each element so it returns to its authored position.
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionHoverServiceBar() {
  const init = () => {
    const links = Array.from(document.querySelectorAll('.qs-service-bar-link'));
    if (!links.length) return;

    links.forEach((link) => {
      const highlight = link.querySelector('.qs-service-bar-link-highlight');
      const label = link.querySelector('.label');
      if (!highlight && !label) return;

      const baseYLabel = label ? gsap.getProperty(label, 'y') : 0;
      const baseYHighlight = highlight ? gsap.getProperty(highlight, 'y') : 0;

      let enterTl = null;
      let leaveTl = null;

      const enter = () => {
        if (leaveTl) leaveTl.kill();
        if (enterTl) enterTl.kill();
        enterTl = gsap.timeline();
        if (label) enterTl.to(label, { y: (Number(baseYLabel) || 0) - 2, duration: 0.22, ease: myEase }, 0);
        if (highlight) enterTl.to(highlight, { y: -4, duration: 0.22, ease: myEase }, 0.06);
      };

      const leave = () => {
        if (enterTl) enterTl.kill();
        if (leaveTl) leaveTl.kill();
        leaveTl = gsap.timeline();
        if (highlight) leaveTl.to(highlight, { y: (Number(baseYHighlight) || 0), duration: 0.2, ease: myEase }, 0);
        if (label) leaveTl.to(label, { y: (Number(baseYLabel) || 0), duration: 0.2, ease: myEase }, 0.06);
      };

      link.addEventListener('mouseenter', enter);
      link.addEventListener('mouseleave', leave);
      link.addEventListener('focusin', enter);
      link.addEventListener('focusout', leave);
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
}
