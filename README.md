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
  App.jsx                <- backdrop cross-fade, page sections, hooks
  config/
    flavors.js           <- ALL flavor data lives here
    brand.js             <- contact details (PLACEHOLDERS, see below)
    sections.js          <- section order, nav links, glass targets
    performance.js       <- quality tier, dpr cap, reduced-motion flag
  store/
    useStore.js          <- active flavor, section, scroll values, tier
  three/
    Scene.jsx            <- Canvas, lights, camera, glass choreography
    Glass.jsx            <- LatheGeometry glass
    Liquid.jsx           <- custom shader liquid
    Shatter.jsx          <- 60 (40 mobile) shards, one InstancedMesh
    shardMath.js         <- pure, reversible shard maths
    Ice.jsx              <- not built yet
    Mint.jsx             <- not built yet
    Fruit.jsx            <- not built yet
    Bubbles.jsx          <- not built yet
    shaders/
      liquid.js          <- liquid vertex + fragment
      glassMaterial.js   <- shared glass material, optional per-instance fade
  ui/
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
    useAdaptiveQuality.js<- not built yet
  assets/                <- compressed models and textures only
public/
scripts/
  verify-shatter.mjs     <- reversal + sanity checks for the shard maths
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

Canvas dpr is capped at 1.5 on mobile and 2 on desktop, detected once at load.
Rendering stops while the tab is hidden. Smooth scroll is Lenis, driven by the
GSAP ticker so the page has a single rAF loop. Lenis honours
`prefers-reduced-motion` by collapsing to 1:1 scroll.

## The shatter

Approaching the contact section, `breakProgress` runs 0 to 1, scrubbed by
ScrollTrigger. The glass drops and shakes up to 0.3, then the intact glass and
liquid hide and 60 shards (40 on mobile) appear in their place, flying outward,
falling and fading to nothing.

Nothing integrates velocity over time. Every shard's position, rotation and
alpha is a closed-form function of `breakProgress`, which is what makes
scrolling back up reassemble the glass exactly rather than leaving it
scattered. `scripts/verify-shatter.mjs` asserts that reversal over 200 scroll
steps, plus alpha monotonicity, finite values, unit-length rotation
quaternions, and that shard origins start inside the glass:

```powershell
pnpm verify
```

## Phase status

- [x] 1. Setup, canvas, test cube, flavor picker
- [x] 2. Glass and liquid shader
- [x] 3A. Navbar and scroll journey
- [x] 3B. Glass shatter and contact details
- [ ] 4. Scroll story: ice, mint, fruit, bubbles
- [ ] 5. Mobile optimization pass
- [ ] 6. Loader, SEO, deploy to Vercel
