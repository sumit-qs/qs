/**
 * Native Webflow Search results — unified client-side date sort across
 * Insights, Case Studies, and Webinars.
 *
 * Problem: Webflow's native Search index has no CMS date field, so results
 * render in relevance order, not chronological order.
 *
 * Approach: after native Search renders its results list on /search, for
 * each result whose URL matches a known "has a visible date" collection,
 * fetch that page and read the date rendered in its hero markup. Sort ALL
 * dated items together — newest → oldest — regardless of which collection
 * they came from. Items from collections outside this scope (Conferences,
 * Solutions, Magazines) or static pages are left in their original
 * relative order and appended after the dated ones.
 *
 * Conferences are deliberately excluded: the header component lets editors
 * pick a collection item, but the rest of each conference page is manually
 * authored, so the visible date text isn't reliably tied to that specific
 * page's item (confirmed by testing — the same date text appeared across
 * multiple different conference pages). DOM-scraping isn't safe there.
 *
 * Scope: Max 10 results per search (no pagination), fetched in parallel,
 * so this stays cheap. Results with no matching collection config skip the
 * fetch entirely (no point fetching Conferences/Solutions/Magazines/static
 * pages — nothing reliable to find).
 *
 * Hooks: .qs-search-list (results wrapper), .qs-search-item (each result),
 * <a href> inside each result (used to identify collection + fetch page).
 */

// Ordered by URL prefix. First match wins — prefixes must not collide.
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
	// Conferences intentionally excluded: the header component lets editors
	// pick a collection item, but the rest of the page (including the
	// visible date text) is manually authored per static page — so the
	// rendered date isn't reliably tied to that page's specific item.
	// DOM-scraping isn't safe here. Left out of scope until a different
	// approach is decided (e.g. a hand-maintained slug → date map).
	//
	// Solutions and Magazines also excluded: no on-page date to scrape
	// (Magazines has a Publication Date field in the CMS but nothing on
	// the frontend renders it yet). They — and any static page — fall
	// through to "undated" without a network call.
];

const MONTH_NAMES =
	"January|February|March|April|May|June|July|August|September|October|November|December";

// Tried in order. First pattern that matches wins.
const DATE_PATTERNS = [
	// "17 July 2026" / "Article 17 July 2026"
	new RegExp(`\\b(\\d{1,2}\\s+(?:${MONTH_NAMES})\\s+\\d{4})\\b`),
	// "8/7/2026 8:00 AM" / "8/7/2026"
	/\b(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?)\b/i,
];

function getCollectionConfig(href) {
	if (!href) return null;
	return COLLECTIONS.find((c) => href.includes(c.urlPrefix)) || null;
}

// Fallback only: used when a URL already matched a known date-bearing
// collection (so it's guaranteed to be Insights/Case Studies/Webinars,
// never a Conferences/Solutions/Magazines/static page) but the on-page
// selector didn't yield a parseable date. Extracts a bare 4-digit year
// from the URL path and treats it as Jan 1 of that year. Low-precision
// (year only) since it's a last resort, not the primary signal.
function extractYearFromUrl(href) {
	const match = href.match(/\/(20\d{2})(?:\/|$)/);
	if (!match) return null;
	const year = Number(match[1]);
	const parsed = new Date(year, 0, 1);
	return isNaN(parsed) ? null : parsed;
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

async function extractDate(url, selector) {
	try {
		const res = await fetch(url, { credentials: "same-origin" });
		if (!res.ok) return null;

		const html = await res.text();
		const doc = new DOMParser().parseFromString(html, "text/html");

		const dateEl = doc.querySelector(selector);
		if (!dateEl) return null;

		return parseDateFromText(dateEl.textContent);
	} catch (err) {
		console.warn("[search-sort] fetch failed for", url, err);
		return null;
	}
}

async function sortSearchResultsByDate(resultsWrapper) {
	const items = Array.from(resultsWrapper.querySelectorAll(".qs-search-item"));
	if (!items.length) return;

	const withDates = await Promise.all(
		items.map(async (item) => {
			const link = item.querySelector("a[href]");
			const href = link?.getAttribute("href");
			const config = getCollectionConfig(href);

			// No known date-bearing collection for this URL — skip the
			// fetch entirely, it stays undated.
			if (!config) return { item, date: null };

			let date = await extractDate(href, config.selector);
			let source = "selector";

			// Selector matched no element, or the element's text didn't
			// parse — fall back to a bare year pulled from the URL itself.
			// Safe here specifically because `config` is non-null, i.e.
			// this URL already belongs to a known date-bearing collection.
			if (!date) {
				date = extractYearFromUrl(href);
				source = "url-year-fallback";
			}

			return { item, date, collection: config.name, source };
		})
	);

	// Single unified sort: every dated item, regardless of collection,
	// newest first. Undated items keep their original relative order and
	// are appended after.
	const dated = withDates.filter((r) => r.date).sort((a, b) => b.date - a.date);
	const undated = withDates.filter((r) => !r.date);

	// TEMP DEBUG — remove once confirmed working on live
	console.log(
		"[search-sort] dated:",
		dated.map((r) => `${r.collection} (${r.source}): ${r.date.toDateString()}`),
		"| undated count:",
		undated.length
	);

	[...dated, ...undated].forEach((r) => resultsWrapper.appendChild(r.item));
}

// Exportable function to sort native Webflow Search results by date
// across multiple collections.
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