/**
 * Webinar / event hero: converts the event's date+time into the VISITOR's own
 * timezone and updates the page's badges and past-vs-upcoming state.
 *
 * Reuses the date-parsing + timezone engine from countdown.js. For each webinar
 * wrapper (see SELECTORS.wrapper) it:
 *   - reads the source date/time (supports several legacy + new hero layouts),
 *   - reformats it into the visitor's locale/timezone (.qs-webinar-converted, the
 *     .qs-webinar-layout slots, etc.),
 *   - flips badges between "Upcoming" / "On-demand" and toggles the upcoming-vs-
 *     past form wrappers and layout section depending on whether it has passed.
 *
 * This is presentation-only — it rewrites visible text/badges; it does NOT run a
 * ticking timer (that's countdown.js).
 */
import { gsap } from "gsap";
import { myEase } from "../../config/variables.js";
import {
	attemptParseDateTime,
	composeHeroDateTime,
	determineParseOptions,
	findLocationForElement,
	resolveTimeZone,
	sanitizeDateTimeInput,
	zonedTimeToUtc
} from "./countdown.js";

const SELECTORS = {
	wrapper: ".qs-webinar-wrapper, .qs-webinar-hero, .qs-new-webinar-hero-wrapper",
	badge: ".qs-badge-webinar",
	badgeWrapper: ".qs-badge-wrapper",
	badgeLabel: ".label-change",
	badgeTextLabel: ".label",
	legacyDate: ".label-date",
	conferenceDateWrapper: ".qs-conference-date-wrapper",
	linkTitle: ".qs-link-wrapper .title6",
	day: ".webinar-day",
	time: ".webinar-time",
	newHeroContent: ".qs-hero-custom-content",
	newHeroDate: ".qs-webinar-converted .body, .qs-webinar-converted",
	newHeroTime:
		".qs-webinar-time, .qs-webinar-time-wrapper, .qs-new-webinar-time, .qs-webinar-time-new, .qs-hero-time, [data-webinar-time], [data-webinar-time-text]",
	city: ".webinar-city",
	country: ".webinar-country",
	converted: ".qs-webinar-converted",
	convertedBody: ".body",
	past: ".qs-webinar-past"
};

