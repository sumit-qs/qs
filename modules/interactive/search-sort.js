/**
 * Native Webflow Search results — unified client-side date sort across
 * multiple collections (Insights, Case Studies, Conferences, Webinars).
 *
 * Problem: Webflow's native Search index has no CMS date field, so results
 * render in relevance order, not chronological order.
 *
 * Approach: after native Search renders its results list on /search, for
 * each result whose URL matches a known "has a visible date" collection,
 * fetch that page and read the date rendered in its hero markup. Sort ALL
 * dated items together — newest → oldest — regardless of which collection
 * they came from. Items from collections with no on-page date (Solutions,
 * Magazines) or static pages are left in their original relative order and
 * appended after the dated ones.
 *
 * This replaces the earlier "Insights-only, dated-Insights-first" version.
 * That version treated every non-Insights result as undated, so it always
 * got pushed below the whole Insights block even when it was more recent.
 * Now every collection with a real date gets extracted and everything is
 * sorted into one list.
 *
 * Scope: Max 10 results per search (no pagination), fetched in parallel,
 * so this stays cheap. Results with no matching collection config skip the
 * fetch entirely (no point fetching Solutions/Magazines/static pages —
 * they have no date to find).
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
		name: "conference",
		urlPrefix: "/conference/",
		selector: ".qs-conference-header .body",
	},
	{
		name: "webinars",
		urlPrefix: "/webinars/",
		// Page has two session slots (Session 1 / Session 2); first .body
		// found is the primary/earliest session time, which is what we want.
		selector: ".qs-new-webinar-hero-wrapper .body",
	},
	// Solutions and Magazines intentionally out of scope for this pass
	// (pending pilot results). Magazines has a Publication Date field in
	// the CMS but nothing on the frontend renders it yet. They — and any
	// static page — fall through to "undated" without a network call.
];

const MONTH_NAMES =
	"January|February|March|April|May|June|July|August|September|October|November|December";

// Tried in order. First pattern that matches wins.
const DATE_PATTERNS = [
	// Conference date ranges: "9 - 10 July 2026" / "24-25 June 2027".
	// Captures the START day (group 1) plus the trailing "Month year"
	// (group 2) — the end day is discarded, we sort on the start date.
	new RegExp(`\\b(\\d{1,2})\\s*-\\s*\\d{1,2}\\s+((?:${MONTH_NAMES})\\s+\\d{4})\\b`),
	// "17 July 2026" / "Article 17 July 2026"
	new RegExp(`\\b(\\d{1,2}\\s+(?:${MONTH_NAMES})\\s+\\d{4})\\b`),
	// "8/7/2026 8:00 AM" / "8/7/2026"
	/\b(\d{1,2}\/\d{1,2}\/\d{4}(?:\s+\d{1,2}:\d{2}\s*(?:AM|PM))?)\b/i,
];

function getCollectionConfig(href) {
	if (!href) return null;
	return COLLECTIONS.find((c) => href.includes(c.urlPrefix)) || null;
}

function parseDateFromText(text) {
	// Range pattern has two capture groups (start day + "Month year") that
	// need to be joined; every other pattern has one group that's already
	// a complete, parseable date string.
	const rangeMatch = text.match(DATE_PATTERNS[0]);
	if (rangeMatch) {
		const parsed = new Date(`${rangeMatch[1]} ${rangeMatch[2]}`);
		if (!isNaN(parsed)) return parsed;
	}

	for (const pattern of DATE_PATTERNS.slice(1)) {
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

			const date = await extractDate(href, config.selector);
			return { item, date, collection: config.name };
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
		dated.map((r) => `${r.collection}: ${r.date.toDateString()}`),
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