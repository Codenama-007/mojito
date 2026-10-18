# Session 7 — Phase 9B

Covers prompt 12: what a crawler can read, and the fact that until this phase it
could read nothing at all.

## 1. The task was not "add some content"

The brief asked for a facts section, a FAQ, robots.txt, llms.txt, and for the
built HTML of every route to contain all of it **without running JavaScript**.

The last requirement is the one that decides the design. This is a
client-rendered SPA: `vite build` emitted

```html
<div id="root"></div>
<script type="module" src="/assets/index-*.js"></script>
```

and nothing else. Every word of the page existed only after a module executed, so
a crawler that reads the response body — which is most of them, and all of the AI
ones — fetched an empty document. A prompt asking the page a question got nothing.

That means requirements 2, 3 and 5 could not be satisfied by writing React
components. The build itself had to be made to put the text in the file.

Three options were considered:

- **Add a router and prerender each route.** There is one route and its sections
  are scroll positions, not paths. A router would add a dependency to fix a
  problem the site does not have.
- **Server-render with `react-dom/server`.** The app imports three, R3F and CSS,
  none of which survive a Node import, so this means building a second bundle and
  a second build step to render components that draw nothing in the first place.
- **Write the crawlable copy as plain HTML at build time, from the same config the
  components read.** One Vite plugin, no dependencies, no second bundle.

The third was built.

## 2. One source, three consumers

The real risk here is not "the text is missing", it is "the text disagrees with
itself". A FAQ that says one thing to a person and another thing to Google is a
manual-action-grade problem, and a facts table that contradicts the chips already
on the page is a worse failure than an empty one, because it looks finished.

So `src/config/siteContent.js` is the only place the copy exists: the "What is
Affan's Mojito?" paragraph, the facts per flavor, the eight FAQ entries, the meta
title and description, and both JSON-LD blocks. It holds no JSX and imports
nothing outside `config/`, so it can be read by a React component, by the Vite
config running in Node, and by a verification script.

The facts themselves are **derived, not retyped** — ingredients and calories come
from the flavor's own chips, size, shelf life and alcohol from `brand.serving`. So
the number in the facts list and the number in the chip are the same number
because they are the same string.

## 3. The static shell, and why hiding it is correct

`plugins/ai-prerender.js` renders the same strings to plain HTML and puts them
inside `#root`, plus the JSON-LD and a canonical link in the head. `src/main.jsx`
removes that shell before creating the React root, so the live DOM holds exactly
one copy of every sentence.

That removal is deliberate rather than left to React. `createRoot` does clear a
container, but "does React clear it, and does it warn" is a question about React
internals that this phase should not have to have an answer for. Two lines in
`main.jsx` make it deterministic.

The shell is then hidden by a `[data-static-shell]` rule in `src/index.css`, and
that is safe for the reason the whole approach works: **a crawler does not apply
stylesheets**. The text is in the response body, which is what a crawler reads.
The rule lives in the stylesheet Vite links in the head, so it is applied before
the first paint — there is no window in which a person sees it. It stays in the
accessibility tree on purpose: if the bundle never arrives, it is the only content
there is.

What it does not get is a visible no-JS fallback. With scripting off, a person
still sees an empty page — exactly as before this phase. That is a one-line change
(delete the hide rule) and was left to the phase that owns the no-JS story
(AGENTS.md section 7, the WebGL fallback), because a visible fallback is a design
decision, not a side effect of a crawler fix.

## 4. The URLs, which have no domain yet

robots.txt wants an absolute sitemap URL and a sitemap wants absolute `<loc>`s,
and there is no domain — deploy is a later phase. Inventing one was not an option:
a guess would ship a file pointing crawlers at someone else's site.

So `brand.siteUrl` exists, empty, and the build resolves the origin in this order:
`brand.siteUrl`, then Vercel's own `VERCEL_PROJECT_PRODUCTION_URL` (which is
correct automatically on the platform this site is going to), then nothing. With
nothing, robots.txt and the sitemap use paths and **the plugin says so as a build
warning**, and the verifier prints the same note. That is a deliberate downgrade
with a visible notice rather than a silent invalid file, and one line in
`brand.js` fixes it.

`public/llms.txt` is the one hand-written file in the set — its format wants prose,
not a data table, so it is not generated from config. Instead
`verify-static-html.mjs` asserts it still names the brand, still carries the phone
number and still lists all four flavors, so a change to `brand.js` fails a test
rather than quietly leaving a stale document in `public/`.

## 5. How it is verified

`scripts/verify-static-html.mjs` runs the real production build through Vite's own
API and then reads `dist/index.html` **as bytes — no DOM, no jsdom, no module
execution**. That is the only version of this test that proves the requirement:
asserting against a rendered DOM would have passed while the page source stayed
empty, which is the exact failure this phase exists to fix.

It checks every fact of all four flavors, all eight questions and answers, that
the FAQPage markup agrees with the visible answers question for question, that
both JSON-LD blocks parse, that the title and description come from config, and
the shape of robots.txt, the sitemap and llms.txt. The absolute-URL branch of the
crawler files was exercised by building with `VERCEL_PROJECT_PRODUCTION_URL` set,
which is how the rewrite in `closeBundle` was confirmed to work rather than
assumed to.

## 6. What the phase did not touch

Nothing in `src/three/`. The new sections do need cup targets, so
`config/sections.js` gained two entries that hold the cup exactly where About holds
it — the sections are text-heavy and the cup belongs small and centred behind them,
not moving to a side it never leaves before the shatter.

`SECTION_ORDER` was reasoned about before adding sections: the shatter is anchored
to the contact section (`start: 'top bottom'`, `end: 'center center'`), so
inserting sections above it moves nothing. `verify-cup-fit.mjs` sweeps
`SECTION_ORDER` rather than a hardcoded list, so it picked up the nine sections by
itself.