const DEFAULT_LOCALE = "en-US";
const DATE_TIME_FORMAT_OPTIONS = { dateStyle: "long", timeStyle: "short" };
const TIME_ZONE_COUNTRY_OVERRIDES = {
	"Europe/London": "United Kingdom",
	"Europe/Dublin": "Ireland",
	"Europe/Paris": "France",
	"Europe/Madrid": "Spain",
	"Europe/Berlin": "Germany",
	"Europe/Amsterdam": "Netherlands",
	"Europe/Brussels": "Belgium",
	"Europe/Rome": "Italy",
	"Europe/Athens": "Greece",
	"Europe/Lisbon": "Portugal",
	"Europe/Zurich": "Switzerland",
	"Europe/Prague": "Czech Republic",
	"Europe/Warsaw": "Poland",
	"Europe/Budapest": "Hungary",
	"Europe/Bucharest": "Romania",
	"Europe/Sofia": "Bulgaria",
	"Europe/Vienna": "Austria",
	"Europe/Belgrade": "Serbia",
	"Europe/Zagreb": "Croatia",
	"Europe/Ljubljana": "Slovenia",
	"Europe/Bratislava": "Slovakia",
	"Europe/Riga": "Latvia",
	"Europe/Tallinn": "Estonia",
	"Europe/Vilnius": "Lithuania",
	"Europe/Helsinki": "Finland",
	"Europe/Oslo": "Norway",
	"Europe/Copenhagen": "Denmark",
	"Europe/Stockholm": "Sweden",
	"Europe/Istanbul": "Turkiye",
	"Europe/Moscow": "Russia",
	"Europe/Kyiv": "Ukraine",
	"Europe/Luxembourg": "Luxembourg",
	"Europe/Monaco": "Monaco",
	"Europe/San_Marino": "San Marino",
	"Europe/Andorra": "Andorra",
	"Europe/Gibraltar": "Gibraltar",
	"America/New_York": "United States",
	"America/Chicago": "United States",
	"America/Denver": "United States",
	"America/Los_Angeles": "United States",
	"America/Phoenix": "United States",
	"America/Detroit": "United States",
	"America/Indiana/Indianapolis": "United States",
	"America/Anchorage": "United States",
	"America/Honolulu": "United States",
	"America/Toronto": "Canada",
	"America/Vancouver": "Canada",
	"America/Winnipeg": "Canada",
	"America/Edmonton": "Canada",
	"America/Montreal": "Canada",
	"America/Mexico_City": "Mexico",
	"America/Guadalajara": "Mexico",
	"America/Monterrey": "Mexico",
	"America/Sao_Paulo": "Brazil",
	"America/Bogota": "Colombia",
	"America/Lima": "Peru",
	"America/Argentina/Buenos_Aires": "Argentina",
	"America/Chile/Santiago": "Chile",
	"America/Caracas": "Venezuela",
	"America/Panama": "Panama",
	"America/Costa_Rica": "Costa Rica",
	"America/Santo_Domingo": "Dominican Republic",
	"America/San_Jose": "Costa Rica",
	"America/Guatemala": "Guatemala",
	"America/Tegucigalpa": "Honduras",
	"America/Managua": "Nicaragua",
	"America/El_Salvador": "El Salvador",
	"America/Jamaica": "Jamaica",
	"America/Port_of_Spain": "Trinidad and Tobago",
	"America/Puerto_Rico": "Puerto Rico",
	"America/La_Paz": "Bolivia",
	"America/Asuncion": "Paraguay",
	"America/Montevideo": "Uruguay",
	"America/Cancun": "Mexico",
	"America/Belize": "Belize",
	"America/Nassau": "Bahamas",
	"America/Curacao": "Curacao",
	"Atlantic/Bermuda": "Bermuda",
	"Atlantic/Reykjavik": "Iceland",
	"Africa/Johannesburg": "South Africa",
	"Africa/Lagos": "Nigeria",
	"Africa/Nairobi": "Kenya",
	"Africa/Cairo": "Egypt",
	"Africa/Casablanca": "Morocco",
	"Africa/Accra": "Ghana",
	"Africa/Algiers": "Algeria",
	"Africa/Tunis": "Tunisia",
	"Africa/Dakar": "Senegal",
	"Africa/Tripoli": "Libya",
	"Asia/Dubai": "United Arab Emirates",
	"Asia/Doha": "Qatar",
	"Asia/Bahrain": "Bahrain",
	"Asia/Kuwait": "Kuwait",
	"Asia/Muscat": "Oman",
	"Asia/Riyadh": "Saudi Arabia",
	"Asia/Jerusalem": "Israel",
	"Asia/Istanbul": "Turkiye",
	"Asia/Beirut": "Lebanon",
	"Asia/Amman": "Jordan",
	"Asia/Kolkata": "India",
	"Asia/Karachi": "Pakistan",
	"Asia/Dhaka": "Bangladesh",
	"Asia/Colombo": "Sri Lanka",
	"Asia/Kathmandu": "Nepal",
	"Asia/Singapore": "Singapore",
	"Asia/Bangkok": "Thailand",
	"Asia/Kuala_Lumpur": "Malaysia",
	"Asia/Ho_Chi_Minh": "Vietnam",
	"Asia/Jakarta": "Indonesia",
	"Asia/Makassar": "Indonesia",
	"Asia/Manila": "Philippines",
	"Asia/Shanghai": "China",
	"Asia/Hong_Kong": "Hong Kong",
	"Asia/Taipei": "Taiwan",
	"Asia/Seoul": "South Korea",
	"Asia/Tokyo": "Japan",
	"Asia/Almaty": "Kazakhstan",
	"Asia/Tashkent": "Uzbekistan",
	"Asia/Baku": "Azerbaijan",
	"Asia/Yerevan": "Armenia",
	"Asia/Tbilisi": "Georgia",
	"Asia/Tehran": "Iran",
	"Asia/Baghdad": "Iraq",
	"Asia/Aqtau": "Kazakhstan",
	"Australia/Sydney": "Australia",
	"Australia/Melbourne": "Australia",
	"Australia/Brisbane": "Australia",
	"Australia/Perth": "Australia",
	"Australia/Adelaide": "Australia",
	"Australia/Darwin": "Australia",
	"Pacific/Auckland": "New Zealand",
	"Pacific/Wellington": "New Zealand",
	"Pacific/Port_Moresby": "Papua New Guinea",
	"Pacific/Noumea": "New Caledonia",
	"Pacific/Fiji": "Fiji",
	"Pacific/Tahiti": "French Polynesia",
	"Pacific/Honolulu": "United States"
};

