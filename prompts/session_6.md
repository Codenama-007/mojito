# Session 6 — Phase 8C and 8D

Covers prompts 8 to 11: the fruit field that never drew, the per-flavor art, the
pushed handover, the cup's turn, the brand details and copy, and the navbar
overlay.

## 1. The fruit field was never on screen

Prompt 8 arrived as a regression report — "the limes background disappears and the
other fruits havent yet got their backgrounds" — and it was the first solid
symptom after a run of reports that could only be restated as requirements.

The cause is in `src/three/fruitFieldScene.js`, and it is one line:

```js
dispose() {
  group.remove(mesh)   // removed
  ...
}
```

The field is built imperatively and handed to React as `<primitive
object={group} />`. React runs an effect, its cleanup, and the effect again on
every mount **in development**, so the cleanup detached both meshes from a group
that stayed mounted and empty, for every flavor, on every frame, silently. In a
production build StrictMode does not double-invoke and the field would have drawn
— which is why a build, a lint and five verification suites all passed.

Every other instanced component in the project (`Ice`, `Mint`, `Bubbles`,
`Shatter`) disposes only GPU resources and leaves the scene graph to React. A
geometry, material or texture disposed under a live mesh is re-uploaded by three on
the next frame, so that is not merely safe, it is the established pattern. The
field now follows it, and `dispose()` says why in a comment, because the tempting
version is the broken one.

Recorded honestly: prompt 7 assumed lime's field worked and sent the search into
the swap state machine. It did not work. The lesson is in `prompt_8.md` — ask
whether a field is drawing before asking whether it is drawing the right thing.

## 2. Four fruits, four silhouettes

The brief's first ask was here, and it had a second cause worth naming. Every
flavor's base colour is a shade of that flavor's own hue, so **hue can never
separate a fruit from its backdrop**: a mango on orange and an apple on green read
as an empty background even when the fruit is drawn correctly.

`src/three/fruitArt.js` is new and holds the whole answer, split out of
`fruitTextures.js` so it can be driven from Node with a stub canvas. Each kind now
gets three things at once:

- a distinct **silhouette** — a squashed disc (lime), a dipped two-lobed apple, a
  narrow-topped mango, a wedge (strawberry);
- a dark **rim**, `shade(skin, -0.58)`, drawn on the outline;
- a soft dark **halo** behind the whole fruit.

The verifier states the readability property as a number instead of a hope: each
flavor's darkest drawn colour must be at least 0.2 luminance below its own
backdrop. It also asserts four distinct whole-fruit silhouettes and four distinct
slices, checks every assigned colour for NaN and for range, and measures every
drawn path — plus half the rim's stroke — against the canvas.

That last check found two real art bugs that were invisible before it was honest.
It was wrong twice first: it measured bezier *control points* by their diagonal
distance, and it measured an `ellipse` by its larger radius on both axes. Both
read apples and strawberries as overflowing when they did not. Once corrected to a
bounding box in canvas coordinates, and once it followed `translate` (the
strawberry's calyx is drawn 0.86 of a radius above the centre, and without that it
was measured as though it sat at the centre), it found the strawberry's calyx and
the apple's stalk genuinely being clipped by the edge of their own texture. The
fruit radius dropped from 0.4 to 0.385 of the canvas and both crowns were pulled in.

## 3. The handover is a push

Per prompt 7's answer. `FruitField.jsx` now mounts up to two `Field`s: the incoming
one starts a full viewport to one side and arrives at zero, the outgoing one leaves
towards the other side, both over `FLAVOR_PUSH` (0.8 s).

Both are **linear on purpose**, and the CSS base colour uses the same numbers. Any
easing would have to be written twice — once in keyframes, once in a frame loop —
and two curves meant to match and slightly failing is worse than an even wipe. The
fruit is painted on the colour, so a drift between the two would be visible as the
fruit sliding across its own backdrop.

Two details that are load-bearing:

