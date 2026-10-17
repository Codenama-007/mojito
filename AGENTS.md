# AGENTS.md — Mojito Brand 3D Website

Read this file fully before every task. Follow it strictly.

## 1. Project summary
A mobile-first, scroll-driven 3D website for a mojito brand.
Flavors: Lime, Strawberry, Apple, Mango.

Core concept: ONE glass stays on screen. Scrolling "builds" the mojito in stages:
glass -> ice drops in -> mint is muddled -> fruit splashes in -> fizz rises.
Tapping a flavor changes the fruit, liquid color, background mood, and copy.

This must NOT look like a generic "product spinning while you scroll" site.

## 2. Tech stack (do not add or swap libraries without asking)
- Vite + React + TypeScript
- three, @react-three/fiber, @react-three/drei
- gsap + ScrollTrigger, lenis (smooth scroll)
- Tailwind CSS (UI layer)
- Zustand (small global state: active flavor, scroll progress)

Do NOT add: heavy physics engines, postprocessing libraries (except optional light bloom on desktop), or any new 3D framework.

## 3. Folder structure
```
src/
  main.tsx
  App.tsx
  config/
    flavors.ts          <- ALL flavor data lives here
    performance.ts      <- pixel ratio caps, quality tiers
  store/
    useStore.ts         <- active flavor, scroll progress, quality tier
  three/
    Scene.tsx           <- Canvas + lights + camera rig
    Glass.tsx           <- LatheGeometry glass
    Liquid.tsx          <- custom shader liquid
    Ice.tsx             <- instanced rounded cubes
    Mint.tsx            <- instanced textured planes
    Fruit.tsx           <- slices/discs, swaps by flavor
    Bubbles.tsx         <- instanced points/sprites
    shaders/            <- .glsl or .ts shader strings
  ui/
    Hero.tsx
    FlavorPicker.tsx
    FlavorCards.tsx
    About.tsx
    OrderCTA.tsx
    Loader.tsx
  hooks/
    useScrollProgress.ts
    useAdaptiveQuality.ts
  assets/               <- compressed models and textures only
public/
```

## 4. Golden rules
1. Work on ONE phase or task at a time. Never jump ahead.
2. Every flavor's colors, fruit, and copy come from `config/flavors.ts`. Never hardcode flavor values inside 3D components.
3. Build objects from code first (LatheGeometry glass, instanced ice/mint/bubbles). Only load external models if the task says so.
4. Keep components small. One component per file, under ~150 lines. Split if larger.
5. No `any` types. Keep TypeScript strict.
6. Do not rewrite working files unrelated to the task.
7. If unsure, ask a question instead of guessing.

## 5. Mobile performance rules (non-negotiable)
- Canvas `dpr` capped at 1.5. Auto-lower toward 1 if FPS drops below 45.
- Total model + texture weight under 2 MB. Use Draco/KTX2 or WebP textures.
- Bubbles, ice, and mint leaves must use `InstancedMesh` or `Points`, never individual meshes.
- No real glass refraction or `MeshTransmissionMaterial` on mobile. Fake glass with fresnel + transparent shader/material.
- No heavy post-processing. Optional light bloom on desktop only, off on mobile.
- Max 2 lights. No real-time shadows on mobile.
- Dispose geometries, materials, and textures on unmount.
- Pause rendering (`frameloop="demand"` or equivalent) when the canvas is off-screen or the tab is hidden.
- Detect quality tier once at load (mobile / desktop) and store it in the store.

## 6. Interaction rules
- Scroll drives everything. No required drag, pinch, or hover.
- All tap targets at least 44x44 px.
- Use `100svh` (not `100vh`) so mobile browser bars do not break layout.
- Test layouts at 360px, 390px, and 768px widths first, desktop last.
- Respect `prefers-reduced-motion`: reduce animation and disable smooth scroll.

## 7. Fallbacks
- If WebGL is unavailable or crashes, show a static hero image with the flavor picker still working.
- Show a loader until the scene is ready. Never show an empty canvas.

## 8. Design direction
- Fresh, summery, high-contrast. Large bold typography, plenty of whitespace.
- Each flavor has its own color mood (background gradient, liquid color, accent).
- Transitions between flavors must animate (color lerp, fruit swap), never hard-cut.
- Copy is short and punchy. No lorem ipsum in final output.

## 9. Workflow for every task
1. Restate the task in one sentence.
2. List the files you will create or change.
3. Make the changes.
4. Run `npm run build` and fix any errors.
5. Report: what changed, how to test it, and what "done" looks like.
6. Wait for confirmation before the next task.

## 10. Git
- Commit after each completed phase: `phase-N: short description`.
- Never commit `node_modules` or build output.

## 11. Phases
1. Setup + canvas + test cube running on phone
2. Glass + liquid shader
3. Scroll story (ice, mint, fruit, bubbles)
4. Flavor switcher driven by `flavors.ts`
5. UI layer (hero, cards, about, CTA)
6. Mobile optimization pass
7. Polish: loader, SEO, deploy to Vercel