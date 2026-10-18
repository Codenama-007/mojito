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
    brand.js             <- brand name and contact details (see below)
    sections.js          <- section order, nav links, cup targets
    performance.js       <- quality tier, dpr cap, reduced-motion, cup lean
    cupProfile.js        <- the cup, lid and straw, as numbers
  store/
    useStore.js          <- active flavor, section, scroll values, tier
  three/
    Scene.jsx            <- Canvas, lights, environment map, quality wiring
    MojitoGroup.jsx      <- the cup choreography (drop, shake, sway, ease, fit)
    Cup.jsx              <- cup, rim, lid, straw and highlight
    cupGeometry.js       <- the lathes, spun from cupProfile.js
    Liquid.jsx           <- custom shader liquid, lathe on the cup interior
    liquidProfile.js     <- the drink's bounds, in one place, as plain numbers
    Ground.jsx           <- contact shadow under the cup (desktop only)
    Shatter.jsx          <- 60 (40 mobile) shards, one InstancedMesh
    shardMath.js         <- pure, reversible shard maths
    Bubbles.jsx          <- 80 (40 mobile) rising bubbles, one InstancedMesh
    WallBubbles.jsx      <- 60 (30 mobile) clinging to the wall
    Ice.jsx              <- 3 rounded cubes, one InstancedMesh
    Mint.jsx             <- 24 (14 mobile) leaves, one InstancedMesh
    leafGeometry.js      <- the serrated leaf outline, built in code
    mintTexture.js       <- a 128 px canvas texture for the leaf veins
    Fruit.jsx            <- 3 (2 mobile) slices, wedged against the wall
    fruitModels.js       <- the four slices, built from primitives
    FlavorFruits.jsx     <- whole fruit orbiting the cup, cross-faded
    wholeFruits.js       <- the whole-fruit meshes, built from primitives
    wholeFruitMath.js    <- pure, reversible orbit maths
    Splash.jsx           <- the juice burst that leaves the lid
    splashMath.js        <- pure, closed-form ballistic maths
    ingredientMath.js    <- pure, reversible ingredient maths
    FruitField.jsx       <- the background fruit: the push, and the swap state
    fruitFieldScene.js   <- two InstancedMeshes and the per-frame walk
    fruitFieldMath.js    <- pure layer, layout and drift maths
    fruitFieldMaterial.js<- one material, two shader injections
    fruitTextures.js     <- whole fruit and slice, drawn to a canvas
    fruitArt.js          <- the four silhouettes, rims and halos (pure canvas 2D)
    shaders/
      liquid.js          <- liquid vertex + fragment
      plasticMaterial.js <- the one plastic recipe: cup, lid and shards
  ui/
    Backdrop.jsx         <- solid flavor base + readability layers, pushed
    Navbar.jsx           <- fixed bar, hamburger overlay under 768px
    Hero.jsx             <- headline + flavor picker
    FlavorSection.jsx    <- one component, rendered per flavor
    FlavorPicker.jsx     <- four buttons, lives in the hero
    About.jsx
    Contact.jsx          <- phone, email, and the order button
    FlavorCards.jsx      <- not built yet
    OrderCTA.jsx         <- not built yet
    Loader.jsx           <- not built yet
  hooks/
    useLenis.js          <- Lenis instance, GSAP ticker wiring
    useScrollProgress.js <- every ScrollTrigger -> store write
    useAdaptiveQuality.js<- FPS sampler, lowers dpr toward 1 under 45 FPS
    useGlassBaseScale.js <- viewport-derived scale, shared by cup + shadow
  assets/                <- compressed models and textures only
public/
  images/glass.jpg       <- the owner's reference shot for the cup
  env/studio.hdr         <- 1.4 MB, environment map
  backdrops/fruits/      <- OPTIONAL cutout sheets; see "The fruit field"
prompts/                 <- the owner's prompts and session records
scripts/
  verify-shatter.mjs     <- reversal + sanity checks for the shard maths
  verify-ingredients.mjs <- bounds + reversal checks for ice, mint, fruit, fizz
  verify-whole-fruits.mjs<- orbit, clearance and cross-fade checks
  verify-splash.mjs      <- ballistics, fade and colour checks
  verify-cup-fit.mjs     <- the cup fits the screen in every section
  verify-fruit-field.mjs <- shader hooks, art, framing, push and spin geometry
  verify-brand.mjs       <- brand details and flavor copy
