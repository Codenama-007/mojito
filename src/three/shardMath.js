import * as THREE from 'three'

/**
 * The shatter, as pure maths. Nothing here integrates velocity over time or
 * keeps accumulated state, which is the whole reason the burst rewinds
 * exactly when the user scrolls back up: every value is a function of
 * breakProgress alone.
 */

/** breakProgress at which the intact glass swaps for the shards. */
export const BREAK_START = 0.3
export const GRAVITY = -1.15
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
 * Precomputed once per scene: origin inside the glass, launch direction,
 * speed, spin axis and rate, size, and stagger delay.
 * @param {number} count
 * @param {number} [seed]
 */
export function buildShards(count, seed = 20261018) {
  const random = makeRandom(seed)
  const shards = []

  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2
    const radius = 0.08 + random() * 0.3

    const axis = new THREE.Vector3(
      random() - 0.5,
      random() - 0.5,
      random() - 0.5,
    )
    // A zero axis would produce a non-unit quaternion, so fall back.
    if (axis.lengthSq() < 1e-6) axis.set(1, 0, 0)
    axis.normalize()

    shards.push({
      origin: new THREE.Vector3(
        Math.cos(angle) * radius,
        (random() - 0.5) * 0.78,
        Math.sin(angle) * radius,
      ),
      // Outward and upward, so the burst opens away from the glass.
      dir: new THREE.Vector3(
        Math.cos(angle) * (0.6 + random() * 0.7),
        0.35 + random() * 0.9,
        Math.sin(angle) * (0.6 + random() * 0.7),
      ).normalize(),
      speed: 0.9 + random() * 1.5,
      axis,
      spin: (random() - 0.5) * 9,
      scale: 0.22 + random() * 0.34,
      delay: random() * MAX_DELAY,
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
  out.y += 0.5 * GRAVITY * ti * ti
  return out
}

/** Rotation this shard has picked up by time ti. */
export function shardRotation(shard, ti, out) {
  return out.setFromAxisAngle(shard.axis, shard.spin * ti)
}

/** Fades to nothing by the end of the burst. */
export const shardFade = (ti) => 1 - ti
