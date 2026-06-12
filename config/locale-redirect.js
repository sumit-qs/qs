// US (Eastern Time) -> /en-us redirect.
// Runs as a side-effect module so it can execute as early as possible in the bundle.

(function qsLocaleRedirectUSEastern() {
  try {
    const EN_US_PREFIX = "/en-us";
    const currentPath = window.location?.pathname || "/";
    const search = window.location?.search || "";
    const params = new URLSearchParams(search);
    const debug = params.has("qsLocaleDebug");
    const disabled = params.has("qsNoLocaleRedirect");

    if (disabled) {
      if (debug) console.log("[QS locale] redirect disabled via qsNoLocaleRedirect");
      return;
    }

    // Already on /en-us
    if (currentPath === EN_US_PREFIX || currentPath.startsWith(`${EN_US_PREFIX}/`)) return;

    // If a locale prefix is already present (e.g. /fr-fr/), don't override it.
    const localePrefixRegex = /^\/[a-z]{2}-[a-z]{2}(?:\/|$)/i;
    if (localePrefixRegex.test(currentPath)) return;

    let timeZone = null;
    try {
      timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    } catch {
      timeZone = null;
    }

    // “Miami / New York” = US Eastern Time.
    const usEasternTimeZones = new Set([
      "America/New_York",
      "US/Eastern",
      "EST5EDT",
      "America/Detroit",
      "America/Kentucky/Louisville",
      "America/Indiana/Indianapolis",
      // Common systems report Canada/Caribbean IDs for the same local time.
      "America/Toronto",
      "America/Montreal",
      "America/Nassau",
      "America/Port-au-Prince",
      "America/Iqaluit",
    ]);
    const isUSEastern = timeZone ? usEasternTimeZones.has(timeZone) : false;

    if (debug) {
      console.log("[QS locale] tz=", timeZone, "path=", currentPath, "isUSEastern=", isUSEastern);
      // Expose for quick inspection without relying on console history.
      window.__qsLocale = { timeZone, currentPath, isUSEastern };
    }

    if (!isUSEastern) return;

    const normalizedPath = currentPath.startsWith("/") ? currentPath : `/${currentPath}`;
    const targetPath = normalizedPath === "/" ? EN_US_PREFIX : `${EN_US_PREFIX}${normalizedPath}`;
    const targetUrl = `${window.location.origin}${targetPath}${window.location.search || ""}${window.location.hash || ""}`;

    // Loop guard: if something redirects us back immediately, don't thrash.
    try {
      const guardKey = "qs_locale_redirect_attempt";
      const now = Date.now();
      const last = Number(window.sessionStorage?.getItem(guardKey) || 0);
      if (last && now - last < 10_000) return;
      window.sessionStorage?.setItem(guardKey, String(now));
    } catch {
      // Ignore storage errors.
    }

    window.location.replace(targetUrl);
  } catch {
    // Fail open: never block page rendering if detection fails.
  }
})();
