# prompt_2 — Phase 6A: whole fruits and the juice splash

**Not recorded verbatim.** This prompt was sent before the `prompts/` folder
existed, and the session that received it did not keep the text. What follows is
the brief as reconstructed from the work it produced and from `session_4.md`.
Treat the wording as approximate; the requirements are not.

---

Read AGENTS.md first and follow it.

Task: Phase 6A — whole fruits orbiting the glass, and a juice splash.

1. Whole fruits: while a flavor section is on screen, 3–4 whole fruits of that
   flavor orbit the glass — limes, strawberries, apples, mango pieces. Build
   them in code from primitives, no external models or images. They arrive and
   leave by scaling up and down, never with a hard cut.
2. The fruits leave the glass when the flavor changes: the outgoing fruits
   travel outward and fade while the incoming ones arrive. About half a second.
   No loop, no idle spin that reads as a turntable.
3. The splash: when a flavor becomes active — by tap or by scrolling into its
   section — a burst of juice leaves the glass. Droplets and a crown around the
   rim, ballistic arcs, falling back down, fading out. One burst per trigger. It
   must never loop.
4. Colors come from `config/flavors.js`. Add whatever fields you need there;
   never hardcode a flavor color inside a 3D component.
5. Everything must fit inside the glass and its liquid bounds where it overlaps
   them, and must follow the glass's position, scale and sway.
6. The shatter must hide the fruits and the splash along with the rest of the
   drink.
7. No physics library. Keep it closed-form and reversible.
8. Dispose geometries and materials on unmount.
