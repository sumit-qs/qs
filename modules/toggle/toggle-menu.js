/**
 * Dropdown / mega-menu controller for the main nav.
 * Hooks: each .qs-nav-wrapper contains .qs-nav-container (trigger, with a
 * .qs-nav-icon-embed chevron) and .qs-nav-menu-wrapper (the panel).
 *   Desktop (>1279px): panel slides down, absolutely positioned and centered.
 *   Mobile  (<=1279px): panel expands inline (height auto) inside .qs-header-center.
 * Only one menu is open at a time (fastSwitchMenu cross-fades between triggers);
 * closes on outside click / Escape and re-lays-out on resize across the breakpoint.
 *
 * IMPORTANT: this module SELF-INITIALISES at the bottom of the file (it adds its
 * own DOMContentLoaded listener and exposes window.functionToggleMenu). Although
 * scripts.js imports it, it does NOT call functionToggleMenu() in its init list —
 * unlike most other modules.
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";

export function functionToggleMenu() {
  if (typeof gsap === 'undefined') return;

  const isUnder1280 = () => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 1279px)').matches;

  let activeMenu = null;
  let isAnimating = false;
  let __lastMobileState = null;
  const DUR = { icon: 0.25, openMobile: 0.28, closeMobile: 0.22, openDesktop: 0.35, closeDesktop: 0.22 };

  function killTweens(menuWrapper, icon) {
    if (menuWrapper) gsap.killTweensOf(menuWrapper);
    if (icon) gsap.killTweensOf(icon);
  }

  function neutralizeTransformsMobile(root) {
    if (!root) return;
    try {
      root.style.setProperty('transform', 'none', 'important');
      const all = root.querySelectorAll('*');
      all.forEach((n) => n.style.setProperty('transform', 'none', 'important'));
    } catch (e) {}
  }

function centerMenu(menuWrapper) {
  const mobile = isUnder1280();
  if (mobile) {
    gsap.set(menuWrapper, {
      position: 'static',
      clearProps: 'x,xPercent,left,right,width,top',
      width: '100%',
      x: 0, xPercent: 0
    });
  } else {
    gsap.set(menuWrapper, {
      position: 'absolute',         
      // top: 'calc(100% + 12px)',      // matches the CSS
      left: '50%',
      xPercent: -50,
      x: 0,
      transformOrigin: 'top center',
      width: 'min(1200px, calc(100vw - 64px))'
    });
  }
}
  function showMenu(trigger, menuWrapper) {
    if (isAnimating) isAnimating = false;
    const icon = trigger.querySelector('.qs-nav-icon-embed');
    const isMobile = isUnder1280();

    killTweens(menuWrapper, icon);
    centerMenu(menuWrapper);

    if (isMobile) {
      const prevTransition = menuWrapper.style.transition;
      menuWrapper.style.transition = 'none';
      neutralizeTransformsMobile(menuWrapper);
      gsap.set(menuWrapper, { y: 0 });
      void menuWrapper.offsetHeight;
      menuWrapper.style.transition = prevTransition;
      gsap.set(menuWrapper, { display: 'block', height: 0, opacity: 0 });
      const tl = gsap.timeline({ onComplete: () => { activeMenu = { trigger, menuWrapper }; } });
      if (icon) tl.to(icon, { rotation: 180, duration: DUR.icon, ease: myEase }, 0);
      tl.to(menuWrapper, { height: "auto", opacity: 1, duration: DUR.openMobile, ease: myEase, overwrite: 'auto' }, 0);
    } else {
      gsap.set(menuWrapper, { display: 'flex' });
      const tl = gsap.timeline({ onComplete: () => { activeMenu = { trigger, menuWrapper }; } });
      if (icon) tl.to(icon, { rotation: 180, duration: DUR.icon, ease: myEase }, 0);
      tl.fromTo(menuWrapper, { y: 200, opacity: 0 }, { y: 0, opacity: 1, duration: DUR.openDesktop, ease: myEase }, 0);
    }
  }

  function hideMenu(trigger, menuWrapper, callback) {
    const icon = trigger.querySelector('.qs-nav-icon-embed');
    const isMobile = isUnder1280();
    killTweens(menuWrapper, icon);

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(menuWrapper, { display: 'none' });
        activeMenu = null;
        if (callback) callback();
      }
    });

    if (icon) tl.to(icon, { rotation: 0, duration: DUR.icon, ease: myEase }, 0);

    if (isMobile) {
      const prevTransition = menuWrapper.style.transition;
      menuWrapper.style.transition = 'none';
      neutralizeTransformsMobile(menuWrapper);
      gsap.set(menuWrapper, { y: 0 });
      void menuWrapper.offsetHeight;
      menuWrapper.style.transition = prevTransition;
      tl.to(menuWrapper, { height: 0, opacity: 0, duration: DUR.closeMobile, ease: myEase, overwrite: 'auto' }, 0);
    } else {
      tl.to(menuWrapper, { y: 200, opacity: 0, duration: DUR.closeDesktop, ease: myEase }, 0);
    }
  }

  function fastSwitchMenu(prevTrigger, prevMenu, nextTrigger, nextMenu) {
    const isMobile = isUnder1280();
    const prevIcon = prevTrigger.querySelector('.qs-nav-icon-embed');
    const nextIcon = nextTrigger.querySelector('.qs-nav-icon-embed');

    killTweens(prevMenu, prevIcon);
    killTweens(nextMenu, nextIcon);

    if (isMobile) {
      const prevTransition = nextMenu.style.transition;
      nextMenu.style.transition = 'none';
      neutralizeTransformsMobile(nextMenu);
      gsap.set(nextMenu, { y: 0 });
      void nextMenu.offsetHeight;
      nextMenu.style.transition = prevTransition;
    }
    centerMenu(nextMenu);
    gsap.set(nextMenu, { display: isMobile ? 'block' : 'flex', opacity: 0, height: isMobile ? 0 : 'auto', y: isMobile ? 0 : 200 });

    const tl = gsap.timeline({
      onComplete: () => {
        activeMenu = { trigger: nextTrigger, menuWrapper: nextMenu };
        gsap.set(prevMenu, { display: 'none' });
      }
    });

    if (prevIcon) tl.to(prevIcon, { rotation: 0, duration: DUR.icon, ease: myEase }, 0);
    if (nextIcon) tl.to(nextIcon, { rotation: 180, duration: DUR.icon, ease: myEase }, 0);

    if (isMobile) {
      tl.to(prevMenu, { height: 0, opacity: 0, duration: DUR.closeMobile, ease: myEase }, 0)
        .to(nextMenu, { height: 'auto', opacity: 1, duration: DUR.openMobile, ease: myEase }, 0);
    } else {
      tl.to(prevMenu, { y: 200, opacity: 0, duration: DUR.closeDesktop, ease: myEase }, 0)
        .to(nextMenu, { y: 0, opacity: 1, duration: DUR.openDesktop, ease: myEase }, 0);
    }
  }

  let __menuInited = false;
  function init() {
    if (__menuInited) return;
    __menuInited = true;
    const navWrappers = document.querySelectorAll('.qs-nav-wrapper');

    const headerCenter = document.querySelector('.qs-header-center');
    const isMobileInit = isUnder1280();
    __lastMobileState = isMobileInit;
    if (headerCenter) {
      if (isMobileInit) {
        headerCenter.style.removeProperty('display');
      } else {
        headerCenter.style.display = 'flex';
        headerCenter.style.justifyContent = 'center';
      }
    }

    navWrappers.forEach((wrapper) => {
      const trigger = wrapper.querySelector('.qs-nav-container');
      const menuWrapper = wrapper.querySelector('.qs-nav-menu-wrapper');
      const icon = trigger?.querySelector('.qs-nav-icon-embed');
      if (!trigger || !menuWrapper || !icon) return;

      const isMobile = isUnder1280();

      if (isMobile) {
        neutralizeTransformsMobile(menuWrapper);
        gsap.set(menuWrapper, { display: 'none', height: 0, opacity: 0, y: 0 });
      } else {
        gsap.set(menuWrapper, { display: 'none', y: 200, opacity: 0 });
      }
      centerMenu(menuWrapper);

      trigger.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        if (activeMenu && activeMenu.menuWrapper === menuWrapper) {
          hideMenu(activeMenu.trigger, activeMenu.menuWrapper);
          return;
        }

        if (activeMenu) {
          fastSwitchMenu(activeMenu.trigger, activeMenu.menuWrapper, trigger, menuWrapper);
        } else {
          showMenu(trigger, menuWrapper);
        }
      });

      menuWrapper.addEventListener('click', (e) => { e.stopPropagation(); });
    });

    document.addEventListener('click', (e) => {
      if (isUnder1280()) return;
      if (activeMenu && !activeMenu.trigger.contains(e.target) && !activeMenu.menuWrapper.contains(e.target)) {
        hideMenu(activeMenu.trigger, activeMenu.menuWrapper);
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && activeMenu) hideMenu(activeMenu.trigger, activeMenu.menuWrapper);
    });

    window.addEventListener('resize', () => {
      const nowMobile = isUnder1280();
      if (nowMobile !== __lastMobileState) {
        const headerCenterEl = document.querySelector('.qs-header-center');
        if (headerCenterEl) {
          if (nowMobile) {
            headerCenterEl.style.removeProperty('display');
          } else {
            headerCenterEl.style.display = 'flex';
            headerCenterEl.style.justifyContent = 'center';
          }
        }
        __lastMobileState = nowMobile;
      }

      navWrappers.forEach((wrapper) => {
        const trigger = wrapper.querySelector('.qs-nav-container');
        const menuWrapper = wrapper.querySelector('.qs-nav-menu-wrapper');
        const icon = trigger?.querySelector('.qs-nav-icon-embed');
        if (!trigger || !menuWrapper || !icon) return;

        const isMobile = nowMobile;
        centerMenu(menuWrapper);

        if (activeMenu && activeMenu.menuWrapper === menuWrapper) {
          if (isMobile) {
            neutralizeTransformsMobile(menuWrapper);
            gsap.set(menuWrapper, { y: 0, height: 'auto', display: 'block', opacity: 1 });
          } else {
            gsap.set(menuWrapper, { height: 'auto', y: 0, display: 'flex', opacity: 1 });
          }
        } else {
          if (isMobile) {
            neutralizeTransformsMobile(menuWrapper);
            gsap.set(menuWrapper, { y: 0, height: 0, opacity: 0, display: 'none' });
          } else {
            gsap.set(menuWrapper, { height: 'auto', y: 200, opacity: 0, display: 'none' });
          }
        }
      });
    });
  }

  return {
    init,
    showMenuByWrapper: (wrapper) => {
      const trigger = wrapper.querySelector('.qs-nav-container');
      const menuWrapper = wrapper.querySelector('.qs-nav-menu-wrapper');
      if (trigger && menuWrapper) showMenu(trigger, menuWrapper);
    },
    hideActiveMenu: () => { if (activeMenu) hideMenu(activeMenu.trigger, activeMenu.menuWrapper); },
    getActiveMenu: () => activeMenu,
    testInit: () => { init(); }
  };
}

if (typeof window !== 'undefined') {
  window.functionToggleMenu = functionToggleMenu;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { const menuController = functionToggleMenu(); if (menuController) menuController.init(); });
  } else {
    const menuController = functionToggleMenu(); if (menuController) menuController.init();
  }
}