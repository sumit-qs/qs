/**
 * search-sort.js — qs.com site search (v3)
 * Export: functionSearchSort() — call once from the main bundle, on every page.
 *
 * TWO ENGINES, ONE FILE
 *   Native  (always)  Re-ranks the ≤60 results Webflow renders on /search, cleans
 *                     junk, rescues CMS stubs, fills filters with extra
 *                     background queries. Works with no index at all.
 *   Index   (if CONFIG.indexUrl loads)  Upgrades the same page to a full-site
 *                     search over the GitHub-built index: every page, real
 *                     category filters, typo/accent/synonym tolerance.
 *                     Any failure → native results stay as they are.
 *
 * RANKING (both engines)
 *   band  5 exact title / phrase in title · 4 all terms in title ·
 *         3 all terms in title/URL/description · 2 most terms · 1 weak
 *   score title > headings > URL > description > body, title precision,
 *         query-year match, recency, past-event penalty, static-page and
 *         landing-page bonus, event sub-page penalty, Webflow's own rank
 *   order band → score → Webflow order. People (unless name match), the
 *         homepage and template-only matches drop to the end / are hidden.
 *
 * WEBFLOW HOOKS
 *   .qs-search-results › .qs-search-list › .qs-search-item
 *     .qs-asset (img) · a.title4 · p.body · .caption
 *   .btn-is-search[data-collection="solutions|insights|case-studies|webinars|conferences|people"]
 *   Optional: [data-search-snippet] inside an item (bound to Search Index → Snippet)
 *
 * CLASSES SET BY THIS SCRIPT
 *   .btn-is-search.is-active · .qs-search-list.is-loading
 *   .qs-search-more-wrapper › .qs-button.qs-search-more  ("Show more results")
 *   .qs-search-filter-empty  (empty-filter message)
 *
 * DEBUG  /search?query=x&searchdebug=1  → console.table, or run qsSearchDiagnostics()
 */

// ---------------------------------------------------------------------------
// CONFIG
// ---------------------------------------------------------------------------
const CONFIG = {
	sel: {
		results: ".qs-search-results",
		list: ".qs-search-list",
		item: ".qs-search-item",
		buttons: ".btn-is-search[data-collection]",
		snippet: "[data-search-snippet]",
		queryInputs: 'input[name="query"]',
	},
	urlParam: "category",
	pageSize: 30,
	fadeMs: 150,
	// Set to null to run native-only. A missing/404 index is harmless.
	indexUrl: "https://sumit-qs.github.io/qs/search/index.json",
	indexTimeoutMs: 8000,
	defaultImage:
		"https://cdn.prod.website-files.com/685dc0d3783c5b149e061183/685dc0d3783c5b149e0611b1_d74a9ecee6ad2c0df866a9d38cc46e97_6756468cae334f39ca01eb26_Cover.png",
	moreLabel: "Show more results",
};

const CURRENT_YEAR = new Date().getFullYear();
const LOCALE_PREFIXES = ["/en-us"];

// Never shown (exact path segments — "/solution" never matches "/solutions").
const HIDDEN_PATHS = [
	"/solution", // CMS reference template (known items are aliased below)
	"/conference", // CMS stubs (known items are aliased below)
	"/staging",
	"/magazine",
	"/magazines", // WIP — remove these two lines when the magazine goes live
	"/cms-collection-topics",
	"/cms-solutions-categories",
	"/search",
	"/404",
	"/401",
];

// Legal pages: hidden unless the query asks for them ("privacy", "terms"…).
const LEGAL_PATHS = ["/terms-and-conditions", "/qs-customer-contract-terms-and-conditions"];
const LEGAL_INTENT =
	/\b(privacy|cookies?|terms?|conditions?|polic(?:y|ies)|legal|gdpr|slavery|compliance|supplier|security|contract|accessibility|feedback|statement|refunds?|data protection)\b/;

