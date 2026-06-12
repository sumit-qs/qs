/**
 * Timezone-aware countdown timer for conference / event pages.
 *
 * Renders days/hours/minutes/seconds into [data-d]/[data-h]/[data-m]/[data-s]
 * inside each `.qs-countdown-time-container[data-target]`, ticking once a second.
 *
 * Most of this file is date handling, not animation. It gathers a target datetime
 * from several possible sources (a `data-target` attribute, `data-date`+`data-time`,
 * or the hero's visible `.qs-countdown-day` / `.qs-countdown-time` text), parses
 * many human-written formats, and resolves the EVENT's timezone from the page's
 * location text or `data-*` attributes (see the CITY_/COUNTRY_TIME_ZONE maps) so
 * the countdown is correct regardless of the visitor's own timezone.
 *
 * Several helpers (attemptParseDateTime, resolveTimeZone, zonedTimeToUtc, …) are
 * exported and reused by webinar.js. Debugging: window.QS_COUNTDOWN_DEBUG = true
 * (or a per-element data-debug-countdown). Override zones via
 * window.QS_TIMEZONE_OVERRIDES or a per-element data-timezone.
 */
let countdownInterval;

// Extend these maps as new event locations are added.
const CITY_TIME_ZONE_OVERRIDES = {
  india: {
    goa: "Asia/Kolkata",
    mumbai: "Asia/Kolkata",
    delhi: "Asia/Kolkata",
    bengaluru: "Asia/Kolkata",
    bangalore: "Asia/Kolkata",
    hyderabad: "Asia/Kolkata",
    chennai: "Asia/Kolkata",
    pune: "Asia/Kolkata",
    gurgaon: "Asia/Kolkata",
    gurugram: "Asia/Kolkata"
  },
  "united states": {
    atlanta: "America/New_York",
    austin: "America/Chicago",
    boston: "America/New_York",
    chicago: "America/Chicago",
    dallas: "America/Chicago",
    denver: "America/Denver",
    houston: "America/Chicago",
    "las vegas": "America/Los_Angeles",
    "los angeles": "America/Los_Angeles",
    miami: "America/New_York",
    "new york": "America/New_York",
    orlando: "America/New_York",
    phoenix: "America/Phoenix",
    "san diego": "America/Los_Angeles",
    "san francisco": "America/Los_Angeles",
    "san jose": "America/Los_Angeles",
    "san antonio": "America/Chicago",
    seattle: "America/Los_Angeles",
    washington: "America/New_York"
  },
  canada: {
    calgary: "America/Edmonton",
    edmonton: "America/Edmonton",
    montreal: "America/Toronto",
    ottawa: "America/Toronto",
    toronto: "America/Toronto",
    vancouver: "America/Vancouver",
    winnipeg: "America/Winnipeg"
  },
  australia: {
    adelaide: "Australia/Adelaide",
    brisbane: "Australia/Brisbane",
    melbourne: "Australia/Melbourne",
    perth: "Australia/Perth",
    sydney: "Australia/Sydney",
    "gold coast": "Australia/Brisbane"
  },
  brazil: {
    brasilia: "America/Sao_Paulo",
    "rio de janeiro": "America/Sao_Paulo",
    "sao paulo": "America/Sao_Paulo",
    manaus: "America/Manaus"
  },
  mexico: {
    cancun: "America/Cancun",
    guadalajara: "America/Mexico_City",
    "mexico city": "America/Mexico_City",
    monterrey: "America/Monterrey",
    tijuana: "America/Tijuana"
  },
  indonesia: {
    jakarta: "Asia/Jakarta",
    yogyakarta: "Asia/Jakarta",
    surabaya: "Asia/Jakarta",
    bali: "Asia/Makassar",
    denpasar: "Asia/Makassar"
  },
  "united arab emirates": {
    dubai: "Asia/Dubai",
    "abu dhabi": "Asia/Dubai"
  },
  qatar: {
    doha: "Asia/Qatar"
  },
  "saudi arabia": {
    riyadh: "Asia/Riyadh",
    jeddah: "Asia/Riyadh"
  },
  china: {
    beijing: "Asia/Shanghai",
    shanghai: "Asia/Shanghai",
    shenzhen: "Asia/Shanghai",
    guangzhou: "Asia/Shanghai"
  },
  "south africa": {
    "cape town": "Africa/Johannesburg",
    johannesburg: "Africa/Johannesburg"
  },
  "new zealand": {
    auckland: "Pacific/Auckland",
    wellington: "Pacific/Auckland"
  }
};

