# QS — Webflow front-end scripts

Custom JavaScript (and a little CSS) layered on top of the **QS** Webflow site.
The source under `scripts.js` + `modules/` is bundled with **esbuild** into a
single `scripts.min.js`, which is then loaded into Webflow via a `<script>` tag.
Animations are built with **GSAP** (incl. the Club plugins ScrollSmoother,
ScrollTrigger, ScrollToPlugin, Draggable, InertiaPlugin) and sliders with
**Swiper**.

> **New to this repo? Start here.** Read this file top-to-bottom, then open
> [`scripts.js`](scripts.js) — it is the entry point and lists every feature in
> the order it initialises. Each feature lives in its own file under `modules/`
> and begins with a header comment describing what it does and which Webflow
> markup (CSS classes / `[attribute]` selectors) it hooks into.

---

## How it fits together

```
Webflow page  ──loads──►  scripts.min.js  ◄──built by──  build.mjs (esbuild)
                                                              ▲
                                                              │ bundles
                                                  scripts.js + modules/*
```

- The **same bundle ships to every page.** Each module queries the DOM for its
  hooks and silently no-ops when that markup isn't present, so a module only
  "activates" on pages that contain its elements.
- `scripts.js` registers GSAP plugins, boots ScrollSmoother (desktop / non-touch
  only), and — once web fonts are ready — calls every module's init function.
- There is **no application server.** `npm run watch` just rebuilds the bundle on
  change; `npx http-server` serves the built files so Webflow can fetch them.

---

## Project structure

```
.
├── scripts.js                 # Entry point: registers plugins, boots ScrollSmoother, calls every module
├── build.mjs                  # esbuild config (watch + minify) → scripts.min.js, locale-redirect.min.js
├── config/
│   ├── locale-redirect.js     # US Eastern visitors → /en-us (built separately, see below)
│   ├── variables.js           # Shared constants — myEase (default easing) + duration scale
│   ├── nativescroll.js        # iOS/Safari ScrollTrigger tuning (getIOSOptimizedConfig, initIOSOptimizations)
│   ├── theme.js               # (NOT bundled) light/dark theme toggle — import commented out in scripts.js
│   ├── transition.js          # (NOT bundled) page-transition/loader experiment — unused
│   └── webflow.js             # (NOT bundled) resetWebflow() helper for Barba-style transitions — unused
├── modules/
│   ├── toggle/                # Open/close UI: accordion, search, share, nav (mobile), mega-menu, conference nav
│   ├── fixed/                 # Scroll-pinned UI: reading progress, progress-bar pin, sticky CTA bar, side panel, vertical pin
│   ├── hover/                 # Hover micro-interactions: button, link icon, cards, magazine, service bar, clear/reset
│   ├── interactive/           # Feature widgets: swiper, countdown, webinar, gate, ordering, sticky bar, conference nav
│   ├── finsweet/              # Enhancements for Finsweet CMS lists: filter animation, dept de-dupe, highlight-to-share
│   ├── drag/                  # GSAP Draggable horizontal carousel
│   └── hubspot/styles.js      # (empty placeholder)
├── scripts.min.js             # ⚙️ BUILD OUTPUT — do not edit by hand
├── scripts.min.css            # ⚙️ BUILD OUTPUT (includes Swiper CSS) — do not edit by hand
├── locale-redirect.min.js     # ⚙️ BUILD OUTPUT of config/locale-redirect.js
└── swiper.min.css             # Standalone copy of Swiper's CSS
```

> Files marked **(NOT bundled)** exist in the repo but are **not imported** by
> `scripts.js`, so they don't ship. Treat them as parked/legacy code. Files
> marked **BUILD OUTPUT** are generated — never edit them directly; edit the
> source and rebuild.

---

## Prerequisites

- **Node.js** 18+ and npm.
- **Club GreenSock access.** ScrollSmoother, Draggable and InertiaPlugin are paid
  GSAP plugins served from GreenSock's private registry. The auth token lives in
  [`.npmrc`](.npmrc) (`@gsap:registry=https://npm.greensock.com`). Without a valid
  token `npm install` will fail to fetch `gsap`.
  ⚠️ A token is currently committed to `.npmrc` — see **Security note** below.

---

## Getting started (local development)

```sh
# 1. Install dependencies (needs the Club GreenSock token in .npmrc)
npm install

# 2. Start the watcher — rebuilds scripts.min.js + locale-redirect.min.js on save
npm run watch

# 3. In a second terminal, serve the built files so Webflow can load them
npx http-server -p 8000
#   (or: npm start, which runs `serve`)
```

If you're developing inside a GitHub Codespace / cloud IDE, set the forwarded
port (8000) to **Public** so Webflow's Designer/preview can fetch the script.

To sanity-check that GSAP installed correctly:

```sh
npm list gsap
```

---

## Build

`npm run watch` runs [`build.mjs`](build.mjs), which uses esbuild to bundle two
entry points:

| Entry source                  | Output                   |
| ----------------------------- | ------------------------ |
| `scripts.js`                  | `scripts.min.js`         |
| `config/locale-redirect.js`   | `locale-redirect.min.js` |

Both are minified IIFE bundles targeting ES6. There is currently no separate
one-shot "build" script — `watch` is used for both dev and producing the output
you commit. (The committed `*.min.js` files ARE the deployed artifacts.)

---

## Deploying to Webflow