```

## Brand details

`src/config/brand.js` holds the name ("Affan's Mojito"), the phone number and the
email. It is the only place they are written down.

Two fields are **deliberately empty**: `instagram` and `address`, because neither
was supplied. An empty string means "we do not have this", and the contact section
drops the row rather than rendering a blank or a dead link — so there is no second
flag to keep in step with the data. Fill either one in and the row appears with no
other change.

"Order now" dials, because orders are taken on the phone.

`scripts/verify-brand.mjs` is what stops a placeholder reaching a live page: it
asserts the phone number is dialable, the email well-formed, the `tel:` link is a
bare number, no field is still `TODO_`, and that each flavor's paragraph is two
sentences, a different two sentences, and not lorem ipsum.

## Current behavior

Scroll drives the journey. The glass stays pinned to the screen while seven
sections pass: hero, four flavors, about, contact. Each flavor section moves
the glass to one side (up and centre on mobile), rotates it slightly, and sets
the active flavor, which lerps the liquid color over about half a second. The
backdrop cross-fades between flavors, and so does the field of fruit in front
of it.

Every scroll-driven value is written to the Zustand store by GSAP ScrollTrigger
callbacks and read inside `useFrame`, so scrolling never re-renders React. The
one React subscription is a derived boolean in the contact section.

Canvas dpr is capped at 1.5 on mobile and 2 on desktop, detected once at load,
and is lowered further toward 1 during play if the frame rate stays under 45.
Rendering stops while the tab is hidden. Smooth scroll is Lenis, driven by the
GSAP ticker so the page has a single rAF loop. Lenis honours
`prefers-reduced-motion` by collapsing to 1:1 scroll.

## The cup

Phase 7 replaced the stemmed glass with a clear plastic takeaway cup. There is no
external model any more. `src/config/cupProfile.js` holds the whole thing as
numbers — a tapered wall, a rolled rim, a domed lid with a straw hole, and the
straw — and `cupGeometry.js` spins them into lathes. `public/models/glass.glb`
and the script that measured it are gone, returning 236 KB of the asset budget.

Everything still works in one coordinate space: y = 0 at the cup's base, y = 1 at
the rim, the lid above that (base 1.018, crown 1.238) and the straw out to 1.488.
The liquid, the ingredients, the whole fruit, the splash, the shatter and the
section targets all still use that space, so Phase 7 changed the silhouette and
nothing else.

The cup is a **cone**, and that is the whole difficulty. It is widest at the mouth
and narrowest at the floor, so an ingredient standing in the top half has less
room at its foot than at its own height. Every bound is therefore asked for at
the height that actually constrains the object, not the height it sits at — see
`buildMint` and `maxSliceRadius` for the two places that bit. The drink is a lathe
on the cup's interior profile at 85% fill, cut off partway up rather than scaled:
scaling a tapered cup vertically moves its wall sideways.

**Plastic, one recipe.** `shaders/plasticMaterial.js` covers the cup, the lid and
the shards, so they can never disagree about what they are made of. Desktop is a
`MeshPhysicalMaterial` at transmission 0.9, thickness 0.1, roughness 0.08, ior
1.45, clearcoat 1. Mobile is `transparent` at opacity 0.2 with `depthWrite` off
and both sides drawn, plus a stronger environment map — no transmission pass at
all. There is no `MeshTransmissionMaterial` on either tier, and no
post-processing.

> **Known risk.** The page backdrop is CSS, so the scene behind the cup is empty
> and a transmission pass samples clear black instead of the flavour gradient.
> The desktop cup may therefore read dark against the backdrop. It is implemented
> as briefed; `performance.plastic.transmission` is a single number to flip to 0
> if it looks wrong on a real desktop screen.

**The tilt.** `MojitoGroup.jsx` nests three groups. The outer one carries
position, uniform scale and yaw. The next centres the cup's own 0..1 body on the
origin. The inner one carries the resting lean and the idle sway, and everything
the cup is made of lives inside it — which is what keeps the drink level *in* the
cup instead of sliding about inside it. Phase 8A set the lean to **−10° in Z**,
negative so the top of the cup tips to the right, and 4° in X.

**The fit (Phase 8A).** The cup, lid and straw are measured once at load and again
on resize with a `THREE.Box3`, at both extremes of the sway so the clamp holds
while the cup rocks. The group is scaled *down* if it would fill more than 62% of
the viewport height on mobile (72% desktop). Every frame the top of the straw is
held at least 8% of the viewport below the top edge, or below the 64 px navbar on
mobile, whichever is lower. Both use `useThree`'s viewport, so they follow the
screen rather than assuming one. `scripts/verify-cup-fit.mjs` sweeps seven
sections × three widths × 35 heights × both tiers and asserts the straw never
crosses. `MOBILE_GLASS_Y_OFFSET` (0.11) still drops the whole journey on mobile,
and the clamp runs after it.

Asset budget: the environment map is 1.4 MB of the 2 MB ceiling in AGENTS.md
section 5, leaving about 0.6 MB. Every surface is built in code or drawn to a
small canvas texture, so there are no binary assets to blow it.


## The ingredients

Scrolling from the hero into the first flavor section builds the drink:
bubbles fade in, ice drops in from above, mint arrives, then the fruit.
`scrollProgress` runs 0 to `BUILD_END` (0.25) across that stretch, and each
ingredient has its own window inside it. Nothing new is stored or triggered;
the ingredients read the scroll value the page already had.

The scroll-driven part of every ingredient is a closed-form function of that
progress, so scrolling back up empties the cup again in exactly the reverse
order — the same guarantee the shatter has. The clock-driven parts (the climb,
the bob, the sway) are separate and never touch scroll.

Everything is fitted against `liquidProfile.js`, which is the drink's measured
bounds pulled out of `Liquid.jsx`. Ice, mint and bubbles all ask it how much
room there is at the height that actually constrains them rather than carrying a
copied constant, and `verify-ingredients.mjs` sweeps both tiers and asserts every
instance of every ingredient stays inside. The fruit goes further: the verifier
builds all four slices, walks every vertex, and checks each one against the real
cup wall.

| | desktop | mobile |
|---|---|---|
| Rising bubbles | 80, one `InstancedMesh` | 40, one `InstancedMesh` |
| Wall bubbles | 60, one `InstancedMesh` | 30 |
| Ice | 3 rounded cubes, one `InstancedMesh` | same |
| Mint | 24 leaves, one `InstancedMesh` | 14 |
| Fruit slices | 3, wedged against the wall | 2 |
| Whole fruit | 3–4 orbiting the cup | same |

**The drink had to become translucent for any of this to be visible.** It was a
closed lathe with a hard `1.0` alpha, so anything placed inside it — bubbles
included — was hidden behind its own front face. It is now `transparent` at
0.75, with depth writes off and front faces only, so the back wall is culled
and you look into the drink. Phase 7 mixed the flavour's `liquidColor` 55% of
the way to white and lightened the top, because a pale drink shows the mint and
the wall bubbles far better than a saturated one; the shader and the fill level
are otherwise unchanged.

The ingredients are parented inside the group `MojitoGroup.jsx` already hides
when the cup breaks, so the shatter takes them with it and no shatter logic was
touched.

The ice material is the plastic recipe with `transmission: 0` and its own
opacity, so ice never pays for a second scene pass — and never samples the empty
canvas on desktop. The mint's shape is built in code from a serrated outline and
a small 128 px `CanvasTexture` draws its veins, which is a texture the asset
budget does not have to carry. The fruit slices and the whole fruits are small
groups of primitives per flavor, with colours that come from the `fruit` block on
their flavor in `config/flavors.js` — no colour is written inside a 3D component.

Mint is the one ingredient that is not flavor data — every mojito gets the same
mint — so its greens are a separate export in the same file rather than four
identical copies on the flavor objects.

## The backdrop and the fruit field

Phase 8B split the background in two.

**The base is a solid colour, not a gradient.** Each flavor carries a `colorA`
in `config/flavors.js`, a shade down from its own colour, and `Backdrop.jsx`
fills the screen with it. The Phase 4 gradient and its bokeh blobs are gone:
they were doing the same job as the fruit field — giving the background depth —
and two answers to one question only muddied each other. What replaced them is
three thin layers over the base: a flat 15% wash for readability, a soft
vignette so the fruit does not stop dead at the corners, and the shatter shade.

**The depth comes from the fruit.** `FruitField.jsx` is a field of the active
flavor's own fruit — limes and lime wheels, strawberries, apples and apple
slices, mango pieces — dealt out behind the cup. It lives inside the canvas
rather than in the DOM, which is the only way fruit can be *behind* the cup,
and it is two `InstancedMesh`es: one for the whole fruit, one for the cut
slices, 40 planes each on desktop and 22 on mobile. Two draw calls for eighty
pieces of fruit.

Every fruit is drawn to a 128 px canvas at runtime, from the same `fruit` block
in `config/flavors.js` that the slices inside the cup are built from, so the
background fruit and the drink cannot drift apart. Nothing is downloaded. If you
would rather ship your own artwork, drop a transparent cutout sheet at
`public/backdrops/fruits/<flavor-id>.webp` — whole fruit in the left half, a cut
slice in the right — and it is used instead, resolved at build time so an absent
folder costs no request and no 404.

The field is three layers deep, far to near, and the brief's rules are all in
`config/performance.js`: opacity ceilings 0.25 / 0.4 / 0.55, softness 0.92 / 0.6
/ 0.34 (the far fruit is blurred almost away, the near fruit barely), and a
scroll parallax of 0.03 / 0.07 / 0.11 of the viewport, so the far layers lag the
near ones as you scroll. Each layer's fruit drifts and spins on a slow, seeded
clock, and the field is dealt out to 145% of the frame so that parallax never
uncovers an empty edge. A clear zone in the middle keeps fruit from sitting over
the cup.

**Each flavor has to read as its own fruit.** Every base colour is a shade of that
flavor's own hue, so colour alone can never separate the fruit from its backdrop —
a mango on orange and an apple on green both came out looking like an empty
background. The fix is three things at once, and `fruitArt.js` is where they live:
a distinct **silhouette** per kind (a squashed disc for the lime, a dipped
two-lobed apple, a narrow-topped mango, a wedge for the strawberry), a dark **rim**
drawn at −58% brightness around every outline, and a soft dark **halo** behind the
whole fruit. `verify-fruit-field.mjs` drives the art with a stub 2D context that
records every path and colour, so it can assert the hard part as a number: each
flavor's darkest drawn colour is at least 0.2 luminance below its own backdrop, and
the four whole fruits and the four slices draw four different silhouettes each. It
also measures every drawn path plus half the rim's stroke against the 128 px canvas,
which is how the strawberry's calyx and the apple's stalk were caught being clipped
by the edge of their own texture.

Nothing in the field is lit, and no fruit writes depth, so none of it can pick up
a highlight from the scene lights or cut a seam into the cup.

The per-instance fade and the soft edge are two `onBeforeCompile` injections into
a `MeshBasicMaterial` rather than a hand-written shader. Instancing is three's
job — `instanceMatrix` and the attribute plumbing come free with a built-in
material and have to be reimplemented in a raw `ShaderMaterial` — so the code is
added to the built-in stages instead. `scripts/verify-fruit-field.mjs` asserts
against three itself that every chunk the injection replaces still exists, and
runs the injection against a stand-in shader to check what came out. That is the
one failure mode here that no build would catch: a three upgrade that renames
`#include <map_fragment>` produces a field of hard-edged squares, not an error.

