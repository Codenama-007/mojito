import { cupOuterRadiusAt } from './liquidProfile.js'
import { seededRandom } from './ingredientMath.js'

/**
 * Where the whole fruits float and how they swap, as pure functions.
 *
 * Same two rules as ingredientMath.js: nothing here reads a clock or a store,
 * so scripts/verify-whole-fruits.mjs can sweep time, scroll and the swap
 * without a renderer, and the layout is seeded so the verifier sees exactly
 * what the browser draws.
 */

/**
 * How far a fruit travels outward while it leaves, in cup units.
 *
 * The exit and the entrance are the same number: `wholeFruitState` pushes each
 * fruit out by (1 - presence), so a fruit flies outward as it scales to nothing
 * and flies back in as the incoming flavor scales up. One mechanism, both
 * halves of the swap (the brief, item 2).
 *
 * 0.34 in Phase 6A, down to 0.28 in Phase 7. The number is not about taste, it
 * is about the screen: the cup's silhouette is half as wide again as the old
 * glass was, so every orbit radius moved outward with it, and the same 0.34 of
 * outward flight on top of that puts a departing lime past the edge of the
 * narrowest phone script the verifier checks. See MAX_OFFSCREEN_REACH in
 * scripts/verify-whole-fruits.mjs for the arithmetic.
 */
export const FLY_OUT = 0.28

/**
 * The swap spring: about half a second, with one small overshoot on the way in.
 * Same numbers as the fruit slice's swap in ingredientMath.js, so a flavor tap
 * moves everything on screen together.
 */
export const WHOLE_FRUIT_SPRING = { stiffness: 170, damping: 13 }

/**
 * The gap held between a fruit's surface and the glass. The 1.25 factor on the
 * size is the spring's overshoot: a fruit is briefly 1.25 times its resting
 * size, and the clearance has to survive that or it clips the bowl on the way
 * in.
 */
const CLEARANCE = 0.05
const OVERSHOOT_ALLOWANCE = 1.25

/**
 * A fruit is placed by how much *room* it has, not by a number picked by eye.
 *
 * The subtlety is that a fruit is a sphere hanging beside the glass, so what it
 * has to clear is the widest the glass gets anywhere that sphere reaches — not
 * the glass at the fruit's own height. A lime drifting alongside the narrow
 * stem would otherwise sail straight through the bowl above it. That is also
 * why a fruit cannot simply hug the glass: the nearer the stem it hangs, the
 * further out it has to sit to miss the shoulder.
 *
 * @param {number} count How many orbit at once.
 * @param {number} seed
 */
export function buildWholeFruits(count, seed) {
  const random = seededRandom(seed)
  const fruits = []

  for (let i = 0; i < count; i++) {
    // Spread over the stem and the bowl, so they are not a ring at one height.
    const y = 0.3 + random() * 0.48
    const size = 0.09 + random() * 0.045
    const bob = 0.018 + random() * 0.025

    // Everywhere the fruit's own sphere and its bob can carry it.
    const reach = size * OVERSHOOT_ALLOWANCE + bob
    const outer = Math.max(
      cupOuterRadiusAt(y - reach),
      cupOuterRadiusAt(y),
      cupOuterRadiusAt(y + reach),
    )
    const clearance = outer + reach + CLEARANCE

    fruits.push({
      size,
      y,
      bob,
      /** Evenly spaced, then jittered so the group never reads as a carousel. */
      phase: (i / count) * Math.PI * 2 + random() * 0.9,
      radiusX: clearance + 0.03 + random() * 0.12,
      /**
       * Deeper than it is wide on purpose. The camera is a perspective one, so
       * a fruit in front of the glass sweeps further across the screen than one
       * behind it when the glass slides between sections — real parallax for
       * free, rather than a faked offset.
       */
      radiusZ: clearance + 0.02 + random() * 0.2,
      /** Radians per second, either way round, so they do not march in step. */
      orbitSpeed: (random() < 0.5 ? -1 : 1) * (0.1 + random() * 0.16),
      /** Extra turns across the whole page, so scrolling moves them too. */
      scrollDrift: (random() - 0.5) * 2.2,
      bobSpeed: 0.45 + random() * 0.6,
      bobPhase: random() * Math.PI * 2,
      spin: (random() - 0.5) * 0.9,
      spinSpeed: (random() - 0.5) * 0.8,
      tilt: (random() - 0.5) * 1.1,
    })
  }

  return fruits
}

/**
 * Where one fruit is and how big it is.
 *
 * @param {object} fruit One entry from buildWholeFruits.
 * @param {number} presence 0 when the flavor is out, 1 when it is in.
 * @param {number} time Seconds.
 * @param {number} progress Whole-page scroll progress.
 * @param {number} [motion] 0 freezes the ambient drift, for reduced motion.
 */
export function wholeFruitState(fruit, presence, time, progress, motion = 1) {
  const angle =
    fruit.phase +
    time * fruit.orbitSpeed * motion +
    progress * Math.PI * 2 * fruit.scrollDrift

  const fly = (1 - presence) * FLY_OUT
  const bob = Math.sin(time * fruit.bobSpeed + fruit.bobPhase) * fruit.bob * motion

  return {
    x: Math.cos(angle) * (fruit.radiusX + fly),
    y: fruit.y + bob,
    z: Math.sin(angle) * (fruit.radiusZ + fly),
    scale: presence,
    spin: fruit.spin + time * fruit.spinSpeed * motion,
    tilt: fruit.tilt,
  }
}
