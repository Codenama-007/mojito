# Mojito — scroll-driven 3D website

A mobile-first site for a mojito brand. One glass stays on screen while the
page scrolls past it. Tapping a flavor, or scrolling into a flavor section,
changes the fruit, the liquid color, the background mood, and the copy.

Flavors: Lime, Strawberry, Apple, Mango.

## Run it

```powershell
pnpm install
pnpm dev
```

`dev` is `vite --host`, so the server is already exposed on your local network.
Find your machine's IP, then open it on your phone:

```powershell
ipconfig
```

Look for `IPv4 Address` under your active adapter and open
`http://<that-ip>:5173` in your phone's browser. Phone and PC need to be on the
same Wi-Fi. If the firewall prompts, allow Node.js on private networks.

Production build:

```powershell
pnpm build
pnpm preview
```

## Deviations from AGENTS.md

Approved by the project owner. Both apply to the whole project until revoked.

1. **Plain CSS, no Tailwind.** AGENTS.md section 2 lists Tailwind as the UI
   layer. Styling is vanilla CSS: one `.css` file per UI component plus
   `src/index.css` for the reset and tokens. Flavor colors are never hardcoded
   in CSS; they come from `src/config/flavors.js` and reach the DOM as custom
   properties at runtime.
2. **JavaScript, no TypeScript.** AGENTS.md section 3 and rule 4.5 assume
   TypeScript with strict mode. This project is plain JS with `.js`/`.jsx`
   files. `pnpm build` does not type-check. JSDoc annotations cover the shared
   config, store, and shard maths so editors still get hover docs.

Two files sit outside the AGENTS.md section 3 tree: `src/config/brand.js`
(contact details) and `src/config/sections.js` (the scroll journey). Both are
data, not components, and neither belongs inside one.

## Layout

```
src/
  main.jsx
  App.jsx                <- page sections and hooks
  config/
    flavors.js           <- ALL flavor data lives here
    brand.js             <- contact details (PLACEHOLDERS, see below)
    sections.js          <- section order, nav links, glass targets
    performance.js       <- quality tier, dpr cap, reduced-motion flag
    glassProfile.js      <- GENERATED: measured glass profiles + shard points
  store/
    useStore.js          <- active flavor, section, scroll values, tier
  three/
    Scene.jsx            <- Canvas, lights, environment map, quality wiring
    MojitoGroup.jsx      <- the glass choreography (drop, shake, sway, ease)
    Glass.jsx            <- the loaded model, plus a lathe fallback
    Liquid.jsx           <- custom shader liquid, lathe on the bowl interior
    liquidProfile.js     <- the drink's bounds, in one place, as plain numbers
    Ground.jsx           <- contact shadow under the glass (desktop only)
    Shatter.jsx          <- 60 (40 mobile) shards, one InstancedMesh
    shardMath.js         <- pure, reversible shard maths
    Bubbles.jsx          <- 80 (40 mobile) bubbles, one InstancedMesh
    Ice.jsx              <- 5 rounded cubes, one InstancedMesh
    Mint.jsx             <- 8-10 leaves, one InstancedMesh, shape built in code
    Fruit.jsx            <- one slice per flavor, cross-faded on flavor change
    fruitModels.js       <- the four slices, built from primitives
    ingredientMath.js    <- pure, reversible ingredient maths
    shaders/
      liquid.js          <- liquid vertex + fragment
      glassMaterial.js   <- shared glass material, optional per-instance fade
  ui/
    Backdrop.jsx         <- flavor gradient + CSS bokeh, cross-faded
    Navbar.jsx           <- fixed bar, hamburger overlay under 768px
    Hero.jsx             <- headline + flavor picker
    FlavorSection.jsx    <- one component, rendered per flavor
    FlavorPicker.jsx     <- four buttons, lives in the hero
    About.jsx
    Contact.jsx          <- placeholder for now
    FlavorCards.jsx      <- not built yet
    OrderCTA.jsx         <- not built yet
    Loader.jsx           <- not built yet
  hooks/
    useLenis.js          <- Lenis instance, GSAP ticker wiring
    useScrollProgress.js <- every ScrollTrigger -> store write
    useAdaptiveQuality.js<- FPS sampler, lowers dpr toward 1 under 45 FPS
    useGlassBaseScale.js <- viewport-derived scale, shared by glass + shadow
  assets/                <- compressed models and textures only
public/
  models/glass.glb       <- 236 KB
  env/studio.hdr         <- 1.4 MB, environment map
prompts/                 <- the owner's prompts, recorded verbatim
scripts/
  extract-glass-profile.mjs <- measures the GLB, writes config/glassProfile.js
  verify-shatter.mjs        <- reversal + sanity checks for the shard maths
  verify-ingredients.mjs    <- bounds + reversal checks for ice/mint/fruit/fizz
```

