# Session 1 — Phase 3A, Phase 3B, and Phase 4 planning

Working tree clean. Four commits. Phases 1–3B shipped, Phase 4 planned but
blocked on assets.

## Commits

```
c9cdfe5  phase-3b: glass shatter and contact
e0bd81b  phase-3a: navbar and scroll journey
a26be27  phase-2: glass and liquid          (earlier session)
f585de9  phase-1: setup and test scene      (earlier session)
```

Built in a single pass, then committed as two by staging a self-consistent
3A-only state first (backed up, reverted, committed, restored). So `e0bd81b`
is a genuine working checkpoint, not a label on a partial tree.

## Phase 3A — navbar and scroll journey

The page scrolls now. Body is no longer `overflow: hidden` / fixed; the canvas
and backdrop are pinned behind a normally-flowing document.

- Seven sections: `hero` → `flavor-lime` → `flavor-strawberry` → `flavor-apple`
  → `flavor-mango` → `about` → `contact`.
- Glass eases between per-section targets stored as **fractions of the
  viewport** in `config/sections.js`, so nothing breaks on a different aspect
  ratio. Section bands are exactly one viewport tall and do not overlap, so
  precisely one is active at a time; `onEnter` + `onEnterBack` make it work in
  both scroll directions.
- Fixed navbar, collapsing to a hamburger overlay under 768px. Escape closes,
  scroll locked via `lenis.stop()`/`start()`.
- Hero owns the flavor picker now; it is no longer fixed at the bottom.
- Lenis is driven by the GSAP ticker, so the page has one rAF loop.

### New files

`config/brand.js`, `config/sections.js`, `hooks/useLenis.js`,
`hooks/useScrollProgress.js`, `ui/Navbar.jsx` + `.css`,
`ui/FlavorSection.jsx` + `.css`, `ui/Hero.jsx` + `.css`, `ui/About.jsx` +
`.css`, `ui/Contact.jsx` + `.css`.

### Changed

`index.css`, `App.jsx`, `Scene.jsx`, `useStore.js`, `Glass.jsx`,
`FlavorPicker.css`, `flavors.js` (added `properties` chips), `README.md`.

## Phase 3B — glass shatter and contact

`breakProgress` is scrubbed by ScrollTrigger from the end of About to the centre
of Contact. Glass drops and shakes up to 0.3, then the intact glass and liquid
hide and the shards take over: 60 desktop / 40 mobile, one `InstancedMesh`,
flying outward, falling, fading. Contact details reveal at 0.6.

### New files

`three/Shatter.jsx`, `three/shardMath.js`, `three/shaders/glassMaterial.js`,
`scripts/verify-shatter.mjs`. Added a `pnpm verify` alias.

`shardMath.js` exists so the shatter maths can be tested against the *shipped*
code rather than a copy of it.

## Verification done this session

- `pnpm build` exit 0. `pnpm lint` exit 0.
- Dev server: all 11 modules resolve and transform (HTTP 200). Not a render
  test, but it proves nothing is import-broken at runtime.
- `pnpm verify`: 13/13 green. The important one is exact reversibility —
  **0.00e+0 delta across 12,000 samples**, so scrolling up reassembles the glass
  rather than leaving it scattered. Also asserts alpha monotonicity, no NaN,
  unit-length rotation quaternions, and shard origins starting inside the glass.
- Three real bugs caught and fixed during the session:
  1. `BREAK_START` left imported from `Shatter.jsx` after it moved to
     `shardMath.js`. Caught by the build.
  2. Per-shard fade mutated a `useMemo` value, which the `react-hooks`
     immutability rule rejects. Now read off the mesh instead.
  3. The reversibility test was measuring 3D distance from the centre, but the
     glass is a cylinder. Radial and vertical constraints had to be checked
     separately. Code was right; the test was wrong.

## Decisions and deviations worth remembering

- **Two `customProgramCacheKey` values on the glass material.** The glass and
  the shards need separate material *instances* (per-instance alpha cannot be
  expressed with one global `opacity`). Two materials differing only in
  injected code share a cached shader program by default, and the instanced one
  would draw wrong. The distinct cache keys prevent that.
- **`prefers-reduced-motion`** is largely handled by Lenis itself
  (`respectReducedMotion` defaults to `true`). The glass still moves between
  sections because that is scroll-linked and user-driven, not autoplay — a
  deliberate reading of AGENTS.md §6.
- **`scripts/` and a `pnpm verify` alias** sit slightly outside the AGENTS.md §3
  tree. Kept because the reversibility guarantee deserves a regression test.
- Pre-existing approved deviations, documented in `README.md`: plain CSS (no
  Tailwind), JavaScript (no TypeScript). So the task brief's `.tsx` / `.ts` /
  `npm run build` are `.jsx` / `.js` / `pnpm build` throughout.

## Not verified

The actual WebGL render, the 60fps target, and the hamburger feel. I have no
browser; these depend on the user's phone test.

## Phase 4 — planned, then blocked

