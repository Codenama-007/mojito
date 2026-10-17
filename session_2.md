# Session 2 — Phase 4: realistic glass and background

Working tree was clean with four commits (phases 1–3B) plus two untracked assets.
Phase 4 had been planned in Session 1 and blocked on the glass model; this
session built it end to end and committed it.

**Status: done and committed. Nothing is half-finished.** Phase 5 not started.

## Commits

```
842e639  phase-4: realistic glass and background   <- this session
c9cdfe5  phase-3b: glass shatter and contact
e0bd81b  phase-3a: navbar and scroll journey
a26be27  phase-2: glass and liquid          (earlier session)
f585de9  phase-1: setup and test scene      (earlier session)
```

25 files changed, +1,677 / −302. `node_modules` and `dist` stay ignored.

## What shipped

The Session 1 plan had nine steps. All nine landed:

| Step | Result |
|---|---|
| 1 | `scripts/extract-glass-profile.mjs` → `src/config/glassProfile.js` |
| 2 | `performance.js` tier params + tier-aware `glassMaterial.js` |
| 3 | `Glass.jsx` on `useGLTF`, auto-fitted, Suspense lathe fallback |
| 4 | `Liquid.jsx` rebuilt as a lathe on the measured bowl interior |
| 5 | `Environment` + `ContactShadows` + a real FPS sampler |
| 6 | `Backdrop.jsx` + CSS bokeh, `App.jsx` swapped over |
| 7 | `verify-shatter.mjs` rewritten for the new geometry |
| 8 | build / lint / verify / module resolution all clean |
| 9 | reported and committed |

Detail:

- **The model.** `public/models/glass.glb` (a stemmed glass) loads via drei's
  `useGLTF`. `Glass.jsx` measures its bounding box at load and fits it to exactly
  1 unit tall, base at y = 0, centred on x/z. That is the same space the Phase 3
  scroll targets already used, so nothing downstream needed changing.
- **The measurement.** Rather than eyeball geometry numbers, the extractor reads
  the GLB and writes `src/config/glassProfile.js`: the bowl's interior profile,
  the outer silhouette (for the fallback lathe), and 60 points sampled off the
  real surface for shard origins. Every number in the 3D code is measured.
- **The liquid.** A lathe on the measured interior profile. The 80% fill level
  is applied by *truncating* the profile, not by scaling the mesh.
- **Lighting.** `Environment` with `public/env/studio.hdr`, and a
  desktop-only contact shadow that grounds the glass.
- **The backdrop.** Flavor gradient plus CSS radial-gradient bokeh, cross-faded
  between flavors, with per-flavor blob positions in `config/flavors.js`.
- **Adaptive quality.** `useAdaptiveQuality.js` is now real: it samples frame
  rate and lowers canvas dpr toward 1 while FPS stays under 45.

## Numbers resolved

| | Value |
|---|---|
| Model height (file units) | 4.90709 |
| Model width (file units) | 2.03424 (aspect 2.41:1, tall and thin) |
| `normaliseScale` | 0.20379 |
| Widest radius (local) | 0.20728 |
| Bowl interior floor / rim | y 0.50035 → 1.000 |
| Widest interior | 0.20127 at y 0.74887 |
| Interior radius at the rim | 0.14518 |
| Interior profile points | 18 (monotone) |
| Outer silhouette points | 21 |
| Shard spawn points | 60 |
| Liquid fill | 0.8 → surface at y 0.90007 |
| Liquid clearance | radius × 0.92 |
| Shards | 60 desktop / 40 mobile, largest 0.146 vs glass width 0.415 |
| Assets | 236 KB + 1.4 MB = 1.7 MB of the 2 MB ceiling |

**The single most important number:** the bowl is **widest just below its middle
(0.20127) and narrower at the rim (0.14518)**. A cylinder cannot sit inside it —
it would either poke through the wall or leave a 35% gap at mid-height. That is
why the liquid became a lathe, and why the old 0.443 cylinder would have been
wrong even though it "looked fine" against a hand-written glass.

## Two bugs found and fixed

Both came from Phase 3A/3B, and **both had passing tests that encoded the same
mistake.** Worth remembering as a pattern.

1. **Shard origins were half a glass too low.** `Shatter` and `Glass` are
   siblings inside one group, so they share the glass's local space, where y runs
   0 (base) to 1 (rim). `buildShards` placed origins at y −0.39…0.39 — a
   *centred* space — so half the burst started below the glass and the rest
   entered from underneath. `verify-shatter.mjs` asserted
   `minY >= -0.5 && maxY <= 0.5`, which agreed with the bug, so it went green.
   Origins now come from measured surface points; the verifier asserts the burst
   spans y 0…1 (it reads 0.000 → 1.000).
2. **The backdrop cross-fade never ran.** The outgoing layer was rendered
   *before* the incoming one at the same z-index, and the incoming layer is a
   fully opaque gradient, so the fade happened behind an opaque wall. Switching
   flavor was a hard cut. The outgoing layer now paints on top and animates out.

## Decisions and deviations worth remembering

- **No transmission, on either tier** — and this replaces the Session 1 plan of
  "desktop transmission, mobile non-transmission". Reason: the page backdrop is
  CSS, so the scene behind the glass is *empty*. A transmission pass samples that
  empty scene as clear black and the glass would go dark, not refract the
  gradient the user actually sees. Glass now reads as glass through opacity +
  clearcoat + env map + a fresnel rim injected into the physical shader. Bonus:
  one fewer full scene pass per frame, and no transmission-sorting risk.
