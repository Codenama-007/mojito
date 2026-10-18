# Session 3 — Phase 5: ingredients inside the glass

Working tree had five commits (phases 1–4) and one uncommitted `.gitignore` edit
adding `.agents/`, which belongs to the owner and was left alone.

The owner sent the Phase 5 brief, added "keep every prompt in a `prompts/`
folder", and — before any code — approved two corrections to the brief itself.
This session then built it end to end.

**Status: done and committed. Nothing half-finished.** Phase 6 not started.

## Commits

```
The head commit is this session's, `phase-5: ingredients`. Its parents are
stable; the head hash is not, since amending changes it.

```
phase-5: ingredients  <- this session
3c58f01  docs: expand session_2.md into a full session record
842e639  phase-4: realistic glass and background
c9cdfe5  phase-3b: glass shatter and contact
e0bd81b  phase-3a: navbar and scroll journey
a26be27  phase-2: glass and liquid          (earlier session)
f585de9  phase-1: setup and test scene      (earlier session)
```

`node_modules`, `dist` and the owner's `.gitignore` edit stay out of it.

## The brief, item by item

| Item | Result |
|---|---|
| 1 | `Bubbles.jsx` — one `InstancedMesh`, 80 desktop / 40 mobile, looping climb with wobble |
| 2 | `Ice.jsx` — one `InstancedMesh`, 5 rounded cubes, glass material, dropping in and bobbing |
| 3 | `Mint.jsx` — one `InstancedMesh`, 10 desktop / 8 mobile, leaf shape built from two curves |
| 4 | `Fruit.jsx` + `fruitModels.js` — four code-built slices, `fruit` block added to `flavors.js` |
| 5 | Four slices live at once and cross-fade on a damped spring, ~0.5s with one overshoot |
| 6 | `scrollProgress` 0 → 0.25 builds it in order; every scroll term is closed-form and rewinds |
| 7 | Everything fitted to `liquidProfile.js`; parented inside `intactRef` so the shatter takes it |
| 8 | Geometries and materials disposed on unmount in all four |

## Two corrections to the brief, approved before coding

**1. The drink had to become translucent.** Item 1 asked for bubbles rising
*inside* the liquid while item 7 said not to change the liquid. Both could not
hold: the Phase 4 fragment shader ended `gl_FragColor = vec4(color, 1.0)`, the
`ShaderMaterial` had no `transparent` flag, and the lathe is a closed watertight
solid. Anything placed inside it is occluded by its own front face — the count
would have been right and the screen would have been empty.

The fix is four flags and one uniform: `transparent`, alpha 0.85, `depthWrite:
false`, front faces only. Geometry, profile, uniforms, fill level, ripple and
the colour lerp are untouched. Single-sided matters: it culls the bowl's back
wall so you look *into* the drink instead of at a solid block.

**2. The build range.** 0 to 0.15 is about 0.9 of a viewport on a seven-section
page, split four ways. Stretched to 0 to 0.25, roughly 0.37 of a viewport per
ingredient.

Also translated to this repo, which is plain JS on pnpm: `.tsx` → `.jsx`,
`npm run build` → `pnpm build`, `flavors.ts` → `src/config/flavors.js`.

`RoundedBoxGeometry` is *not* where the brief says. drei ships it as a JSX
component wrapping `ExtrudeGeometry`, which cannot be handed to an
`InstancedMesh`; `three-stdlib` does not ship it at all. The real class is
`three/examples/jsm/geometries/RoundedBoxGeometry.js`, which three already
exports and which needs no new dependency.

## What shipped, in detail

**The bounds moved out of `Liquid.jsx` into `liquidProfile.js`.** Phase 4 computed
the drink's profile privately. Phase 5 needs the same numbers for the ice, mint
and bubbles, and two copies of a *measured* profile is exactly how the glass and
the drink drift apart — which is the bug that produced the Phase 3A shatter
defect. So the profile is now a plain-numbers module with `drinkWall`,
`drinkRadiusAt`, `glassRadiusAt`, `drinkTopRadius`, `drinkBoundAt`. `Liquid.jsx`
maps it into vectors; the ingredients query it; the verifier checks against it.
Nothing duplicated, one source of truth.

**`ingredientMath.js`** holds the rest as pure functions: no clock reads, no
store reads, time and scroll arrive as arguments. That is what lets the verifier
sweep both without a renderer. It also holds the split that matters — the
scroll-driven part of every ingredient is a closed-form function of progress
(so scrolling up rewinds it exactly), while the climb, bob and sway are clock-
driven and never touch scroll. Seeded RNG, so the drink is byte-identical on
every load and the verifier can reproduce what the browser draws.

Measured numbers, all in the glass's own space (y 0 base → 1 rim):

| | value |
|---|---|
| Drink floor / surface | 0.50035 / 0.90007 |
| Drink radius at the surface | 0.15677 |
| Drink radius at its widest | 0.18517 |
| Bubbles | radius 0.004–0.009, climb 3.4–7.1s, wobble ≤ 0.09 of the radius |
| Ice | 5 cubes, edge 0.038–0.052, resting y 0.888, entering from y 1.46 |
| Mint | 8/10 leaves, length 0.046–0.062, at y 0.904 |
| Fruit | at y 0.918, tilted 0.2 rad, radius 0.092–0.095 |
| Fruit extent | y 0.886 to 0.961, 2,060 triangles across all four |
| Reveal windows | bubbles 0–0.2, ice 0.18–0.5, mint 0.46–0.76, fruit 0.74–1.0 (of 0.25) |
| Fruit spring | stiffness 170, damping 13 → ~0.5s, ~16% overshoot |

**Ice reuses the glass recipe** (`createGlassMaterial({ opacity })`), so the
"same tier rules as the glass" in item 2 is literal — one set of numbers, one
fresnel rim, no second copy to keep in sync. Its geometry is generated by three
and instanced by three, so nothing about the material is special-cased.

**The mint leaf is a shape, not a texture** — two quadratic curves meeting at a
point at each end, coloured by a vertex gradient running stem to tip. The asset
budget has about 0.3 MB left and a leaf image would have spent it.

**The fruit is the one ingredient with no instancing**, because only one slice
is ever visible. Four primitives-composed slices sit in the scene at once and
are scaled by a damped spring toward 1 or 0. That single mechanism delivers both
the flavor cross-fade (item 5) and the scroll reveal (item 6) with no mounting
or unmounting, which is what makes "no hard cuts" true rather than hopeful.

**Render order.** `Liquid` moved from 1 to 0; bubbles 0.2, mint 0.4, ice 0.6,
then the glass at 2 and the shards at 3 unchanged. Keeping the glass and shards
on their existing numbers is why `Glass.jsx` and `Shatter.jsx` needed no edit at
all. Fruit and mint are opaque, so they render in the opaque pass and depth-test
correctly against the translucent drink without any ordering at all.

**`Mint.jsx` is not per-flavor and does not pretend to be.** Every mojito gets
the same mint, so its two greens are a `mint` export in `flavors.js` rather than
four identical copies on four flavor objects — still config, still not a
hardcoded value inside a 3D component.

## Things that were wrong on the first pass

- **Mint was bounded by the drink it sits on top of.** `drinkRadiusAt` returns 0
  above the surface by design, so every leaf was placed at radius 0 — a single
  green dot in the middle. Mint floats *on* the surface, so the number it needs
  is the drink's radius where it meets the air. That is now `drinkTopRadius`.
  The verifier would have caught it; the arithmetic caught it first.
- **The mango chunks poked through the rim.** With the slice tilt at 0.24 rad,
  the chunks' worst-case corner reached y 1.047 against a rim at 1.0. Lowered
  the slice to y 0.918, the tilt to 0.2, and the chunks to half the slice
  radius. The tallest point is now 0.961.
- **`react-hooks/immutability` rejected `material.opacity = …`.** The new rule
  forbids assigning to a value that came out of a hook and was passed to one.
  `Liquid.jsx` already sidesteps this by reaching the material through the mesh
  ref, so both `Bubbles.jsx` and `Ice.jsx` now do the same rather than the check
  being disabled.
- **The verifier compared two different floats.** The reversal sweep first
  keyed its lookup map on `1 - i / STEPS` and looked up `i / STEPS`; those differ
  in the last bit, so every lookup missed. Both sweeps now key on the same
  values in a different order, the way `verify-shatter.mjs` does.

## Verification

`pnpm build` exit 0 — 615 modules, 413.57 KB gzip (was 410, all three.js).
`pnpm lint` exit 0. `pnpm verify` exit 0 — **55 checks green**, 20 for the
shatter and 35 new:

- the same reversal sweep as the shatter over 400 steps and every instance:
  `worst delta 0.00e+0`. Bubbles climb on the clock, so scroll provably cannot
  move them.
- appearance order asserted, not assumed: bubbles ≥ ice ≥ mint ≥ fruit at every
  step, zeros at 0, ones at 0.25, never decreasing.
- every bubble, every ice-cube corner for the whole drop, every leaf, and
  **every vertex of all four fruit slices** checked against the real glass and
  drink bounds. Worst overhang `0.00e+0` in all four.
- both tiers, not just the one Node detects. Node has no `window`, so `quality`
  is always mobile there; `TIERS` is now exported so the desktop counts (80
  bubbles, 10 leaves) are built and checked rather than assumed.

All 17 modules plus the `three/examples` geometry fetch 200 from the dev server.

## What is still not verified

**The render itself.** There is still no browser here, so nothing visual is
confirmed. Specifically unconfirmed:

- whether 0.85 is the right drink opacity, or whether it reads too solid now
  that it has to be seen through;
- whether eight mint leaves and five ice cubes crowd each other at the surface
  (usable radius there is only 0.157, and this was flagged as an art risk before
  a line was written);
- whether the ice's drop is legible in the ~0.37 of a viewport the window gives
  it, especially with each cube's stagger;
- whether the fruit's spring reads as a bounce or as a wobble;
- whether the bubbles are visible at all on a phone at 1.5 dpr — they are 0.4%
  to 0.9% of the glass height, so this is a real question;
- whether the 0.25 build range feels right, or too fast, in the hand.

Every one of those is a constant in `ingredientMath.js`, `performance.js` or
`Liquid.jsx`, so tuning is a one-number edit and needs no restructuring.

## Open items carried forward

- `brand.js` is still all `TODO_` placeholders, and the navbar logo is
  therefore empty. Still the cheapest visible win.
- `FlavorCards.jsx`, `OrderCTA.jsx`, `Loader.jsx` are still stubs.
- The AGENTS §7 WebGL-unavailable fallback image is still unbuilt.
- The `prompts/` folder starts at prompt 1 with this phase. Earlier prompts are
  not recoverable verbatim — only session notes survive.
