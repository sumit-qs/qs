/**
 * Native Webflow Search results — two-tier priority sort.
 *
 * PRIORITY ORDER
 *   Tier 1: static pages (anything not matching a known CMS collection URL)
 *   Tier 2: CMS collection items (Insights, Case Studies, Webinars, Conferences)
 * Tier 1 always renders entirely above Tier 2 — this is a hard priority
 * split, not a blended sort.
 *
 * SORT WITHIN EACH TIER
 *   1. Newest date first (year, or full date where available)
 *   2. Alphabetical by title as a tiebreak — same date, or no date at all
 *
 * DATE SOURCES
 *   Tier 1 (static pages): a 4-digit year pulled from the URL path, or
 *   failing that, from the page title text. No page fetch needed for the
 *   year check itself — it's read from the search result's own link/title
 *   already present in the DOM.
 *
 *   Tier 2 (collection items): a per-collection CSS selector, fetched from
 *   the live page. See COLLECTIONS below. Collections without a working
 *   date element yet (Solutions, Magazines) are defined but commented out
 *   — left in place so picking this back up later is a five-minute job,
 *   not a rewrite.
 *
 * BLACKLIST
 *   Some collections (e.g. reference/category lists used only as
 *   conditioning fields inside other collections) are not real pages and
 *   should never appear in search at all. BLACKLISTED_URL_PREFIXES holds
 *   those URL prefixes; matching items are removed from the DOM entirely,
 *   before tiering/sorting even runs.
 *
 *   NOTE: this is a client-side removal AFTER Webflow's native search has
 *   already indexed and returned these items — not a true search-index
 *   exclusion. To stop them from being indexed by Webflow itself, that's
 *   a per-collection "Include in search results" setting in Site Settings
 *   → Search, not something this script can control.
 *
 * SCOPE / LIMIT
 *   Search results limit raised to 60 (from 10). All 60 are fetched in
 *   parallel for Tier 2 date extraction, so watch for any rate-limiting
 *   or performance concerns at that volume in production.
 *
 * Hooks: .qs-search-list (results wrapper), .qs-search-item (each result),
 * <a href> inside each result (used to identify collection + fetch page).
 */

// ---------------------------------------------------------------------------
// BLACKLIST — reference-only collections that should never appear in search.
// Populate with URL prefixes, e.g. "/slider-categories-for-filters/".
// Matching items are removed from the DOM entirely before any sorting.
// ---------------------------------------------------------------------------
const BLACKLISTED_URL_PREFIXES = [
	// TODO: add URL prefixes for reference/category collections once
	// confirmed (e.g. Slider Categories for Filters, Accordion Categories
	// for Filters, Type/Topic/Country reference lists, etc.)
];

// ---------------------------------------------------------------------------
// TIER 2 — active collections with a working date source.
// ---------------------------------------------------------------------------
const COLLECTIONS = [
	{
		name: "insights",
		urlPrefix: "/insights/",
		selector: ".qs-section.qs-section-hero.qs-section-hero-insight .caption",
	},
	{
		name: "case-studies",
		urlPrefix: "/case-studies/",
		// Same template family as Insights, distinguished by extra classes
		selector: ".qs-section-hero-insight .caption.reversed.label-unwrap",
	},
	{
		name: "webinars",
		urlPrefix: "/webinars/",
		// Page has two session slots (Session 1 / Session 2); first .body
		// found is the primary/earliest session time, which is what we want.
		selector: ".qs-new-webinar-hero-wrapper .body",
	},
	{
		name: "conferences",
		// Matches both /conference/... and /conferences/.../2026/overview
		// style static pages — all built from the "Header / New Conference"
		// component, which contains a hidden element (.qs-conf-timer-hide)
		// bound to the "KEEP — Countdown Timer" Date/Time field (confirmed
		// via CMS field inspection). Renders as "June 24, 2027" on the
		// page — day AFTER month, unlike Insights/Case Studies which
		// render day BEFORE month. This sidesteps the earlier problem
		// where visible hero text was shared/static across pages and
		// unreliable per page.
		urlPrefix: "/conference", // matches both /conference/ and /conferences/
		selector: ".qs-conf-timer-hide",
	},

	// -------------------------------------------------------------------
	// TIER 2 — collections with NO working date source yet. Defined here,
	// commented out, so they're ready to activate the moment a date
	// element exists on their frontend. Uncomment + fill in `selector`
	// and move into the active COLLECTIONS array above when ready.
	// -------------------------------------------------------------------
	// {
	// 	name: "solutions",
	// 	urlPrefix: "/solutions/",
	// 	selector: "", // TODO: no date field rendered on frontend yet
	// },
	// {
	// 	name: "magazines",
	// 	urlPrefix: "/magazines/",
	// 	selector: "", // TODO: Publication Date exists in CMS, not on frontend yet
	// },
];

