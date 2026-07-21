/**
 * Native Webflow Search results — client-side date sort (Insights only, pilot).
 *
 * Problem: Webflow's native Search index only stores Search Title, snippet
 * text, and Page URL — no CMS date field — so results render in relevance
 * order, not chronological order.
 *
 * Approach: after native Search renders its results list on /search, for each
 * result whose URL is under /insights/, fetch that page and read the visible
 * "<Badge> <date>" caption rendered in its hero
 * (.qs-section-hero-insight .caption, e.g. "Article 17 July 2026"). Parse the
 * date out, sort dated Insights results newest → oldest, and reorder the DOM.
 * Non-Insights results (Conferences/Solutions/Webinars) and any Insights
 * result whose date couldn't be parsed are left in their original relative
 * order, appended after the dated ones.
 *
 * Scope: pilot — Insights only. Only runs on /search. Max 10 results per
 * search (no pagination), fetched in parallel, so this stays cheap. Extending
 * to other collections later just means adding their own caption selector /
 * URL-prefix check below.
 *
 * Hooks: .qs-search-list (results wrapper), .qs-search-item (each result),
 * a[href*="/insights/"] (link inside each result).
 */

const DATE_REGEX =
	/\b(\d{1,2}\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/;

async function extractInsightDate(url) {
	try {
		const res = await fetch(url, { credentials: "same-origin" });
		if (!res.ok) return null;

		const html = await res.text();
		const doc = new DOMParser().parseFromString(html, "text/html");

		const captionEl = doc.querySelector(
			".qs-section.qs-section-hero.qs-section-hero-insight .caption"
		);
		if (!captionEl) return null;

		const match = captionEl.textContent.match(DATE_REGEX);
		if (!match) return null;

		const parsed = new Date(match[1]);
		return isNaN(parsed) ? null : parsed;
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
			const link = item.querySelector('a[href*="/insights/"]');
			const href = link?.getAttribute("href");
			const date = href ? await extractInsightDate(href) : null;
			return { item, date };
		})
	);

	const dated = withDates.filter((r) => r.date).sort((a, b) => b.date - a.date);
	const undated = withDates.filter((r) => !r.date);

	[...dated, ...undated].forEach((r) => resultsWrapper.appendChild(r.item));
}

// Exportable function to sort native Webflow Search results by date (Insights pilot)
export function functionSearchSort() {
	if (!window.location.pathname.includes("/search")) return;

	const resultsWrapper = document.querySelector(".qs-search-list");
	if (!resultsWrapper) return;

	let debounceTimer;

	const observer = new MutationObserver(() => {
		clearTimeout(debounceTimer);
		debounceTimer = setTimeout(() => {
			observer.disconnect();
			sortSearchResultsByDate(resultsWrapper).finally(() => {
				observer.observe(resultsWrapper, { childList: true });
			});
		}, 200);
	});

	observer.observe(resultsWrapper, { childList: true });
}