- The two layers are exactly one viewport apart at all times, so their union always
  covers the screen. The field is 145% of a frame wide, so a sliver of the outgoing
  fruit *is* still on screen at the end of a push; it is invisible only because the
  outgoing alpha reaches zero over the last third. That fade is not decoration.
- A field demoted to outgoing mid-flight has its clock moved back exactly one
  viewport's worth of progress, so it continues the conveyor instead of jumping.
  One rule handles both a field that had landed (1 → 0) and one at 0.4 (−0.6).

Fields are keyed by the **swap**, not the flavor, so strawberry → lime → strawberry
builds a new field rather than reviving one whose clock and direction belong to a
finished change. There is one outgoing slot; a third flavor mid-push discards the
oldest outgoing, which is a fruit-position jump rather than a hole.

`Backdrop.jsx` / `Backdrop.css` do the same push in CSS with keyed layers, and the
stage now carries the current base colour as well, so an interrupted or never-started
animation cannot leave the page with no background at all.

## 4. The cup's turn

Per prompt 11: one full 360° turn per flavor section, and on a picker tap, which is
the same code path because both land in `activeFlavor`. Direction comes from
`flavorDirectionFor(fromId, toId)` in `config/flavors.js`, so stepping back through
the flavors undoes the turn, and `useStore` stores it beside the flavor so the two
cannot come apart.

The ease changed from cubic-out to **cubic-in-out**, and the duration from 0.9 s to
1.35 s. The turn was never missing; it was unreadable. 70% of a revolution inside
the first third of the duration, on a shape that is very nearly a solid of
revolution, reads as a snap.

## 5. The navbar overlay

Per prompt 10. Two bugs, one line each:

- The overlay's background was `rgba(255, 255, 255, 0.9)` — a near-opaque white
  sheet, which is what the owner was describing. Now a 16% veil with a 26 px blur,
  with an `@supports` fallback to a near-opaque sheet for browsers without
  `backdrop-filter`. The ink is near-black and the base colours are bright, so
  contrast holds.
- The hamburger is z-index 3 and the overlay z-index 4, so the menu opened over the
  only control that could close it. The overlay now has its own close button at the
  same 44 px corner, so the hamburger appears to turn into an X in place, and the bar
  underneath is `inert` while the overlay is up.

## 6. Brand details and copy

Per prompt 9. `src/config/brand.js` holds **Affan's Mojito**, the phone number and
the email — real values, no placeholders. Two fields are deliberately empty because
neither was supplied: `instagram` and `address`. An empty string means "we do not
have this", and the contact section drops the row rather than rendering a blank or a
dead link, so there is no second flag to keep in step. Instagram was asked about and
the owner chose to leave it out for now.

`orderUrl` is gone: "Order now" dials, because the phone is the only channel we have.
`hasPlaceholderDetails` and the on-screen `TODO_` warning are gone with it, replaced
by `scripts/verify-brand.mjs`, which asserts the phone is dialable, the email
well-formed, the `tel:` link is a bare number, and nothing in `brand.js` is a
placeholder. A test is a better guard against shipping a placeholder than a warning
rendered on the live page.

Copy: the hero now carries the brand name as its `h1`, a lede that says what the page
does, and a hint that says how to drive it. Each flavor gained a `story` in
`flavors.js` — two sentences, the second line under the tagline — and the verifier
checks that each is two sentences, a different two sentences, and not lorem ipsum.

## Verification

```
pnpm run build   # 632 modules, 1,390 kB raw / 403 kB gzip
pnpm run lint    # clean
pnpm run verify  # 6 suites, all green
```

New: `scripts/verify-brand.mjs`, wired into `pnpm verify`.

## What is not verified

No browser was available. Nothing in this session has been seen rendering. The push,
the spin and the navbar overlay are reasoned, linted and asserted where they can be
asserted, and the fruit field's *structure* is now asserted without a renderer — but
whether the four flavors read as four fruits on a phone is the owner's call, and the
one thing no amount of arithmetic settles.
