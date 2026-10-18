# Session 4 — Phases 6A, 6B and 7: whole fruits, splash, and the takeaway cup

Working tree had five commits (phases 1–5) plus the owner's uncommitted
`.gitignore` line adding `.agents/`, which was left alone.

The owner asked for three phases in one round. 6B was dropped before it was
built. 6A and 7 were both built in this session and land in one commit, because
6A's fruits and splash had to be re-fitted to the cup the moment the cup existed
and were never separately testable.

**Status: done and committed as `phase-7: takeaway cup`. Phase 6B is dropped, not
pending.**

## What 6A added

Whole fruits orbit the cup while a flavor section is on screen, and a burst of
juice leaves the rim when a flavor becomes active.

- `fruitGeometry.js` builds each fruit as a lathe or a set of primitives, then
  `normaliseToUnitRadius` welds it to a unit bounding sphere at the origin, so
  every flavor's fruit arrives at the same size and only the per-instance scale
  differs. `mergeVertices` keys its hash on every attribute, so the normals and
  UVs have to be deleted before welding or the weld silently does nothing.
- `wholeFruitMath.js` is the orbit, closed-form in time and in
  `flavorPresence`, so leaving a flavor is the same function run backwards.
- `splashMath.js` is closed-form ballistics — `origin + v*t + g*t*t/2` — with the
  velocities precomputed per droplet. No integration and no physics library.
  Every droplet in a burst shares one start time, so a single material opacity is
  the exact fade for all of them, and one burst dies by `BURST_LIFE` (1.2 s).
- Fruits and splash are mounted inside `intactRef`, the group the shatter already
  hides, so hiding them at the break and following the cup needed no new logic.
- `setColorAt` / `instanceColor` requires `material.vertexColors` to stay *false*
  on both meshes. Getting this wrong shows as every instance rendering in one
  color.

Two bugs worth recording. The fruit clearance was originally computed against the
glass radius *at the fruit's own height*; because the bowl is widest below the
middle, a fruit that bobbed downward clipped the wall. Clearance is now taken
against the widest radius anywhere the fruit's sphere plus its bob can reach. And
the burst's fade-out used an exact `< 0` test that never fired, so dead droplets
stayed visible; it is now an epsilon.

## What 7 changed

The glass is gone. `Glass.jsx`, `config/glassProfile.js`,
`shaders/glassMaterial.js`, `scripts/extract-glass-profile.mjs` and
`public/models/glass.glb` were all deleted, and the whole cup is built from
numbers in `config/cupProfile.js` and `three/cupGeometry.js`. That returned
236 KB of the asset budget.

The coordinate space did not change: y = 0 at the base, y = 1 at the rim, with
the lid from 1.018 to 1.238 and the straw out to 1.488. Because of that, the
liquid, the ingredients, the fruits, the splash, the shatter and the section
targets all kept working and only had to be re-fitted.

What did have to be re-fitted, and why:

- The cup is a **cone**. Every bound that used to be a cylinder check became a
  check at the height that constrains the object, not the height it sits at.
  `buildMint` samples the drink's radius at the leaf's *foot*; `maxSliceRadius`
  inverts the radius it allows, because the slice's tangential three o'clock
  sticks out furthest.
- `CLEARANCE` went 0.92 → 0.965 so the drink actually touches the plastic, which
  is what makes the wall-pressed mint read as pressed rather than floating.
- `LEAF_HALF_LENGTH` and `LEAF_HALF_WIDTH_MAX` are exported from
  `leafGeometry.js` and used to bound a leaf's reach, instead of a restated
  constant: a bound that disagrees with the outline by a few percent is exactly
  how a leaf ends up through the wall.
- The mint heading is `PI/2 - angle`, not `angle`. A leaf's normal is its local
  +Z, so it has to be turned *onto* the radial to lie flat against the wall.
- Ice uses the plastic recipe with `transmission: 0`. Ice must never pay for a
  second scene pass, and on desktop a pass would sample the empty canvas and go
  black.
- `FLY_OUT` 0.34 → 0.28 and `MAX_OFFSCREEN_REACH` 0.95 → 1.0, derived as
  `1 / (2 * 0.62 * 0.78) = 1.034` minus a 3% margin: portrait phones are
  width-limited, so the width cancels out of the derivation.
- Wall bubbles take their wall clearance from `size * (1 + WALL_SHIMMER)` rather
  than `size`, so a bubble at the peak of its shimmer cannot poke through.

## The one known risk

The page backdrop is CSS, so the scene behind the cup is empty and a desktop
transmission pass samples clear black instead of the flavor gradient. The
desktop cup may therefore read dark. It is implemented exactly as briefed; the
single number to flip is `transmission` in the `plastic` tier of
`config/performance.js`, and the caveat is repeated in a comment above it.

## Verification

Five suites, all green, all wired to `pnpm verify`:

| suite | what it covers |
|---|---|
| `verify-shatter.mjs` | reversal, alpha monotonicity, unit quaternions, origins on the real surface, the lid breaking too, the interior cone |
| `verify-ingredients.mjs` | reversal over 400 steps, appearance order, tier counts, and a bounds walk over every bubble, wall bubble, cube, leaf vertex and fruit vertex |
| `verify-whole-fruits.mjs` | orbit, monotone outward travel, the sizing bounce, reduced motion |
| `verify-splash.mjs` | ballistics, the one-shot fade, droplet colors, reduced motion |
| `verify-cup-fit.mjs` | (added in Phase 8A) the cup fits the screen in every section |

Two of these had to be rewritten rather than adjusted, because their assertions
had been written against the old shape and would have kept passing while testing
nothing: `verify-shatter.mjs` still asserted a *bowl* profile, and
`verify-ingredients.mjs` still imported `glassProfile.js`, which no longer
exists.

## Commits

```
phase-7: takeaway cup   <- this session (includes Phase 6A)
5b787d9  phase-5: ingredients
```