const COUNTRY_TIME_ZONE_DEFAULTS = {
  india: "Asia/Kolkata",
  singapore: "Asia/Singapore",
  "united arab emirates": "Asia/Dubai",
  uae: "Asia/Dubai",
  qatar: "Asia/Qatar",
  bahrain: "Asia/Bahrain",
  oman: "Asia/Muscat",
  kuwait: "Asia/Kuwait",
  jordan: "Asia/Amman",
  lebanon: "Asia/Beirut",
  egypt: "Africa/Cairo",
  "saudi arabia": "Asia/Riyadh",
  turkiye: "Europe/Istanbul",
  turkey: "Europe/Istanbul",
  israel: "Asia/Jerusalem",
  "south africa": "Africa/Johannesburg",
  nigeria: "Africa/Lagos",
  kenya: "Africa/Nairobi",
  ghana: "Africa/Accra",
  morocco: "Africa/Casablanca",
  "united kingdom": "Europe/London",
  uk: "Europe/London",
  ireland: "Europe/Dublin",
  france: "Europe/Paris",
  germany: "Europe/Berlin",
  spain: "Europe/Madrid",
  portugal: "Europe/Lisbon",
  italy: "Europe/Rome",
  switzerland: "Europe/Zurich",
  austria: "Europe/Vienna",
  belgium: "Europe/Brussels",
  netherlands: "Europe/Amsterdam",
  denmark: "Europe/Copenhagen",
  norway: "Europe/Oslo",
  sweden: "Europe/Stockholm",
  finland: "Europe/Helsinki",
  poland: "Europe/Warsaw",
  hungary: "Europe/Budapest",
  "czech republic": "Europe/Prague",
  czech: "Europe/Prague",
  romania: "Europe/Bucharest",
  bulgaria: "Europe/Sofia",
  greece: "Europe/Athens",
  croatia: "Europe/Zagreb",
  serbia: "Europe/Belgrade",
  slovenia: "Europe/Ljubljana",
  slovakia: "Europe/Bratislava",
  estonia: "Europe/Tallinn",
  latvia: "Europe/Riga",
  lithuania: "Europe/Vilnius",
  iceland: "Atlantic/Reykjavik",
  argentina: "America/Argentina/Buenos_Aires",
  chile: "America/Santiago",
  colombia: "America/Bogota",
  peru: "America/Lima",
  "dominican republic": "America/Santo_Domingo",
  panama: "America/Panama",
  "costa rica": "America/Costa_Rica",
  japan: "Asia/Tokyo",
  china: "Asia/Shanghai",
  "hong kong": "Asia/Hong_Kong",
  taiwan: "Asia/Taipei",
  "south korea": "Asia/Seoul",
  malaysia: "Asia/Kuala_Lumpur",
  thailand: "Asia/Bangkok",
  vietnam: "Asia/Ho_Chi_Minh",
  philippines: "Asia/Manila",
  indonesia: undefined,
  pakistan: "Asia/Karachi",
  bangladesh: "Asia/Dhaka",
  "sri lanka": "Asia/Colombo",
  nepal: "Asia/Kathmandu"
};

const MONTH_LOOKUP = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

const dtfCache = new Map();
let overrideMapCache;
const locationCache = new WeakMap();

function sanitizeTimeZone(zone) {
  if (!zone) return undefined;
  const trimmed = zone.trim();
  if (!trimmed) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed }).format(new Date());
    return trimmed;
  } catch (err) {
    return undefined;
  }
}

function normalizeToken(value) {
  if (!value) return "";
  return value
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function sanitizeDateTimeInput(raw) {
  if (!raw) return "";
  let value = raw
    .replace(/[\u2012-\u2015]/g, "-")
    .replace(/\b(\d{1,2})(st|nd|rd|th)\b/gi, "$1")
    .replace(/\b([AP])\.?M\.?\b/gi, (m, ap) => `${ap.toUpperCase()}M`)
    .replace(/\bGMT[+-]?\d{1,2}(?::?\d{2})?\b/gi, "")
    .replace(/\bUTC[+-]?\d{1,2}(?::?\d{2})?\b/gi, "")
    .replace(/\((?:GMT|UTC)[^)]*\)$/i, "")
    .replace(/\s+\b([A-Z]{3,5})\b$/g, (match, abbr) => {
      const lower = abbr.toLowerCase();
      if (lower === "am" || lower === "pm") return ` ${abbr}`;
      return "";
    })
    .replace(/\s*,\s*$/g, "")
    .replace(/\s+/g, " ");

  value = value.trim();
  return value;
}

function normalizeLookupKey(value) {
  if (!value) return "";
  if (typeof value !== "string") return "";
  return value
    .replace(/[,/]+/g, "|")
    .split("|")
    .map((segment) => normalizeToken(segment))
    .filter(Boolean)
    .join("|");
}

function normalizePair(city, country) {
  const cityKey = normalizeToken(city);
  const countryKey = normalizeToken(country);
  if (cityKey && countryKey) return `${cityKey}|${countryKey}`;
  if (countryKey) return countryKey;
  return cityKey;
}

