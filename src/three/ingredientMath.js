import {
  drinkFloorY,
  drinkRadiusAt,
  drinkSurfaceY,
  drinkTopRadius,
  glassRadiusAt,
} from './liquidProfile.js'

/**
 * Everything the ingredients do, as pure functions.
 *
 * Two rules shape this file:
 *
 *  1. Nothing here reads a clock or a store. Time and scroll arrive as
 *     arguments, so scripts/verify-ingredients.mjs can sweep both and assert
 *     on the results without a renderer.
 *  2. The scroll-driven part of every ingredient is a closed-form function of
 *     scroll progress. That is what makes the build rewind exactly when the
 *     user scrolls back up, the same guarantee the shatter has.
 *
 * Time-driven motion (the climb, the bob, the sway) is deliberately separate:
 * it keeps running either way, and only its opacity or scale is scroll-gated.
 */

/**
 * Scroll progress at which the build finishes. The four ingredients play out
 * over 0..BUILD_END. At 0.15 on this seven-section page the whole build got
 * about 0.9 of a viewport, split four ways, which is a flick of the thumb;
 * 0.25 gives each stage roughly 0.37 of a viewport.
 */
export const BUILD_END = 0.25

/**
 * Reveal windows, as fractions of BUILD_END, in the order they appear:
 * bubbles fade in, ice drops in, mint arrives, then fruit. They overlap, so
 * the build reads as one pour rather than four cuts.
 */
export const REVEAL = {
  bubbles: [0.0, 0.2],
  ice: [0.18, 0.5],
  mint: [0.46, 0.76],
  fruit: [0.74, 1.0],
}

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value)

/**
 * How far an ingredient has appeared, 0 to 1, at a given scroll progress.
 *
 * @param {number} progress Whole-page scroll progress from the store.
 * @param {number[]} window  [start, end] as fractions of BUILD_END.
 */
export function revealAt(progress, window) {
  const [start, end] = window
  const t = clamp01((progress / BUILD_END - start) / (end - start))
  return t * t * (3 - 2 * t)
}

/**
 * Deterministic RNG. Every layout is seeded, so the drink is identical on
 * every load and the verifier can reproduce whatever the browser draws.
 */
export function seededRandom(seed) {
  let state = seed >>> 0 || 1
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
}

// --------------------------------------------------------------------- bubbles

/** Sphere radii, as a fraction of the glass height. */
const BUBBLE_MIN_SIZE = 0.004
const BUBBLE_MAX_SIZE = 0.009

const RISE_SPAN = drinkSurfaceY - drinkFloorY

/** @returns {object[]} Precomputed per-bubble randomness. */
export function buildBubbles(count, seed = 0x51ee7) {
  const random = seededRandom(seed)
  const bubbles = []

  for (let i = 0; i < count; i++) {
    bubbles.push({
      size: BUBBLE_MIN_SIZE + random() * (BUBBLE_MAX_SIZE - BUBBLE_MIN_SIZE),
      angle: random() * Math.PI * 2,
      /** Where each bubble is along its climb when the clock starts. */
      phase: random(),
      /** Column heights per second, so a climb takes 3.4s to 7.1s. */
      speed: 0.14 + random() * 0.3,
      /** Fraction of the radius left at this height that the bubble keeps to. */
      radialFrac: 0.2 + random() * 0.68,
      wobbleSpeed: 0.8 + random() * 1.6,
      wobblePhase: random() * Math.PI * 2,
    })
  }

  return bubbles
}

/**
 * Where a bubble is at time t. Time-driven only: the climb loops forever and
 * never depends on scroll, so scrolling cannot yank a bubble sideways.
 */
export function bubblePosition(bubble, t, motion = 1) {
  const climb = (bubble.phase + t * bubble.speed) % 1

  // Keep the whole sphere between the floor and the surface, so the radius
  // lookup below never runs off the end of the profile.
  const y = drinkFloorY + bubble.size + climb * (RISE_SPAN - bubble.size * 2)

  // The single hard constraint: the sphere has to fit inside the drink.
  const limit = Math.max(drinkRadiusAt(y) - bubble.size, 0)
  const wobble = Math.sin(t * bubble.wobbleSpeed + bubble.wobblePhase) * 0.09 * motion
  const radial = limit * Math.min(bubble.radialFrac + wobble, 1)
  const angle =
    bubble.angle +
    Math.sin(t * bubble.wobbleSpeed * 0.6 + bubble.angle) * 0.22 * motion

  return { x: Math.cos(angle) * radial, y, z: Math.sin(angle) * radial }
}

// ------------------------------------------------------------------------- ice

/** Ice floats half-submerged, so its centre sits just under the surface. */
export const ICE_SUBMERGE = 0.012

/** How far above its resting place a cube starts, in glass heights. */
export const ICE_DROP_HEIGHT = 0.55

/**
 * A cube's corner reach from its centre. Ice is yawed and tilted, so the
 * diagonal of the cube is the honest number to fit, not its edge.
 */