// CMS stub / redirect → the real page. Verified live (12 Oct 2026).
// The GitHub index adds more automatically (canonical tags + redirects).
const ALIASES = {
	"/conference/africa-forum": "/conferences/africa-forum",
	"/conference/americas": "/conferences/americas",
	"/conference/arab-forum": "/conferences/arab-forum",
	"/conference/asia-pacific": "/conferences/asia-pacific",
	"/conference/back-to-school": "/conferences/back-to-school",
	"/conference/china": "/conferences/china",
	"/conference/edudata": "/conferences/edudata",
	"/conference/eurasia": "/conferences/eurasia",
	"/conference/europe": "/conferences/europe",
	"/conference/europe-2026": "/conferences/europe",
	"/conference/global-skills-week": "/conferences/global-skills-week",
	"/conference/global-skills-week-2026": "/conferences/global-skills-week/2026/overview",
	"/conference/india": "/conferences/india",
	"/conference/middle-east": "/conferences/middle-east",
	"/conference/move-on": "/conferences/move-on/2026/overview",
	"/conference/reimagine": "/conferences/reimagine",
	"/conference/qs-india-summit-2026": "/conferences/india/2026/overview",
	"/conference/qs-china-summit-2026": "/conferences/china/2026/overview",
	"/conference/qs-africa-forum-2026": "/conferences/africa-forum/2026/overview",
	"/conference/qs-world-edudata-summit-2026": "/conferences/edudata/2026/edudata-overview",
	"/conference/qs-higher-ed-summit-americas-2027": "/conferences/americas",
	"/solution/academic-reputation-dataset": "/solutions/academic-reputation-dataset",
	"/solution/ai-capability-assessments": "/solutions/ai-capability-assessments",
	"/solution/ai-capability-framework": "/solutions/ai-capability-framework",
	"/solution/conferences-sponsorship": "/solutions/conferences-sponsorship",
	"/solution/digital-marketing-and-advertising": "/solutions/digital-marketing-and-advertising",
	"/solution/employer-reputation-dataset": "/solutions/employer-reputation-dataset",
	"/solution/gme-rankings-dataset": "/solutions/gme-rankings-dataset",
	"/solution/moveon": "/solutions/moveon",
	"/solution/offer-conversion-services": "/solutions/offer-conversion-services",
	"/solution/qs-apply": "/solutions/qs-apply",
	"/solution/qs-consultancy": "/solutions/qs-consultancy",
	"/solution/qs-publications": "/solutions/qs-publications",
	"/solution/qs-stars": "/solutions/university-ratings",
	"/solution/regional-rankings-dataset": "/solutions/regional-rankings-dataset",
	"/solution/regional-recruitment-service": "/solutions/regional-recruitment-service",
	"/solution/reputation-building-tools": "/solutions/reputation-building-tools",
	"/solution/reputation-manager": "/solutions/reputation-manager",
	"/solution/responsible-ai-consortium": "/solutions/responsible-ai-consortium",
	"/solution/subject-rankings-dataset": "/solutions/subject-rankings-dataset",
	"/solution/sustainability-rankings-dataset": "/solutions/sustainability-rankings-dataset",
	"/solution/world-university-rankings-dataset": "/solutions/world-university-rankings-dataset",
	"/solution/qs-1mentor": "/solutions/1mentor", // live redirect is broken (404)
	"/solution/transnational-education": "/consulting/transnational-education", // live redirect is broken (404)
};

// name = the button's data-collection value. A path belongs to a category
// when it is the folder's landing page or anything inside it.
const CATEGORIES = [
	{ name: "solutions", prefixes: ["/solutions", "/consulting"] },
	{ name: "insights", prefixes: ["/insights"] },
	{ name: "case-studies", prefixes: ["/case-studies"] },
	{ name: "webinars", prefixes: ["/webinars"] },
	{ name: "conferences", prefixes: ["/conferences"] },
	{ name: "people", prefixes: ["/people"] },
];

// CMS template folders — everything else is a static page.
const CMS_PREFIXES = ["/insights", "/case-studies", "/webinars", "/people"];

// Native engine only: extra Webflow query run when a filter is opened, so the
// filter isn't limited to the 60 results of the main query ("rankings" →
// 0 webinars, but "rankings webinar" → 43 webinars).
const FILTER_HINTS = { webinars: "webinar", "case-studies": "case study", conferences: "summit" };

// Query synonyms. key (normalised) → alternatives. Matching any one counts.
const SYNONYMS = {
	wur: ["world university rankings"],
	tne: ["transnational education"],
	emba: ["executive mba"],
	omba: ["online mba"],
	gme: ["graduate management education"],
	ai: ["artificial intelligence"],
	sdg: ["sustainable development goals"],
	sdgs: ["sustainable development goals"],
	"m and a": ["mergers acquisitions"],
	"move on": ["moveon"],
	moveon: ["move on"],
	"move in": ["movein"],
	"1 mentor": ["1mentor"],
	"one mentor": ["1mentor"],
	"edu data": ["edudata"],
	event: ["conference", "summit", "forum"],
	events: ["conference", "summit", "forum"],
	conference: ["summit", "forum"],
	conferences: ["summit", "forum"],
	ratings: ["stars"],
	rating: ["stars"],
	uni: ["university"],
	unis: ["universities"],
	job: ["careers"],
	jobs: ["careers"],
	vacancies: ["careers"],
};
const SYNONYM_KEYS = Object.keys(SYNONYMS).sort((a, b) => b.length - a.length);

const STOPWORDS = new Set(
	("a an and are as at be by can do does for from get how i in is it its me my of on or our " +
		"the this that to vs versus what when where which who why with your about qs find show").split(" ")
);

// Event sub-pages (agenda, venue…) rank under their event's main page.
const SUBPAGE = /^(agenda|speakers|[a-z-]+-speakers|venue|partners|sponsors|apply|welcome-message|call-for-proposals|programme|program|schedule|faqs?|register|registration)$/;
const EVENT_WORDS = /\b(summit|forum|conference|masterclass|week|awards)\b/i;