function getOverrideMap() {
  if (overrideMapCache) return overrideMapCache;
  const map = new Map();

  if (typeof window !== "undefined") {
    const overrides = window.QS_TIMEZONE_OVERRIDES;
    if (overrides && typeof overrides === "object") {
      Object.entries(overrides).forEach(([rawKey, zone]) => {
        if (typeof zone !== "string") return;
        const normalizedKey = normalizeLookupKey(rawKey);
        if (!normalizedKey) return;
        const sanitizedZone = sanitizeTimeZone(zone);
        if (!sanitizedZone) return;
        map.set(normalizedKey, sanitizedZone);
      });
    }
  }

  overrideMapCache = map;
  return map;
}

function lookupOverride(key) {
  if (!key) return undefined;
  const map = getOverrideMap();
  return map.get(key);
}

function findCityOverride(city, country) {
  if (!city) return undefined;
  const cityKey = normalizeToken(city);
  if (!cityKey) return undefined;
  const countryKey = normalizeToken(country);

  if (countryKey && CITY_TIME_ZONE_OVERRIDES[countryKey]) {
    const cityMap = CITY_TIME_ZONE_OVERRIDES[countryKey];
    if (Object.prototype.hasOwnProperty.call(cityMap, cityKey)) {
      return cityMap[cityKey];
    }
  }

  if (CITY_TIME_ZONE_OVERRIDES["*"] && CITY_TIME_ZONE_OVERRIDES["*"][cityKey]) {
    return CITY_TIME_ZONE_OVERRIDES["*"][cityKey];
  }

  for (const [countryName, cityMap] of Object.entries(CITY_TIME_ZONE_OVERRIDES)) {
    if (countryName === "*") continue;
    if (cityMap && Object.prototype.hasOwnProperty.call(cityMap, cityKey)) {
      return cityMap[cityKey];
    }
  }

  return undefined;
}

export function determineParseOptions(el, location) {
  const options = {};
  const assignDayFirst = (value) => {
    if (!Object.prototype.hasOwnProperty.call(options, "dayFirst")) {
      options.dayFirst = value;
    }
  };

  const formatAttr = (el?.getAttribute("data-date-format") || "").trim().toLowerCase();
  if (formatAttr && formatAttr !== "auto") {
    if (formatAttr.includes("dmy") || formatAttr.includes("day")) assignDayFirst(true);
    if (formatAttr.includes("mdy") || formatAttr.includes("month")) assignDayFirst(false);
  }

  if (!Object.prototype.hasOwnProperty.call(options, "dayFirst")) {
    if (typeof window !== "undefined") {
      const globalFormat = window.QS_COUNTDOWN_DATEFORMAT;
      if (typeof globalFormat === "string") {
        const normalized = globalFormat.trim().toLowerCase();
        if (normalized.includes("dmy") || normalized.includes("day")) assignDayFirst(true);
        if (normalized.includes("mdy") || normalized.includes("month")) assignDayFirst(false);
      } else if (typeof globalFormat === "boolean") {
        assignDayFirst(Boolean(globalFormat));
      }
    }
  }

  if (
    !Object.prototype.hasOwnProperty.call(options, "dayFirst") &&
    location &&
    typeof location === "object"
  ) {
    const locationFormat = (location.dateFormat || "").toString().trim().toLowerCase();
    if (locationFormat.includes("dmy") || locationFormat.includes("day")) assignDayFirst(true);
    if (locationFormat.includes("mdy") || locationFormat.includes("month")) assignDayFirst(false);
  }

  return options;
}

