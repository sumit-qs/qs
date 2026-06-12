/**
 * Accordion open/close.
 * Webflow hooks:
 *   [accordion='head']    – clickable header row
 *   [accordion='content'] – collapsible panel (the head's next sibling)
 *   [accordion='button'] / [accordion='line'] – chevron/plus icon that rotates
 * Every panel starts collapsed (height:0); clicking a head animates its sibling
 * content open/closed and rotates the icon.
 */
import { gsap } from "gsap";
import { DefaultSelector, myEase } from "../../config/variables.js";

export function functionToggleAccordion() {
  const TriggerAccordion = DefaultSelector.querySelectorAll("[trigger='accordion']");

  document.querySelectorAll("[accordion='content']").forEach((content) => {
    content.style.height = "0px";
    content.style.opacity = "0";
  });

  document.querySelectorAll("[accordion='head']").forEach((header) => {
    const content = header.nextElementSibling;
    const accordionButton = header.querySelector("[accordion='button']");
    const vertical = header.querySelector("[accordion='line']");

    header.addEventListener("click", () => {
      const isClosed = content.style.height === "0px" || content.style.height === "";
      if (isClosed) {
        gsap.to([accordionButton, vertical], { rotation: 180, duration: 0.5, ease: myEase, overwrite: "auto" });
        gsap.to(content, { height: "auto", opacity: 1, duration: 0.5, ease: myEase, overwrite: "auto" });
      } else {
        gsap.to([accordionButton, vertical], { rotation: -90, duration: 0.5, ease: myEase, overwrite: "auto" });
        gsap.to(content, { height: 0, opacity: 0, duration: 0.5, ease: myEase, overwrite: "auto" });
      }
    });
  });
}