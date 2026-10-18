# prompt_6 — Phase 8B: fruit field background

Recorded verbatim, as sent. Same message as `prompt_5.md`.

---

Read AGENTS.md first and follow it.

Task: Phase 8B: Replace the gradient background with a fruit-filled background per flavor.

1. Keep Backdrop.tsx but make the base a solid, slightly darker version of the flavor color (no visible gradient). Use colorA from flavors.ts as the base.
2. Create src/three/FruitField.tsx: a field of fruits scattered across the background behind the cup.
   - Lime flavor: limes and lime slices. Strawberry: strawberries. Apple: apples and apple slices. Mango: mango pieces.
   - Draw each fruit type once to a small CanvasTexture (128x128) in code: whole fruit and cut slice versions, with simple highlights and shading. No external images.
   - Use ONE InstancedMesh of planes per fruit type. 40 instances on desktop, 22 on mobile.
   - Each instance gets a random depth (3 layers: far, mid, near), random size, random rotation, and a very slow drift and spin. Far fruits are smaller, dimmer, and more blurred (lower opacity and a soft-edge shader). Near fruits are bigger and slightly blurred.
   - Keep a clear area behind the cup, so fruits thin out near the center.
3. Opacity: far 0.25, mid 0.4, near 0.55 maximum. Add a soft dark overlay at about 15 percent so text stays readable. Put these values in performance.ts as FRUIT_FIELD_OPACITY so I can tweak them.
4. Flavor change: the old fruits scale down and fade out while the new ones fade in (about 0.8s). Base color cross-fades too. No hard cuts.
5. Add a light parallax: the fruit field shifts slightly with scroll progress (far layers move less than near layers).
6. Remove the previous gradient noise and bokeh circles. Keep the vignette, but make it subtle.
7. If public/backdrops/fruits/<flavor>.webp exists (a transparent cutout sheet), use it instead of the canvas drawn fruit. Otherwise use the canvas version.
8. Hide or fade the fruit field during the glass shatter at the contact section, and fade in a neutral dark brand color.
9. Dispose textures and geometries on unmount. No new heavy libraries. Total assets under 2 MB on mobile.

Do not change the cup, splash, navbar, or scroll logic.

Done when:
- npm run build passes.
- Lime shows a background full of limes, strawberry full of strawberries, and the same for apple and mango, with good readability of the text on top.
- Flavor changes cross-fade smoothly.
- Smooth on my phone (around 60fps), with no console errors.

Commit as "phase-8b: fruit field background".
