/**
 * UTM capture — stores campaign parameters for the browsing session.
 *
 * Runs on EVERY page (no DOM hooks). On the first page that carries UTM
 * parameters in the URL, the values are written to sessionStorage under
 * `qs:utm`. They survive internal navigation for the rest of the session, so a
 * visitor who lands on /insights via a campaign link and then clicks through to
 * a gated report still submits the original campaign values.
 *
 * Rules:
 *   - First touch of the session wins. A later page WITHOUT utm params never
 *     clears the stored set; a later page WITH utm params overwrites it
 *     (a new campaign click = a new attribution).
 *   - sessionStorage, not cookies: cleared when the tab closes, never read by a
 *     third party, and therefore not subject to cookie consent. (Confirm with
 *     QS legal — item 8 of the Periti spec.)
 *   - gclid / fbclid are captured too; they are useful for paid reporting and
 *     cost nothing to carry.
 *
 * Read it back anywhere with `getStoredUtms()`.
 */

const STORAGE_KEY = 'qs:utm';

export const UTM_KEYS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'fbclid',
];

export function getStoredUtms() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
  } catch (_) {
    return {};
  }
}

export function functionUtmCapture() {
  let params;
  try {
    params = new URLSearchParams(window.location.search);
  } catch (_) {
    return;
  }

  const found = {};
  UTM_KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) found[key] = value.trim().slice(0, 255);
  });

  if (!Object.keys(found).length) return; // no campaign params on this page — keep what we have

  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(found));
  } catch (_) {
    /* private mode / storage disabled — submissions simply carry no UTMs */
  }
}