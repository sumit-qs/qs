/**
 * Native Webflow Search results — two-tier priority sort with collection filtering.
 *
 * PRIORITY ORDER
 *   Tier 1: static pages (anything not matching a known CMS collection URL)
 *   Tier 2: CMS collection items (Insights, Case Studies, Webinars, Conferences, People, Solutions)
 * Tier 1 always renders entirely above Tier 2 — this is a hard priority
 * split, not a blended sort.
 *
 * SORT WITHIN EACH TIER
 *   1. Newest date first (year, or full date where available)
 *   2. Alphabetical by title as a tiebreak — same date, or no date at all
 *
 * COLLECTION FILTER BUTTONS
 *   Buttons with class .btn-is-search and a data-collection attribute filter
 *   the visible results. Behaves like a radio group — only one button active
 *   at a time. Clicking the active button again deactivates it and reverts
 *   to the full default view.
 *
 *   data-collection values:
 *     "insights"      → /insights/
 *     "case-studies"  → /case-studies/
 *     "webinars"      → /webinars/
 *     "conferences"   → /conference/
 *     "people"        → /people/
 *     "solutions"     → /solutions/
 *
 * BLACKLIST
 *   URL prefixes in BLACKLISTED_URL_PREFIXES are removed from the DOM
 *   entirely before tiering/sorting runs. Client-side only — Webflow's
 *   search index is unaffected.
 *
 * SCOPE / LIMIT
 *   Search results limit raised to 60 (from 10). All 60 are fetched in
 *   parallel for Tier 2 date extraction, so watch for rate-limiting or
 *   performance concerns at that volume in production.
 *
 * Hooks:
 *   .qs-search-list        — results wrapper
 *   .qs-search-item        — each result
 *   .btn-is-search         — filter buttons
 *   [data-collection]      — collection name on each filter button
 *   <a href>               — used to identify collection + fetch page
 */

// ---------------------------------------------------------------------------
// BLACKLIST — items removed from the DOM entirely before any sorting.
// ---------------------------------------------------------------------------
const BLACKLISTED_URL_PREFIXES = [
	"/terms-and-conditions/",
	"/solution/", // CMS template only — redirects to /solutions/ static pages
];

// ---------------------------------------------------------------------------
// COLLECTIONS — CMS collections classified as Tier 2.
// Empty selector = no fetch, sorts alphabetically within Tier 2.
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
		selector: ".qs-section-hero-insight .caption.reversed.label-unwrap",
	},
	{
		name: "webinars",
		urlPrefix: "/webinars/",
		selector: ".qs-new-webinar-hero-wrapper .body",
	},
	{
		name: "conferences",
		urlPrefix: "/conference", // matches both /conference/ and /conferences/
		selector: ".qs-conf-timer-hide",
	},
	{
		name: "people",
		urlPrefix: "/people/",
		selector: "", // no date field — sorts alphabetically within Tier 2
	},
	{
		name: "solutions",
		urlPrefix: "/solutions/",
		selector: "", // no date field — sorts alphabetically within Tier 2
	},

	// Uncomment + fill selector when date element exists on frontend:
	// { name: "magazines", urlPrefix: "/magazines/", selector: "" },
];

const MONTH_NAMES =
	"January|February|March|April|May|June|July|August|September|October|November|December";

const DATE_PATTERNS = [
	new RegExp(`\\b(\\d{1,2}\\s+(?:${MONTH_NAMES})\\s+\\d{4})\\b`),
	new RegExp(`\\b((?:${MONTH_NAMES})\\s+\\d{1,2},\\s*\\d{4})\\b`),
	/\b(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?)\b/i,
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

async function extractCollectionDate(href, selector) {
	if (!selector) return null;
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

		return extractYearAsDate(href);
	} catch (err) {
		console.warn("[search-sort] fetch failed for", href, err);
		return null;
	}
}

function extractStaticDate(href, title) {
	return extractYearAsDate(href || "") || extractYearAsDate(title || "");
}

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

// ---------------------------------------------------------------------------
// FILTER — radio behaviour: one active collection at a time, or none (default).
// Operates purely on display:none toggling — never re-sorts or re-fetches.
// ---------------------------------------------------------------------------
function applyFilter(allEntries, activeCollection) {
	for (const entry of allEntries) {
		const visible = !activeCollection || entry.collectionName === activeCollection;
		entry.item.style.display = visible ? "" : "none";
	}
}

