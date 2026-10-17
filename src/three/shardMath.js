import * as THREE from 'three'

/**
 * The shatter, as pure maths. Nothing here integrates velocity over time or
 * keeps accumulated state, which is the whole reason the burst rewinds
 * exactly when the user scrolls back up: every value is a function of
 * breakProgress alone.
 *
 * Coordinates. The shards are siblings of the glass inside one group, so they
 * share the glass's local space: y runs 0 at the base to 1 at the rim, centred
 * on x/z. Phase 3B put shard origins at y -0.39..0.39, which is a *centred*
 * space; the glass is not, so half the burst started below the glass and the
 * rest entered it from underneath. Origins now come from points measured on
 * the real mesh (config/glassProfile.js), which are already in this space.
 *
 * Scale. Sizes, speeds and gravity are all multiplied by the glass's width, so
 * the burst keeps its proportions if the model is replaced.
 */

/** breakProgress at which the intact glass swaps for the shards. */
export const BREAK_START = 0.3

/** Downward acceleration per unit of glass width, per unit of t squared. */
export const GRAVITY_PER_WIDTH = -1.15

export const MAX_DELAY = 0.22

/** @param {number} value */
export const clamp01 = (value) => Math.min(Math.max(value, 0), 1)

/**
 * Seeded RNG, so the shards are identical on every reload and the reversal
 * can be asserted deterministically.
 * @param {number} seed
 */
export function makeRandom(seed) {
  let state = seed >>> 0
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

/**
 * Precomputed once per scene: origin on the glass surface, launch direction,
 * speed, spin axis and rate, size, stagger delay, and the gravity that applies
 * to this shard.
 *
 * @param {number} count
 * @param {object} [options]
 * @param {number[][]} [options.spawns]  Surface points in glass local space.
 * @param {number} [options.width]       Glass width (diameter) in local units.
 * @param {number} [options.seed]
 */
export function buildShards(count, { spawns = [[0, 0.5, 0]], width = 1, seed = 20261018 } = {}) {
  const random = makeRandom(seed)
  const shards = []

  for (let i = 0; i < count; i++) {
    // Spread the picks evenly over the spawn list rather than repeating the
    // first `count` entries, so mobile (fewer shards) still covers the glass.
    const source = spawns[Math.floor((i * spawns.length) / count)]

    const origin = new THREE.Vector3(source[0], source[1], source[2])

    // Blow outward from the axis. Shards picked near the stem sit on the axis,
    // where there is no radial direction to use, so those get a random heading.
    const fallbackAngle = random() * Math.PI * 2
    const radial = new THREE.Vector3(origin.x, 0, origin.z)
    if (radial.lengthSq() < 1e-8) {
      radial.set(Math.cos(fallbackAngle), 0, Math.sin(fallbackAngle))
    }
    radial.normalize()

    const axis = new THREE.Vector3(
      random() - 0.5,
      random() - 0.5,
      random() - 0.5,
    )
    // A zero axis would produce a non-unit quaternion, so fall back.
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0)
    axis.normalize()

    shards.push({
      origin,
      // Outward and upward, so the burst opens away from the glass.
      dir: new THREE.Vector3(
        radial.x * (0.6 + random() * 0.7),
        0.35 + random() * 0.9,
        radial.z * (0.6 + random() * 0.7),
      ).normalize(),
      speed: width * (1.4 + random() * 2.2),
      axis,
      spin: (random() - 0.5) * 9,
      scale: width * (0.14 + random() * 0.22),
      delay: random() * MAX_DELAY,
      gravity: GRAVITY_PER_WIDTH * width,
    })
  }

  return shards
}

/** 0..1 across the break itself, so 0.3 maps to 0 and 1.0 maps to 1. */
export const progressToT = (breakProgress) =>
  clamp01((breakProgress - BREAK_START) / (1 - BREAK_START))

/** Per-shard time, after that shard's stagger delay. */
export const shardTi = (shard, t) =>
  shard.delay >= 1 ? 1 : clamp01((t - shard.delay) / (1 - shard.delay))

/**
 * Closed-form ballistic offset for one shard.
 * @param {object} shard
 * @param {number} ti
 * @param {THREE.Vector3} out
 */
export function shardDisplacement(shard, ti, out) {
  out.copy(shard.origin).addScaledVector(shard.dir, shard.speed * ti)
  out.y += 0.5 * shard.gravity * ti * ti
  return out
}

/** Rotation this shard has picked up by time ti. */
export function shardRotation(shard, ti, out) {
  return out.setFromAxisAngle(shard.axis, shard.spin * ti)
}

/** Fades to nothing by the end of the burst. */
export const shardFade = (ti) => 1 - ti
