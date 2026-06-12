/**
 * Mobile hamburger toggle for the CONFERENCE inner-nav (<=991px). Same mechanism
 * as toggle-navigation.js, but targets .qs-inner-nav-center and uses the 991px
 * breakpoint.
 *
 * KNOWN QUIRK: the window assignment at the bottom of this file references
 * `functionNavigationMobileToggle` (the name from toggle-navigation.js), not the
 * Conference export. It happens to resolve to the global set by that other module
 * once bundled, but it is misleading. The export imported by scripts.js
 * (functionNavigationMobileToggleConference) is the correct one — left as-is to
 * avoid changing runtime behaviour during handover.
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionNavigationMobileToggleConference() {
  const toggle = document.querySelector('[toggle="navigation"]');
  const headerCenter = document.querySelector('.qs-inner-nav-center');
  if (!toggle || !headerCenter) return;

  const lineOne = toggle.querySelector('.line-one');
  const lineTwo = toggle.querySelector('.line-two');
  const lineThree = toggle.querySelector('.line-three');
  if (!lineOne || !lineTwo || !lineThree) return;

  let open = false;

  const openNav = () => {
    open = true;
    gsap.killTweensOf([lineOne, lineTwo, lineThree, headerCenter]);
    gsap.to(lineOne, { y: 9.5, rotate: 45, ease: myEase, duration: 0.35, overwrite: 'auto' });
    gsap.to(lineTwo, { opacity: 0, ease: myEase, duration: 0.25, overwrite: 'auto' });
    gsap.to(lineThree, { y: -9.5, rotate: -45, ease: myEase, duration: 0.35, overwrite: 'auto' });
    gsap.set(headerCenter, { display: 'flex', willChange: 'transform', yPercent: 25 });
    gsap.to(headerCenter, { yPercent: 0, opacity: 1, duration: 0.35, ease: myEase, overwrite: 'auto', onComplete: () => gsap.set(headerCenter, { clearProps: 'willChange' }) });
  };

  const closeNav = () => {
    open = false;
    gsap.killTweensOf([lineOne, lineTwo, lineThree, headerCenter]);
    gsap.to(lineOne, { y: 0, rotate: 0, ease: myEase, duration: 0.35, overwrite: 'auto' });
    gsap.to(lineTwo, { opacity: 1, ease: myEase, duration: 0.25, overwrite: 'auto' });
    gsap.to(lineThree, { y: 0, rotate: 0, ease: myEase, duration: 0.35, overwrite: 'auto' });
    gsap.to(headerCenter, { yPercent: 25, opacity: 0, duration: 0.3, ease: myEase, overwrite: 'auto', onComplete: () => gsap.set(headerCenter, { display: 'none' }) });
    headerCenter.querySelectorAll('.qs-nav-menu-wrapper').forEach((el) => {
      gsap.set(el, { display: 'none', height: 0, opacity: 0, clearProps: 'transform' });
    });
  };

  const toggleNav = () => {
    if (window.innerWidth > 1279) return;
    open ? closeNav() : openNav();
  };

  if (window.innerWidth <= 1279) {
    gsap.set(headerCenter, { display: 'none', yPercent: 25, opacity: 0 });
  }

  toggle.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); toggleNav(); });
  headerCenter.addEventListener('click', (e) => {
    // On mobile (<=991px), do not close on header background clicks
    if (window.matchMedia && window.matchMedia('(max-width: 991px)').matches) {
      return;
    }
    if (open) closeNav();
  });

  // Reset hamburger and header when crossing to desktop
  const mql = window.matchMedia('(max-width: 991px)');
  const handleBpChange = (e) => {
    if (!e.matches) {
      // Entered desktop
      open = false;
      gsap.killTweensOf([lineOne, lineTwo, lineThree, headerCenter]);
      gsap.set(lineOne, { y: 0, rotate: 0 });
      gsap.set(lineTwo, { opacity: 1 });
      gsap.set(lineThree, { y: 0, rotate: 0 });
      gsap.set(headerCenter, { display: 'flex', clearProps: 'transform,opacity,willChange' });
    } else {
      // Entered mobile
      open = false;
      gsap.killTweensOf([lineOne, lineTwo, lineThree, headerCenter]);
      gsap.set(lineOne, { y: 0, rotate: 0 });
      gsap.set(lineTwo, { opacity: 1 });
      gsap.set(lineThree, { y: 0, rotate: 0 });
      gsap.set(headerCenter, { display: 'none', yPercent: 25, opacity: 0 });
    }
  };
  if (mql && mql.addEventListener) {
    mql.addEventListener('change', handleBpChange);
  } else if (mql && mql.addListener) {
    // Older browsers
    mql.addListener(handleBpChange);
  }
}

if (typeof window !== 'undefined') {
  window.functionNavigationMobileToggle = functionNavigationMobileToggle;
}