const REGION_FALLBACK_COUNTRIES = {
	Australia: "Australia",
	"New_Zealand": "New Zealand",
	Canada: "Canada",
	Singapore: "Singapore",
	Hong_Kong: "Hong Kong",
	Macau: "Macau",
	Atlantic: "Atlantic",
	Pacific: "Pacific",
	Indian: "Indian",
	Etc: "UTC"
};

const dateFormatterCache = new Map();
let cachedVisitorContext;

function readText(node) {
	return (node?.textContent || "").trim();
}

function stripTrailingParenthetical(value) {
	return (value || "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

function stripTrailingAtTime(value) {
	const text = (value || "").trim();
	if (!text) return "";
	return text.split(/\s+at\s+/i)[0].trim();
}

function looksLikeTime(value) {
	const text = (value || "").trim();
	if (!text) return false;
	// Require either minutes (e.g. 23:00, 9.30) or an am/pm marker (e.g. 9pm).
	return /\b\d{1,2}(?:(?:[:.]\d{2})|\s*(?:am|pm))\b/i.test(text);
}

function normalizeExtractedTimeText(value) {
	return (value || "")
		.replace(/^at\s+/i, "")
		.replace(/\s+at\s+/, " ")
		.trim();
}

function findNewHeroTimeFallback(wrapper) {
	if (!wrapper) return "";
	const convertedRoot = wrapper.querySelector(SELECTORS.converted);
	const searchRoot = wrapper.querySelector(SELECTORS.newHeroContent) || wrapper;
	const nodes = searchRoot.querySelectorAll(
		"time, [class*='time'], [data-time], [data-time-text], [data-webinar-time], [data-webinar-time-text]"
	);
	for (const node of nodes) {
		if (!node) continue;
		if (convertedRoot && (node === convertedRoot || convertedRoot.contains(node))) continue;
		const candidate = normalizeExtractedTimeText(stripTrailingParenthetical(readText(node)));
		if (looksLikeTime(candidate)) return candidate;
	}
	return "";
}

function toTitleCase(value) {
	if (!value) return "";
	return value
		.split(/\s+/)
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
		.join(" ");
}

function formatTimeZoneCity(timeZone) {
	if (!timeZone) return "";
	const parts = timeZone.split("/");
	const raw = parts[parts.length - 1];
	if (!raw) return "";
	return toTitleCase(raw.replace(/_/g, " "));
}

function extractRegionFromLocale(locale) {
	if (!locale) return "";
	const normalized = locale.replace(/_/g, "-");
	const segments = normalized.split("-");
	for (let i = segments.length - 1; i >= 1; i -= 1) {
		const candidate = segments[i];
		if (candidate && (candidate.length === 2 || candidate.length === 3)) {
			return candidate.toUpperCase();
		}
	}
	return "";
}

function formatRegionName(regionCode, locale) {
	if (!regionCode) return "";
	if (typeof Intl === "undefined" || typeof Intl.DisplayNames === "undefined") return regionCode;
	try {
		const display = new Intl.DisplayNames([locale || DEFAULT_LOCALE], { type: "region" });
		return display.of(regionCode) || regionCode;
	} catch (_) {
		return regionCode;
	}
}

function deriveCountryFromTimeZone(timeZone) {
	if (!timeZone) return "";
	if (Object.prototype.hasOwnProperty.call(TIME_ZONE_COUNTRY_OVERRIDES, timeZone)) {
		return TIME_ZONE_COUNTRY_OVERRIDES[timeZone];
	}
	const [region] = timeZone.split("/");
	if (region && Object.prototype.hasOwnProperty.call(REGION_FALLBACK_COUNTRIES, region)) {
		return REGION_FALLBACK_COUNTRIES[region];
	}
	return region ? toTitleCase(region.replace(/_/g, " ")) : "";
}

function getVisitorContext() {
	if (cachedVisitorContext) return cachedVisitorContext;
	if (typeof window === "undefined" || typeof Intl === "undefined") {
		cachedVisitorContext = {};
		return cachedVisitorContext;
	}
	const formatter = Intl.DateTimeFormat();
	const resolved = typeof formatter.resolvedOptions === "function" ? formatter.resolvedOptions() : {};
	const locale =
		(typeof navigator !== "undefined" && navigator.languages && navigator.languages[0]) ||
		(typeof navigator !== "undefined" && navigator.language) ||
		resolved.locale ||
		DEFAULT_LOCALE;
	const timeZone = resolved.timeZone || "";
	const region = extractRegionFromLocale(locale) || extractRegionFromLocale(resolved.locale || "");
	let countryName = deriveCountryFromTimeZone(timeZone);
	if (!countryName && region) {
		countryName = formatRegionName(region, locale);
	}
	const cityName = formatTimeZoneCity(timeZone);
	cachedVisitorContext = { locale, timeZone, cityName, countryName };
	return cachedVisitorContext;
}

function formatVisitorDate(timestamp, visitor) {
	if (!Number.isFinite(timestamp) || !visitor || !visitor.timeZone || typeof Intl === "undefined") {
		return "";
	}
	const locale = visitor.locale || DEFAULT_LOCALE;
	const cacheKey = `${locale}|${visitor.timeZone}`;
	let formatter = dateFormatterCache.get(cacheKey);
	if (!formatter) {
		try {
			formatter = new Intl.DateTimeFormat(locale, {
				...DATE_TIME_FORMAT_OPTIONS,
				timeZone: visitor.timeZone
			});
			dateFormatterCache.set(cacheKey, formatter);
		} catch (_) {
			formatter = null;
		}
	}
	if (formatter) {
		return formatter.format(new Date(timestamp));
	}
	try {
		return new Date(timestamp).toLocaleString(locale);
	} catch (_) {
		return new Date(timestamp).toLocaleString();
	}
}


function composeConvertedText(timestamp, visitor) {
	const dateText = formatVisitorDate(timestamp, visitor);
	if (!dateText) return "";
	const locationParts = [];
	if (visitor?.cityName) locationParts.push(visitor.cityName);
	if (visitor?.countryName) locationParts.push(visitor.countryName);
	const locationText = locationParts.join(", ");
	return locationText ? `${dateText} (${locationText})` : dateText;
}

function updateConvertedField(wrapper, timestamps, visitor) {
	const normalized = Array.isArray(timestamps) ? timestamps : [timestamps];
	const usableTimestamps = normalized.filter((value) => Number.isFinite(value));
	if (!wrapper || !visitor || !usableTimestamps.length) return;
	const convertedRoot = wrapper.querySelector(SELECTORS.converted);
	if (!convertedRoot) return;
	const bodies = Array.from(convertedRoot.querySelectorAll(SELECTORS.convertedBody));
	if (!bodies.length) {
		const composed = composeConvertedText(usableTimestamps[0], visitor);
		if (!composed) return;
		convertedRoot.textContent = composed;
		return;
	}

	// Multiple slots: update each body by index.
	const count = Math.min(bodies.length, usableTimestamps.length);
	for (let i = 0; i < count; i += 1) {
		const body = bodies[i];
		const composed = composeConvertedText(usableTimestamps[i], visitor);
		if (composed) body.textContent = composed;
	}
}

function formatVisitorDateOnly(timestamp, visitor) {
	if (!Number.isFinite(timestamp) || !visitor || !visitor.timeZone || typeof Intl === "undefined") {
		return "";
	}
	const locale = visitor.locale || DEFAULT_LOCALE;
	try {
		const formatter = new Intl.DateTimeFormat(locale, {
			dateStyle: "long",
			timeZone: visitor.timeZone
		});
		return formatter.format(new Date(timestamp));
	} catch (_) {
		return "";
	}
}

function abbreviateTimeZoneName(name) {
	if (!name) return "";
	// Already an abbreviation (e.g. "AEDT", "PST", "CET") — all uppercase, ≤ 5 chars
	if (/^[A-Z]{2,5}$/.test(name)) return name;
	// Offset like "GMT+11" — return as-is
	if (/^(?:GMT|UTC)[+-]?\d/.test(name)) return name;
	// Long name like "Australian Eastern Daylight Time" → take initials → "AEDT"
	const initials = name
		.split(/[\s-]+/)
		.filter(Boolean)
		.map((word) => word.charAt(0))
		.join("")
		.toUpperCase();
	return initials.length >= 2 && initials.length <= 6 ? initials : name;
}

function formatVisitorTimeWithZone(timestamp, visitor) {
	if (!Number.isFinite(timestamp) || !visitor || !visitor.timeZone || typeof Intl === "undefined") {
		return "";
	}
	const locale = visitor.locale || DEFAULT_LOCALE;
	const date = new Date(timestamp);

	// Try "short" first — in some browsers this already gives abbreviations like "AEDT"
	// Then try "long" which gives full names like "Australian Eastern Daylight Time"
	// that we can abbreviate to initials.
	const tzNameStyles = ["short", "long"];
	let tzPart = "";

	for (const style of tzNameStyles) {
		try {
			const formatter = new Intl.DateTimeFormat(locale, {
				hour: "numeric",
				minute: "2-digit",
				timeZoneName: style,
				timeZone: visitor.timeZone
			});
			const parts = formatter.formatToParts(date);
			const tz = parts.find((p) => p.type === "timeZoneName");
			if (!tz || !tz.value) continue;

			const abbreviated = abbreviateTimeZoneName(tz.value);
			// Accept if it's a real abbreviation (not a GMT offset)
			if (abbreviated && !/^(?:GMT|UTC)[+-]?\d/.test(abbreviated)) {
				tzPart = abbreviated;
				break;
			}
			// Keep offset as last resort
			if (!tzPart) tzPart = abbreviated;
		} catch (_) {
			continue;
		}
	}

	// Format the time cleanly without timezone name
	let timePart = "";
	try {
		const formatter = new Intl.DateTimeFormat(locale, {
			hour: "numeric",
			minute: "2-digit",
			timeZone: visitor.timeZone
		});
		timePart = formatter.format(date);
	} catch (_) {
		return "";
	}

	if (!timePart) return "";
	return tzPart ? `${timePart} (${tzPart})` : timePart;
}

function updateLayoutField(wrapper, visitor) {
	const layoutRoot = wrapper.querySelector(".qs-webinar-layout");
	if (!layoutRoot || !visitor) return;

	const location = extractLocation(wrapper);
	const parseOptions = determineParseOptions(wrapper, location);
	const timeZone = resolveWrapperTimeZone(wrapper, location);

	const bodies = Array.from(layoutRoot.querySelectorAll(".body"));
	if (!bodies.length) return;

	for (const body of bodies) {
		const cached = (body.dataset?.qsWebinarSourceDatetime || "").trim();
		const raw = cached || stripTrailingParenthetical(readText(body));
		if (!raw) continue;
		if (!cached) body.dataset.qsWebinarSourceDatetime = raw;

		const sanitized = sanitizeDateTimeInput(raw);
		const effectiveOptions = applyDayFirstHeuristic(parseOptions, timeZone, sanitized || raw);
		const parsed = attemptParseDateTime(sanitized || raw, effectiveOptions);
		const timestamp = parsedResultToTimestamp(parsed, timeZone);
		if (!Number.isFinite(timestamp)) continue;

		// Direct child .body of .qs-webinar-layout: date only, no time or location
		const isDirectChild = body.parentElement === layoutRoot;
		const isSlotGroupChild = body.parentElement?.classList?.contains("qs-slot-group-new");
		if (isDirectChild) {
			const dateOnly = formatVisitorDateOnly(timestamp, visitor);
			if (dateOnly) body.textContent = dateOnly;
		} else if (isSlotGroupChild) {
			const dateOnly = formatVisitorDateOnly(timestamp, visitor);
			const timeWithZone = formatVisitorTimeWithZone(timestamp, visitor);
			if (dateOnly && timeWithZone) {
				body.textContent = "";
				body.appendChild(document.createTextNode(dateOnly));
				body.appendChild(document.createElement("br"));
				body.appendChild(document.createTextNode(timeWithZone));
			} else if (timeWithZone) {
				body.textContent = timeWithZone;
			}
		} else {
			const composed = composeConvertedText(timestamp, visitor);
			if (composed) body.textContent = composed;
		}
	}
}

function updatePastFutureVisibility(wrapper, timestamps, now) {
	if (!wrapper || !Array.isArray(timestamps) || !timestamps.length) return;
	// Only apply this behavior on the webinar hero template.
	if (!wrapper.classList?.contains("qs-new-webinar-hero-wrapper")) return;
	const convertedRoot = wrapper.querySelector(SELECTORS.converted);
	const pastRoot = wrapper.querySelector(SELECTORS.past);
	if (!convertedRoot || !pastRoot) return;

	const valid = timestamps.filter((value) => Number.isFinite(value));
	if (!valid.length) return;
	const isPast = Math.max(...valid) <= now;

	if (isPast) {
		convertedRoot.style.display = "none";
		pastRoot.style.display = "flex";
	} else {
		convertedRoot.style.display = "";
		pastRoot.style.display = "none";
	}

	// Toggle form wrappers based on past/future state
	const upcomingForm = document.querySelector(".qs-webinar-form-wrapper-upcoming");
	const pastForm = document.querySelector(".qs-webinar-form-wrapper-updated");
	if (upcomingForm) upcomingForm.style.display = isPast ? "none" : "";
	if (pastForm) pastForm.style.display = isPast ? "" : "none";

	// Hide the layout section when the webinar is in the past / on-demand
	const layoutRoot = wrapper.querySelector(".qs-webinar-layout");
	if (layoutRoot) layoutRoot.style.display = isPast ? "none" : "";
}

function extractLocation(wrapper) {
	const city = readText(wrapper.querySelector(SELECTORS.city));
	const country = readText(wrapper.querySelector(SELECTORS.country));
	if (city || country) {
		return { city: city || undefined, country: country || undefined };
	}
	return findLocationForElement(wrapper);
}

function resolveWrapperTimeZone(wrapper, location) {
	const manualTimeZone = (wrapper.getAttribute("data-timezone") || "").trim();
	return resolveTimeZone(location, manualTimeZone);
}

function applyDayFirstHeuristic(parseOptions, timeZone, raw) {
	if (!parseOptions) return {};
	if (Object.prototype.hasOwnProperty.call(parseOptions, "dayFirst")) return parseOptions;
	const sample = (raw || "").trim();
	if (!/^\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(sample)) return parseOptions;
	const region = (timeZone || "").split("/")[0] || "";
	// Most non-Americas time zones use D/M/Y for numeric dates.
	const dayFirst = region ? region !== "America" : true;
	return { ...parseOptions, dayFirst };
}

function componentsToTimestamp(components, timeZone) {
	if (!components) return null;
	if (timeZone) {
		try {
			const zoned = zonedTimeToUtc(components, timeZone);
			if (Number.isFinite(zoned)) return zoned;
		} catch (_) {
			// ignore invalid timezone conversions to keep UI resilient
		}
	}
	const localDate = new Date(
		components.year,
		components.month - 1,
		components.day,
		components.hour || 0,
		components.minute || 0,
		components.second || 0,
		components.millisecond || 0
	);
	return Number.isNaN(localDate.getTime()) ? null : localDate.getTime();
}

function parsedResultToTimestamp(parsed, timeZone) {
	if (!parsed) return null;
	if (parsed.type === "absolute") return parsed.timestamp;
	return componentsToTimestamp(parsed.components, timeZone);
}

function getNewHeroSlotSourceText(slotNode) {
	if (!slotNode) return "";
	const cached = (slotNode.dataset?.qsWebinarSourceDatetime || "").trim();
	if (cached) return cached;
	const raw = stripTrailingParenthetical(readText(slotNode));
	if (raw) slotNode.dataset.qsWebinarSourceDatetime = raw;
	return raw;
}

function computeNewHeroSlotTimestamps(wrapper, location, parseOptions, timeZone) {
	if (!wrapper?.classList?.contains("qs-new-webinar-hero-wrapper")) return null;
	const convertedRoot = wrapper.querySelector(SELECTORS.converted);
	if (!convertedRoot) return null;
	const bodies = Array.from(convertedRoot.querySelectorAll(SELECTORS.convertedBody));
	if (!bodies.length) return null;

	const timestamps = [];
	for (const body of bodies) {
		const raw = getNewHeroSlotSourceText(body);
		if (!raw) continue;
		const sanitized = sanitizeDateTimeInput(raw);
		const effectiveOptions = applyDayFirstHeuristic(parseOptions, timeZone, sanitized || raw);
		const parsed = attemptParseDateTime(sanitized || raw, effectiveOptions);
		const timestamp = parsedResultToTimestamp(parsed, timeZone);
		if (Number.isFinite(timestamp)) timestamps.push(timestamp);
	}

	return timestamps.length ? timestamps : null;
}

function computeStructuredTimestamp(wrapper, location, parseOptions, timeZone) {
	const dayText = readText(wrapper.querySelector(SELECTORS.day));
	if (!dayText) return null;
	const timeText = readText(wrapper.querySelector(SELECTORS.time));
	const heroComponents = composeHeroDateTime(dayText, timeText, parseOptions);
	if (!heroComponents) return null;
	const timestamp = componentsToTimestamp(heroComponents, timeZone);
	if (Number.isFinite(timestamp)) return timestamp;
	const combined = `${dayText}${timeText ? ` ${timeText}` : ""}`.trim();
	if (!combined) return null;
	const sanitized = sanitizeDateTimeInput(combined);
	const fallback = Date.parse(sanitized || combined);
	return Number.isNaN(fallback) ? null : fallback;
}

function getNewHeroSourceDateTime(wrapper) {
	const cachedDate = (wrapper?.dataset?.qsWebinarSourceDate || "").trim();
	const cachedTime = (wrapper?.dataset?.qsWebinarSourceTime || "").trim();
	let dateText = cachedDate;
	let timeText = cachedTime;

	if (dateText) {
		dateText = stripTrailingAtTime(stripTrailingParenthetical(dateText));
		wrapper.dataset.qsWebinarSourceDate = dateText;
	}

	if (timeText) {
		timeText = normalizeExtractedTimeText(stripTrailingParenthetical(timeText));
		if (!looksLikeTime(timeText)) {
			timeText = "";
			delete wrapper.dataset.qsWebinarSourceTime;
		} else {
			wrapper.dataset.qsWebinarSourceTime = timeText;
		}
	}

	if (!dateText) {
		const dateNode = wrapper.querySelector(SELECTORS.newHeroDate);
		dateText = stripTrailingAtTime(stripTrailingParenthetical(readText(dateNode)));
		if (dateText) wrapper.dataset.qsWebinarSourceDate = dateText;
	}

	if (!timeText) {
		const timeNode = wrapper.querySelector(SELECTORS.newHeroTime);
		const rawTime = normalizeExtractedTimeText(stripTrailingParenthetical(readText(timeNode)));
		if (looksLikeTime(rawTime)) {
			timeText = rawTime;
			wrapper.dataset.qsWebinarSourceTime = timeText;
		}
	}

	if (!timeText) {
		const fallbackTime = findNewHeroTimeFallback(wrapper);
		if (fallbackTime) {
			timeText = fallbackTime;
			wrapper.dataset.qsWebinarSourceTime = timeText;
		}
	}

	return { dateText, timeText };
}

function computeNewHeroTimestamp(wrapper, location, parseOptions, timeZone) {
	if (!wrapper?.classList?.contains("qs-new-webinar-hero-wrapper")) return null;
	const slotTimestamps = computeNewHeroSlotTimestamps(wrapper, location, parseOptions, timeZone);
	if (Array.isArray(slotTimestamps) && slotTimestamps.length) {
		return Math.min(...slotTimestamps);
	}
	const { dateText, timeText } = getNewHeroSourceDateTime(wrapper);
	if (!dateText) return null;
	const heroComponents = composeHeroDateTime(dateText, timeText, parseOptions);
	if (heroComponents) {
		const timestamp = componentsToTimestamp(heroComponents, timeZone);
		if (Number.isFinite(timestamp)) return timestamp;
	}
	const combined = `${dateText}${timeText ? ` ${timeText}` : ""}`.trim();
	if (!combined) return null;
	const sanitized = sanitizeDateTimeInput(combined);
	const fallbackParsed = attemptParseDateTime(sanitized || combined, parseOptions);
	const fallbackTimestamp = parsedResultToTimestamp(fallbackParsed, timeZone);
	if (Number.isFinite(fallbackTimestamp)) return fallbackTimestamp;
	const nativeFallback = Date.parse(sanitized || combined);
	return Number.isNaN(nativeFallback) ? null : nativeFallback;
}

function computeConferenceDateTimestamp(wrapper, parseOptions, timeZone) {
	const dateWrapper = wrapper.querySelector(SELECTORS.conferenceDateWrapper);
	if (!dateWrapper) return null;
	const firstLabel = dateWrapper.querySelector('.label');
	if (!firstLabel) return null;
	const rawDate = readText(firstLabel);
	if (!rawDate) return null;
	const sanitized = sanitizeDateTimeInput(rawDate);
	const effectiveOptions = applyDayFirstHeuristic(parseOptions, timeZone, sanitized || rawDate);
	const parsed = attemptParseDateTime(sanitized || rawDate, effectiveOptions);
	const timestamp = parsedResultToTimestamp(parsed, timeZone);
	if (Number.isFinite(timestamp)) return timestamp;
	const fallback = Date.parse(sanitized || rawDate);
	return Number.isNaN(fallback) ? null : fallback;
}

function computeLegacyTimestamp(wrapper, parseOptions, timeZone) {
	const dateEl = wrapper.querySelector(SELECTORS.legacyDate);
	if (!dateEl) return null;
	const rawDate = dateEl.getAttribute("datetime") || dateEl.dataset.date || readText(dateEl);
	if (!rawDate) return null;
	const parsed = attemptParseDateTime(rawDate, parseOptions);
	const timestamp = parsedResultToTimestamp(parsed, timeZone);
	if (Number.isFinite(timestamp)) return timestamp;
	const sanitized = sanitizeDateTimeInput(rawDate);
	const fallback = Date.parse(sanitized || rawDate);
	return Number.isNaN(fallback) ? null : fallback;
}

function getWebinarTimestamp(wrapper, location) {
	const parseOptions = determineParseOptions(wrapper, location);
	const timeZone = resolveWrapperTimeZone(wrapper, location);
	return (
		computeStructuredTimestamp(wrapper, location, parseOptions, timeZone) ??
		computeNewHeroTimestamp(wrapper, location, parseOptions, timeZone) ??
		computeLegacyTimestamp(wrapper, parseOptions, timeZone) ??
		computeConferenceDateTimestamp(wrapper, parseOptions, timeZone)
	);
}

function getWebinarTimestamps(wrapper, location) {
	const parseOptions = determineParseOptions(wrapper, location);
	const timeZone = resolveWrapperTimeZone(wrapper, location);
	const structured = computeStructuredTimestamp(wrapper, location, parseOptions, timeZone);
	if (Number.isFinite(structured)) return [structured];
	const slots = computeNewHeroSlotTimestamps(wrapper, location, parseOptions, timeZone);
	if (Array.isArray(slots) && slots.length) return slots;
	const singleNew = computeNewHeroTimestamp(wrapper, location, parseOptions, timeZone);
	if (Number.isFinite(singleNew)) return [singleNew];
	const legacy = computeLegacyTimestamp(wrapper, parseOptions, timeZone);
	if (Number.isFinite(legacy)) return [legacy];
	const conference = computeConferenceDateTimestamp(wrapper, parseOptions, timeZone);
	if (Number.isFinite(conference)) return [conference];
	return [];
}

export function functionWebinar() {
	const wrappers = document.querySelectorAll(SELECTORS.wrapper);
	if (!wrappers.length) return;
	const now = Date.now();
	const visitor = getVisitorContext();
	wrappers.forEach((wrapper) => {
		const location = extractLocation(wrapper);
		const timestamps = getWebinarTimestamps(wrapper, location);
		if (timestamps.length) {
			updateConvertedField(wrapper, timestamps, visitor);
			updatePastFutureVisibility(wrapper, timestamps, now);
		}
		updateLayoutField(wrapper, visitor);
		const startTimestamp = timestamps.length
			? Math.min(...timestamps)
			: getWebinarTimestamp(wrapper, location);
		const endTimestamp = timestamps.length ? Math.max(...timestamps) : startTimestamp;
		// Try old badge structure, then fall back to new .qs-badge-wrapper structure
		let badge = wrapper.querySelector(SELECTORS.badge);
		let label = badge ? badge.querySelector(SELECTORS.badgeLabel) : null;
		const isNewBadgeStructure = !badge || !label;
		if (isNewBadgeStructure) {
			const newBadge = wrapper.querySelector(SELECTORS.badgeWrapper);
			const newLabel = newBadge ? newBadge.querySelector('.label') : null;
			if (newBadge && newLabel && Number.isFinite(endTimestamp)) {
				const isUpcoming = endTimestamp > now;
				newLabel.textContent = isUpcoming ? 'Upcoming' : 'On-demand';
				if (isUpcoming) {
					gsap.to(newBadge, { backgroundColor: '#253238', duration: 0.4, ease: myEase });
					gsap.to(newLabel, { color: '#fff', duration: 0.4, ease: myEase });
					const linkTitle = wrapper.querySelector(SELECTORS.linkTitle);
					if (linkTitle) linkTitle.textContent = 'Sign up';
				}
			}
			return;
		}
		if (!badge || !label || !Number.isFinite(endTimestamp) || endTimestamp <= now) return;
		label.textContent = "Upcoming";
		gsap.to(badge, { backgroundColor: "#253238", duration: 0.4, ease: myEase });
		const badgeTextLabel = badge.querySelector(SELECTORS.badgeTextLabel);
		if (badgeTextLabel) {
			gsap.to(badgeTextLabel, { color: "#fff", duration: 0.4, ease: myEase });
		}
		const linkTitle = wrapper.querySelector(SELECTORS.linkTitle);
		if (linkTitle) linkTitle.textContent = "Sign up";
	});
}
