/**
 * scripts.js — Main entry point for the QS Webflow site.
 *
 * Bundled by build.mjs (esbuild) into scripts.min.js, which is loaded in the
 * Webflow project via a <script defer> tag (see README → "Deploying to Webflow").
 *
 * What this file does, in order:
 *   1. Registers the GSAP plugins used across the site.
 *   2. Boots GSAP ScrollSmoother (desktop / non-touch only) for smooth scrolling.
 *   3. Once fonts are ready, calls every feature module's init function.
 *
 * Each `functionX()` below lives in its own file under /modules and is fully
 * self-contained: it queries the DOM for its hooks (CSS classes or [attribute]
 * selectors) and silently no-ops when those elements are absent. That is why the
 * same bundle can ship to every page — modules simply activate wherever their
 * markup exists. See each module file's header comment for its specific hooks.
 *
 * Note: a few imported modules self-initialise from their own file (e.g.
 * toggle-menu.js) and are therefore NOT called again in the list below.
 */
import "./config/locale-redirect.js";

import { gsap } from "gsap";
import { ScrollSmoother, ScrollTrigger, ScrollToPlugin, Draggable, InertiaPlugin } from "gsap/all";
import { myEase } from "./config/variables.js";
import { initIOSOptimizations } from "./config/nativescroll.js";
// import { functionTheme } from "./config/theme.js";

import { functionToggleAccordion } from "./modules/toggle/toggle-accordion.js";
import { functionToggleSearch } from "./modules/toggle/toggle-search.js";
import { functionLink } from "./modules/fixed/scrollto.js";
import { functionScrollProgress } from "./modules/fixed/progress.js";
import { functionStickyProgress } from "./modules/fixed/progress-bar.js";
import { functionFixedBar } from "./modules/fixed/bar.js";
import { functionFixedReveal } from "./modules/fixed/sticky-appear.js";
import { functionHoverButton } from "./modules/hover/button.js";
import { functionHoverLinkIcon } from "./modules/hover/link-icon.js";
import { functionHoverLinkNoIcon } from "./modules/hover/link-no-icon.js";
import { functionHoverClear } from "./modules/hover/clear.js";
import { functionHoverCards } from "./modules/hover/cards.js";
import { functionHoverServiceBar } from "./modules/hover/service-bar.js";
import { functionMagazine } from "./modules/hover/magazine.js";
import { functionSwiper } from "./modules/interactive/swiper.js";
import { functionCountdown } from "./modules/interactive/countdown.js";
import { functionGate } from "./modules/interactive/gate.js";
import { functionWebinar } from "./modules/interactive/webinar.js";
import { functionOrdering } from "./modules/interactive/ordering.js";
import { functionSticky } from "./modules/interactive/sticky.js";
import { functionFinsweetFilters } from "./modules/finsweet/filters.js";
import { functionFinsweetHightlight } from "./modules/finsweet/highlight.js";
import { functionFinsweetDepartment } from "./modules/finsweet/department.js";
import { functionDragDynamic } from "./modules/drag/draggable.js";
import { functionScrollPinVertical } from "./modules/fixed/sticky-filters.js";
import { functionNavigationMobileToggle } from "./modules/toggle/toggle-navigation.js";
import { functionNavigationMobileToggleConference } from "./modules/toggle/toggle-menu-conference.js";
import { functionConference } from "./modules/interactive/conference.js";
import { functionToggleMenu } from "./modules/toggle/toggle-menu.js";
import { functionToggleShare } from "./modules/toggle/toggle-share.js";
import { functionCookieSettingsButton } from "./modules/consent/cookie-settings.js";
import { functionInsightsTopicFilter } from "./modules/finsweet/insights-topic-filter.js";