const MONTH_NAMES =
	"January|February|March|April|May|June|July|August|September|October|November|December";

// Tried in order. First pattern that matches wins.
const DATE_PATTERNS = [
	// "17 July 2026" / "Article 17 July 2026"
	new RegExp(`\\b(\\d{1,2}\\s+(?:${MONTH_NAMES})\\s+\\d{4})\\b`),
	// "June 24, 2027" — how the conference countdown timer field renders
	new RegExp(`\\b((?:${MONTH_NAMES})\\s+\\d{1,2},\\s*\\d{4})\\b`),
	// "8/7/2026 8:00 AM" / "8/7/2026"
	/\b(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?)\b/i,
	// ISO-ish, in case a countdown timer stores "2026-07-08" etc.
	/\b(\d{4}-\d{2}-\d{2})\b/,
];

const YEAR_PATTERN = /\b(20\d{2})\b/;

function getCollectionConfig(href) {
	if (!href) return null;
	return COLLECTIONS.find((c) => href.includes(c.urlPrefix)) || null;
}

function isBlacklisted(href) {
	if (!href) return false;
	return BLACKLISTED_URL_PREFIXES.some((prefix) => href.includes(prefix));
}

function parseDateFromText(text) {
	for (const pattern of DATE_PATTERNS) {
		const match = text.match(pattern);
		if (match) {
			const parsed = new Date(match[1]);
			if (!isNaN(parsed)) return parsed;
		}
	}
	return null;
}

// Bare-year fallback: used when a full date can't be parsed but a 4-digit
// year is present. Treated as Jan 1 of that year — low precision, last
// resort, but still enough to sort correctly against other years.
function extractYearAsDate(text) {
	const match = text.match(YEAR_PATTERN);
	if (!match) return null;
	return new Date(Number(match[1]), 0, 1);
}

function getResultTitle(item) {
	return (
		item.querySelector("h1,h2,h3,h4,h5,h6")?.textContent?.trim() ||
		item.querySelector("a[href]")?.textContent?.trim() ||
		""
	);
}

// ---------------------------------------------------------------------------
// TIER 2 date extraction — fetch the live page, read the collection's
// configured selector. Checks datetime/data-date attributes first (in case
// a hidden timer element stores an ISO string there), then falls back to
// visible/hidden textContent, then a bare-year fallback from the URL.
// ---------------------------------------------------------------------------
async function extractCollectionDate(href, selector) {
	try {
		const res = await fetch(href, { credentials: "same-origin" });
		if (!res.ok) return null;

		const html = await res.text();
		const doc = new DOMParser().parseFromString(html, "text/html");
		const el = doc.querySelector(selector);
		if (!el) return extractYearAsDate(href);

		const attrCandidate = el.getAttribute("datetime") || el.getAttribute("data-date");
		if (attrCandidate) {
			const parsed = parseDateFromText(attrCandidate) || new Date(attrCandidate);
			if (parsed && !isNaN(parsed)) return parsed;
		}

		const textDate = parseDateFromText(el.textContent || "");
		if (textDate) return textDate;

		// Selector matched but nothing parseable inside it — try a bare
		// year from the URL as a last resort before giving up.
		return extractYearAsDate(href);
	} catch (err) {
		console.warn("[search-sort] fetch failed for", href, err);
		return null;
	}
}

// ---------------------------------------------------------------------------
// TIER 1 date extraction — no fetch needed. Year from the URL first, title
// text second.
// ---------------------------------------------------------------------------
function extractStaticDate(href, title) {
	return extractYearAsDate(href || "") || extractYearAsDate(title || "");
}

