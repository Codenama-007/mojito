# Session 5 — Phases 8A and 8B: the lean, and the fruit field

Two phases. 8A was small and mechanical: lean the cup to the right and stop the
straw ever leaving the screen. 8B was the biggest single piece of work since the
cup — it replaced the whole background.

**Status: both done and committed, as `phase-8a: tilt right and height fix` and
`phase-8b: fruit field background`.**

## Phase 8A — the lean and the fit

The lean is one number, `CUP_TILT_Z = -10` degrees, negative because the inner
group's Z rotation tips the top of the cup to the right. The X lean and the idle
sway were untouched, so the resting pose is `[-4, 0, -10]` plus the sway.

The fit is the part with the thinking in it. `MojitoGroup.jsx` measures the cup,
lid and straw with a `THREE.Box3` once at load and again on resize, and scales
the group **down** if it would fill more than 62% of the viewport height on
mobile (72% on desktop). Then every frame it clamps the group's Y so the straw
top stays at least 8% of the viewport below the top edge, or below the 64px
navbar on mobile, whichever is lower.

Three things about that measurement are easy to get wrong and all three are
recorded in the code:

- The box is taken at **both extremes of the sway**, `TILT_Z ± SWAY`, not at the
  resting angle. The clamp has to hold while the cup rocks, and the straw is the
  part that swings furthest.
- `cupRef` is a group wrapping **only** `<Cup />`, and it sits *inside* the tilt
  group. Measure the tilt group instead and the orbiting whole fruit — which
  swings well outside the cup — inflates the box, and the fit starts scaling the
  cup down to make room for its own garnish.
- The box comes back in world space, so its top and height are recovered by
  subtracting `group.position.y` and dividing by `group.scale.x`.

The fit is a **ceiling** — `Math.min(1, fitting)` — so it can only ever shrink
the cup, never grow it. `MOBILE_GLASS_Y_OFFSET` (0.11) still drops the whole
journey on mobile, and the clamp runs after it.

`scripts/verify-cup-fit.mjs` sweeps seven sections × three screens × 35 heights
× both tiers and asserts the straw never crosses its limit.

**Worth being honest about:** the sweep found the cup was *already* inside the
frame on mobile at every swept height before 8A. The fitted scale only bites on
desktop. It was implemented as briefed rather than skipped, and the suite now
asserts it, but the mobile half of the brief was a no-op in practice.

## Phase 8B — the fruit field

The brief for 8B arrived in four parts: a solid base colour instead of the
gradient, a field of the flavor's own fruit behind the cup, a cross-fade between
flavors, and a fade-out at the shatter. All four are in.

**The base.** `backgroundGradient` and `bokeh` were removed from
`config/flavors.js` and replaced with `colorA`, a shade down from each flavor's
own colour. The gradient and the fruit field were both trying to give the
background depth, and two answers to one question just muddy each other — so the
gradient went and the depth now comes from the field's three layers.

**The field.** Fruit is drawn to a 128px canvas at runtime — one whole fruit and
one cut slice per flavor — from the same `fruit` block that the slices inside the
cup are built from. Nothing is downloaded. Two `InstancedMesh`es of planes hold
it, one per fruit type: 40 instances each on desktop, 22 on mobile, so two draw
calls for eighty pieces of fruit.

It lives **inside the canvas**, and that is the whole reason it works. Fruit has
to be behind the cup, and the cup is transparent; in the DOM there is no "behind"
a canvas that also shows the DOM through it, and eighty `<img>` elements would be
eighty compositor layers on a phone. In-canvas it also lets the field be unlit
and depth-write-free, so no fruit can pick up a highlight from the scene lights
or cut a seam into the cup.

Per-instance alpha and a per-instance soft edge go in as two `onBeforeCompile`
injections into a `MeshBasicMaterial`. A hand-written `ShaderMaterial` was the
obvious alternative and was rejected: instancing is three's job, and
`instanceMatrix` plus the attribute plumbing come free with a built-in material.
`instanceColor` was rejected too — it multiplies RGB and cannot carry an alpha,
and an opaque quad on a bright backdrop is exactly what this field must not have.

