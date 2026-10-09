/**
 * QS SITE SEARCH — V2 (drop-in ES module replacement)
 * ---------------------------------------------------
 * Replace the existing module that exports functionSearchSort() with this file.
 * Keep the existing import and call of functionSearchSort() in your site's entry.
 *
 * Implements:
 * - Relevance bands FIRST (exact/close title > all query terms > partial).
 * - Static pages FIRST only within the SAME relevance band; relevant CMS beats
 *   irrelevant static content.
 * - Category filters from URL paths, including /conference/ and /conferences/.
 * - Filter state mirrored in ?category= for bookmarking / back-forward.
 * - Synchronous DOM sorting: NO per-result fetches, waiting loops, or debounce.
 * - Stable fallback to native Webflow order, URL deduplication and exclusions.
 * - Guarded DOM scope; preserves existing result-card markup and button styles.
 *
 * LIMITATION: this is a post-processor for Webflow's NATIVE results (max 60).
 * It cannot show pages absent from Webflow's index/result set.
 *
 * No API keys belong in frontend JavaScript. No new libraries are required.
 */

const QS_SEARCH_V2 = Object.freeze({
  listSelector: ".qs-search-list",
  itemSelector: ".qs-search-item",
  buttonSelector: ".btn-is-search[data-collection]",
  categoryParameter: "category",

  // Prefer static pages when they are approximately equally relevant.
  rankStaticFirstWithinBand: true,

  // Keep intentional exclusions; notably /conference/ is NOT excluded.
  excludedPaths: [
    /^\/staging(?:\/|$)/i,
    /^\/terms-and-conditions(?:\/|$)/i,
    /^\/solution(?:\/|$)/i,
  ],
});

// Categories describe CONTENT, not whether the URL is a CMS page.
// Extend mappings for additional QS routes only after verifying live routes.
const QS_CATEGORY_ROUTES = [
  { name: "conferences", test: /^\/conferences?(?:\/|$)/i },
  { name: "case-studies", test: /^\/case-studies(?:\/|$)/i },
  { name: "webinars", test: /^\/webinars(?:\/|$)/i },
  { name: "insights", test: /^\/insights(?:\/|$)/i },
  { name: "people", test: /^\/people(?:\/|$)/i },
  {
    name: "solutions",
    test: /^\/(?:solutions|consulting|capabilities)(?:\/|$)/i,
  },
];

// Paths of CMS items; URLs outside these patterns are provisionally static.
// In particular: plural /conferences/... can be a STATIC event page,
// singular /conference/... is a CMS route.
// Search-result HTML does not expose original Webflow page type:
// use data-search-kind when available.
const QS_CMS_ROUTES = [
  /^\/conference\//i,
  /^\/insights\//i,
  /^\/case-studies\//i,
  /^\/webinars\//i,
  /^\/people\//i,
];

const QS_CATEGORY_ALIASES = {
  "case studies": "case-studies",
  "case-studies": "case-studies",
  "case_studies": "case-studies",
  "conference": "conferences",
  "conferences": "conferences",
  "insight": "insights",
  "insights": "insights",
  "webinar": "webinars",
  "webinars": "webinars",
  "person": "people",
  "people": "people",
  "solution": "solutions",
  "solutions": "solutions",
};

const QS_QUERY_STOP_WORDS = new Set([
  "a", "an", "and", "at", "by", "for", "from",
  "in", "of", "on", "or", "the", "to", "with", "qs"
]);

