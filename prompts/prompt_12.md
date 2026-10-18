# Prompt 12

Recorded verbatim, 18 October 2026.

> Read AGENTS.md first and follow it.
>
> Task: Phase 9B: Make the site AI-crawler friendly.
>
> 1. In public/robots.txt, allow all crawlers (including GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot) and point to the sitemap.
> 2. Add an /about-brand section or page with a plain-text "What is [brand]?" paragraph, and a "Facts" list per flavor (ingredients, size, price, calories, shelf life, alcoholic or not). Read the data from flavors.ts and brand.ts.
> 3. Add a FAQ section with 8 real questions and short, direct answers, rendered as HTML and as FAQPage JSON-LD.
> 4. Add public/llms.txt with a short summary of the brand, flavors, and links to each page.
> 5. Verify the built HTML of every route contains all of this text without running JavaScript.
>
> Do not change the 3D scene.
>
> Done when:
> - npm run build passes.
> - Viewing the page source of each route shows the text.
> - No console errors.
>
> Commit as "phase-9b: ai-friendly content".

## Notes taken at the time

Four things in the brief did not match the repository, and were resolved rather
than assumed:

1. **`flavors.ts` and `brand.ts` are `flavors.js` and `brand.js`.** The project is
   plain JS, an approved deviation recorded in the README. Read the data from the
   files that exist.
2. **There is one route, and it has no URL.** No router, no history API — the
   sections are scroll positions, not paths. So "each route" is `/`, and
   "verify the page source of each route" means verify the one document. Section
   anchors (`#about-brand`, `#faq`) are added so a crawler has something to follow.
3. **`npm run build` is `pnpm run build`.** pnpm is the project's package manager.
4. **This is a client-rendered SPA, and that is the whole task.** `vite build`
   emitted `dist/index.html` as `<div id="root"></div>` and a script tag: not one
   word of the page was in the file. Requirements 2, 3 and 5 could not be met by
   adding React components — the built HTML had to be given the text at build
   time, which is what `plugins/ai-prerender.js` does.

The brief was also labelled Phase 9B, but `git log` shows 8D as the last commit
and no 9A anywhere. Not guessed at; the phase was built as asked and committed
under the requested message.

## Two questions, asked before any code was written

Both facts needed for the Facts list were unknown, and one of them was worth
stopping for:

- **Price per flavor.** Answered: *don't publish a price*. This is the right
  answer for the reason it was asked — an invented price is the one error this
  kind of page makes expensive, because every assistant that reads it repeats the
  number and none of them can tell it was made up. An empty `serving.price`
  renders as "Call to order — <phone>" in the facts list, the FAQ and the
  structured data.
- **Size, alcohol, shelf life.** Answered: *use the defaults* — 300 ml, alcoholic
  white rum, made to order. Recorded as owner-supplied defaults in `brand.js` with
  a comment saying so, because everything downstream is published verbatim.

## What "verify without JavaScript" had to mean

The obvious version of this test — render the app and assert the text is on the
page — would have passed for the wrong reason and proved nothing, since the whole
problem was that the text only existed after a module ran. So
`scripts/verify-static-html.mjs` runs the real production build through Vite's own
API and then reads `dist/index.html` as bytes: no DOM, no jsdom, no execution.

It also checks the one thing structured data is for — that the FAQPage markup
agrees with the visible answers, question for question. Google treats a mismatch
as a violation, not a cosmetic problem.

## Deliberately not done

- **No visible no-JS fallback.** The static content is in the response body but
  hidden by CSS, so with scripting off a person still sees an empty page, as they
  did before this phase. Crawlers do not apply stylesheets, so they read all of it;
  a human with no JS does not. Showing it is a one-line change (drop the
  `[data-static-shell]` rule) and was left out because the brief is about crawlers
  and AGENTS.md section 7 owns the no-JS story, in a later phase, with a hero image.
- **No `Product` or `MenuItem` schema per flavor.** Only the FAQPage and an
  Organization block were asked for. Per-flavor product markup means publishing a
  price or an `offers` block, and there is no price to publish.