**The handover is a push, not a cut (Phase 8C).** A flavor change carries the
outgoing field one full viewport to one side while the incoming one arrives from
the other side behind it, `FLAVOR_PUSH_DISTANCE` of `FLAVOR_PUSH` (0.8 s). The CSS
base colour does exactly the same thing with the same numbers, so the fruit
travels with the colour it is painted on — which is the whole point, and why
`FruitField`'s frame loop and `Backdrop.css`'s keyframes are both deliberately
**linear**. Any easing would have to be written twice, and two curves meant to
match and slightly failing is worse than an even wipe.

The two pushed layers are always exactly one viewport apart, so their union
always covers the screen. The field is 145% of a frame wide, though, so at the end
of a push a sliver of the outgoing fruit is still on screen; it is invisible only
because the outgoing alpha reaches zero over the last third of the travel. That
fade is load-bearing, not decoration.

A flavor change arriving mid-push is handled on the field itself. Each field is
keyed by the *swap*, not by the flavor, so strawberry → lime → strawberry builds a
new field rather than reviving one whose clock and direction belong to a change
that is over. When a field in flight is demoted to outgoing, its clock is moved
back exactly one viewport's worth of progress: it continues the conveyor it was
already on instead of jumping back to the start. One rule covers both cases, and
there is one outgoing slot — a third flavor arriving mid-push discards the oldest
outgoing, which is a fruit-position jump rather than a hole, since the base colour
is always behind.