## Contact details are placeholders

`src/config/brand.js` holds the brand name, phone, email, address, Instagram
and order URL. Every value is currently a `TODO_` placeholder, and the contact
section shows an on-screen warning while any remain, so a placeholder cannot
ship unnoticed. Replace the values before launch.

## Current behavior

Scroll drives the journey. The glass stays pinned to the screen while seven
sections pass: hero, four flavors, about, contact. Each flavor section moves
the glass to one side (up and centre on mobile), rotates it slightly, and sets
the active flavor, which lerps the liquid color over about half a second. The
backdrop cross-fades between flavor gradients.

Every scroll-driven value is written to the Zustand store by GSAP ScrollTrigger
callbacks and read inside `useFrame`, so scrolling never re-renders React. The
one React subscription is a derived boolean in the contact section.

Canvas dpr is capped at 1.5 on mobile and 2 on desktop, detected once at load,
and is lowered further toward 1 during play if the frame rate stays under 45.
Rendering stops while the tab is hidden. Smooth scroll is Lenis, driven by the
GSAP ticker so the page has a single rAF loop. Lenis honours
`prefers-reduced-motion` by collapsing to 1:1 scroll.

## The glass

`public/models/glass.glb` is a stemmed glass: a wide foot, a thin stem, and a
rounded bowl. It arrives at an arbitrary scale, so `Glass.jsx` measures its
bounding box at load and fits it to exactly 1 unit tall with its base at y = 0,
centred on x/z. That is the coordinate space everything else works in.

The bowl is **widest just below its middle (radius 0.2013) and narrower at the
rim (0.1452)**, so a cylinder cannot sit inside it: it would either poke
through the wall or leave a visible gap. The liquid is therefore a lathe on the
bowl's measured interior profile, and the 80% fill level is applied by cutting
the profile off partway up rather than by scaling the mesh — scaling a tapered
bowl vertically moves its wall sideways.

Rather than eyeball those numbers, `scripts/extract-glass-profile.mjs` reads the
GLB and writes `src/config/glassProfile.js`:

```powershell
node scripts/extract-glass-profile.mjs
```

It emits the bowl's interior profile, the outer silhouette (used to build the
fallback lathe shown while the model loads), and 60 points sampled from the
real surface, which the shatter uses as shard origins. Every number is measured
from the mesh; re-run it if the model is ever replaced. `Glass.jsx` warns in dev
if the loaded model disagrees with that file.

Two notes on the source file. It declares
`KHR_materials_pbrSpecularGlossiness` as a *required* extension, which three has
no implementation for, so `GLTFLoader` warns on every load; `Glass.jsx`
registers an empty handler to keep the console clean, and replaces the
material anyway because the file's own is solid black.

Asset budget: the model is 236 KB and the environment map is 1.4 MB, which is
1.7 MB of the 2 MB ceiling in AGENTS.md section 5 — about 0.3 MB left. That is
why the backdrop is pure CSS: soft blobs are radial gradients, not blurred
images.

There is no transmission or refraction on either tier. The page backdrop is
CSS, so the scene behind the glass is empty, and a transmission pass would
sample clear black instead of the gradient the user actually sees. The glass
reads as glass through opacity, clearcoat, the environment map and a fresnel
rim injected into the physical shader.

## The ingredients

Scrolling from the hero into the first flavor section builds the drink:
bubbles fade in, ice drops in from above, mint arrives, then the fruit.
`scrollProgress` runs 0 to `BUILD_END` (0.25) across that stretch, and each
ingredient has its own window inside it. Nothing new is stored or triggered;
the ingredients read the scroll value the page already had.

