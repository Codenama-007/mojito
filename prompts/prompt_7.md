# Prompt 7

Recorded verbatim, 18 October 2026.

> just like you added the limme background at the lime section can you do the sam e for the manog , strawberry and apple
> and when i select strawberry from lime , and any other option add a glass rotating transition and the background transition should be such that the old background should go in and new one should come out

## Notes taken at the time

Three asks:

1. **Fruit background for every flavor.** Read as a bug report: lime's fruit
   field is visible, and strawberry / apple / mango are not. Checked first, and
   the art and the config are not the cause — every flavor has a full `fruit`
   block of valid hex (`config/flavors.js`), and `fruitFieldCount` is 22 mobile
   / 40 desktop for every flavor alike (`config/performance.js`). So if only one
   flavor's fruit is on screen, the fault is in the per-flavor swap, not in the
   textures.
2. **A glass rotation on flavor change.** New. The cup currently holds its
   resting lean plus its idle sway, which is 4° of X and 10° of Z; there is no
   rotation tied to changing flavor.
3. **A background transition where the old one goes and the new one arrives.**
   New. Currently a cross-fade: the outgoing fill is painted over the incoming
   one and fades away, so for 0.8 s both are on screen at once, blended.

Two things in that are ambiguous and were put to the owner before any code was
written: what the fruit field actually looks like per section, and which of
several transitions "old goes in / new comes out" means.