const W = {
	title: 100, heading: 20, slug: 30, desc: 15, body: 6, snippet: 8,
	coverage: 80, allInTitle: 80, phrase: 180, exact: 300, precision: 50,
	yearHit: 60, yearMiss: -100, recentNow: 40, recentLast: 15, oldPerYear: -10, oldCap: -40,
	pastEvent: -90, static: 35, landing1: 30, landing2: 15, subpage: -45,
	native: 25, legal: 60, intent: 60,
};

// A category word in the query is intent, not a term: "conferences india",
// "rankings webinar". Pages of that category satisfy the word and get a boost.
const INTENT_WORDS = {
	conference: "conferences", conferences: "conferences", summit: "conferences", summits: "conferences",
	event: "conferences", events: "conferences", forum: "conferences",
	webinar: "webinars", webinars: "webinars",
	"case study": "case-studies", "case studies": "case-studies",
	insight: "insights", insights: "insights", article: "insights", articles: "insights",
	solution: "solutions", solutions: "solutions", product: "solutions", products: "solutions",
	people: "people", speaker: "people", speakers: "people", expert: "people", experts: "people",
};
const INTENT_KEYS = Object.keys(INTENT_WORDS).sort((a, b) => b.length - a.length);

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

const isNum = (w) => /^\d+$/.test(w);
const isYear = (w) => /^(19|20)\d{2}$/.test(w);

function stem(w) {
	if (isNum(w)) return w;
	if (w.length > 4 && w.endsWith("ies")) return w.slice(0, -3) + "y";
	if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) return w.slice(0, -1);
	return w;
}

const tokenise = (v) => {
	const n = normalise(v);
	return n ? n.split(" ").map(stem) : [];
};

const yearsIn = (v) =>
	(String(v || "").match(/\b(19|20)\d{2}\b/g) || []).map(Number).filter((y) => y >= 1990 && y <= 2099);

// Strip the brand suffix so "QS Stars | QS" is an exact match for "qs stars".
const stripBrand = (t) => {
	let s = String(t || "");
	for (let i = 0; i < 3; i++) {
		s = s.replace(/\s*\|\s*(qs( quac\w* symonds)?|qs case study|case study|webinar)\s*$/i, "");
	}
	return s.trim();
};

// Damerau-Levenshtein distance ≤ 1
function within1(a, b) {
	if (a === b) return true;
	const la = a.length;
	const lb = b.length;
	if (Math.abs(la - lb) > 1) return false;
	let i = 0;
	while (i < la && i < lb && a[i] === b[i]) i++;
	if (la === lb) {
		if (a.slice(i + 1) === b.slice(i + 1)) return true;
		return i + 1 < la && a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2);
	}
	return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

