/**
 * search-sort.js — qs.com native Webflow Search enhancer (final)
 * Export: functionSearchSort()  — call once from your main bundle.
 *
 * PIPELINE (synchronous, zero network requests)
 *   1. Clean     remove blacklisted paths, locale duplicates, title-less cards
 *   2. Classify  category by exact URL path segment; static vs CMS
 *   3. Rank      relevance band → static-before-CMS within band → score →
 *                year → Webflow's native order
 *   4. Reveal    list is hidden by the <head> guard until step 3 is done,
 *                then fades in (no visible re-ordering)
 *   5. Filter    .btn-is-search[data-collection], radio behaviour, counts,
 *                empty message, ?category= in URL, Back/Forward support
 *
 * RELEVANCE BANDS
 *   5  exact query phrase in title
 *   4  every query term in title
 *   3  every query term across title / URL / description
 *   2  some query terms matched
 *   1  no visible match (Webflow matched page body only) — kept, ranked last
 *
 * HOOKS
 *   .qs-search-list / .qs-search-item / .qs-search-item a[href] / .qs-search-item .body
 *   .btn-is-search[data-collection="insights|case-studies|webinars|conferences|people|solutions"]
 *   [data-search-count]          optional, inside a button → receives the count
 *   [data-search-filter-empty]   optional, your own empty-filter element
 *
 * STATE CLASSES (style in Webflow)
 *   .btn-is-search.is-active  .btn-is-search.is-empty
 */

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const CONFIG = {
	listSelector: ".qs-search-list",
	itemSelector: ".qs-search-item",
	buttonSelector: ".btn-is-search[data-collection]",
	urlParam: "category", // ?category=insights
	legacyUrlParams: ["type"],
	localePrefixes: ["/en-us"],
	fadeMs: 150,
	debug: false, // true → console.table on load
};

// Exact path segments. "/conference" blocks /conference/* but NOT /conferences/*.
const BLACKLIST = ["/terms-and-conditions", "/solution", "/staging", "/conference"];

// name must equal the button's data-collection value.
// Matches the folder's landing page AND everything inside it.
const CATEGORIES = [
	{ name: "solutions", prefix: "/solutions" },
	{ name: "insights", prefix: "/insights" },
	{ name: "case-studies", prefix: "/case-studies" },
	{ name: "webinars", prefix: "/webinars" },
	{ name: "conferences", prefix: "/conferences" },
	{ name: "people", prefix: "/people" },
];

// CMS template folders (item pages only). Everything else counts as static.
const CMS_PREFIXES = ["/insights", "/case-studies", "/webinars", "/people"];

const WEIGHTS = {
	titleTerm: 150,
	slugTerm: 48,
	descTerm: 12,
	coverage: 100, // × fraction of query terms matched anywhere
	allInTitle: 90,
	phraseInTitle: 260,
	exactTitle: 450,
	wrongYearInTitle: -120, // query says 2026, title says only 2027
	homepage: -400,
};

const STOPWORDS = new Set([
	"a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with", "qs",
]);

// ---------------------------------------------------------------------------
// TEXT
// ---------------------------------------------------------------------------
const normalise = (v) =>
	String(v || "")
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/&/g, " and ")
		.replace(/[^a-z0-9]+/g, " ")
		.trim();

function stem(w) {
	if (/^\d+$/.test(w)) return w;
	if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
	if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
	return w;
}

const tokenise = (v) => {
	const n = normalise(v);
	return n ? n.split(" ").map(stem) : [];
};

// exact token, or prefix for 4+ char terms ("rank" → "ranking"); numbers exact only
function has(tokens, term) {
	const prefixOk = term.length >= 4 && !/^\d+$/.test(term);
	for (const t of tokens) if (t === term || (prefixOk && t.startsWith(term))) return true;
	return false;
}

const yearsIn = (v) => (String(v).match(/\b(?:19|20)\d{2}\b/g) || []).map(Number);