function qsNormalizeText(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function qsStem(term) {
  if (/^\d+$/.test(term)) return term;

  if (term.length > 4 && term.endsWith("ies")) {
    return term.slice(0, -3) + "y";
  }

  if (
    term.length > 3 &&
    term.endsWith("s") &&
    !term.endsWith("ss")
  ) {
    return term.slice(0, -1);
  }

  return term;
}

function qsTokens(value) {
  return qsNormalizeText(value)
    .split(" ")
    .filter(Boolean)
    .map(qsStem);
}

function qsQueryTokens(query) {
  const all = qsTokens(query);

  const useful = all.filter(
    token => !QS_QUERY_STOP_WORDS.has(token)
  );

  return [...new Set(useful.length ? useful : all)];
}

function qsNormalizeCategory(value) {
  const normalized = qsNormalizeText(value)
    .replace(/\s+/g, "-");

  return QS_CATEGORY_ALIASES[normalized] || normalized;
}

function qsUrlFromAnchor(anchor) {
  try {
    const url = new URL(
      anchor.href,
      window.location.origin
    );

    if (url.origin !== window.location.origin) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function qsPath(url) {
  // Webflow localized content, e.g. /en-us/conferences/india.
  return url.pathname.replace(
    /^\/[a-z]{2}-[a-z]{2}(?=\/)/i,
    ""
  ) || "/";
}

function qsCleanPath(pathname) {
  if (pathname === "/") return pathname;

  return pathname.replace(/\/+$/, "");
}

function qsResultTitle(item, anchor) {
  const heading = item.querySelector(
    "h1,h2,h3,h4,h5,h6"
  );

  return (
    heading?.textContent ||
    anchor?.textContent ||
    ""
  )
    .replace(/\s+/g, " ")
    .trim();
}

function qsResultDescription(item) {
  // Search snippets only; don't score complete pages,
  // menus or hidden embeds.
  const specified = item.querySelector(
    "[data-search-description],.qs-search-description"
  );

  if (specified) {
    return (specified.textContent || "")
      .slice(0, 1200);
  }

  return [...item.querySelectorAll("p")]
    .slice(0, 3)
    .map(node => node.textContent || "")
    .join(" ")
    .slice(0, 1200);
}

function qsExtractDate(item, path, title) {
  const explicit = item.querySelector(
    "time[datetime],[data-search-date]"
  );

  const attr =
    explicit?.getAttribute("datetime") ||
    explicit?.getAttribute("data-search-date");

  if (attr) {
    const parsed = Date.parse(attr);

    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }

  // Avoid reading years from a snippet,
  // which often describes OTHER events.
  const year = `${path} ${title}`.match(
    /\b(20\d{2})\b/
  );

  return year
    ? Date.UTC(Number(year[1]), 0, 1)
    : null;
}

function qsCategory(path, item) {
  // Optional explicit metadata, if later
  // provided in the Webflow Designer.
  const override = item.getAttribute(
    "data-search-category"
  );

  if (override) {
    return qsNormalizeCategory(override);
  }

  return QS_CATEGORY_ROUTES.find(
    route => route.test.test(path)
  )?.name || null;
}

function qsPageKind(path, item) {
  const override = (
    item.getAttribute("data-search-kind") || ""
  ).toLowerCase();

  if (
    override === "static" ||
    override === "cms"
  ) {
    return override;
  }

  return QS_CMS_ROUTES.some(
    route => route.test(path)
  )
    ? "cms"
    : "static";
}

function qsRank(entry, queryTokens) {
  if (!queryTokens.length) {
    return {
      band: 0,
      score: 0,
    };
  }

  const title = qsTokens(entry.title);

  const description = qsTokens(
    entry.description
  );

  const path = qsTokens(
    entry.path.replace(/\//g, " ")
  );

  const titleSet = new Set(title);
  const descriptionSet = new Set(description);
  const pathSet = new Set(path);

  const matchingTitle = queryTokens.filter(
    token => titleSet.has(token)
  );

  const matchingAll = queryTokens.filter(
    token =>
      titleSet.has(token) ||
      pathSet.has(token) ||
      descriptionSet.has(token)
  );

  const normalizedQuery = queryTokens.join(" ");
  const normalizedTitle = title.join(" ");

  const titlePhrase = normalizedTitle.includes(
    normalizedQuery
  );

  const allInTitle =
    matchingTitle.length === queryTokens.length;

  const allAnywhere =
    matchingAll.length === queryTokens.length;

  // A closely matching title always beats
  // a partial-content mention.
  let band = 0;

  if (titlePhrase) {
    band = 4;
  } else if (allInTitle) {
    band = 3;
  } else if (allAnywhere) {
    band = 2;
  } else if (matchingAll.length) {
    band = 1;
  }

  let score = matchingTitle.length * 150;

  score += queryTokens.filter(
    token => pathSet.has(token)
  ).length * 48;

  score += queryTokens.filter(
    token => descriptionSet.has(token)
  ).length * 12;

  score += (
    matchingAll.length / queryTokens.length
  ) * 100;

  if (titlePhrase) {
    score += normalizedTitle === normalizedQuery
      ? 450
      : 260;
  }

  if (allInTitle) {
    score += 90;
  }

  // Prevent a current 2027 event landing page
  // that mentions 2026 elsewhere from outranking
  // an exact 2026 title.
  const searchedYears = queryTokens.filter(
    token => /^20\d{2}$/.test(token)
  );

  if (
    searchedYears.length &&
    /\b20\d{2}\b/.test(entry.title)
  ) {
    const titleYears = entry.title.match(
      /\b20\d{2}\b/g
    ) || [];

    if (
      !searchedYears.some(
        year => titleYears.includes(year)
      )
    ) {
      score -= 120;
    }
  }

  return {
    band,
    score,
  };
}

function qsCompare(a, b) {
  if (a.rank.band !== b.rank.band) {
    return b.rank.band - a.rank.band;
  }

  if (
    QS_SEARCH_V2.rankStaticFirstWithinBand &&
    a.kind !== b.kind
  ) {
    return a.kind === "static" ? -1 : 1;
  }

  if (a.rank.score !== b.rank.score) {
    return b.rank.score - a.rank.score;
  }

  // Use publication year/date only
  // to break comparable matches.
  if (a.date !== b.date) {
    if (a.date == null) return 1;
    if (b.date == null) return -1;

    return b.date - a.date;
  }

  // Preserve Webflow's native order
  // rather than force alphabetical ranking.
  return a.nativeOrder - b.nativeOrder;
}

function qsGetQuery() {
  const params = new URLSearchParams(
    window.location.search
  );

  return (
    params.get("query") ||
    params.get("search") ||
    ""
  );
}

function qsReadCategory() {
  const raw = new URLSearchParams(
    window.location.search
  ).get(QS_SEARCH_V2.categoryParameter);

  const category = qsNormalizeCategory(raw);

  return QS_CATEGORY_ROUTES.some(
    route => route.name === category
  )
    ? category
    : null;
}

function qsWriteCategory(category) {
  const url = new URL(window.location.href);

  if (category) {
    url.searchParams.set(
      QS_SEARCH_V2.categoryParameter,
      category
    );
  } else {
    url.searchParams.delete(
      QS_SEARCH_V2.categoryParameter
    );
  }

  window.history.pushState(
    {
      ...(window.history.state || {}),
      qsSearchCategory: category,
    },
    "",
    url
  );
}

function qsFindCollection(items) {
  if (!items.length) return null;

  const parent = items[0].parentElement;

  // Abort rather than flattening the DOM
  // if the search items aren't siblings.
  return parent &&
    items.every(
      item => item.parentElement === parent
    )
      ? parent
      : null;
}

/**
 * Call exactly where the original
 * functionSearchSort() was called.
 */
export function functionSearchSort() {
  if (
    !/^\/search\/?$/.test(
      qsPath(new URL(window.location.href))
    )
  ) {
    return;
  }

  if (window.__qsSearchV2Initialized) {
    return;
  }

  window.__qsSearchV2Initialized = true;

  const state = {
    list: null,
    listObserver: null,
    entries: [],
    active: qsReadCategory(),
    empty: null,
    scheduled: false,
    baseDisplay: new WeakMap(),
  };

  function applyFilters() {
    let visibleCount = 0;

    for (const entry of state.entries) {
      const visible =
        !entry.excluded &&
        (
          !state.active ||
          entry.category === state.active
        );

      entry.item.style.display = visible
        ? (state.baseDisplay.get(entry.item) || "")
        : "none";

      if (visible) {
        visibleCount++;
      }
    }

    document.querySelectorAll(
      QS_SEARCH_V2.buttonSelector
    ).forEach(button => {
      const category = qsNormalizeCategory(
        button.dataset.collection
      );

      const active = category === state.active;

      button.classList.toggle(
        "is-active",
        active
      );

      button.setAttribute(
        "aria-pressed",
        String(active)
      );

      button.dataset.resultsCount = String(
        state.entries.filter(
          e =>
            !e.excluded &&
            e.category === category
        ).length
      );
    });

    if (!state.empty && state.list) {
      state.empty = document.createElement("p");

      state.empty.className =
        "qs-search-enhancer-empty";

      state.empty.setAttribute(
        "role",
        "status"
      );

      state.empty.style.marginTop = "1.25rem";

      state.list.insertAdjacentElement(
        "afterend",
        state.empty
      );
    }

    if (state.empty) {
      // For zero NATIVE results,
      // Webflow already owns the empty state.
      const show =
        state.entries.length > 0 &&
        visibleCount === 0;

      state.empty.hidden = !show;

      state.empty.textContent = show
        ? (
            state.active
              ? `No ${state.active.replace(/-/g, " ")} results in this search. Try another category or search term.`
              : "No eligible results found for this search."
          )
        : "";
    }
  }

  function processResults() {
    const list = state.list;

    if (!list?.isConnected) {
      return;
    }

    const items = [
      ...list.querySelectorAll(
        QS_SEARCH_V2.itemSelector
      )
    ];

    const parent = qsFindCollection(items);

    if (items.length && !parent) {
      console.warn(
        "[QS Search V2] Search items have different parents; preserving native DOM order."
      );

      return;
    }

    const tokens = qsQueryTokens(
      qsGetQuery()
    );

    const seen = new Set();

    const entries = items.map(
      (item, index) => {
        if (!state.baseDisplay.has(item)) {
          state.baseDisplay.set(
            item,
            item.style.display
          );
        }

        const anchor = item.querySelector(
          "a[href]"
        );

        const url = anchor
          ? qsUrlFromAnchor(anchor)
          : null;

        const path = url
          ? qsPath(url)
          : "";

        const title = qsResultTitle(
          item,
          anchor
        );

        const description = qsResultDescription(
          item
        );

        const canonical = url
          ? `${url.origin}${qsCleanPath(url.pathname).toLowerCase()}`
          : `invalid-${index}`;

        const duplicate = seen.has(
          canonical
        );

        seen.add(canonical);

        const excluded =
          !url ||
          duplicate ||
          !title ||
          QS_SEARCH_V2.excludedPaths.some(
            pattern => pattern.test(path)
          );

        const entry = {
          item,
          path,
          title,
          description,
          excluded,
          category: qsCategory(
            path,
            item
          ),
          kind: qsPageKind(
            path,
            item
          ),
          date: qsExtractDate(
            item,
            path,
            title
          ),
          nativeOrder: index,
        };

        entry.rank = qsRank(
          entry,
          tokens
        );

        return entry;
      }
    );

    state.entries = entries;

    if (parent && items.length > 1) {
      const anchor =
        items[items.length - 1].nextSibling;

      const ordered = [...entries].sort(
        (a, b) => {
          if (a.excluded !== b.excluded) {
            return a.excluded ? 1 : -1;
          }

          return qsCompare(a, b);
        }
      );

      // Disconnect while moving nodes,
      // to avoid observer-feedback loops.
      state.listObserver?.disconnect();

      const fragment =
        document.createDocumentFragment();

      for (const entry of ordered) {
        fragment.appendChild(
          entry.item
        );
      }

      parent.insertBefore(
        fragment,
        anchor
      );

      state.listObserver?.observe(
        list,
        {
          childList: true,
          subtree: true,
        }
      );
    }

    applyFilters();

    list.setAttribute(
      "data-qs-search-ready",
      "true"
    );

    // Optional early-Head anti-flash guard.
    document.documentElement.classList.remove(
      "qs-search-pending"
    );
  }

  function queueProcess() {
    if (state.scheduled) {
      return;
    }

    state.scheduled = true;

    queueMicrotask(() => {
      state.scheduled = false;
      processResults();
    });
  }

  function mount(list) {
    if (state.list === list) {
      return;
    }

    state.listObserver?.disconnect();
    state.empty?.remove();

    state.list = list;
    state.empty = null;

    state.listObserver = new MutationObserver(
      records => {
        // Respond only to result-card changes,
        // not unrelated in-card UI tweaks.
        if (
          records.some(
            record =>
              [
                ...record.addedNodes,
                ...record.removedNodes,
              ].some(
                node =>
                  node.nodeType === 1 &&
                  (
                    node.matches?.(
                      QS_SEARCH_V2.itemSelector
                    ) ||
                    node.querySelector?.(
                      QS_SEARCH_V2.itemSelector
                    )
                  )
              )
          )
        ) {
          queueProcess();
        }
      }
    );

    // Process immediately;
    // no polling or waiting for page fetches.
    processResults();

    state.listObserver.observe(
      list,
      {
        childList: true,
        subtree: true,
      }
    );
  }

  // Delegation avoids cloning buttons
  // and losing other Webflow click listeners.
  document.addEventListener(
    "click",
    event => {
      const button = event.target.closest?.(
        QS_SEARCH_V2.buttonSelector
      );

      if (!button) {
        return;
      }

      event.preventDefault();

      const selected = qsNormalizeCategory(
        button.dataset.collection
      );

      if (
        !QS_CATEGORY_ROUTES.some(
          route => route.name === selected
        )
      ) {
        return;
      }

      state.active =
        state.active === selected
          ? null
          : selected;

      qsWriteCategory(
        state.active
      );

      applyFilters();
    }
  );

  window.addEventListener(
    "popstate",
    () => {
      state.active = qsReadCategory();
      applyFilters();
    }
  );

  // Optional read-only QA snapshot
  // in the browser console:
  //
  // console.table(window.qsSearchDiagnostics().results)
  window.qsSearchDiagnostics = () => ({
    query: qsGetQuery(),

    category: state.active,

    nativeResultCount:
      state.entries.length,

    visibleCount:
      state.entries.filter(
        e =>
          !e.excluded &&
          (
            !state.active ||
            e.category === state.active
          )
      ).length,

    results: state.entries.map(
      e => ({
        title: e.title,
        path: e.path,
        category: e.category,
        pageKind: e.kind,
        rankBand: e.rank.band,
        rankScore: e.rank.score,
        excluded: e.excluded,

        visible:
          !e.excluded &&
          (
            !state.active ||
            e.category === state.active
          ),
      })
    ),
  });

  const start = () => {
    const list = document.querySelector(
      QS_SEARCH_V2.listSelector
    );

    if (list) {
      mount(list);
      return;
    }

    // Only needed if Webflow injects
    // the results wrapper after DOMContentLoaded.
    const waitObserver = new MutationObserver(
      () => {
        const lateList = document.querySelector(
          QS_SEARCH_V2.listSelector
        );

        if (lateList) {
          waitObserver.disconnect();
          mount(lateList);
        }
      }
    );

    waitObserver.observe(
      document.body,
      {
        childList: true,
        subtree: true,
      }
    );

    window.setTimeout(
      () => waitObserver.disconnect(),
      8000
    );
  };

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start,
      {
        once: true,
      }
    );
  } else {
    start();
  }
}