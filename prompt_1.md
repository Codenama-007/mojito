# Phase 1 Prompt (copy-paste into Open Code)

Read AGENTS.md first and follow it.

**Task: Phase 1 — Project setup and test scene.**

1. Scaffold a Vite + React + TypeScript project in the current folder.
2. Install: three, @react-three/fiber, @react-three/drei, gsap, lenis, zustand, tailwindcss (with its Vite plugin).
3. Create the folder structure from AGENTS.md (empty files are fine for later phases).
4. Create `src/config/flavors.ts` with 4 flavors (lime, strawberry, apple, mango). Each has: id, name, liquidColor, accentColor, backgroundGradient, tagline.
5. Create `src/config/performance.ts` that detects mobile vs desktop and exports a quality tier (dpr cap 1.5 on mobile, 2 on desktop).
6. Create `src/three/Scene.tsx` with a full-screen fixed `<Canvas>` using the dpr cap, one light, and a single rotating cube colored by the active flavor's `liquidColor`.
7. Create a simple `FlavorPicker` with 4 buttons (min 44px tall) at the bottom of the screen. Tapping one changes the cube color via the Zustand store.
8. Use `100svh` for the layout. Add `npm run dev -- --host` instructions to the README so I can open it on my phone.

**Do not** add the glass, shaders, scroll animation, or any other phase yet.

**Done when:**
- `npm run build` passes with no errors.
- The page opens on my phone over the local network.
- The cube renders and changes color when I tap each flavor.
- No console errors.

When finished, report what you changed and how I can test it. Then commit as `phase-1: setup and test scene`.