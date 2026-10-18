# prompt_3 — Phase 6B: animated shader backdrop

**Not recorded verbatim.** Sent before the `prompts/` folder existed; the text
was not kept. Reconstructed from `session_4.md`. Treat the wording as
approximate.

---

Read AGENTS.md first and follow it.

Task: Phase 6B — replace the CSS backdrop with something that moves.

1. The background should stop being a still gradient and start reacting to the
   flavor and to scroll. A subtle, slow-moving field behind the glass.
2. It has to stay cheap on mobile: no post-processing, no large blurred images,
   nothing that costs a full-screen pass every frame.
3. The flavor change has to cross-fade, never hard cut.
4. The text on top must stay readable — keep a dark or light overlay as needed.

**Outcome:** this phase was deprioritised by the owner before it was built and
never implemented. One item from its list — dropping the glass a fixed slice of
the viewport on mobile — was folded into Phase 7 as `MOBILE_GLASS_Y_OFFSET` in
`config/performance.js`, and later reworded by Phase 8A as "keep the offset
working, but clamp *after* it". The backdrop is still the Phase 4 CSS one.