// ---------------------------------------------------------------------------
// SORT — classifies, fetches dates, sorts, appends to DOM, returns entry list.
// ---------------------------------------------------------------------------
async function sortSearchResultsByDate(resultsWrapper) {
	let items = Array.from(resultsWrapper.querySelectorAll(".qs-search-item"));
	if (!items.length) return [];

	// Blacklist pass
	for (const item of items) {
		const href = item.querySelector("a[href]")?.getAttribute("href");
		if (isBlacklisted(href)) item.remove();
	}
	items = items.filter((item) => item.isConnected);
	if (!items.length) return [];

	// Classify
	const tier1 = [];
	const tier2 = [];

	for (const item of items) {
		const href = item.querySelector("a[href]")?.getAttribute("href");
		const title = getResultTitle(item);
		const config = getCollectionConfig(href);

		if (config) {
			tier2.push({ item, href, title, config, tier: "collection", collectionName: config.name });
		} else {
			tier1.push({ item, href, title, tier: "static", collectionName: null });
		}
	}

	// Date extraction
	const tier1Sorted = sortByDateThenTitle(
		tier1.map((r) => ({ ...r, date: extractStaticDate(r.href, r.title) }))
	);

	const tier2WithDates = await Promise.all(
		tier2.map(async (r) => ({
			...r,
			date: await extractCollectionDate(r.href, r.config.selector),
		}))
	);
	const tier2Sorted = sortByDateThenTitle(tier2WithDates);

	// TEMP DEBUG — remove once confirmed working on live
	console.log(
		"[search-sort] Tier 1 (static):",
		tier1Sorted.map((r) => `${r.title || r.href}: ${r.date?.toDateString() ?? "undated"}`)
	);
	console.log(
		"[search-sort] Tier 2 (collections):",
		tier2Sorted.map((r) => `${r.collectionName} — ${r.title || r.href}: ${r.date?.toDateString() ?? "undated"}`)
	);

	// Append in tier order: static first, then collections
	const allEntries = [...tier1Sorted, ...tier2Sorted];
	allEntries.forEach((r) => resultsWrapper.appendChild(r.item));

	return allEntries;
}

// ---------------------------------------------------------------------------
// BUTTON FILTER INIT — wires radio behaviour to .btn-is-search buttons.
// Called after each sort so handlers always reference the current entry list.
// ---------------------------------------------------------------------------
function initFilterButtons(allEntries) {
	const buttons = Array.from(document.querySelectorAll(".btn-is-search[data-collection]"));
	if (!buttons.length) return;

	// Clear any previously attached listeners by replacing each button with
	// a clone — simplest way to avoid stacking handlers across re-sorts.
	buttons.forEach((btn) => {
		const fresh = btn.cloneNode(true);
		btn.parentNode.replaceChild(fresh, btn);
	});

	// Re-query after clone replacement
	const freshButtons = Array.from(document.querySelectorAll(".btn-is-search[data-collection]"));
	let activeCollection = null;

	freshButtons.forEach((btn) => {
		btn.addEventListener("click", () => {
			const collection = btn.getAttribute("data-collection");
			if (!collection) return;

			if (activeCollection === collection) {
				// Clicking the already-active button: deactivate → show all
				activeCollection = null;
				btn.classList.remove("is-active");
			} else {
				// New selection: deactivate previous, activate this one
				freshButtons.forEach((b) => b.classList.remove("is-active"));
				activeCollection = collection;
				btn.classList.add("is-active");
			}

			applyFilter(allEntries, activeCollection);
		});
	});
}

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------
export function functionSearchSort() {
	if (!window.location.pathname.includes("/search")) return;

	const resultsWrapper = document.querySelector(".qs-search-list");
	if (!resultsWrapper) return;

	let debounceTimer;
	let hasSortedOnce = false;

	async function runSort() {
		observer.disconnect();
		try {
			// Reset all button states on every new sort (new search query)
			document.querySelectorAll(".btn-is-search.is-active").forEach((btn) => {
				btn.classList.remove("is-active");
			});

			const allEntries = await sortSearchResultsByDate(resultsWrapper);
			initFilterButtons(allEntries);
		} finally {
			observer.observe(resultsWrapper, { childList: true });
		}
	}

	const observer = new MutationObserver(() => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(runSort, 200);
	});

	observer.observe(resultsWrapper, { childList: true });

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

	setTimeout(() => clearInterval(pollTimer), 5000);
}