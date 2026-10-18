# prompt_1 — Phase 5: ingredients inside the glass

Recorded verbatim, as sent. Numbering starts here, with the first prompt of the
Phase 5 round.

---

hey chat here you go
Read AGENTS.md first and follow it.

Task: Phase 5 — Ingredients inside the glass.

1. Bubbles (src/three/Bubbles.tsx): 80 bubbles on desktop, 40 on mobile, using ONE InstancedMesh of small spheres (or Points). They rise inside the liquid with random speed and slight sideways wobble, then loop back to the bottom. Animate in useFrame with precomputed random values. Keep them inside the liquid's inner bounds.
2. Ice (src/three/Ice.tsx): 5 rounded ice cubes in ONE InstancedMesh (use RoundedBoxGeometry from drei or three-stdlib). Semi-transparent, glassy material (same mobile/desktop tier rules as the glass). They float near the top of the liquid and bob gently.
3. Mint (src/three/Mint.tsx): 8 to 10 mint leaves in ONE InstancedMesh using a simple leaf-shaped plane (build the shape in code) with a green gradient color and slight random rotation. They float at the top and sway slightly.
4. Fruit (src/three/Fruit.tsx): one fruit slice per flavor, built in code, no external models:
   - lime: green disc with a lighter inner ring and radial segments
   - strawberry: red-pink heart-like slice with small seed dots
   - apple: pale yellow-white slice with a red rim
   - mango: orange cube-like chunks
   Slices sit on the glass rim or float near the top. Which fruit shows comes from the active flavor in flavors.ts. Add a `fruit` field there.
5. Flavor change animation: when the flavor changes, the old fruit scales down to 0 and the new one scales up with a small bounce (about 0.5s). No hard cuts.
6. Scroll story in the hero and the first section only: as scroll progress goes from 0 to 0.15, ingredients appear in order: bubbles fade in, ice drops in from above, mint appears, then fruit. Drive it with scroll progress from the store. It must reverse when scrolling up.
7. Everything must fit inside the glass and liquid bounds from Phase 4. Do not change the glass, liquid, navbar, or shatter logic. The shatter should hide the ingredients when the glass breaks.
8. Dispose geometries and materials on unmount.

Done when:
- npm run build passes.
- On my phone I can see bubbles rising, ice, mint, and the right fruit for each flavor.
- Ingredients appear in order as I scroll and reverse when I scroll up.
- Still smooth, with no console errors.

Report what changed and commit as "phase-5: ingredients".
here is the new task
and one more thing
all the prompts that i gave to you just genereate a prompts folder and store that content in the prompt_1.md and so on till we get my desired output

---

## Notes on this prompt

Two conflicts were raised before any code was written, and both were resolved
with the author rather than silently:

- **Item 1 vs item 7.** Bubbles are asked to rise *inside* the liquid, but item 7
  said not to change the liquid — and the Phase 4 liquid was a fully opaque
  `ShaderMaterial` (`gl_FragColor = vec4(color, 1.0)`, no `transparent` flag,
  closed watertight lathe). Anything inside it is occluded by its own front
  face, so the bubbles would have been invisible. Approved fix: the liquid
  becomes translucent (`transparent`, alpha 0.85, `depthWrite: false`,
  front faces only). Geometry, uniforms, fill level and the colour lerp are
  untouched.
- **Item 6's range.** 0 to 0.15 is roughly 0.9 of a viewport of scrolling on a
  seven-section page, split four ways. Approved: stretch to 0 to 0.25.

Also translated to this repo, which is plain JS and pnpm: `.tsx` -> `.jsx`,
`npm run build` -> `pnpm build`, `flavors.ts` -> `src/config/flavors.js`, and
`RoundedBoxGeometry` taken from `three/examples/jsm/geometries/` rather than
drei (drei ships it as a JSX component wrapping `ExtrudeGeometry`, which does
not suit an `InstancedMesh`; `three-stdlib` does not ship it at all).