// Newest first; alphabetical by title as a tiebreak (including when
// neither item has a date at all).
function sortByDateThenTitle(entries) {
	return entries.sort((a, b) => {
		if (a.date && b.date && a.date.getTime() !== b.date.getTime()) {
			return b.date - a.date;
		}
		if (a.date && !b.date) return -1;
		if (!a.date && b.date) return 1;
		return a.title.localeCompare(b.title);
	});
}

async function sortSearchResultsByDate(resultsWrapper) {
	let items = Array.from(resultsWrapper.querySelectorAll(".qs-search-item"));
	if (!items.length) return;

	// --- Blacklist pass: strip reference-only collection items entirely ---
	for (const item of items) {
		const href = item.querySelector("a[href]")?.getAttribute("href");
		if (isBlacklisted(href)) item.remove();
	}
	items = items.filter((item) => item.isConnected);
	if (!items.length) return;

	// --- Classify into Tier 1 (static) / Tier 2 (collection) ---
	const tier1 = [];
	const tier2 = [];

	for (const item of items) {
		const href = item.querySelector("a[href]")?.getAttribute("href");
		const title = getResultTitle(item);
		const config = getCollectionConfig(href);

		if (config) {
			tier2.push({ item, href, title, config });
		} else {
			tier1.push({ item, href, title });
		}
	}

	// --- Tier 1: date from URL/title, no fetch ---
	const tier1Sorted = sortByDateThenTitle(
		tier1.map((r) => ({ ...r, date: extractStaticDate(r.href, r.title) }))
	);

	// --- Tier 2: date from live page fetch, per-collection selector ---
	const tier2WithDates = await Promise.all(
		tier2.map(async (r) => ({
			...r,
			date: await extractCollectionDate(r.href, r.config.selector),
		}))
	);
	const tier2Sorted = sortByDateThenTitle(tier2WithDates);

	// TEMP DEBUG — remove once confirmed working on live
	console.log(
		"[search-sort] Tier 1 (static, sorted):",
		tier1Sorted.map((r) => `${r.title || r.href}: ${r.date ? r.date.toDateString() : "undated"}`)
	);
	console.log(
		"[search-sort] Tier 2 (collections, sorted):",
		tier2Sorted.map(
			(r) =>
				`${r.config.name} — ${r.title || r.href}: ${r.date ? r.date.toDateString() : "undated"}`
		)
	);

	[...tier1Sorted, ...tier2Sorted].forEach((r) => resultsWrapper.appendChild(r.item));
}

// Exportable function to sort native Webflow Search results: static pages
// first, then CMS collection items, each tier sorted newest → oldest with
// alphabetical tiebreaks.
export function functionSearchSort() {
	if (!window.location.pathname.includes("/search")) return;

	const resultsWrapper = document.querySelector(".qs-search-list");
	if (!resultsWrapper) return;

	let debounceTimer;
	let hasSortedOnce = false;

	function runSort() {
		observer.disconnect();
		sortSearchResultsByDate(resultsWrapper).finally(() => {
			observer.observe(resultsWrapper, { childList: true });
		});
	}

	const observer = new MutationObserver(() => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(runSort, 200);
	});

	observer.observe(resultsWrapper, { childList: true });

	// Native Search may have already finished rendering by the time this
	// script runs — in that case MutationObserver alone never fires.
	// Poll briefly for a stable, non-empty item count, then sort once.
	let stableChecks = 0;
	let lastCount = -1;
	const pollTimer = setInterval(() => {
		const count = resultsWrapper.querySelectorAll(".qs-search-item").length;

		if (count > 0 && count === lastCount) {
			stableChecks++;
		} else {
			stableChecks = 0;
		}
		lastCount = count;

		if (stableChecks >= 2 && !hasSortedOnce) {
			hasSortedOnce = true;
			clearInterval(pollTimer);
			console.log("[search-sort] stable item count detected:", count, "— running sort"); // TEMP DEBUG
			runSort();
		}
	}, 150);

	// Safety timeout: stop polling after 5s regardless (e.g. genuinely no results)
	setTimeout(() => clearInterval(pollTimer), 5000);
}