1. Run `npm run watch` (or rebuild) and commit the updated `scripts.min.js`.
2. The build output is served from a public URL and referenced in
   **Webflow → Project Settings → Custom Code → Footer** (loaded with `defer`):

   ```html
   <script src="https://<your-host>/scripts.min.js" defer></script>
   ```

   During development you can point the tag at your local/Codespace server, e.g.
   `https://<codespace>-8000.app.github.dev/scripts.min.js`. For production it
   should point at the committed, hosted copy of `scripts.min.js`.

### Locale redirect (Head Code)

For the fastest possible redirect — before any content paints — the locale
redirect is shipped **separately** and pasted into **Webflow → Project Settings →
Custom Code → Head Code** (not bundled into `scripts.min.js`):

1. Run `npm run watch` to (re)generate `locale-redirect.min.js`.
2. Paste its contents into Head Code inside a `<script>` tag.

What it does: visitors whose browser timezone is **US Eastern** (New York /
Miami, plus several equivalent IANA zones) are redirected to the `/en-us`
locale, unless a locale prefix is already present. Debug with `?qsLocaleDebug`,
disable with `?qsNoLocaleRedirect`. Source:
[`config/locale-redirect.js`](config/locale-redirect.js).

---

## The modules at a glance

Each file's header comment is the source of truth; this is a quick map. The
init order is defined in [`scripts.js`](scripts.js).

| Module | What it does | Key DOM hook |
| ------ | ------------ | ------------ |
| `toggle/toggle-accordion` | Accordion open/close | `[accordion='head'/'content']` |
| `toggle/toggle-search` | Search overlay in/out | `.qs-search-wrapper`, `.qs-search-open` |
| `toggle/toggle-share` | Staggered share panel | `[share='open']`, `.qs-share-top` |
| `toggle/toggle-navigation` | Mobile hamburger (main header, ≤1279px) | `[toggle='navigation']`, `.qs-header-center` |
| `toggle/toggle-menu` | Desktop/mobile mega-menu (**self-inits**) | `.qs-nav-wrapper` |
| `toggle/toggle-menu-conference` | Mobile hamburger (conference nav, ≤991px) | `.qs-inner-nav-center` |
| `fixed/scrollto` | Smooth in-page links + TOC scroll-spy | `a[data-scroll-to]`, `a[href^='#']` |
| `fixed/progress` | Horizontal reading-progress fill | `[scroll='progress']` |
| `fixed/progress-bar` | Pins the article overlay header | `.qs-article-overlay-wrapper` |
| `fixed/bar` | Auto-docking sticky CTA bar | `.qs-article-bar-wrapper` |
| `fixed/sticky-appear` | Desktop article side-panel reveal | `.qs-article-fixed-link-wrapper` |
| `fixed/sticky-filters` | Vertical pin (desktop ≥991px) | `[scroll='vertical-pin']` |
| `hover/button` · `link-icon` · `link-no-icon` · `cards` · `magazine` · `service-bar` · `clear` | Hover/focus micro-interactions | various `.qs-*` / `[hover]` |
| `interactive/swiper` | Swiper.js sliders | `.swiper` |
| `interactive/countdown` | Timezone-aware event countdown | `.qs-countdown-time-container[data-target]` |
| `interactive/webinar` | Converts event time to visitor TZ, badges | `.qs-webinar-*` |
| `interactive/gate` | Scroll/download content gate | `.qs-gate` |
| `interactive/ordering` | "Upcoming" items first in CMS lists | `[fs-list-element='list']` etc. |
| `interactive/sticky` | Generic sticky bottom bar | `.qs-sticky-bar` |
| `interactive/conference` | Sticky conference nav + active link | `.qs-inner-nav-wrapper` |
| `finsweet/filters` | Animates Finsweet-filtered lists | `form[fs-list-element='filters']` |
| `finsweet/highlight` | Highlight-to-share popover | `#highlight-share` |
| `finsweet/department` | De-dupes filter options | `.qs-department-option` |
| `drag/draggable` | GSAP Draggable carousel | `[drag='dynamic'] .track` |

### Things worth knowing (gotchas)

- **ScrollSmoother + `position: fixed`.** ScrollSmoother transforms
  `#smooth-content`, which breaks native `position: fixed`. Modules that need a
  truly fixed element (`fixed/bar`, `interactive/sticky`, `interactive/conference`)
  work around this by reparenting the element to `<body>` and/or forcing styles
  inline. Keep that in mind before "simplifying" them.
- **The page needs `#smooth-wrapper` / `#smooth-content`** for smooth scrolling;
  ScrollSmoother is skipped on touch devices.
- **`toggle/toggle-menu` self-initialises** from its own file and is therefore not
  in the `scripts.js` call list, unlike every other module.
- **`countdown.js` and `webinar.js` share a date/timezone engine** — `webinar.js`
  imports parsing helpers from `countdown.js`. Debug countdown parsing with
  `window.QS_COUNTDOWN_DEBUG = true`.
- **`interactive/sticky.js` is noisy** with `console.log` debugging — consider
  removing those before a production launch.
- **`toggle-menu-conference.js`** has a misleading `window.*` assignment at the
  bottom referencing the name from `toggle-navigation.js`; the export used by
  `scripts.js` is correct. See its header comment.
- **Export name typo kept on purpose:** `finsweet/highlight.js` exports
  `functionFinsweetHightlight` (sic). Renaming it means updating the import in
  `scripts.js` too.

---

## Security note

[`.npmrc`](.npmrc) currently contains a **Club GreenSock auth token committed to
the repository.** Before this repo is shared more widely you should rotate that
token in your GreenSock account and keep the replacement out of version control
(e.g. via an `NPM_TOKEN` environment variable or an untracked local `.npmrc`).

---

</content>
</invoke>
