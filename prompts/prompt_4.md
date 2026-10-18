# prompt_4 — Phase 7: rebuild the glass as a clear takeaway cup

**Not recorded verbatim.** Sent before the `prompts/` folder existed; the text
was not kept. Reconstructed from the work it produced and from `session_4.md`,
and it is long, so this is a paraphrase of every requirement rather than the
owner's sentences.

---

Read AGENTS.md first and follow it.

Task: Phase 7 — rebuild the glass as a clear plastic takeaway cup.

1. **Replace `Glass.jsx` with `Cup.jsx`.** Built in code, no external model.
   A tapered lathe body, top radius about 1.3x the bottom, thin wall, rounded
   bottom edge. A rim flange ring. A dome lid slightly wider than the rim, with
   a flat lip and a straw hole. A straw from inside the liquid up through the
   lid, about 25% of it above the lid, colored by a new `strawColor` field on
   each flavor and lerped on flavor change.
2. **Plastic material.** Desktop: `MeshPhysicalMaterial`, transmission 0.9,
   thickness 0.1, roughness 0.08, ior 1.45, clearcoat 1, envMapIntensity 1.2.
   Mobile: no transmission — `transparent`, opacity 0.2, roughness 0.08,
   clearcoat 1, envMapIntensity 1.5, `depthWrite: false`, `DoubleSide`. Add a
   soft white highlight streak down one side.
3. **Liquid.** Keep the shader. Paler and more transparent: mix the flavor's
   `liquidColor` about 55% of the way to white, opacity about 0.75, lighter at
   the top, fill about 85%, resized to the tapered interior.
4. **Tilt.** Wrap the cup, lid, straw, liquid and every ingredient in ONE group
   and rotate it about 10 degrees in Z and 4 in X, toward the camera, plus a
   gentle ±1.5 degree sway. Angles live in `performance.js` as `CUP_TILT_Z` and
   `CUP_TILT_X`. Keep the tilt in every section.
5. **Mint, dense.** 24 leaves on desktop, 14 on mobile, ONE `InstancedMesh`,
   with a serrated edge built in code and a small `CanvasTexture` for the veins
   (a darker green center and side veins on a lighter green). Leaves pressed
   against the inner wall and stacked in the upper half of the liquid, with
   random rotation.
6. **Bubbles.** Keep the rising ones. Add about 60 tiny static bubbles clinging
   to the wall on desktop (30 mobile) on one `Points`/`InstancedMesh`, with a
   slight shimmer, that occasionally detach and rise.
7. **Fruit.** 2–3 flavor-specific slices pressed against the inner wall near the
   top, from the existing `Fruit.jsx`. Not floating mid-cup.
8. **Ice.** Reduce to 3 small cubes, mostly hidden behind the mint.
9. **Whole fruits and splash** must still follow the cup, and the splash must
   now start from the lid area.
10. **Shatter** must break cup and lid shards using the same plastic material.
11. Everything in bounds, dispose on unmount, total assets under 2 MB on mobile.
    Do not change the navbar, the backdrop, or the scroll logic.

**Done when:** `pnpm run build` passes; on the phone a tilted clear cup with a
dome lid and a straw, packed mint with visible veins, wall bubbles and pale
tinted liquid; straw color and liquid tint change smoothly for all four flavors;
the shatter at the contact section still works; smooth, with no console errors.

Commit as `phase-7: takeaway cup`.

---

**Owner's reference:** `public/images/glass.jpg` was added as the location shot
for the cup.
