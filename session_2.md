# Session 2 — Phase 4: realistic glass and background

Working tree had four commits (phases 1–3B) plus untracked assets. Phase 4 had
been planned in the previous session and blocked on the glass model; this
session built it end to end.

## What shipped

- `public/models/glass.glb` (stemmed glass) loaded via drei `useGLTF`, measured
  at load and fitted to 1 unit tall with its base at y = 0.
- `scripts/extract-glass-profile.mjs` measures the GLB and writes
  `src/config/glassProfile.js`: interior profile, outer silhouette, 60 surface
  points for shard origins.
- `Liquid.jsx` rebuilt as a lathe on the measured interior profile.
- `Environment` (`public/env/studio.hdr`) + a desktop-only `ContactShadows`
  ground, both driven by the quality tier.
- `Backdrop.jsx`: flavor gradient + CSS radial-gradient bokeh, cross-faded.
- `useAdaptiveQuality.js` implemented: FPS sampler, lowers dpr toward 1 under
  45 FPS, never raises it again.

## Two bugs found and fixed

1. **Shard origins were half a glass too low.** `Shatter` and `Glass` are
   siblings in the same local space, where the glass runs y 0 (base) to 1 (rim).
   `buildShards` placed origins at y −0.39..0.39 — a *centred* space — so half
   the burst started below the glass. `verify-shatter.mjs` asserted
   `minY >= -0.5 && maxY <= 0.5`, encoding the same wrong assumption, so it
   passed. Origins now come from measured surface points and the verifier
   asserts the burst spans y 0..1.
2. **The backdrop cross-fade never ran.** The outgoing layer was rendered
   *before* the incoming one at the same z-index while the incoming layer is a
   fully opaque gradient, so the fade happened behind an opaque wall and the
   flavor switch was a hard cut. The outgoing layer now paints on top and
   animates out.

Both were introduced in Phase 3A/3B and both had passing checks that agreed
with them.

## Numbers resolved

- Model: 4.90709 tall, 2.03424 wide in file units → `normaliseScale` 0.20379.
- Bowl interior: floor y 0.50035, rim y 1.000, widest radius 0.20127 at
  y 0.74887, rim radius 0.14518. 18 profile points, monotone.
- Liquid: fill 0.8 → surface at y 0.90007; radius scaled by 0.92 (clearance).
- Shards: 60 (40 mobile), width-scaled; largest shard 0.146 against a glass
  width of 0.415.
- Assets: 236 KB model + 1.4 MB env map = 1.7 MB of the 2 MB ceiling.

## Deliberate departures from the plan

- **No transmission**, on either tier. The backdrop is CSS, so the scene behind
  the glass is empty and a transmission pass samples clear black rather than the
  gradient the user sees. Opacity + clearcoat + env map + fresnel rim instead.
- **`Scene.jsx` split** into `Scene` / `MojitoGroup` / `Ground`, and
  `useGlassBaseScale` moved to `hooks/`. Scene was on course to exceed the
  150-line limit in AGENTS.md rule 4.4. The choreography itself is unchanged.
- Backdrop bokeh is CSS radial gradients rather than `filter: blur()`, which
  would be filtered on the GPU every frame.

## Verified

- `pnpm build` exit 0, `pnpm lint` exit 0, `pnpm verify` 20/20 green
  (reversibility still 0.00e+0 across 12,000 samples).
- GLB loaded through three's `GLTFLoader` in Node: parses, 5,216 tris, no
  console warning, measured scale/height/width all match `glassProfile.js`.
- All 21 source modules and both binary assets return 200 on the dev server.

## Not verified

The actual WebGL render. No browser is available here, so the glass look, the
contact shadow, the adaptive-dpr cut-off and the hamburger overlay are all
still untested on a real device. That needs the phone pass.