function gatherInputs(el, parseOptions = {}) {
  const inputs = [];
  const debugGather =
    typeof window !== "undefined" && Boolean(window.QS_COUNTDOWN_DEBUG);

  const addCandidate = (raw, parsed, sanitized, priority, source) => {
    const safeRaw = (raw || "").trim();
    if (!safeRaw) return;
    const safeSanitized = sanitized != null ? sanitized : sanitizeDateTimeInput(safeRaw);
    inputs.push({
      raw: safeRaw,
      sanitized: safeSanitized,
      parsed,
      priority: Number.isFinite(priority) ? priority : 0,
      source: source || "unknown"
    });
  };

  let heroRoot = el.closest(".qs-conference-hero-content");
  let heroRootSource = heroRoot ? "closest" : null;
  if (!heroRoot && typeof document !== "undefined") {
    heroRoot = document.querySelector(".qs-conference-hero-content");
    heroRootSource = heroRoot ? "document" : null;
  }

  if (debugGather) {
    if (heroRoot) {
      console.info("[QS Countdown] hero root located", {
        source: heroRootSource || "unknown",
        hasDay: Boolean(heroRoot.querySelector(".qs-countdown-day")),
        hasTime: Boolean(heroRoot.querySelector(".qs-countdown-time")),
        hasTimerBlock: Boolean(heroRoot.querySelector(".qs-countdown-timer"))
      });
    } else {
      console.warn("[QS Countdown] hero root not found near countdown element");
    }
  }

  if (heroRoot) {
    const dayEl = heroRoot.querySelector(".qs-countdown-day");
    const timeEl = heroRoot.querySelector(".qs-countdown-time");
    const dayText = (dayEl?.textContent || "").trim();
    const timeText = (timeEl?.textContent || "").trim();
    if (dayText) {
      const combined = `${dayText}${timeText ? ` ${timeText}` : ""}`.trim();
      const heroComponents = composeHeroDateTime(dayText, timeText, parseOptions);
      if (heroComponents) {
        const sanitized = sanitizeDateTimeInput(combined);
        addCandidate(
          combined,
          {
            type: "parts",
            components: {
              year: heroComponents.year,
              month: heroComponents.month,
              day: heroComponents.day,
              hour: heroComponents.hour,
              minute: heroComponents.minute,
              second: heroComponents.second,
              millisecond: heroComponents.millisecond
            }
          },
          sanitized,
          heroComponents.__hadExplicitTime ? 50 : 20,
          heroComponents.__hadExplicitTime ? "hero-day+time" : "hero-day"
        );
        if (debugGather) {
          console.info("[QS Countdown] hero day/time components", {
            dayText,
            timeText,
            combined,
            heroComponents
          });
        }
      } else if (combined) {
        const sanitized = sanitizeDateTimeInput(combined);
        addCandidate(
          combined,
          attemptParseDateTime(combined, parseOptions),
          sanitized,
          timeText ? 25 : 15,
          timeText ? "hero-day+time-fallback" : "hero-day-fallback"
        );
        if (debugGather) {
          console.warn("[QS Countdown] hero day/time fallback parse", {
            dayText,
            timeText,
            combined
          });
        }
      }
    }

    const timerBlock = heroRoot.querySelector(".qs-countdown-timer");
    if (timerBlock) {
      const fromTimer = (timerBlock.textContent || "").trim();
      if (fromTimer) {
        const sanitized = sanitizeDateTimeInput(fromTimer);
        addCandidate(
          fromTimer,
          attemptParseDateTime(fromTimer, parseOptions),
          sanitized,
          18,
          "timer-block"
        );
        if (debugGather) {
          console.info("[QS Countdown] timer block candidate", { value: fromTimer });
        }
      }
    }
  }

  const primary = (el.getAttribute("data-target") || "").trim();
  if (primary) {
    const sanitized = sanitizeDateTimeInput(primary);
    addCandidate(primary, attemptParseDateTime(primary, parseOptions), sanitized, 5, "data-target");
  }

  const dataDate = el.getAttribute("data-date");
  const dataTime = el.getAttribute("data-time");
  if (dataDate || dataTime) {
    const combined = `${dataDate || ""}${dataDate && dataTime ? " " : ""}${dataTime || ""}`.trim();
    if (combined) {
      const sanitized = sanitizeDateTimeInput(combined);
      addCandidate(
        combined,
        parseDateAndTime(dataDate || "", dataTime || "", parseOptions),
        sanitized,
        10,
        dataDate && dataTime ? "data-date+time" : "data-date"
      );
    }
  }

  inputs.sort((a, b) => b.priority - a.priority);
  return inputs;
}

function computeTargetTimestamp(inputs, timeZone) {
  const debugCompute =
    typeof window !== "undefined" && Boolean(window.QS_COUNTDOWN_DEBUG);
  for (const candidate of inputs) {
    if (candidate.parsed) {
      if (candidate.parsed.type === "absolute") {
        if (debugCompute) {
          console.info("[QS Countdown] using absolute timestamp", {
            candidate
          });
        }
        return {
          timestamp: candidate.parsed.timestamp,
          source: "absolute",
          inputSource: candidate.source
        };
      }
      if (timeZone) {
        try {
          const zonedTs = zonedTimeToUtc(candidate.parsed.components, timeZone);
          if (Number.isFinite(zonedTs)) {
            if (debugCompute) {
              console.info("[QS Countdown] zoned time conversion success", {
                candidate,
                timeZone,
                zonedTs
              });
            }
            return {
              timestamp: zonedTs,
              source: `zoned:${timeZone}`,
              inputSource: candidate.source
            };
          }
        } catch (err) {
          // ignore invalid conversions
          if (debugCompute) {
            console.warn("[QS Countdown] zoned time conversion failed", {
              candidate,
              timeZone,
              error: err instanceof Error ? err.message : err
            });
          }
        }
      }
    }

    const fallback = Date.parse(candidate.sanitized || candidate.raw);
    if (!Number.isNaN(fallback)) {
      if (debugCompute) {
        console.info("[QS Countdown] using native Date.parse fallback", {
          candidate,
          fallback
        });
      }
      return {
        timestamp: fallback,
        source: "native",
        inputSource: candidate.source
      };
    }
  }

  if (debugCompute) {
    console.warn("[QS Countdown] no valid timestamp derived from inputs", {
      inputs,
      timeZone
    });
  }
  return { timestamp: null, source: "unparsed" };
}

