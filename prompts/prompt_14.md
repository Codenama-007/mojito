# Prompt 14

Recorded verbatim, 18 October 2026.

> When I switch to mobile for mobile responsiveness, when I click any of the nav
> links, they do not redirect me anywhere on the single page. What I want is for
> them to scroll me to the desired section. If I click on FAQ, it should scroll me
> to FAQ. Can you add the smooth scrolling effect?

## Notes taken at the time

**The scrolling was not missing. It was being refused.** Lenis already animated
programmatic scrolls and the handler already asked it to, so "add smooth scrolling"
was not quite the job. The request was being thrown away one line into Lenis:

```js
if ((this.isStopped || this.isLocked) && !force) return   // lenis.mjs
```

The mobile menu stops the instance while it is open — the same stop that holds the
page still behind the veil — so on a phone, and only on a phone, every link asked a
stopped Lenis to scroll. Because the handler also calls `preventDefault`, the
browser's own jump to the anchor was suppressed in the same breath. The links did
nothing whatsoever, which is exactly what was reported, and the menu stayed open
because the `onComplete` that closed it never ran either.

**The obvious fix was wrong, and that is worth recording.** `force: true` gets past
that check, so the tempting repair is to pass it. It scrolls — until the menu
closes, because closing calls `lenis.start()`, and `start()` resets, and `reset()`
calls `animate.stop()`: the animation launched a few milliseconds earlier is
cancelled before its first frame. `force` alone would have passed every check in
this repo that does not run a frame loop.

**The order is the fix: `lenis.start()` before `lenis.scrollTo(...)`.** Starting
first makes the scroll acceptable *and* means the close's later `start()` finds the
instance already running and no-ops, so nothing resets underneath it. Three lines
with two distinct failure modes is the shape of bug that survives a green build, so
`scripts/verify-nav.mjs` now imports the project's own helper and drives a real
Lenis, frame by frame, against a stub `window` and `document` — both orderings, and
all nine sections.

**A second thing the menu got wrong.** Six 56px links plus a close button do not fit
a landscape phone, and the overlay could not scroll, so its last link was
unreachable. Fixed in the same pass: `overflow-y: auto`, `overscroll-behavior:
contain`, `data-lenis-prevent`, and the vertical centring moved from
`justify-content: center` to `margin: auto` on the nav — centred overflow is clipped
off the top, where nothing can scroll back to it.