// ---------------------------------------------------------------------------
// PATHS
// ---------------------------------------------------------------------------
function toPath(href) {
	if (href == null) return null;
	let p;
	try {
		p = new URL(href, window.location.origin).pathname;
	} catch {
		p = String(href).split(/[?#]/)[0];
	}
	try {
		p = decodeURIComponent(p);
	} catch {
		/* keep raw */
	}
	p = p.toLowerCase().replace(/\/+$/, "");
	for (const lp of LOCALE_PREFIXES) {
		if (p === lp || p.startsWith(lp + "/")) {
			p = p.slice(lp.length);
			break;
		}
	}
	return ALIASES[p] || p; // "" = homepage
}

const inFolder = (p, prefix) => p === prefix || p.startsWith(prefix + "/");
const categoryOf = (p) => CATEGORIES.find((c) => c.prefixes.some((x) => inFolder(p, x)))?.name || null;
const isCategory = (v) => CATEGORIES.some((c) => c.name === v);
const segments = (p) => p.split("/").filter(Boolean);

// ---------------------------------------------------------------------------
// QUERY
// ---------------------------------------------------------------------------
function buildQuery(raw) {
	const norm = normalise(raw);
	const groups = [];
	let rest = ` ${norm} `;

	// category intent (only when other words remain: "webinars" alone is a normal search)
	let intent = null;
	let intentRest = null;
	for (const key of INTENT_KEYS) {
		if (rest.includes(` ${key} `)) {
			const without = rest.replace(` ${key} `, " ").trim();
			if (without && tokenise(without).some((t) => !STOPWORDS.has(t))) {
				intent = INTENT_WORDS[key];
				intentRest = without;
				groups.push({ label: key, alts: [tokenise(key), ...(SYNONYMS[key] || []).map(tokenise)], intentFor: intent });
				rest = ` ${without} `;
			}
			break;
		}
	}

	for (const key of SYNONYM_KEYS) {
		if (rest.includes(` ${key} `)) {
			groups.push({ label: key, alts: [tokenise(key), ...SYNONYMS[key].map(tokenise)] });
			rest = rest.replace(` ${key} `, " ");
		}
	}

	const tokens = tokenise(rest);
	const years = [...new Set(tokens.filter(isYear).map(Number))];
	let words = tokens.filter((t) => !isYear(t) && !STOPWORDS.has(t) && t.length > 1);
	if (!words.length && !groups.length && !years.length) words = tokens.filter((t) => !isYear(t));

	for (const w of words) if (!groups.some((g) => g.label === w)) groups.push({ label: w, alts: [[w]] });

	const phraseOf = (s) =>
		tokenise(s)
			.filter((t) => !STOPWORDS.has(t) && !isYear(t))
			.join(" ");
	const phrase = phraseOf(norm);
	const phraseNoIntent = intentRest ? phraseOf(intentRest) : phrase;

	// Expanded text for an extra Webflow query (native engine): "wur" → "world university rankings"
	// single pass with placeholders, so "move on" → "moveon" isn't swapped back by "moveon" → "move on"
	let expanded = ` ${norm} `;
	const swaps = [];
	for (const key of SYNONYM_KEYS) {
		if (["event", "events", "conference", "conferences", "rating", "ratings"].includes(key)) continue;
		if (expanded.includes(` ${key} `)) {
			expanded = expanded.replace(` ${key} `, ` \u0000${swaps.length}\u0000 `);
			swaps.push(SYNONYMS[key][0]);
		}
	}
	expanded = expanded.replace(/\u0000(\d+)\u0000/g, (_, i) => swaps[i]).replace(/\s+/g, " ").trim();

	return {
		raw,
		norm,
		intent,
		intentRest,
		groups: groups.slice(0, 10),
		years,
		phrase,
		phraseNoIntent,
		legal: LEGAL_INTENT.test(norm),
		words: new Set(tokenise(norm)),
		expanded: expanded !== norm ? expanded : null,
	};
}

// ---------------------------------------------------------------------------
// DOCUMENTS (native result cards and index records share one shape)
// ---------------------------------------------------------------------------
function field(text) {
	const tok = tokenise(text);
	return { tok, set: new Set(tok) };
}

function prep(rec) {
	const path = rec.path;
	const title = String(rec.title || "").replace(/\s+/g, " ").trim();
	const clean = stripBrand(title);
	const titleYears = yearsIn(clean);
	const dateYear = rec.date ? Number(String(rec.date).slice(0, 4)) || null : null;
	const allYears = [...titleYears, ...yearsIn(path), ...(dateYear ? [dateYear] : [])];
	const segs = segments(path);
	const category = categoryOf(path);
	const kind = path === "" ? "home" : rec.kind || (CMS_PREFIXES.some((c) => path.startsWith(c + "/")) ? "cms" : "static");
	const titleField = field(clean);

	return {
		...rec,
		path,
		title,
		category,
		kind,
		depth: segs.length,
		subpage: segs.length > 2 && SUBPAGE.test(segs[segs.length - 1]),
		legal: LEGAL_PATHS.some((l) => inFolder(path, l)),
		titleYears,
		years: allYears,
		year: allYears.length ? Math.max(...allYears) : null,
		isEvent: category === "conferences" || EVENT_WORDS.test(clean),
		f: {
			title: titleField,
			titleSig: titleField.tok.filter((t) => !STOPWORDS.has(t) && !isYear(t)),
			slug: field(path.replace(/[/-]/g, " ")),
			desc: field(rec.desc),
			head: field(rec.headings),
			body: field(`${rec.body || ""} ${rec.keywords || ""}`),
			snip: field(rec.snippet),
		},
		band: 1,
		score: 0,
	};
}

function termWeight(fieldObj, term) {
	if (fieldObj.set.has(term)) return 1;
	if (isNum(term) || term.length < 4) return 0;
	for (const t of fieldObj.tok) if (t.startsWith(term)) return 0.85;
	if (term.length < 5) return 0;
	for (const t of fieldObj.tok) if (Math.abs(t.length - term.length) <= 1 && within1(t, term)) return 0.6;
	return 0;
}

function groupWeight(fieldObj, group) {
	let best = 0;
	for (const alt of group.alts) {
		let w = 1;
		for (const term of alt) {
			w = Math.min(w, termWeight(fieldObj, term));
			if (!w) break;
		}
		if (w > best) best = w;
		if (best === 1) break;
	}
	return best;
}

function score(d, q, nativeTotal) {
	const f = d.f;
	const n = q.groups.length;
	let s = 0;
	let band = 1;
	let any = 0;

	if (n) {
		let inTitle = 0;
		let inStrong = 0;
		for (const g of q.groups) {
			if (g.intentFor && d.category === g.intentFor) {
				// the category word is satisfied by being in that category
				s += W.intent;
				inTitle++;
				inStrong++;
				any++;
				continue;
			}
			const t = groupWeight(f.title, g);
			const u = t ? 0 : groupWeight(f.slug, g);
			const de = groupWeight(f.desc, g);
			const h = groupWeight(f.head, g);
			const b = groupWeight(f.body, g);
			const sn = groupWeight(f.snip, g);
			s += W.title * t + W.slug * u + W.desc * de + W.heading * h + W.body * b + W.snippet * sn;
			if (t) inTitle++;
			if (t || u || de || h) inStrong++;
			if (t || u || de || h || b || sn) any++;
		}
		s += W.coverage * (any / n);
		if (inTitle === n) s += W.allInTitle;
		s += W.precision * Math.min(1, inTitle / Math.max(1, f.titleSig.length));

		const sig = f.titleSig.join(" ");
		const phs = q.intent && d.category === q.intent ? [q.phrase, q.phraseNoIntent] : [q.phrase];
		const exact = phs.some((ph) => ph && sig === ph);
		const phrase = !exact && n > 1 && phs.some((ph) => ph && ph.includes(" ") && ` ${sig} `.includes(` ${ph} `));
		if (exact) s += W.exact;
		else if (phrase) s += W.phrase;

		band = exact || phrase ? 5 : inTitle === n ? 4 : inStrong === n ? 3 : any === n || inStrong * 2 >= n ? 2 : 1;
	}

	if (q.years.length) {
		const hit = d.years.some((y) => q.years.includes(y));
		if (hit) s += W.yearHit;
		else if (d.titleYears.length) {
			s += W.yearMiss;
			band = Math.min(band, 3);
		}
		if (!n) band = hit ? 3 : 1;
		if (!n && hit) any = 1;
	} else if (d.year) {
		if (d.year >= CURRENT_YEAR) s += W.recentNow;
		else if (d.year === CURRENT_YEAR - 1) s += W.recentLast;
		else s += Math.max(W.oldCap, (CURRENT_YEAR - 1 - d.year) * W.oldPerYear);
		if (d.isEvent && d.year < CURRENT_YEAR) s += W.pastEvent;
	}

	if (d.kind === "static") {
		s += W.static;
		if (d.depth === 1) s += W.landing1;
		else if (d.depth === 2) s += W.landing2;
	}
	if (d.subpage && !q.words.has(stem(segments(d.path).pop()))) s += W.subpage;
	if (d.nativeIndex != null && nativeTotal > 1) s += W.native * (1 - Math.min(d.nativeIndex, nativeTotal - 1) / (nativeTotal - 1));
	if (d.legal && q.legal) s += W.legal;

	d.band = band;
	d.score = s;
	d.matched = any;
	d.hidden = d.legal && !q.legal;
	// demoted: shown after everything else in the default view
	d.demoted = d.kind === "home" || (d.category === "people" && band < 4);
	// junk: only matched through page-template text (nav, footer) — never shown
	// if anything better exists. Native engine only; the index excludes templates.
	d.junk = d.source === "native" && band === 1 && !any && (d.category === "people" || d.category === "conferences");
	return d;
}

const compare = (a, b) =>
	b.band - a.band ||
	b.score - a.score ||
	(a.nativeIndex ?? 1e9) - (b.nativeIndex ?? 1e9) ||
	a.title.localeCompare(b.title);

// ---------------------------------------------------------------------------
// DOM: read native cards, build new cards
// ---------------------------------------------------------------------------
function readCard(el, nativeIndex, source) {
	const link = el.querySelector("a[href]");
	const href = link?.getAttribute("href");
	return {
		el,
		source,
		nativeIndex,
		rawPath: href,
		path: toPath(href),
		title: link?.textContent || "",
		desc: el.querySelector(".body")?.textContent || "",
		snippet: el.querySelector(CONFIG.sel.snippet)?.textContent || "",
	};
}

function cardSkeleton() {
	const el = document.createElement("div");
	el.className = "qs-search-item";
	el.innerHTML =
		'<div class="qs-search-image"><img loading="lazy" src="" alt="" class="qs-asset"></div>' +
		'<div class="qs-search-content-wrapper"><a href="#" class="title4 bold no-link"></a>' +
		'<p class="body"></p><div class="caption"></div></div>';
	return el;
}

function buildCard(state, doc) {
	const el = state.template ? state.template.cloneNode(true) : cardSkeleton();
	el.removeAttribute("style");
	const img = el.querySelector("img");
	const src = doc.image || CONFIG.defaultImage;
	if (img) {
		img.setAttribute("src", src);
		img.style.backgroundImage = `url("${src}")`;
		img.classList.remove("w-dyn-bind-empty");
	}
	const link = el.querySelector("a[href]") || el.querySelector("a");
	if (link) {
		link.setAttribute("href", doc.path || "/");
		link.textContent = doc.title;
	}
	const body = el.querySelector(".body");
	if (body) {
		body.textContent = doc.desc || "";
		body.classList.toggle("w-dyn-bind-empty", !doc.desc);
	}
	const cap = el.querySelector(".caption");
	if (cap) cap.textContent = `${window.location.host}${doc.path || "/"}`;
	el.querySelectorAll(CONFIG.sel.snippet).forEach((s) => (s.textContent = ""));
	return el;
}

// Zero native results: Webflow renders no list — create one.
function ensureList(state) {
	if (state.list) return state.list;
	const results = document.querySelector(CONFIG.sel.results);
	if (!results) return null;
	const list = document.createElement("div");
	list.className = "qs-search-list search-result-items";
	results.prepend(list);
	state.list = list;
	state.webflowEmpty = [...results.children].filter((c) => c !== list);
	return list;
}

// ---------------------------------------------------------------------------
// STATE → VIEW
// ---------------------------------------------------------------------------
function rank(state) {
	const q = state.query;
	const total = state.nativeTotal;
	const all = [...state.docs.values()].map((d) => score(d, q, total)).filter((d) => !d.hidden);
	all.sort(compare);
	state.ranked = all;
}

function currentView(state) {
	const r = state.ranked;
	if (state.active) {
		const inCat = r.filter((d) => d.category === state.active);
		const real = inCat.filter((d) => !d.junk);
		return real.length ? real : inCat;
	}
	// Default view: never the filter-only extras (keeps the default list stable)
	const base = r.filter((d) => !d.extraFor);
	const main = base.filter((d) => !d.demoted && !d.junk);
	const demoted = base.filter((d) => d.demoted && !d.junk);
	const out = [...main, ...demoted];
	return out.length ? out : base;
}

function render(state) {
	if (!state.list && !state.ranked.length) return; // nothing found anywhere — Webflow's empty state stays
	const list = ensureList(state);
	if (!list) return;
	const view = currentView(state);
	const limit = state.page * CONFIG.pageSize;
	const shown = view.slice(0, limit);
	const renderId = (state.renderId = (state.renderId || 0) + 1);

	const frag = document.createDocumentFragment();
	for (const d of shown) {
		if (!d.el) d.el = buildCard(state, d);
		d.el.style.display = "";
		d.el.__qsRender = renderId;
		frag.appendChild(d.el);
	}
	list.appendChild(frag);
	// Everything else in the list (other categories, next pages, removed cards) is hidden
	list.querySelectorAll(CONFIG.sel.item).forEach((el) => {
		if (el.__qsRender !== renderId) el.style.display = "none";
	});

	if (state.webflowEmpty) state.webflowEmpty.forEach((n) => (n.style.display = state.ranked.length ? "none" : ""));

	// buttons
	for (const btn of document.querySelectorAll(CONFIG.sel.buttons)) {
		const on = btn.getAttribute("data-collection") === state.active;
		btn.classList.toggle("is-active", on);
		btn.setAttribute("aria-pressed", String(on));
	}

	// empty filter message
	const empty = state.emptyEl;
	const showEmpty = Boolean(state.active) && view.length === 0 && !state.loading;
	if (showEmpty && !empty.hasAttribute("data-keep-text")) {
		const btn = document.querySelector(`${CONFIG.sel.buttons}[data-collection="${state.active}"]`);
		const label = (btn?.textContent || state.active).trim();
		empty.textContent = `No ${label} results for “${state.query.raw}”. Try another category or search term.`;
	}
	empty.style.display = showEmpty ? "" : "none";

	// show more
	state.moreWrap.style.display = view.length > limit ? "" : "none";
	list.classList.toggle("is-loading", Boolean(state.loading));
	list.setAttribute("aria-busy", String(Boolean(state.loading)));
}

function transition(state, mutate) {
	const list = state.list;
	const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
	if (!list || !CONFIG.fadeMs || reduce) {
		mutate();
		render(state);
		return;
	}
	const token = (state.fadeToken = (state.fadeToken || 0) + 1);
	list.style.transition = `opacity ${CONFIG.fadeMs}ms ease`;
	list.style.opacity = "0";
	setTimeout(() => {
		if (token !== state.fadeToken) return;
		mutate();
		render(state);
		requestAnimationFrame(() => (list.style.opacity = "1"));
	}, CONFIG.fadeMs);
}

// ---------------------------------------------------------------------------
// DATA SOURCES
// ---------------------------------------------------------------------------
function addDoc(state, rec) {
	if (rec.path == null) return false;
	const prev = state.docs.get(rec.path);
	if (prev) {
		// merge: keep the native card + best native rank, gain index fields
		for (const k of ["headings", "body", "keywords", "date", "image", "kind"]) if (rec[k] && !prev[k]) prev[k] = rec[k];
		if (rec.nativeIndex != null && (prev.nativeIndex == null || rec.nativeIndex < prev.nativeIndex)) prev.nativeIndex = rec.nativeIndex;
		if (!prev.desc && rec.desc) prev.desc = rec.desc;
		state.docs.set(rec.path, prep(prev));
		return false;
	}
	state.docs.set(rec.path, prep(rec));
	return true;
}

function collectNative(state) {
	const items = state.list ? [...state.list.querySelectorAll(CONFIG.sel.item)] : [];
	state.nativeTotal = items.length;
	if (items[0]) state.template = items[0].cloneNode(true);
	items.forEach((el, i) => {
		const rec = readCard(el, i, "native");
		if (rec.path === null || !rec.title.trim() || HIDDEN_PATHS.some((h) => inFolder(rec.path, h))) {
			el.remove();
			return;
		}
		if (state.docs.has(rec.path)) {
			el.remove(); // duplicate (locale copy, stub of an existing page)
			return;
		}
		retargetCard(rec);
		addDoc(state, rec);
	});
}

function retargetCard(rec) {
	const link = rec.el.querySelector("a[href]");
	if (!link) return;
	const rawPath = (() => {
		try {
			return new URL(rec.rawPath, window.location.origin).pathname.toLowerCase().replace(/\/+$/, "");
		} catch {
			return rec.rawPath;
		}
	})();
	if (rawPath === rec.path || rawPath === `/en-us${rec.path}`) return;
	link.setAttribute("href", rec.path || "/");
	const cap = rec.el.querySelector(".caption");
	if (cap) cap.textContent = `${window.location.host}${rec.path || "/"}`;
}

// Extra Webflow query → parse its server-rendered cards → merge (native engine)
async function fetchWebflow(state, query, extraFor = null, only = null) {
	const key = normalise(query);
	if (state.fetched.has(key)) return state.fetched.get(key);
	const p = (async () => {
		try {
			const res = await fetch(`/search?query=${encodeURIComponent(query)}`, { credentials: "same-origin" });
			if (!res.ok) return 0;
			const doc = new DOMParser().parseFromString(await res.text(), "text/html");
			let added = 0;
			doc.querySelectorAll(CONFIG.sel.item).forEach((node, i) => {
				const el = document.importNode(node, true);
				const rec = readCard(el, state.nativeTotal + i, "native-extra");
				if (rec.path === null || !rec.title.trim() || HIDDEN_PATHS.some((h) => inFolder(rec.path, h))) return;
				if (state.docs.has(rec.path)) return;
				rec.nativeIndex = null; // no Webflow-rank bonus for supplementary hits
				rec.extraFor = extraFor;
				const keep = extraFor || only;
				if (keep && categoryOf(rec.path) !== keep) return; // keep only the wanted category
				retargetCard(rec);
				if (addDoc(state, rec)) added++;
			});
			return added;
		} catch {
			return 0;
		}
	})();
	state.fetched.set(key, p);
	return p;
}

async function loadIndex() {
	if (!CONFIG.indexUrl) return null;
	const ctrl = typeof AbortController !== "undefined" ? new AbortController() : null;
	const timer = setTimeout(() => ctrl?.abort(), CONFIG.indexTimeoutMs);
	try {
		const res = await fetch(CONFIG.indexUrl, { signal: ctrl?.signal, credentials: "omit" });
		if (!res.ok) return null;
		const data = await res.json();
		return Array.isArray(data?.docs) ? data : null;
	} catch {
		return null;
	} finally {
		clearTimeout(timer);
	}
}

function applyIndex(state, index) {
	Object.assign(ALIASES, index.aliases || {});
	// Re-key any native card whose stub is now known to alias somewhere else
	for (const [path, d] of [...state.docs]) {
		const target = ALIASES[path];
		if (target && target !== path) {
			state.docs.delete(path);
			d.path = target;
			if (!state.docs.has(target)) state.docs.set(target, prep(d));
			else if (d.el) d.el.remove();
		}
	}
	const hidden = (p) => HIDDEN_PATHS.some((h) => inFolder(p, h));
	const q = state.query;
	const cdn = index.cdn || "";
	for (const r of index.docs) {
		const path = toPath(r.u);
		if (path === null || hidden(path)) continue;
		const rec = {
			source: "index",
			path,
			title: r.t || "",
			desc: r.d || "",
			headings: r.h || "",
			body: r.b || "",
			keywords: r.kw || "",
			date: r.dt || null,
			image: r.img ? (r.img.startsWith("~/") ? cdn + r.img.slice(2) : r.img) : "",
			kind: r.k || null,
			nativeIndex: null,
		};
		if (state.docs.has(path)) {
			addDoc(state, rec);
			continue;
		}
		// only keep index docs that match the query at all
		const probe = score(prep(rec), q, 0);
		if (probe.matched || (q.years.length && probe.band >= 3)) state.docs.set(path, probe);
	}
}

// ---------------------------------------------------------------------------
// UI WIRING
// ---------------------------------------------------------------------------
function readCategoryParam() {
	const v = new URLSearchParams(window.location.search).get(CONFIG.urlParam);
	return isCategory(v) ? v : null;
}

function writeUrl(active) {
	const url = new URL(window.location.href);
	url.searchParams.delete("type");
	if (active) url.searchParams.set(CONFIG.urlParam, active);
	else url.searchParams.delete(CONFIG.urlParam);
	history.pushState({ qsSearchCategory: active }, "", url);
}

function makeChrome(state) {
	const anchor = state.list || document.querySelector(CONFIG.sel.results);
	let empty = document.querySelector("[data-search-filter-empty]");
	if (!empty) {
		empty = document.createElement("p");
		empty.className = "qs-search-filter-empty";
		empty.setAttribute("data-search-filter-empty", "");
		empty.setAttribute("role", "status");
		anchor?.insertAdjacentElement("afterend", empty);
	}
	empty.style.display = "none";
	state.emptyEl = empty;

	const wrap = document.createElement("div");
	wrap.className = "qs-search-more-wrapper";
	wrap.style.display = "none";
	const more = document.createElement("a");
	more.href = "#";
	more.className = "qs-button qs-search-more";
	more.textContent = CONFIG.moreLabel;
	more.addEventListener("click", (e) => {
		e.preventDefault();
		state.page++;
		render(state);
	});
	wrap.appendChild(more);
	(empty || anchor)?.insertAdjacentElement("afterend", wrap);
	state.moreWrap = wrap;
}

async function ensureFilterData(state, name) {
	if (state.mode !== "native" || !FILTER_HINTS[name] || !state.query.norm) return;
	const added = await fetchWebflow(state, `${state.query.raw} ${FILTER_HINTS[name]}`, name);
	if (added && !state.merged.has(name)) {
		state.merged.add(name);
		rank(state);
	}
}

function wireButtons(state) {
	document.addEventListener("click", (ev) => {
		const btn = ev.target.closest?.(CONFIG.sel.buttons);
		if (!btn) return;
		ev.preventDefault();
		const name = btn.getAttribute("data-collection");
		if (!isCategory(name)) return;
		state.active = state.active === name ? null : name;
		state.page = 1;
		writeUrl(state.active);
		if (state.active && state.mode === "native" && FILTER_HINTS[state.active]) {
			const wanted = state.active;
			state.loading = true;
			transition(state, () => {});
			ensureFilterData(state, wanted).finally(() => {
				state.loading = false;
				if (state.active === wanted) render(state);
			});
		} else {
			transition(state, () => {});
		}
	});

	// Warm the extra query when the user is about to click a filter
	const warm = (ev) => {
		const btn = ev.target.closest?.(CONFIG.sel.buttons);
		if (btn) ensureFilterData(state, btn.getAttribute("data-collection"));
	};
	document.addEventListener("pointerover", warm, { passive: true });
	document.addEventListener("focusin", warm);

	window.addEventListener("popstate", () => {
		state.active = readCategoryParam();
		state.page = 1;
		transition(state, () => {});
		if (state.active) ensureFilterData(state, state.active).then(() => render(state));
	});
}

// Outside /search: warm the index while the user types in a search box.
function warmIndexOnFocus() {
	if (!CONFIG.indexUrl) return;
	let done = false;
	document.addEventListener("focusin", (e) => {
		if (done || !e.target.matches?.(CONFIG.sel.queryInputs)) return;
		done = true;
		fetch(CONFIG.indexUrl, { credentials: "omit" }).catch(() => {});
	});
}

// ---------------------------------------------------------------------------
// EXPORT
// ---------------------------------------------------------------------------
export function functionSearchSort() {
	if (window.__qsSearchInit) return;
	window.__qsSearchInit = true;

	const onSearchPage = /^\/search$/.test(toPath(window.location.pathname) ?? "");
	if (!onSearchPage) {
		warmIndexOnFocus();
		return;
	}

	const run = () => {
		const params = new URLSearchParams(window.location.search);
		const raw = (params.get("query") || "").trim();
		if (!raw) return;

		const state = {
			query: buildQuery(raw),
			list: document.querySelector(CONFIG.sel.list),
			docs: new Map(),
			fetched: new Map(),
			merged: new Set(),
			ranked: [],
			active: readCategoryParam() || (isCategory(params.get("type")) ? params.get("type") : null),
			page: 1,
			mode: "native",
			nativeTotal: 0,
			template: null,
		};

		try {
			collectNative(state);
			makeChrome(state);
			rank(state);
			render(state);
			wireButtons(state);
			window.qsSearchDiagnostics = () => diagnostics(state);
			if (params.has("searchdebug")) console.table(diagnostics(state));
		} catch (err) {
			console.error("[search] native enhancement failed — Webflow order kept", err);
			return;
		}

		// Upgrade: full-site index → otherwise synonym expansion via a second Webflow query
		loadIndex().then(async (index) => {
			try {
				if (index) {
					applyIndex(state, index);
					state.mode = "index";
					rank(state);
					transition(state, () => {});
				} else {
					// Native engine: widen the 60-result window with extra Webflow queries
					const q = state.query;
					const extra = await Promise.all([
						q.expanded ? fetchWebflow(state, q.expanded) : 0, // "wur" → "world university rankings"
						q.intent && q.intentRest ? fetchWebflow(state, q.intentRest, null, q.intent) : 0, // "conferences india" → conference pages for "india"
					]);
					if (extra[0] + extra[1] > 0) {
						rank(state);
						transition(state, () => {});
					}
					if (state.active) {
						await ensureFilterData(state, state.active);
						render(state);
					}
				}
				if (params.has("searchdebug")) console.table(diagnostics(state));
			} catch (err) {
				console.error("[search] upgrade failed — keeping current results", err);
			}
		});
	};

	if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
	else run();
}

function diagnostics(state) {
	return state.ranked.map((d, i) => ({
		pos: i + 1,
		band: d.band,
		score: Math.round(d.score),
		src: d.source,
		native: d.nativeIndex != null ? d.nativeIndex + 1 : "",
		cat: d.category || d.kind,
		flag: d.junk ? "junk" : d.demoted ? "demoted" : "",
		title: d.title,
		path: d.path || "/",
	}));
}

// Exposed for tests / tooling (tree-shaken if unused)
export const __searchInternals = { buildQuery, prep, score, compare, toPath, tokenise, within1, stripBrand };