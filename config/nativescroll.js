/**
 * iOS / Safari scroll optimisations for GSAP ScrollTrigger.
 *
 * Touch Safari handles `scrub: true` and momentum scrolling poorly, producing
 * janky pinned sections. These helpers detect iOS/Safari and swap in safer
 * settings (numeric scrub, normalizeScroll, lower refreshPriority).
 *
 *   - initIOSOptimizations(): called once on load from scripts.js.
 *   - getIOSOptimizedConfig(config): wrap a ScrollTrigger config to auto-tune it
 *     on iOS; pin/scrub modules use this instead of a raw config object.
 */
import { ScrollTrigger } from "gsap/all";

// iOS Safari detection
export const isIOSSafari = () => {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua);
  const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
  return isIOS || isSafari;
};

// Optimized scrub value for iOS Safari
export const getOptimizedScrub = () => {
  return isIOSSafari() ? 1 : true;
};

// iOS-optimized ScrollTrigger configuration
export const getIOSOptimizedConfig = (baseConfig = {}) => {
  const optimizedConfig = { ...baseConfig };
  
  if (isIOSSafari()) {
    // Use numeric scrub instead of boolean for smoother performance
    if (optimizedConfig.scrub === true) {
      optimizedConfig.scrub = 1;
    }
    
    // Add iOS-specific optimizations
    optimizedConfig.refreshPriority = -1;
    optimizedConfig.normalizeScroll = true;
  }
  
  return optimizedConfig;
};

// Global iOS optimizations - call this once
export const initIOSOptimizations = () => {
  if (isIOSSafari()) {
    ScrollTrigger.config({
      ignoreMobileResize: true,
      refreshPriority: -1
    });
    
    // Prevent momentum scrolling issues
    ScrollTrigger.normalizeScroll(true);
  }
};