The scroll-driven part of every ingredient is a closed-form function of that
progress, so scrolling back up empties the glass again in exactly the reverse
order — the same guarantee the shatter has. The clock-driven parts (the climb,
the bob, the sway) are separate and never touch scroll.

Everything is fitted against `liquidProfile.js`, which is the drink's measured
bounds pulled out of `Liquid.jsx`. Ice, mint and bubbles all ask it how much
room there is at their own height rather than carrying a copied constant, and
`verify-ingredients.mjs` sweeps both tiers and asserts every instance of every
ingredient stays inside. The fruit goes further: the verifier builds all four
slices, walks every vertex, and checks each one against the real glass wall.

| | desktop | mobile |
|---|---|---|
| Bubbles | 80, one `InstancedMesh` | 40, one `InstancedMesh` |
| Ice | 5 rounded cubes, one `InstancedMesh` | same |
| Mint | 10 leaves, one `InstancedMesh` | 8 |
| Fruit | one slice, built from primitives | same |

**The drink had to become translucent for any of this to be visible.** It was a
closed lathe with a hard `1.0` alpha, so anything placed inside it — bubbles
included — was hidden behind its own front face. It is now `transparent` at
0.85, with depth writes off and front faces only, so the back wall is culled
and you look into the drink. Its geometry, uniforms, fill level and color lerp
are unchanged.

The ingredients are parented inside the same group as the glass, the one
`MojitoGroup.jsx` already hides when the glass breaks, so the shatter takes
them with it and no shatter logic was touched.

The ice material is the glass recipe with a different opacity — same tier
numbers, same fresnel rim, one set of values. The mint leaf is a shape built
from two curves, coloured by a vertex gradient rather than a texture, because
the asset budget has about 0.3 MB left and a leaf image would have spent it.
The fruit is a small group of primitives per flavor: fruit is the one
ingredient that needs no instancing, since only one slice is ever on screen.

Every slice's colors come from the `fruit` block on its flavor in
`config/flavors.js`, so no color is written inside a 3D component. Mint is the
one ingredient that is not flavor data — every mojito gets the same mint — so
its two greens are a separate export in the same file rather than four
identical copies on the flavor objects.

## The backdrop

The flavor gradient and its bokeh blobs are both CSS. On a flavor change the
outgoing layer is painted **over** the incoming one and fades away, which is the
only arrangement where the fade is visible — put it underneath and the incoming
opaque gradient hides it instantly, which is what Phase 3A was doing.

## The shatter

Approaching the contact section, `breakProgress` runs 0 to 1, scrubbed by
ScrollTrigger. The glass drops and shakes up to 0.3, then the intact glass and
liquid hide and 60 shards (40 on mobile) appear in their place, flying outward,
falling and fading to nothing.

Shard origins are points sampled from the glass's own surface, and shard sizes,
speeds and gravity are all multiplied by the glass's width, so the burst keeps
its proportions if the model is replaced. Earlier the origins were placed at
y −0.39..0.39, which is a *centred* space; the glass's space runs 0 (base) to 1
(rim), so half the burst started below the glass. The verifier had encoded the
same wrong assumption and passed. It now asserts the burst spans the glass.

Nothing integrates velocity over time. Every shard's position, rotation and
alpha is a closed-form function of `breakProgress`, which is what makes
scrolling back up reassemble the glass exactly rather than leaving it
scattered. `scripts/verify-shatter.mjs` asserts that reversal over 200 scroll
steps, plus alpha monotonicity, finite values, unit-length rotation
quaternions, shard origins on the real surface, and the shape of the measured
interior profile.

`scripts/verify-ingredients.mjs` does the same job for the ingredients: the
same reversal sweep, the appearance order, and a bounds check that walks every
instance — and every vertex of every fruit slice — against the glass and the
drink. Both run together:

```powershell
pnpm verify
```

## Phase status

- [x] 1. Setup, canvas, test cube, flavor picker
- [x] 2. Glass and liquid shader
- [x] 3A. Navbar and scroll journey
- [x] 3B. Glass shatter and contact details
- [x] 3C. Realistic glass, environment map, contact shadow, CSS backdrop
- [x] 4. Scroll story: ice, mint, fruit, bubbles (committed as "phase-5: ingredients")
- [ ] 5. Mobile optimization pass
- [ ] 6. Loader, SEO, deploy to Vercel