function getLocationFromAttributes(el) {
  if (!el || typeof el.getAttribute !== "function") return null;
  const cityAttr =
    (el.getAttribute("data-city") ||
      el.getAttribute("data-location-city") ||
      el.getAttribute("data-city-name") ||
      "").trim();
  const countryAttr =
    (el.getAttribute("data-country") ||
      el.getAttribute("data-location-country") ||
      el.getAttribute("data-country-name") ||
      "").trim();
  if (cityAttr || countryAttr) {
    return {
      city: cityAttr || undefined,
      country: countryAttr || undefined
    };
  }

  const locationAttr = (el.getAttribute("data-location") || "").trim();
  if (locationAttr) {
    const parts = locationAttr.split(",");
    if (parts.length === 1) {
      return { country: parts[0].trim() };
    }
    if (parts.length >= 2) {
      return {
        city: parts[0].trim(),
        country: parts.slice(1).join(",").trim()
      };
    }
  }

  return null;
}

function extractLocationFromContainer(container) {
  if (!container) return null;

  const attrLocation = getLocationFromAttributes(container);
  if (attrLocation) return attrLocation;

  const blocks = Array.from(container.querySelectorAll(".qs-label-location"))
    .filter((node) => !node.classList.contains("alt"));

  for (const block of blocks) {
    const tokens = Array.from(block.querySelectorAll(".body, [data-location-token]"))
      .map((node) => (node.textContent || "").trim())
      .filter(Boolean)
      .filter((text) => !/^,+$/.test(text));

    if (!tokens.length) continue;

    const filtered = tokens
      .map((text) => text.replace(/\s+/g, " ").trim())
      .filter((text) => /[A-Za-z]/.test(text));

    if (!filtered.length) continue;

    if (filtered.length >= 2) {
      return {
        city: filtered[0],
        country: filtered.slice(1).join(" ")
      };
    }

    if (filtered.length === 1 && !/\d/.test(filtered[0])) {
      return { country: filtered[0] };
    }
  }

  return null;
}

export function findLocationForElement(el) {
  if (!el) return null;
  if (locationCache.has(el)) return locationCache.get(el);

  const attrLocation = getLocationFromAttributes(el);
  if (attrLocation) {
    locationCache.set(el, attrLocation);
    return attrLocation;
  }

  const roots = [
    el.closest("[data-location-root]"),
    el.closest(".qs-conference-hero-content"),
    el.closest(".qs-section"),
    document
  ];

  for (const root of roots) {
    if (!root) continue;
    if (locationCache.has(root)) {
      const cached = locationCache.get(root);
      if (cached) {
        locationCache.set(el, cached);
        return cached;
      }
      continue;
    }
    const discovered = extractLocationFromContainer(root);
    locationCache.set(root, discovered);
    if (discovered) {
      locationCache.set(el, discovered);
      return discovered;
    }
  }

  locationCache.set(el, null);
  return null;
}

export function resolveTimeZone(location, manualZone) {
  const direct = sanitizeTimeZone(manualZone);
  if (direct) return direct;
  if (!location) return undefined;
  const { city, country } = location;
  const pairKey = normalizePair(city, country);
  const cityKey = normalizeToken(city);
  const countryKey = normalizeToken(country);

  const override = lookupOverride(pairKey) || lookupOverride(cityKey) || lookupOverride(countryKey);
  if (override) return override;

  const cityOverride = findCityOverride(city, country);
  if (cityOverride) return cityOverride;

  if (countryKey && Object.prototype.hasOwnProperty.call(COUNTRY_TIME_ZONE_DEFAULTS, countryKey)) {
    const countryZone = COUNTRY_TIME_ZONE_DEFAULTS[countryKey];
    if (countryZone) return countryZone;
  }

  return undefined;
}

function getTimeZoneFormatter(timeZone) {
  if (!timeZone) return undefined;
  if (!dtfCache.has(timeZone)) {
    dtfCache.set(
      timeZone,
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour12: false,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3
      })
    );
  }
  return dtfCache.get(timeZone);
}

