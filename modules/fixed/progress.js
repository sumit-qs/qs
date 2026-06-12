/**
 * Horizontal reading-progress bar driven by scroll position.
 * Hooks: [scroll="progress"] is the fill element (animated width 0%→100%); its
 * companion [trigger="scroll-progress"] is the scrubbed region. An optional
 * [data-target] on the fill matches a specific trigger by id/data-id, otherwise
 * the first trigger is used. Uses getIOSOptimizedConfig for smooth iOS scrub.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/all";
import { getIOSOptimizedConfig } from "../../config/nativescroll.js";

gsap.registerPlugin(ScrollTrigger);

export function functionScrollProgress() {
  if (typeof gsap === 'undefined') {
    return;
  }
  
  if (typeof ScrollTrigger === 'undefined') {
    return;
  }
  
  const progressElements = document.querySelectorAll('[scroll="progress"]');
  
  if (progressElements.length === 0) {
    return;
  }
  
  const triggers = document.querySelectorAll('[trigger="scroll-progress"]');
  
  if (triggers.length === 0) {
    return;
  }
  
  progressElements.forEach((progressEl) => {
    const targetId = progressEl.getAttribute('data-target');
    let triggerElement;
    
    if (targetId) {
      triggerElement = document.querySelector(`[trigger="scroll-progress"][id="${targetId}"]`) ||
                      document.querySelector(`[trigger="scroll-progress"][data-id="${targetId}"]`);
    } else {
      triggerElement = triggers[0];
    }
    
    if (!triggerElement) {
      return;
    }
    
    gsap.set(progressEl, { width: "0%" });
    
    let config;
    try {
      config = getIOSOptimizedConfig({
        trigger: triggerElement,
        start: "top top",
        end: "bottom bottom",
        scrub: true, 
      });
    } catch (error) {
      config = {
        trigger: triggerElement,
        start: "top top",
        end: "bottom bottom",
        scrub: true, 
      };
    }
    
    gsap.to(progressEl, {
      width: "100%",
      ease: "none",
      scrollTrigger: config
    });
  });
}
