import { gsap } from "gsap";
import { myEase } from "./variables.js";

export function functionTheme(config = {}) {
  // Default configuration
  const defaultConfig = {
    defaultTheme: "theme-light", // "theme-light" or "theme-dark"
    detectSystemPreference: true, // true = use system preference, false = use defaultTheme
  };
  
  // Merge user config with defaults
  const themeConfig = { ...defaultConfig, ...config };
  
  const body = document.body;
  const toggles = document.querySelectorAll("[trigger='theme']");
  const toggleModes = document.querySelectorAll(".qs-toggle-mode");
  const circles = document.querySelectorAll(".qs-toggle-circle");
  if (!toggles.length || !toggleModes.length || !circles.length) {
    return;
  }

  // Centralized theme settings for all toggle/toggleMode/circle properties
  const themeSettings = {
    "theme-dark": {
      toggleModeBg: "var(--_theme---neutral--surface--tables)",
      circleBg: "var(--_theme---neutral--surface--on-color)",
      circleX: 16,
    },
    "theme-light": {
      toggleModeBg: "var(--_theme---neutral--surface--tables)",
      circleBg: "var(--_theme---neutral--surface--on-color)",
      circleX: 0,
    }
  };

  // Helper to resolve CSS variable if present
  function resolveCssVar(value) {
    if (typeof value === 'string' && value.startsWith('var(')) {
      const varName = value.match(/var\((--[^)]+)\)/)[1];
      return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    }
    return value;
  }

  // Helper to set theme (initial, no animation)
  function setTheme(theme) {
    body.classList.remove("theme-dark", "theme-light");
    body.classList.add(theme);
    circles.forEach((circle, i) => {
      gsap.set(circle, { x: themeSettings[theme].circleX });
      circle.style.background = resolveCssVar(themeSettings[theme].circleBg);
    });
    toggleModes.forEach((toggleMode) => {
      toggleMode.style.background = resolveCssVar(themeSettings[theme].toggleModeBg);
    });
    localStorage.setItem("theme", theme);
  }

  // Detect saved or system theme
  let savedTheme = localStorage.getItem("theme");
  if (!savedTheme) {
    if (themeConfig.detectSystemPreference) {
      const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      savedTheme = prefersDark ? "theme-dark" : "theme-light";
    } else {
      savedTheme = themeConfig.defaultTheme;
    }
  }
  setTheme(savedTheme);

  toggles.forEach((toggle) => {
    toggle.addEventListener("click", () => {
      const isDark = body.classList.contains("theme-dark");
      const newTheme = isDark ? "theme-light" : "theme-dark";
      body.classList.remove("theme-dark", "theme-light");
      body.classList.add(newTheme);
      circles.forEach((circle) => {
        gsap.to(circle, {
          x: themeSettings[newTheme].circleX,
          duration: 0.35,
          ease: myEase,
          onUpdate: () => {
            circle.style.background = resolveCssVar(themeSettings[newTheme].circleBg);
          }
        });
      });
      toggleModes.forEach((toggleMode) => {
        gsap.to(toggleMode, {
          backgroundColor: resolveCssVar(themeSettings[newTheme].toggleModeBg),
          duration: 0.35,
          ease: myEase,
        });
      });
      localStorage.setItem("theme", newTheme);
    });
  });
}