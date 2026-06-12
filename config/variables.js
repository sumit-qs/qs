/**
 * Shared animation constants used by (almost) every module.
 *
 * `myEase` is the site-wide default GSAP easing — change it here to restyle every
 * animation at once. The speed* values are a convenience duration scale (seconds)
 * for tweens. `DefaultSelector` is just `document`, used as a default query root.
 */
export const DefaultSelector = document;

export const myEase = "Expo.easeOut";
export const Linear = "none";

export const speedHigh = 0.125;
export const speedMediumHigh = 0.25;
export const speedMedium = 0.5;
export const speedMediumLow = 0.75;
export const speedLow = 1;

export const myEases = {
  ease: myEase,
  linear: Linear,
};

export const myDurations = {
  speedHigh: speedHigh,
  speedMediumHigh: speedMediumHigh,
  speedMedium: speedMedium,
  speedMediumLow: speedMediumLow,
  speedLow: speedLow,
};