**The cup turns a full turn (Phase 8C).** Every flavor change — a tap on the picker
or a scroll into a flavor section, both of which land in `activeFlavor` — spins the
cup exactly 360° over `FLAVOR_SPIN` (1.35 s), direction taken from
`flavorDirectionFor` so stepping back through the flavors undoes the turn. It is
added to the section yaw rather than replacing it, and a whole turn is the
identity, so nothing has to be reset and no end state reconciled. The ease is
cubic **in and out**: a glass is nearly a solid of revolution, and a front-loaded
ease put most of the turn into its first third, where on a shape this symmetric it
read as a snap rather than a revolution.

**The shatter takes it with it.** Once `breakProgress` passes 0.3 the field has
faded to nothing, and the backdrop fades to a neutral dark behind it, so the cup
breaks against a plain surface rather than a wall of fruit. That shade is a
class on `.app`, and `src/index.css` flips the ink tokens under it — a class
rather than a per-frame style write, so the scroll loop still touches nothing in
the DOM.

The verifier computes the contrast of the ink against each flavor's base colour
*after* the 15% wash and requires 4.5:1. All four pass, the lowest at 5.69:1.

## The shatter

Approaching the contact section, `breakProgress` runs 0 to 1, scrubbed by
ScrollTrigger. The cup drops and shakes up to 0.3, then the intact cup and its
drink hide and 60 shards (40 on mobile) appear in their place, flying outward,
falling and fading to nothing. The lid breaks with it, and the shards use the
same plastic recipe as the cup, so they are obviously the same material.