**The swap.** Two fields at once for 0.8 s: the outgoing one fades to 0 and
shrinks to 65%, the incoming one fades in from 82%. Both deal their fruit out
from the same seed, so the fruit does not move, it changes colour in place — and
because the seeds match, the outgoing field can be replaced by the incoming one
without a single visible jump.

**The shatter.** The field multiplies its whole-field uniform by
`1 - breakProgress / BREAK_START`, so it is gone by the time the cup goes, and
`Backdrop` fades a neutral dark in behind it. That shade is a class on `.app`
with the ink tokens flipped under it in `index.css` — a class rather than a
per-frame style write, so the scroll loop still touches nothing in the DOM.

### Two bugs the verifier caught

Both were found by `scripts/verify-fruit-field.mjs`, not by a build or a lint,
and neither would have been visible without a phone:

1. **`FIELD_SIZE` was being read as a world measurement.** The size was computed
   as `FIELD_SIZE × layerScale × reach` with no viewport term, so `FIELD_SIZE`
   stopped being "a fraction of the screen height" and became "0.24 world units"
   — which on a 3.64-unit viewport is 6% of the screen. The whole field would
   have shipped as specks. Multiplying by `viewport.height` restores the
   documented meaning, and the projected size is now `FIELD_SIZE × layerScale`
   exactly, because the depth and the layer scale cancel.
2. **The drift bound in the suite was sampled, not derived.** The first version
   asserted the *sampled* extreme of each layer still covered the frame after the
   parallax shift. With seven fruit per layer that is a coin toss dressed up as a
   test, and it would have been asserting the seed. It now asserts the invariant
   that actually matters: the deal-out domain, 145% of the frame, is wider than
   the largest shift plus the largest drift.

## Verification

Six suites, all green, all wired to `pnpm verify`:

| suite | what it covers |
|---|---|
| `verify-shatter.mjs` | reversal, alpha monotonicity, unit quaternions, origins on the real surface, the lid breaking too, the interior cone |
| `verify-ingredients.mjs` | reversal over 400 steps, appearance order, tier counts, and a bounds walk over every bubble, wall bubble, cube, leaf vertex and fruit vertex |
| `verify-whole-fruits.mjs` | orbit, monotone outward travel, the sizing bounce, reduced motion |
| `verify-splash.mjs` | ballistics, the one-shot fade, droplet colors, reduced motion |
| `verify-cup-fit.mjs` | the cup fits the screen in every section |
| `verify-fruit-field.mjs` | (added in Phase 8B) the shader hooks, the framing, and the backdrop contrast |

`verify-fruit-field.mjs` is worth its own note, because two of its checks exist
for failure modes nothing else in the toolchain can see:

- **The shader hooks.** The material adds code to `MeshBasicMaterial` by
  replacing three's own chunk names. A three upgrade that renames
  `#include <map_fragment>` fails no build, no lint and no test — it produces a
  field of hard-edged opaque squares, on a phone, in production. So the suite
  asserts the chunk names against `THREE.ShaderLib.basic` itself, then runs the
  injection against a stand-in shader and inspects what came out: both
  attributes declared, the UV varying passed through, the edge applied to
  `diffuseColor.a`, and the fade uniform the frame loop mutates being the *same
  object* the shader was handed.
- **The contrast.** The brief's done-condition is a background of fruit *with
  readable copy on top*, so the suite composites each flavor's base colour with
  the 15% wash the way CSS does and requires 4.5:1 against the ink. All four
  pass; the lowest is strawberry at 5.69:1.

## The known risk that is still open

Unchanged from Phase 7 and repeated here so it does not get lost: the page
backdrop is CSS, so the scene behind the cup is empty and a desktop transmission
pass samples clear black. The desktop cup may therefore read dark. It is
implemented as briefed, the caveat is commented in `config/performance.js`, and
`plastic.transmission` is one number to flip to 0.

## Commits

```
phase-8b: fruit field background <- this session
92710db  phase-8a: tilt right and height fix
8d9790e  phase-7: takeaway cup
5b787d9  phase-5: ingredients
```