function getTimeZoneOffset(date, timeZone) {
  const formatter = getTimeZoneFormatter(timeZone);
  if (!formatter) return 0;
  const parts = formatter.formatToParts(date);
  const data = {};
  parts.forEach(({ type, value }) => {
    if (type !== "literal") data[type] = value;
  });
  const year = Number(data.year);
  const month = Number(data.month);
  const day = Number(data.day);
  const hour = Number(data.hour);
  const minute = Number(data.minute);
  const second = Number(data.second);
  const ms = data.fractionalSecond ? Number(data.fractionalSecond) : 0;
  const asUTC = Date.UTC(year, month - 1, day, hour, minute, second, ms);
  return asUTC - date.getTime();
}

export function zonedTimeToUtc(parts, timeZone) {
  const {
    year,
    month,
    day,
    hour = 0,
    minute = 0,
    second = 0,
    millisecond = 0
  } = parts;
  const initial = new Date(Date.UTC(year, month - 1, day, hour, minute, second, millisecond));
  const offset = getTimeZoneOffset(initial, timeZone);
  let utcMs = initial.getTime() - offset;
  const adjusted = new Date(utcMs);
  const adjustedOffset = getTimeZoneOffset(adjusted, timeZone);
  if (adjustedOffset !== offset) {
    utcMs = initial.getTime() - adjustedOffset;
  }
  return utcMs;
}

function normalizeMilliseconds(fragment) {
  if (!fragment) return 0;
  const padded = fragment.padEnd(3, "0").slice(0, 3);
  return Number(padded);
}

function normalizeYear(year) {
  if (!Number.isFinite(year)) return null;
  if (year >= 100) return year;
  if (year >= 70) return 1900 + year;
  return 2000 + year;
}

function parseHeroDay(dayText, options = {}) {
  const sanitized = sanitizeDateTimeInput(dayText);
  if (!sanitized) return null;

  let match = sanitized.match(/^([A-Za-z\.]+)\s+(\d{1,2})\s*,?\s*(\d{4})$/i);
  if (match) {
    const [, monthName, day, year] = match;
    const month = MONTH_LOOKUP[normalizeToken(monthName)];
    if (!month) return null;
    return { year: Number(year), month, day: Number(day) };
  }

  match = sanitized.match(/^(\d{1,2})\s+([A-Za-z\.]+)\s+(\d{4})$/i);
  if (match) {
    const [, day, monthName, year] = match;
    const month = MONTH_LOOKUP[normalizeToken(monthName)];
    if (!month) return null;
    return { year: Number(year), month, day: Number(day) };
  }

  match = sanitized.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (match) {
    const [, year, month, day] = match;
    return { year: Number(year), month: Number(month), day: Number(day) };
  }

  match = sanitized.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (match) {
    const [, first, second, yearPart] = match;
    const resolvedYear = normalizeYear(Number(yearPart));
    if (!resolvedYear) return null;
    const firstNum = Number(first);
    const secondNum = Number(second);
    const dayFirst = options.dayFirst === true;
    const monthFirst = options.dayFirst === false;

    let month;
    let day;

    if (firstNum > 12 && secondNum <= 12) {
      day = firstNum;
      month = secondNum;
    } else if (secondNum > 12 && firstNum <= 12) {
      month = firstNum;
      day = secondNum;
    } else if (dayFirst) {
      day = firstNum;
      month = secondNum;
    } else if (monthFirst) {
      month = firstNum;
      day = secondNum;
    } else {
      month = firstNum;
      day = secondNum;
    }

    return { year: resolvedYear, month, day };
  }

  return null;
}

function parseHeroTime(timeText) {
  const sanitized = sanitizeDateTimeInput(timeText);
  if (!sanitized) {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      hadTime: false
    };
  }

  const match = sanitized.match(
    /^(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d{1,3}))?\s*(am|pm)?$/i
  );
  if (!match) {
    return {
      hour: 0,
      minute: 0,
      second: 0,
      millisecond: 0,
      hadTime: false
    };
  }

  let [, hour = "0", minute = "0", second = "0", msFragment = "", ampm] = match;
  let normalizedHour = Number(hour);
  if (!Number.isFinite(normalizedHour)) normalizedHour = 0;
  if (ampm) {
    const marker = ampm.toLowerCase();
    if (marker === "pm" && normalizedHour < 12) normalizedHour += 12;
    if (marker === "am" && normalizedHour === 12) normalizedHour = 0;
  }

  return {
    hour: normalizedHour,
    minute: Number(minute) || 0,
    second: Number(second) || 0,
    millisecond: normalizeMilliseconds(msFragment || ""),
    hadTime: true
  };
}

export function composeHeroDateTime(dayText, timeText, options = {}) {
  const dayParts = parseHeroDay(dayText, options);
  if (!dayParts) return null;
  const timeParts = parseHeroTime(timeText || "");

  return {
    year: dayParts.year,
    month: dayParts.month,
    day: dayParts.day,
    hour: timeParts.hour,
    minute: timeParts.minute,
    second: timeParts.second,
    millisecond: timeParts.millisecond,
    __hadExplicitTime: Boolean(timeText && timeParts.hadTime)
  };
}