Shard origins are points sampled from the cup's own surface — wall, floor and
lid dome — and shard sizes, speeds and gravity are all multiplied by the cup's
width, so the burst keeps its proportions if the profile is retuned. Earlier the
origins were placed at y −0.39..0.39, which is a *centred* space; the cup's space
runs 0 (base) to 1 (rim), so half the burst started below the cup. The verifier
had encoded the same wrong assumption and passed. It now asserts the burst spans
the cup.

Nothing integrates velocity over time. Every shard's position, rotation and
alpha is a closed-form function of `breakProgress`, which is what makes
scrolling back up reassemble the cup exactly rather than leaving it scattered.
`scripts/verify-shatter.mjs` asserts that reversal over 200 scroll steps, plus
alpha monotonicity, finite values, unit-length rotation quaternions, shard
origins on the real surface, the lid breaking too, and the shape of the interior
cone.

`scripts/verify-ingredients.mjs` does the same job for the ingredients: the
same reversal sweep, the appearance order, and a bounds check that walks every
instance — and every vertex of every fruit slice and every leaf — against the
plastic and the drink. The other suites cover the whole fruit, the splash,
the Phase 8A fit, the Phase 8B field and the Phase 8C art and transitions. They
all run together:

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
- [x] 5. Whole fruits and the juice splash (committed with "phase-7")
- [x] 6. Takeaway cup, packed mint, wall bubbles (committed as "phase-7: takeaway cup")
- [x] 7. Tilt right, and keep the straw on screen (committed as "phase-8a")
- [x] 8. Fruit-field background (committed as "phase-8b")
- [x] 8C. Per-flavor fruit art, the pushed handover, the cup's 360° turn
- [x] 8D. Brand details, hero and flavor copy, the navbar overlay ("phase-8d")
- [ ] 9. Mobile optimization pass
- [ ] 10. Loader, SEO, deploy to Vercel