// ---------------------------------------------------------------------------
// URL
// ---------------------------------------------------------------------------
function toPath(href) {
	if (!href) return null;
	let p;
	try {
		const u = new URL(href, window.location.origin);
		p = u.pathname;
	} catch {
		p = href.split(/[?#]/)[0];
	}
	try {
		p = decodeURIComponent(p);
	} catch {
		/* keep raw */
	}
	p = p.toLowerCase().replace(/\/+$/, "");
	for (const lp of CONFIG.localePrefixes) {
		if (p === lp || p.startsWith(lp + "/")) {
			p = p.slice(lp.length);
			break;
		}
	}
	return p; // "" = homepage
}

const inFolder = (p, prefix) => p === prefix || p.startsWith(prefix + "/");
const isBlacklisted = (p) => BLACKLIST.some((b) => inFolder(p, b));
const categoryOf = (p) => CATEGORIES.find((c) => inFolder(p, c.prefix))?.name || null;
const isCms = (p) => CMS_PREFIXES.some((c) => p.startsWith(c + "/"));
const isCategory = (v) => CATEGORIES.some((c) => c.name === v);

function readQuery() {
	const params = new URLSearchParams(window.location.search);
	const raw = params.get("query") || "";
	const all = tokenise(raw);
	const useful = all.filter((t) => !STOPWORDS.has(t));
	const terms = [...new Set(useful.length ? useful : all)];
	return { raw, terms, phrase: terms.join(" "), years: yearsIn(raw) };
}

function readCategoryParam() {
	const params = new URLSearchParams(window.location.search);
	for (const key of [CONFIG.urlParam, ...CONFIG.legacyUrlParams]) {
		const v = params.get(key);
		if (isCategory(v)) return v;
	}
	return null;
}

// ---------------------------------------------------------------------------
// COLLECT + CLEAN
// ---------------------------------------------------------------------------
function collect(list) {
	const seen = new Set();
	const entries = [];

	[...list.querySelectorAll(CONFIG.itemSelector)].forEach((item, nativeIndex) => {
		const link = item.querySelector("a[href]");
		const path = toPath(link?.getAttribute("href"));
		const title = (link?.textContent || "").replace(/\s+/g, " ").trim();

		if (path === null || !title || isBlacklisted(path) || seen.has(path)) {
			item.remove();
			return;
		}
		seen.add(path);

		const desc = item.querySelector(".body")?.textContent || "";
		const titleYears = yearsIn(title);
		const urlYears = yearsIn(path);

		entries.push({
			item,
			path,
			title,
			nativeIndex,
			category: categoryOf(path),
			kind: path === "" ? "home" : isCms(path) ? "cms" : "static",
			titleTokens: tokenise(title),
			slugTokens: tokenise(path.replace(/\//g, " ")),
			descTokens: tokenise(desc),
			titleYears,
			year: Math.max(0, ...titleYears, ...urlYears) || null,
			band: 1,
			score: 0,
		});
	});

	return entries;
}

// ---------------------------------------------------------------------------
// RANK
// ---------------------------------------------------------------------------
function rank(e, q) {
	const W = WEIGHTS;
	const n = q.terms.length;
	let score = 0;
	let band = 1;

	if (n) {
		let inTitle = 0;
		let matched = 0;
		for (const t of q.terms) {
			const a = has(e.titleTokens, t);
			const b = has(e.slugTokens, t);
			const c = has(e.descTokens, t);
			if (a) (inTitle++, (score += W.titleTerm));
			if (b) score += W.slugTerm;
			if (c) score += W.descTerm;
			if (a || b || c) matched++;
		}
		score += (matched / n) * W.coverage;

		const titleNorm = e.titleTokens.join(" ");
		const phrase = n > 1 && titleNorm.includes(q.phrase);
		const exact = titleNorm === q.phrase;
		if (inTitle === n) score += W.allInTitle;
		if (phrase || exact) score += exact ? W.exactTitle : W.phraseInTitle;

		band = phrase || exact ? 5 : inTitle === n ? 4 : matched === n ? 3 : matched ? 2 : 1;
	}

	if (q.years.length && e.titleYears.length && !e.titleYears.some((y) => q.years.includes(y))) {
		score += W.wrongYearInTitle;
		band = Math.min(band, 3);
	}

	if (e.kind === "home") {
		score += W.homepage;
		band = Math.min(band, 2);
	}

	e.band = band;
	e.score = score;
}

function compare(a, b) {
	if (a.band !== b.band) return b.band - a.band;
	const sa = a.kind === "static" ? 0 : 1;
	const sb = b.kind === "static" ? 0 : 1;
	if (sa !== sb) return sa - sb; // static first, only within the same band
	if (a.score !== b.score) return b.score - a.score;
	if (a.year !== b.year) return (b.year || 0) - (a.year || 0);
	return a.nativeIndex - b.nativeIndex;
}

// ---------------------------------------------------------------------------
// FILTER UI
// ---------------------------------------------------------------------------
const buttons = () => [...document.querySelectorAll(CONFIG.buttonSelector)];

function emptyElement(list) {
	let el = document.querySelector("[data-search-filter-empty]");
	if (!el) {
		el = document.createElement("p");
		el.className = "qs-search-filter-empty";
		el.setAttribute("data-search-filter-empty", "");
		el.setAttribute("role", "status");
		list.insertAdjacentElement("afterend", el);
	}
	el.hidden = true;
	el.style.display = "none";
	return el;
}

function paint(state) {
	let visible = 0;
	for (const e of state.entries) {
		const show = !state.active || e.category === state.active;
		e.item.style.display = show ? "" : "none";
		if (show) visible++;
	}

	for (const btn of buttons()) {
		const on = btn.getAttribute("data-collection") === state.active;
		btn.classList.toggle("is-active", on);
		btn.setAttribute("aria-pressed", String(on));
	}

	const empty = state.empty;
	const showEmpty = Boolean(state.active) && visible === 0;
	if (showEmpty && !empty.hasAttribute("data-keep-text")) {
		const btn = buttons().find((b) => b.getAttribute("data-collection") === state.active);
		const label = (btn?.textContent || state.active).replace(/\d+/g, "").trim();
		empty.textContent = `No ${label} results for “${state.query.raw}”. Try another category or search term.`;
	}
	empty.hidden = !showEmpty;
	empty.style.display = showEmpty ? "" : "none";
}

// Fade out → swap → fade in, so filter changes don't jump
function transition(state) {
	const list = state.list;
	const token = (state.fadeToken = (state.fadeToken || 0) + 1);
	if (!CONFIG.fadeMs || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
		paint(state);
		return;
	}
	list.style.transition = `opacity ${CONFIG.fadeMs}ms ease`;
	list.style.opacity = "0";
	setTimeout(() => {
		if (token !== state.fadeToken) return;
		paint(state);
		requestAnimationFrame(() => (list.style.opacity = "1"));
	}, CONFIG.fadeMs);
}

function writeUrl(active) {
	const url = new URL(window.location.href);
	[CONFIG.urlParam, ...CONFIG.legacyUrlParams].forEach((k) => url.searchParams.delete(k));
	if (active) url.searchParams.set(CONFIG.urlParam, active);
	history.pushState({ qsSearchCategory: active }, "", url);
}

function wireButtons(state) {
	const counts = {};
	for (const e of state.entries) if (e.category) counts[e.category] = (counts[e.category] || 0) + 1;

	for (const btn of buttons()) {
		const name = btn.getAttribute("data-collection");
		const count = counts[name] || 0;
		btn.dataset.count = String(count);
		btn.classList.toggle("is-empty", count === 0);
		const countEl = btn.querySelector("[data-search-count]");
		if (countEl) countEl.textContent = String(count);
		if (!isCategory(name)) console.warn(`[search] data-collection="${name}" is not a known category`);
	}

	document.addEventListener("click", (ev) => {
		const btn = ev.target.closest?.(CONFIG.buttonSelector);
		if (!btn) return;
		ev.preventDefault(); // buttons are links with href="#"
		const name = btn.getAttribute("data-collection");
		if (!isCategory(name)) return;
		state.active = state.active === name ? null : name;
		writeUrl(state.active);
		transition(state);
	});

	window.addEventListener("popstate", () => {
		state.active = readCategoryParam();
		transition(state);
	});
}

// ---------------------------------------------------------------------------
// REVEAL
// ---------------------------------------------------------------------------
function reveal(list) {
	const html = document.documentElement;
	if (!html.classList.contains("qs-search-pending")) return;
	if (list && CONFIG.fadeMs) {
		list.style.opacity = "0";
		html.classList.remove("qs-search-pending");
		requestAnimationFrame(() => {
			list.style.transition = `opacity ${CONFIG.fadeMs}ms ease`;
			list.style.opacity = "1";
		});
	} else {
		html.classList.remove("qs-search-pending");
	}
}

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------
export function functionSearchSort() {
	if (!/^\/search$/.test(toPath(window.location.pathname) ?? "")) return;
	if (window.__qsSearchInit) return;
	window.__qsSearchInit = true;

	const run = () => {
		const list = document.querySelector(CONFIG.listSelector);
		try {
			if (!list) return;
			const t0 = performance.now();
			const query = readQuery();
			const entries = collect(list);
			entries.forEach((e) => rank(e, query));
			entries.sort(compare);

			const frag = document.createDocumentFragment();
			entries.forEach((e) => frag.appendChild(e.item));
			list.appendChild(frag);

			const state = { list, entries, query, active: readCategoryParam(), empty: emptyElement(list) };
			wireButtons(state);
			paint(state);

			window.qsSearchDiagnostics = () =>
				state.entries.map((e, i) => ({
					pos: i + 1,
					band: e.band,
					kind: e.kind,
					category: e.category,
					score: Math.round(e.score),
					native: e.nativeIndex + 1,
					visible: e.item.style.display !== "none",
					title: e.title,
					path: e.path || "/",
				}));

			if (CONFIG.debug) {
				console.log(`[search] "${query.raw}" terms:`, query.terms, `${(performance.now() - t0).toFixed(1)}ms`);
				console.table(window.qsSearchDiagnostics());
			}
		} catch (err) {
			console.error("[search] enhancer failed — native order kept", err);
		} finally {
			reveal(list);
		}
	};

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
	else run();
}