export function attemptParseDateTime(raw, options = {}) {
  const value = sanitizeDateTimeInput(raw);
  if (!value) return null;

  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(value)) {
    const ts = Date.parse(value);
    if (!Number.isNaN(ts)) {
      return { type: "absolute", timestamp: ts };
    }
  }

  const isoMatch = value.match(
    /^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})(?:[T\s](\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d{1,3}))?)?$/
  );
  if (isoMatch) {
    const [, year, month, day, hour = "0", minute = "0", second = "0", msFragment] = isoMatch;
    return {
      type: "parts",
      components: {
        year: Number(year),
        month: Number(month),
        day: Number(day),
        hour: Number(hour),
        minute: Number(minute),
        second: Number(second),
        millisecond: normalizeMilliseconds(msFragment || "")
      }
    };
  }

  const textualMatch = value.match(
    /^(\d{1,2})\s+([A-Za-z\.]+)\s+(\d{4})(?:[,\s]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d{1,3}))?)?\s*(am|pm)?$/i
  );
  if (textualMatch) {
    const [,
      day,
      monthName,
      year,
      hour = "0",
      minute = "0",
      second = "0",
      msFragment,
      ampm
    ] = textualMatch;
    const month = MONTH_LOOKUP[normalizeToken(monthName)];
    if (!month) return null;
    let normalizedHour = Number(hour);
    if (ampm) {
      const marker = ampm.toLowerCase();
      if (marker === "pm" && normalizedHour < 12) normalizedHour += 12;
      if (marker === "am" && normalizedHour === 12) normalizedHour = 0;
    }
    return {
      type: "parts",
      components: {
        year: Number(year),
        month,
        day: Number(day),
        hour: normalizedHour,
        minute: Number(minute),
        second: Number(second),
        millisecond: normalizeMilliseconds(msFragment || "")
      }
    };
  }

  const textualMonthFirstMatch = value.match(
    /^([A-Za-z\.]+)\s+(\d{1,2})\s*,?\s*(\d{4})(?:[,\s]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d{1,3}))?)?\s*(am|pm)?$/i
  );
  if (textualMonthFirstMatch) {
    const [,
      monthName,
      day,
      year,
      hour = "0",
      minute = "0",
      second = "0",
      msFragment,
      ampm
    ] = textualMonthFirstMatch;
    const month = MONTH_LOOKUP[normalizeToken(monthName)];
    if (month) {
      let normalizedHour = Number(hour);
      if (!Number.isFinite(normalizedHour)) normalizedHour = 0;
      if (ampm) {
        const marker = ampm.toLowerCase();
        if (marker === "pm" && normalizedHour < 12) normalizedHour += 12;
        if (marker === "am" && normalizedHour === 12) normalizedHour = 0;
      }
      return {
        type: "parts",
        components: {
          year: Number(year),
          month,
          day: Number(day),
          hour: normalizedHour,
          minute: Number(minute) || 0,
          second: Number(second) || 0,
          millisecond: normalizeMilliseconds(msFragment || "")
        }
      };
    }
  }

  const numericMatch = value.match(
    /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})(?:[T\s,]+(\d{1,2})(?::(\d{2}))?(?::(\d{2}))?(?:\.(\d{1,3}))?)?\s*(am|pm)?$/i
  );
  if (numericMatch) {
    const [,
      first,
      second,
      yearPart,
      hour = "0",
      minute = "0",
      secondPart = "0",
      msFragment,
      ampm
    ] = numericMatch;

    const firstNum = Number(first);
    const secondNum = Number(second);
    const resolvedYear = normalizeYear(Number(yearPart));
    if (!resolvedYear || !Number.isFinite(firstNum) || !Number.isFinite(secondNum)) return null;

    const preferDayFirst = options.dayFirst === true;
    const preferMonthFirst = options.dayFirst === false;

    let month;
    let day;

    if (firstNum > 12 && secondNum <= 12) {
      day = firstNum;
      month = secondNum;
    } else if (secondNum > 12 && firstNum <= 12) {
      month = firstNum;
      day = secondNum;
    } else if (preferDayFirst && firstNum <= 31 && secondNum <= 12) {
      day = firstNum;
      month = secondNum;
    } else if (preferMonthFirst && firstNum <= 12 && secondNum <= 31) {
      month = firstNum;
      day = secondNum;
    } else {
      month = firstNum;
      day = secondNum;
    }

    if (!month || !day) return null;

    let normalizedHour = Number(hour);
    if (!Number.isFinite(normalizedHour)) normalizedHour = 0;
    const normalizedMinute = Number(minute) || 0;
    const normalizedSecond = Number(secondPart) || 0;
    const normalizedMs = normalizeMilliseconds(msFragment || "");

    if (ampm) {
      const marker = ampm.toLowerCase();
      if (marker === "pm" && normalizedHour < 12) normalizedHour += 12;
      if (marker === "am" && normalizedHour === 12) normalizedHour = 0;
    }

    return {
      type: "parts",
      components: {
        year: resolvedYear,
        month,
        day,
        hour: normalizedHour,
        minute: normalizedMinute,
        second: normalizedSecond,
        millisecond: normalizedMs
      }
    };
  }

  return null;
}

