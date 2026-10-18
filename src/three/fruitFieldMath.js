import {
  FRUIT_FIELD_OPACITY,
  FRUIT_FIELD_PARALLAX,
  FRUIT_FIELD_SOFTNESS,
  prefersReducedMotion,
} from '../config/performance.js'
import { seededRandom } from './ingredientMath.js'

/**
 * Where the fruit field's planes are, and where they are on any given frame.
 *
 * Pure functions of (instance, time, scroll) — no React, no three objects, no
 * clock of its own — so the whole field is reproducible and can be asserted
 * without a renderer, the same way the drink's ingredients are.
 *
 * The camera is Scene.jsx's: fov 40 at z = 5. That fixes how much of the world
 * is on screen at any depth, which is what lets the field fill the frame at
 * every layer instead of being tuned to one distance.
 */

const CAMERA_Z = 5

/** Back to front. The order is also the order instances are dealt out in. */
export const FIELD_LAYERS = ['far', 'mid', 'near']

/** How far behind the cup each layer sits. */
export const FIELD_DEPTH = { far: -7.2, mid: -4.2, near: -1.7 }

/** Apparent size per layer, as a fraction of what a near fruit would be. */
export const FIELD_LAYER_SCALE = { far: 0.52, mid: 0.78, near: 1.12 }

/**
 * A fruit's width, as a fraction of the viewport height, before the layer's own
 * scale. This is the one dial for how busy the background reads. The layer scale
 * and the depth are applied *after* it, and they cancel: a fruit's apparent size
 * is `FIELD_SIZE x FIELD_LAYER_SCALE[layer]` of the screen however far back it
 * sits. 0.18 puts the near layer at a fifth of the screen and the far layer at a
 * tenth, before the per-instance jitter.
 */
export const FIELD_SIZE = 0.18

/**
 * How much larger than the frame the field is dealt out. The spare is what the
 * scroll parallax slides into: deal the field out to exactly one screen and a
 * shifted layer uncovers an empty band at its trailing edge.
 */
export const FIELD_SPREAD = 1.45

/**
 * The radius, in half-frames, of the hole left in the middle. The cup lives
 * there, and fruit behind it only ever fought with it for attention.
 */
export const FIELD_CLEAR = 0.46

/** The slow wander, as a fraction of the frame. */export const FIELD_DRIFT = 0.06

/**
 * The fruit layout. Seeded, so every flavor's field has the *same* fruit in the
 * *same* places — which is what makes a flavor change read as the fruit changing
 * color rather than as a new constellation arriving.
 *
 * @param {number} count     Planes per fruit type.
 * @param {{width: number, height: number}} viewport  World units at z = 0.
 * @param {number} seed
 */
export function buildFieldInstances(count, viewport, seed = 0x5eed) {
  const random = seededRandom(seed)
  const instances = []

  for (let index = 0; index < count; index++) {
    const layer = FIELD_LAYERS[index % FIELD_LAYERS.length]
    const depth = FIELD_DEPTH[layer]

    // How much more world is on screen at this depth than at the cup.
    const reach = (CAMERA_Z - depth) / CAMERA_Z
    const halfWidth = (viewport.width * reach) / 2
    const halfHeight = (viewport.height * reach) / 2

    let x = 0
    let y = 0
    // Rejection sampling, not a placement rule: a fixed exclusion ring reads as
    // a ring. Failures after a few tries are accepted, which only ever puts a
    // fruit somewhere slightly too near the cup.
    for (let attempt = 0; attempt < 12; attempt++) {
      x = (random() * 2 - 1) * halfWidth * FIELD_SPREAD
      y = (random() * 2 - 1) * halfHeight * FIELD_SPREAD
      if (Math.hypot(x / halfWidth, y / halfHeight) >= FIELD_CLEAR) break
    }

    instances.push({
      layer,
      x,
      y,
      z: depth,
      // Depth and layer scale both cancel back out of the *projected* size, so
      // what is left is the apparent size: FIELD_SIZE of the screen, times the
      // layer's scale, times the jitter. Multiplying by reach is what buys the
      // cancellation, and viewport.height is what turns FIELD_SIZE from a world
      // measurement into the fraction of the screen it is documented as.
      size:
        FIELD_SIZE *
        FIELD_LAYER_SCALE[layer] *
        reach *
        viewport.height *
        (0.72 + random() * 0.6),
      rotation: random() * Math.PI * 2,
      /** Radians per second. Slow enough to be felt rather than seen. */
      spin: (random() * 2 - 1) * 0.05,
      driftPhase: random() * Math.PI * 2,
      driftSpeed: 0.04 + random() * 0.05,
      driftAmount: FIELD_DRIFT * reach * (0.5 + random()),
      alpha: FRUIT_FIELD_OPACITY[layer] * (0.7 + random() * 0.3),
      soft: Math.min(0.95, FRUIT_FIELD_SOFTNESS[layer] * (0.85 + random() * 0.3)),
    })
  }

  return instances
}

/**
 * Where one fruit is on this frame.
 *
 * Two motions, both slow: a drift in a small ellipse, and a spin. The parallax
 * is the third term and is not a motion at all — it is the layer's offset for
 * the current scroll, and it is why near layers move further than far ones.
 *
 * @param {object} instance
 * @param {number} time     Seconds.
 * @param {number} scroll   Scroll progress, 0 to 1.
 * @param {{height: number}} viewport
 * @param {{x: number, y: number, z: number, rotation: number}} out
 */
export function fieldPose(instance, time, scroll, viewport, out) {
  const drift = prefersReducedMotion ? 0 : instance.driftAmount

  out.x =
    instance.x + Math.sin(time * instance.driftSpeed + instance.driftPhase) * drift
  out.y =
    instance.y +
    Math.cos(time * instance.driftSpeed * 0.73 + instance.driftPhase) * drift * 1.3 +
    scroll * FRUIT_FIELD_PARALLAX[instance.layer] * viewport.height
  out.z = instance.z
  out.rotation =
    instance.rotation + (prefersReducedMotion ? 0 : time * instance.spin)

  return out
}