- **`Scene.jsx` was split** into `Scene` / `MojitoGroup` / `Ground`, and
  `useGlassBaseScale` moved to `hooks/`. Scene was heading past the 150-line
  limit in AGENTS §4.4. The choreography itself is byte-for-byte the same logic.
- **`ContactShadows` uses `frames={Infinity}` on desktop only,** not the planned
  `frames={1}` + `key={activeSection}`. A single bake captures whatever pose the
  glass was mid-ease in, and the glass eases between sections over ~0.66s, so the
  shadow would always be stale. Mobile gets none, per AGENTS §5.
- **Bokeh is CSS radial gradients, not `filter: blur()`.** A gradient is
  rasterised once; a big blurred layer is filtered on the GPU every frame.
- **The GLB declares `KHR_materials_pbrSpecularGlossiness` as a *required*
  extension,** which three has no implementation for. `GLTFLoader` warns on every
  load. `Glass.jsx` registers an empty handler to silence it (verified silent),
  and replaces the material anyway because the file's own is solid black.
- **`pnpm verify` grew from 13 checks to 20,** now also asserting shard origins
  are real measured surface points, the burst spans the glass, and the interior
  profile has the right shape. Reversibility is still **exactly 0.00e+0 across
  12,000 samples**.

## Verification done this session

- `pnpm build` exit 0. `pnpm lint` exit 0 (two errors caught and fixed: a
  fast-refresh violation from a hook living beside a component, and a
  setState-inside-an-effect in the backdrop).
- `pnpm verify` **20/20 green.**
- All 21 source modules and **both binary assets** return HTTP 200 on the dev
  server, including `/models/glass.glb` and `/env/studio.hdr`.
- **The GLB was loaded through three's `GLTFLoader` in Node** (a throwaway
  script, since deleted): it parses, 5,216 triangles, **no console warning**, and
  the measured height / normalise scale / widest radius all match
  `glassProfile.js` to 5 decimals. That is as close to a runtime test as this
  environment allows.
- Confirmed `dist/` contains `models/glass.glb` and `env/studio.hdr` at the
  paths the code requests.
- Confirmed drei's `Environment` accepts `environmentIntensity`, and that a
  `.hdr` file routes to `RGBELoader`.

## Not verified

**The actual WebGL render.** There is no browser here. Still untested on a real
device:

- Whether the glass *looks* like glass with no transmission.
- Whether the liquid sits correctly in the bowl with the 0.92 clearance (it may
  want to be closer, e.g. 0.96).
- The desktop contact shadow's position and softness.
- The adaptive-dpr cut-off actually firing under load.
- The 60 fps target on your phone.

Also untested from before: the hamburger overlay feel.

## Maintenance note

`src/config/glassProfile.js` is **generated**. If the model is ever replaced,
re-run:

```powershell
node scripts/extract-glass-profile.mjs
```

`Glass.jsx` logs a dev-only warning if the loaded model drifts more than 1% from
the scale that file expects, so a forgotten re-run is not silent.

## Known gaps / carried forward

- `src/config/brand.js` still holds `TODO_` placeholders (brand name, phone,
  email, address, Instagram, order URL). They render literally, and the contact
  section warns while any remain. **Brand name is needed for the navbar logo** —
  it is currently empty.
- JS bundle is now **410 KB gzip** (was 366 KB), almost all three.js.
- Still stubs: `Ice.jsx`, `Mint.jsx`, `Fruit.jsx`, `Bubbles.jsx`,
  `FlavorCards.jsx`, `OrderCTA.jsx`, `Loader.jsx`.
- The AGENTS §7 WebGL-unavailable fallback image is still unbuilt. `hero.png` was
  deleted by the user; the plan is to capture one from the real scene later.

## How to run

```powershell
pnpm install
pnpm dev          # vite --host, already on the LAN
pnpm build        # must exit 0
pnpm lint         # must exit 0
pnpm verify       # 20 shatter + geometry regression checks
```

## Phase status

- [x] 1. Setup, canvas, test cube, flavor picker
- [x] 2. Glass and liquid shader
- [x] 3A. Navbar and scroll journey
- [x] 3B. Glass shatter and contact details
- [x] 3C. Realistic glass, environment map, contact shadow, CSS backdrop
- [ ] 4. Scroll story: ice, mint, fruit, bubbles
- [ ] 5. Mobile optimization pass
- [ ] 6. Loader, SEO, deploy to Vercel

> `session_1.md` numbers this phase "4" because it was the fourth task brief. The
> README files it as 3C, because it completes the glass rather than starting the
> scroll story. Same work either way.

## Next up (Phase 4 / scroll story)

Ice drops in, mint is muddled, fruit splashes in, fizz rises — as scroll-linked
stages. All four are stubs today. Per AGENTS §5 the ice, mint and bubbles must be
`InstancedMesh` or `Points`, and their geometry should stay code-built. Two things
from this session are already in place for it: `Liquid` has a shader with a
`uTime` uniform and a surface ripple to build fizz on, and the glass's interior
profile is measured and exported if the ice needs to sit inside the bowl.

**Before starting it, the phone test from this session should happen.** Several
Phase 4 decisions (no transmission, the 0.92 clearance, the shadow) are
unverified against a real render, and building the next phase on top of them
would compound any mistake.
