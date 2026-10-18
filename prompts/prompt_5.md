# prompt_5 — Phase 8A: tilt right and height fix

Recorded verbatim, as sent. It arrived in the same message as `prompt_6.md`,
under the heading "here are some of the fixes"; the two are split here so each
phase has its own record.

---

Read AGENTS.md first and follow it.

Task: Phase 8A: Tilt the cup to the right and stop it going off the top of the screen.

1. Tilt direction: the cup must lean to the RIGHT (top of the cup leaning toward the right side of the screen). In three.js that means a negative Z rotation. Set CUP_TILT_Z to -10 degrees (converted to radians) in performance.ts. Keep CUP_TILT_X as it is. Keep the small sway on top. Apply this in every section.
2. Height fix: the cup, lid, and straw are currently going above the top of the page in the lime section and at the start of the scroll.
   - Measure the full group (cup + lid + straw, after tilt) with THREE.Box3 once at load and again on resize.
   - Scale the whole group so its total height is at most 62 percent of the viewport height on mobile and 72 percent on desktop.
   - Clamp the group's Y position every frame so the top of the straw is never closer than 8 percent of the viewport height to the top edge. On mobile also keep the navbar height (about 64px) clear.
   - Use useThree viewport values, not fixed numbers, so it works on every screen size.
3. Check these positions specifically: hero, lime section start, lime section middle, and the transitions between flavor sections. The cup must stay fully visible in all of them on a 360px, 390px, and 768px wide screen.
4. Keep MOBILE_GLASS_Y_OFFSET working, but apply the clamp after it.
5. Fruits, splash, and shatter must follow the cup's final position.

Do not change the backdrop, navbar, or scroll logic.

Done when:
- npm run build passes.
- On my phone the cup leans right and the straw is never cut off, including at the lime section.
- Smooth, with no console errors.

Commit as "phase-8a: tilt right and height fix".