document.addEventListener("DOMContentLoaded", function () {
  console.log("## Insights Dynamic URL [Topic filter] ##"); // ADD THIS LINE

  gsap.registerPlugin(
    ScrollTrigger,
    ScrollSmoother,
    ScrollToPlugin,
    Draggable,
    InertiaPlugin,
  );

  initIOSOptimizations();

  document.fonts.ready.then(() => {
    initializeAnimations();
  }).catch(() => {
    setTimeout(initializeAnimations, 500);
  });

  function initializeAnimations() {
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

  let smoother;
  if (!isTouchDevice) {
    const wrapper = document.querySelector("#smooth-wrapper");
    const content = document.querySelector("#smooth-content");
    if (wrapper && content) {
      try {
        const existingSmoother = typeof ScrollSmoother.get === "function"
          ? ScrollSmoother.get()
          : null;
        const hasValidInterface =
          existingSmoother &&
          typeof existingSmoother.content === "function" &&
          typeof existingSmoother.kill === "function";

        if (hasValidInterface) {
          existingSmoother.kill();
        }

        if (!existingSmoother || hasValidInterface) {
          smoother = ScrollSmoother.create({
            wrapper: "#smooth-wrapper",
            content: "#smooth-content",
            smooth: 1,
            effects: true,
            normalizeScroll: true,
            ignoreMobileResize: true
          });
        } else {
          console.warn("[QS] ScrollSmoother existing instance invalid; skipping re-init");
        }
      } catch (error) {
        console.warn("[QS] ScrollSmoother init failed", error);
        smoother = null;
      }
    }
  }

  // ── Finsweet Consent Pro: pause ScrollSmoother when prefs panel is open ──
  const consentRoot = document.querySelector('[fs-consent-element="root"]');
  if (consentRoot && consentRoot.shadowRoot) {
    const shadowRoot = consentRoot.shadowRoot;

    // ── Inject scroll fix CSS into Shadow DOM ──
    const shadowStyle = document.createElement('style');
    shadowStyle.textContent = `
      .consent_prefs_list {
        overflow-y: auto !important;
        max-height: 350px !important;
        overscroll-behavior: contain;
      }
    `;
    shadowRoot.appendChild(shadowStyle);

    // ── Stop wheel AND touch events from bubbling to ScrollSmoother ──
    const prefsList = shadowRoot.querySelector('.consent_prefs_list');
    if (prefsList) {
      prefsList.addEventListener('wheel', function(e) {
        e.stopPropagation();
      }, { passive: true });
    
      prefsList.addEventListener('touchmove', function(e) {
        e.stopPropagation();
      }, { passive: true });
    
      prefsList.addEventListener('touchstart', function(e) {
        e.stopPropagation();
      }, { passive: true });
    }

    // ── Prevent background scroll on touch devices ──
    function preventTouchScroll(e) {
      if (!e.target.closest('.consent_prefs_list')) {
        e.preventDefault();
      }
    }

    // ── Pause ScrollSmoother when prefs panel is open ──
    const consentObserver = new MutationObserver(() => {
      const prefsPanel = shadowRoot.querySelector('[fs-consent-element="preferences"]');
      if (prefsPanel) {
        const isActive = prefsPanel.hasAttribute('fs-consent-active');
        if (isActive) {
          if (smoother) smoother.paused(true);
          document.body.style.overflow = 'hidden';
          document.documentElement.style.overflow = 'hidden';
          document.addEventListener('touchmove', preventTouchScroll, { passive: false });
        } else {
          if (smoother) smoother.paused(false);
          document.body.style.overflow = '';
          document.documentElement.style.overflow = '';
          document.removeEventListener('touchmove', preventTouchScroll);
        }
      }
    });

    consentObserver.observe(shadowRoot, {
      subtree: true,
      attributes: true,
      attributeFilter: ['fs-consent-active']
    });
  }

  function functionTop() {
    gsap.to(window, { duration: 0.55, scrollTo: { y: 0 }, ease: myEase });
  }

  functionTop(); 
  functionNavigationMobileToggle();
  functionLink();
  functionToggleAccordion();
  functionToggleSearch();
  functionToggleShare();
  functionScrollProgress();
  functionStickyProgress();
  functionFixedBar();
  functionFixedReveal();
  functionHoverButton();
  functionHoverLinkIcon();
  functionHoverLinkNoIcon();
  functionHoverClear();
  functionHoverCards();
  functionHoverServiceBar();
  functionMagazine();
  functionSwiper();
  functionCountdown();
  functionFinsweetFilters();
  functionFinsweetHightlight();
  functionFinsweetDepartment();
  functionScrollPinVertical();
  functionDragDynamic();
  functionNavigationMobileToggleConference();
  functionConference();
  functionGate();
  functionWebinar();
  functionOrdering();
  functionSticky();
  functionCookieSettingsButton();
  functionInsightsTopicFilter();

  }
});