export const cubeReach = (size) => size * 0.866

/** @returns {object[]} Precomputed per-cube randomness, already inside the bowl. */
export function buildIce(count, seed = 0x1ce, surfaceY = drinkSurfaceY) {
  const random = seededRandom(seed)
  const restY = surfaceY - ICE_SUBMERGE
  const cubes = []

  for (let i = 0; i < count; i++) {
    const size = 0.038 + random() * 0.014
    const usable = Math.max(drinkRadiusAt(restY) - cubeReach(size), 0)

    cubes.push({
      size,
      restY,
      angle: (i / count) * Math.PI * 2 + random() * 0.6,
      radius: usable * (0.18 + random() * 0.72),
      /** Where this cube enters its own drop, in reveal units. */
      delay: random() * 0.3,
      spin: (random() - 0.5) * 0.9,
      tilt: (random() - 0.5) * 0.6,
    })
  }

  return cubes
}

/** Standard ease-out bounce: 0 at 0, exactly 1 at 1. */
export function easeOutBounce(t) {
  const n = 7.5625
  const d = 2.75

  if (t < 1 / d) return n * t * t
  if (t < 2 / d) {
    const x = t - 1.5 / d
    return n * x * x + 0.75
  }
  if (t < 2.5 / d) {
    const x = t - 2.25 / d
    return n * x * x + 0.9375
  }

  const x = t - 2.625 / d
  return n * x * x + 0.984375
}

/**
 * Fall, land and bob for one cube. The fall is a closed-form function of
 * reveal, so scrolling up lifts the cube back out of the glass.
 */
export function iceState(cube, reveal, t, motion = 1) {
  const local = clamp01((reveal - cube.delay) / (1 - cube.delay))
  const landed = easeOutBounce(local)
  const appear = clamp01(local * 5)
  const bob = Math.sin(t * 0.9 + cube.angle * 2) * 0.006 * local * motion

  return {
    x: Math.cos(cube.angle) * cube.radius,
    y: cube.restY + (1 - landed) * ICE_DROP_HEIGHT + bob,
    z: Math.sin(cube.angle) * cube.radius,
    scale: appear * appear * (3 - 2 * appear),
    spin: cube.spin * local,
    tilt: cube.tilt * local,
  }
}

// ------------------------------------------------------------------------ mint

/** Leaves lie flat on the surface, a hair above it so they are not z-fought. */
export const MINT_SURFACE_OFFSET = 0.004

/** @returns {object[]} Precomputed per-leaf randomness, inside the bowl mouth. */
export function buildMint(count, seed = 0x3a17) {
  const random = seededRandom(seed)
  const y = drinkSurfaceY + MINT_SURFACE_OFFSET
  const leaves = []

  for (let i = 0; i < count; i++) {
    const length = 0.046 + random() * 0.016
    // Bounded by the surface, not the glass, so the leaves read as floating on
    // the drink. drinkRadiusAt(y) would be 0 here: y is above the surface.
    const usable = Math.max(drinkTopRadius - length * 0.5, 0)

    leaves.push({
      length,
      y,
      angle: random() * Math.PI * 2,
      radius: usable * (0.15 + random() * 0.75),
      heading: random() * Math.PI * 2,
      delay: random() * 0.35,
      sway: 0.5 + random() * 0.7,
      swayPhase: random() * Math.PI * 2,
      tilt: (random() - 0.5) * 0.5,
    })
  }

  return leaves
}

/** Mint is muddled rather than dropped, so it grows in where it lies. */
export function mintState(leaf, reveal, t, motion = 1) {
  const local = clamp01((reveal - leaf.delay) / (1 - leaf.delay))
  const appear = clamp01(local * 3)
  const scale = appear * appear * (3 - 2 * appear)
  const swing = Math.sin(t * leaf.sway + leaf.swayPhase) * motion

  return {
    x: Math.cos(leaf.angle) * leaf.radius,
    z: Math.sin(leaf.angle) * leaf.radius,
    y: leaf.y + swing * 0.004 * scale,
    scale,
    heading: leaf.heading + swing * 0.22 * scale,
    tilt:
      leaf.tilt + Math.sin(t * leaf.sway * 0.5 + leaf.heading) * 0.12 * scale * motion,
  }
}

// ----------------------------------------------------------------------- fruit

/**
 * Where the slice sits. Just above the liquid (0.900) and well below the rim
 * (1.0), so it reads as fruit dropped on top of the drink. The bowl's interior
 * radius here is 0.158, and the tilt adds at most 0.02 of height, so the
 * tallest flavor still clears the rim.
 */
export const FRUIT_Y = 0.918
export const FRUIT_TILT = 0.2

/** Enough room at FRUIT_Y, with the tilt, for every flavor's slice. */
export const FRUIT_MAX_RADIUS = glassRadiusAt(FRUIT_Y) * 0.78

/** Spring for the flavor swap: ~0.5s, with one small overshoot. */
export const FRUIT_SPRING = { stiffness: 170, damping: 13 }
