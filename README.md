# Mojito — scroll-driven 3D website

A mobile-first site for a mojito brand. One glass stays on screen and scrolling
builds the drink in stages: glass, ice, mint, fruit, fizz. Tapping a flavor
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
   TypeScript with strict mode. This project is plain JS with
   `.js`/`.jsx` files. `pnpm build` does not type-check. JSDoc annotations cover
   the shared config and store so editors still get hover docs.

## Layout

```
src/
  main.jsx
  App.jsx                <- backdrop cross-fade + scene + picker
  config/
    flavors.js           <- ALL flavor data lives here
    performance.js       <- quality tier, dpr cap, reduced-motion flag
  store/
    useStore.js          <- active flavor, scroll progress, quality tier
  three/
    Scene.jsx            <- Canvas, light, camera, test cube
    Glass.jsx            <- Phase 3
    Liquid.jsx           <- Phase 2
    Ice.jsx              <- Phase 3
    Mint.jsx             <- Phase 3
    Fruit.jsx            <- Phase 3
    Bubbles.jsx          <- Phase 3
    shaders/             <- Phase 2
  ui/
    FlavorPicker.jsx     <- 4 flavor buttons
    Hero.jsx             <- Phase 5
    FlavorCards.jsx      <- Phase 5
    About.jsx            <- Phase 5
    OrderCTA.jsx         <- Phase 5
    Loader.jsx           <- Phase 7
  hooks/
    useScrollProgress.js <- Phase 3
    useAdaptiveQuality.js<- Phase 6
  assets/                <- compressed models and textures only
public/
```

Placeholder files return `null`. They exist so the folder structure matches
AGENTS.md from the start; nothing imports them yet.

## Phase status

- [x] 1. Setup, canvas, test cube, flavor picker
- [x] 2. Glass and liquid shader
- [ ] 3. Scroll story: ice, mint, fruit, bubbles
- [ ] 4. Flavor switcher driven by `flavors.js`
- [ ] 5. UI layer: hero, cards, about, CTA
- [ ] 6. Mobile optimization pass
- [ ] 7. Loader, SEO, deploy to Vercel

## Phase 1 behavior

The scene holds a single rotating cube whose color is the active flavor's
`liquidColor`, lerped over about a quarter second instead of hard-cutting. The
backdrop cross-fades between flavor gradients over 700ms. Canvas dpr is capped
at 1.5 on mobile and 2 on desktop, detected once at load. Rendering stops when
the tab is hidden. The cube holds still under `prefers-reduced-motion`.

Not built yet: glass, shaders, scroll animation, hero copy. That is deliberate.