function parseDateAndTime(dateStr, timeStr, options = {}) {
  const datePart = (dateStr || "").trim();
  const timePart = (timeStr || "").trim();
  if (!datePart) return null;
  if (timePart) return attemptParseDateTime(`${datePart} ${timePart}`, options);
  return attemptParseDateTime(datePart, options);
}

export function functionCountdown() {
  const pad = (n) => String(n).padStart(2, "0");
  const items = Array.from(document.querySelectorAll(".qs-countdown-time-container[data-target]"));

  if (!items.length) {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = undefined;
    }
    return;
  }

  const globalDebug = typeof window !== "undefined" && Boolean(window.QS_COUNTDOWN_DEBUG);

  items.forEach((el) => {
    const location = findLocationForElement(el);
    const manualTimeZone = (el.getAttribute("data-timezone") || "").trim();
    const timeZone = resolveTimeZone(location, manualTimeZone);
    const parseOptions = determineParseOptions(el, location);
    const inputs = gatherInputs(el, parseOptions);
    const result = computeTargetTimestamp(inputs, timeZone);
    const timestamp = result.timestamp;
    el._target = Number.isFinite(timestamp) ? timestamp : null;
    el._countdownLocation = location;
    el._timeZone = timeZone;
    el._targetSource = result.source;
    el._targetInputSource = result.inputSource;

    const debug = globalDebug || el.hasAttribute("data-debug-countdown");
    const label = el.getAttribute("data-debug-label") || el.id || el.className || "countdown";

    if (result.source === "native" && !el._countdownWarnedNative) {
      console.warn(
        `[QS Countdown] ${label} fell back to Date.parse – provide an unambiguous datetime or set data-date-format.`,
        {
          inputs: inputs.map((entry) => ({
            raw: entry.raw,
            sanitized: entry.sanitized,
            source: entry.source,
            priority: entry.priority
          })),
          timeZone,
          location,
          selectedInput: result.inputSource
        }
      );
      el._countdownWarnedNative = true;
    }

    if (!el._target && result.source === "unparsed") {
      console.error(`[QS Countdown] ${label} could not resolve a countdown target`, {
        inputs: inputs.map((entry) => ({
          raw: entry.raw,
          sanitized: entry.sanitized,
          source: entry.source,
          priority: entry.priority
        })),
        timeZone,
        location,
        parseOptions
      });
    }

    if (debug) {
      try {
        console.groupCollapsed(`[QS Countdown] ${label}`);
      } catch (_) {
        console.log(`[QS Countdown] ${label}`);
      }
      console.log("location", location);
      console.log("resolvedTimeZone", timeZone);
      console.log("parseOptions", parseOptions);
      console.log(
        "inputs",
        inputs.map((entry) => ({
          raw: entry.raw,
          sanitized: entry.sanitized,
          source: entry.source,
          priority: entry.priority,
          parsed: entry.parsed
        }))
      );
      console.log("result", result);
      try {
        console.groupEnd();
      } catch (_) {
        // ignore
      }
    }
  });

  function tick() {
    const now = Date.now();
    let anyActive = false;

    items.forEach((el) => {
      if (!el._target) return;

      let diff = Math.max(0, el._target - now);
      const days = Math.floor(diff / 86400000);
      diff -= days * 86400000;
      const hours = Math.floor(diff / 3600000);
      diff -= hours * 3600000;
      const minutes = Math.floor(diff / 60000);
      diff -= minutes * 60000;
      const seconds = Math.floor(diff / 1000);

      const dEl = el.querySelector("[data-d]");
      const hEl = el.querySelector("[data-h]");
      const mEl = el.querySelector("[data-m]");
      const sEl = el.querySelector("[data-s]");

      if (dEl) dEl.textContent = pad(days);
      if (hEl) hEl.textContent = pad(hours);
      if (mEl) mEl.textContent = pad(minutes);
      if (sEl) sEl.textContent = pad(seconds);

      if (el._target <= now) {
        el.classList.add("ended");
        el.style.display = "none";
      } else {
        anyActive = true;
      }
    });

    if (!anyActive && countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = undefined;
    }
  }

  if (countdownInterval) clearInterval(countdownInterval);
  tick();
  countdownInterval = setInterval(tick, 1000);
}