Brief: replace the code-built glass with `public/models/glass.glb` via
`useGLTF` with auto-fit; tier-aware transmission material; `<Environment>`;
resize the liquid; bokeh backdrop; `ContactShadows`; keep the shatter working;
stay under 2 MB on mobile.

### Blocker: the assets do not exist

`public/` contains one file, `favicon.svg`.

| Step | Expected | Status |
|---|---|---|
| 1 | `public/models/glass.glb` | **missing** |
| 3 | `public/env/studio.hdr` | **missing** |
| 5 | `public/backdrops/<flavor>.webp` | missing (has a code fallback, not blocking) |

Blender MCP re-checked: `Could not connect to Blender.` So no sourcing from
Poly Haven/Sketchfab and no modelling an export either. Step 1 is the core of
the phase, so no guessing was done.

### Findings from the investigation (no code written)

- `useGLTF`, `Environment`, `ContactShadows` all confirmed present in drei
  10.7.9. `Environment` accepts `files`, `preset` and `children`.
  `ContactShadows` accepts `frames`, `opacity`, `blur`, `smooth`, `resolution`.
- Step 2's realism mostly comes from the environment map and transmission, not
  from the geometry. The current glass is already a smooth 72-segment lathe;
  what makes it look flat is the absence of an env map. A `.glb` alone would
  not fix that.
- Auto-fit should normalise the model into the **same local space the
  code-built glass already occupies** (`y` 0→1, centred on `x`/`z`). That is
  what keeps the Phase 3 scroll targets, `Liquid`'s `FLOOR_Y = 0.14`, and the
  shatter coordinates working untouched.
- Step 4's numbers depend on the model, so they cannot be produced in advance.
- The 2 MB mobile ceiling is tight: a typical 1k–4k studio HDR is 1–5 MB on its
  own, so it would need downscaling to 1k.
- Turning on drei's `useGLTF`/`Environment`/`ContactShadows` will grow the JS
  bundle past its current **366 KB gzip** (tree-shaking should keep it modest).

### Three conflicts to resolve before building

1. **Step 7 vs the transmission pass.** Shards "use the same glass material as
   the active tier" collides with 3B's per-shard fade, which multiplies
   `diffuseColor.a`; a `transmission > 0` material composites through three's
   separate transmission render target where output alpha behaves differently.
   Recommendation: shards match the tier's colour/roughness/clearcoat/
   `envMapIntensity` but skip transmission. Refraction through paper-thin
   triangles looks wrong anyway.
2. **Step 6 vs AGENTS.md §5.** §5 says no real-time shadows on mobile.
   `frames={1}` is a one-time bake, not real-time, so it reads as compatible —
   but §5 is marked non-negotiable. Note `useAdaptiveQuality.js` is still a stub
   and would need an FPS sampler to honour the 45 FPS cutoff.
3. **Step 1 route.** Options offered, not chosen: keep the code-built glass and
   deliver steps 2/3/5/6/7 (most of the realism); user supplies `.glb`; connect
   Blender and model one properly; or export the lathe to `.glb` (satisfies the
   letter, adds weight, zero visual gain).

Questions were put to the user and dismissed, so Phase 4 has no agreed
direction yet. Nothing was built.

### Explicitly off-limits for Phase 4

"Do not change scroll logic or the navbar":
`hooks/useLenis.js`, `hooks/useScrollProgress.js`, `ui/Navbar.jsx` + `.css`, the
glass targets in `config/sections.js`, and the scroll fields in
`store/useStore.js`. Adaptive-quality state should stay local to `Scene.jsx` so
the store is untouched.

## Known gaps / carried forward

- `src/config/brand.js` holds `TODO_` placeholders for brand name, phone,
  email, address, Instagram and order URL. They render literally on the page
  and the contact section shows a warning while any remain, so a placeholder
  cannot ship unnoticed. **Brand name is needed for the navbar.**
- Bundle is 366 KB gzip, almost all three.js. Phase 6's problem.
- `Ice.jsx`, `Mint.jsx`, `Fruit.jsx`, `Bubbles.jsx`, `useAdaptiveQuality.js`,
  `FlavorCards.jsx`, `OrderCTA.jsx`, `Loader.jsx` are still stubs.
- The AGENTS.md §7 WebGL fallback image is still unbuilt. `hero.png` was deleted
  by the user; the plan is to capture one from the real scene in a later phase.

## How to run

```powershell
pnpm install
pnpm dev          # vite --host, already on the LAN
pnpm build        # must exit 0
pnpm lint         # must exit 0
pnpm verify       # shatter maths regression checks
```

## Phase status

- [x] 1. Setup, canvas, test cube, flavor picker
- [x] 2. Glass and liquid shader
- [x] 3A. Navbar and scroll journey
- [x] 3B. Glass shatter and contact details
- [ ] 4. Realistic glass and background — **blocked on assets**
- [ ] 5. Scroll story: ice, mint, fruit, bubbles
- [ ] 6. Mobile optimization pass
- [ ] 7. Loader, SEO, deploy to Vercel
