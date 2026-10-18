import { cupModel } from '../config/cupProfile.js'
import {
  drinkBoundAt,
  drinkFloorY,
  drinkRadiusAt,
  drinkSurfaceY,
} from './liquidProfile.js'
import { LEAF_HALF_LENGTH, LEAF_HALF_WIDTH_MAX } from './leafGeometry.js'

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

/** Sphere radii, as a fraction of the cup height. */
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

// ---------------------------------------------------------------- wall bubbles

/**
 * A film of bubbles stuck to the inside of the wall.
 *
 * Phase 5's bubbles all climbed, which reads as a fizzy drink and nothing else.
 * A real one also has bubbles gripping the plastic — and, in a cup with the
 * mint packed against the wall, gripping the mint — and that film is most of
 * what separates "carbonated" from "just poured".
 *
 * Smaller than the climbing bubbles on purpose: this is a film, not a second
 * fizz. The two sets share no layout code because they do different jobs.
 */
const WALL_MIN_SIZE = 0.0035
const WALL_MAX_SIZE = 0.0075

/** Peak shimmer, as a fraction of a bubble's own radius. */
const WALL_SHIMMER = 0.16

export function buildWallBubbles(count, seed = 0xb0b1) {
  const random = seededRandom(seed)
  const bubbles = []
  const span = drinkSurfaceY - drinkFloorY

  for (let i = 0; i < count; i++) {
    const size = WALL_MIN_SIZE + random() * (WALL_MAX_SIZE - WALL_MIN_SIZE)

    bubbles.push({
      size,
      /**
       * The radius to keep clear of the wall, which is not `size`: a shimmering
       * bubble is briefly a sixth bigger than its resting self, and the bug this
       * avoids is a bubble that pokes through the plastic once a second.
       */
      reach: size * (1 + WALL_SHIMMER),
      y: drinkFloorY + 0.05 + random() * (span - 0.1),
      angle: random() * Math.PI * 2,
      /** Right out at the wall, so the sphere touches it rather than hovers. */
      radialFrac: 0.93 + random() * 0.07,
      /** How much of its cycle it spends gripping rather than letting go. */
      grip: 0.55 + random() * 0.35,
      /** Cycles per second: a bubble lets go somewhere between 8s and 20s. */
      rate: 0.05 + random() * 0.07,
      phase: random(),
      shimmerSpeed: 1.1 + random() * 1.9,
      shimmerPhase: random() * Math.PI * 2,
    })
  }

  return bubbles
}

/**
 * Where one clinging bubble is, and how big.
 *
 * One phase per bubble decides whether it is gripping or climbing, so there is
 * no per-bubble state to get out of step when the user scrolls, and reduced
 * motion freezes the whole cycle by scaling the rate to zero — the film still
 * exists, it just stops letting go.
 */
export function wallBubbleState(bubble, t, motion = 1) {
  const cycle = (t * bubble.rate * motion + bubble.phase) % 1
  const gripping = cycle < bubble.grip
  const rise = gripping ? 0 : (cycle - bubble.grip) / (1 - bubble.grip)
  const y = bubble.y + rise * (drinkSurfaceY - bubble.y)

  // The cup widens upward, so a bubble climbing the wall follows it outward.
  const limit = Math.max(drinkRadiusAt(Math.min(y, drinkSurfaceY - 0.002)) - bubble.reach, 0)
  const radial = limit * bubble.radialFrac

  const shimmer =
    motion === 0 ? 1 : 1 + Math.sin(t * bubble.shimmerSpeed + bubble.shimmerPhase) * 0.16

  // A bubble that reaches the top pops rather than arriving at full size.
  const pop = rise > 0.85 ? (1 - rise) / 0.15 : 1

  return {
    x: Math.cos(bubble.angle) * radial,
    y,
    z: Math.sin(bubble.angle) * radial,
    scale: bubble.size * shimmer * pop,
  }
}

// -------------------------------------------------------------------------- ice

/** Ice floats half-submerged, so its centre sits just under the surface. */
export const ICE_SUBMERGE = 0.012

/**
 * How far above its resting place a cube starts, in cup heights.
 *
 * Phase 5 dropped them from well above the rim, which was fine when the cup was
 * open. Phase 7 puts a lid on it, so the drop now starts just under the rim:
 * ice has to appear *inside* the cup or it falls through the plastic.
 */
export const ICE_DROP_HEIGHT = 0.13

/** Small cubes, because the mint is what the upper half of the cup is for. */
const ICE_MIN_SIZE = 0.03
const ICE_MAX_SIZE = 0.041

/**
 * A cube's corner reach from its centre. Ice is yawed and tilted, so the
 * diagonal of the cube is the honest number to fit, not its edge.
 */
export const cubeReach = (size) => size * 0.866

/** @returns {object[]} Precomputed per-cube randomness, already inside the cup. */
export function buildIce(count, seed = 0x1ce, surfaceY = drinkSurfaceY) {
  const random = seededRandom(seed)
  const restY = surfaceY - ICE_SUBMERGE
  const cubes = []

  for (let i = 0; i < count; i++) {
    const size = ICE_MIN_SIZE + random() * (ICE_MAX_SIZE - ICE_MIN_SIZE)
    const usable = Math.max(drinkRadiusAt(restY) - cubeReach(size), 0)

    cubes.push({
      size,
      restY,
      angle: (i / count) * Math.PI * 2 + random() * 0.6,
      /** Held well inside the wall, so the mint can sit in front of it. */
      radius: usable * (0.12 + random() * 0.5),
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
 * reveal, so scrolling up lifts the cube back out of the drink.
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

// ------------------------------------------------------------------------- mint

/**
 * Mint is packed, not floated.
 *
 * Phase 5 laid a handful of leaves flat on the surface, which was right for a
 * stemmed glass you look down into: the surface *was* the show. A takeaway cup
 * is a wall you look through, so the leaves are pressed flat against the inside
 * of the wall and stacked up the upper half of the drink — which is also how a
 * mojito cup is actually built. Muddle the mint, then wedge it against the
 * side.
 *
 * A leaf standing against a cone wall is not standing vertically. Its face lies
 * in the wall's tangent plane, so it leans by exactly the wall's own angle
 * (`cupModel.wallLean`); get that wrong by a few degrees and the leaves either
 * poke through the plastic or visibly hover off it.
 */
export const MINT_Y_MIN = 0.55
export const MINT_Y_MAX = 0.84

/** How far out a leaf sits, as a fraction of the room it has. */
const MINT_WALL_MIN = 0.88
const MINT_WALL_MAX = 1.0

/**
 * The furthest a leaf's own surface can stray from its centre, radially.
 *
 * A leaf's plane ends up nearly vertical and nearly tangential, so almost all
 * of its radial thickness comes from the cone's lean rather than from its own
 * width. Written out rather than sampled because `buildMint` has to subtract it
 * *before* it knows where the leaf goes.
 *
 * Both constants come from leafGeometry.js rather than being restated here: this
 * is a bound on the outline, and a bound that disagrees with the outline by a
 * few percent is exactly how a leaf ends up through the plastic.
 */
const leafReach = (length) =>
  Math.sin(cupModel.wallLean) * length * (LEAF_HALF_LENGTH + LEAF_HALF_WIDTH_MAX)

/** @returns {object[]} Precomputed per-leaf randomness, all inside the drink. */
export function buildMint(count, seed = 0x3a17) {
  const random = seededRandom(seed)
  const leaves = []

  for (let i = 0; i < count; i++) {
    const length = 0.085 + random() * 0.05
    const y = MINT_Y_MIN + random() * (MINT_Y_MAX - MINT_Y_MIN)

    /**
     * The room is what the *drink* leaves, not what the cup does: a leaf in the
     * gap between the liquid and the wall would be floating in nothing.
     *
     * Sampled at the leaf's own foot rather than at its centre, because the cup
     * widens upward and the drink's own surface caps the radius above the fill
     * line — so the tightest constraint on a leaf standing in the upper half is
     * the wall below it, not the wall behind it. The extra 0.004 is the sway.
     */
    const foot = y - LEAF_HALF_LENGTH * length - 0.004
    const room = Math.max(drinkBoundAt(foot) - leafReach(length), 0)

    leaves.push({
      length,
      y,
      angle: (i / count) * Math.PI * 2 + random() * 1.1,
      /** 0.88 to 1.0 of the room: stacked, but all but touching the wall. */
      radius: room * (MINT_WALL_MIN + random() * (MINT_WALL_MAX - MINT_WALL_MIN)),
      /** Roll in the leaf's own plane, so no two read the same side on. */
      roll: (random() - 0.5) * 1.1,
      delay: random() * 0.35,
      sway: 0.5 + random() * 0.7,
      swayPhase: random() * Math.PI * 2,
    })
  }

  return leaves
}

/**
 * Where one leaf is and how it is turned.
 *
 * The heading is `PI/2 - angle`, not `angle`: a leaf's normal is its local +Z,
 * so turning the *normal* onto the wall's radial direction is what lays it
 * flat. Turning its length instead stands it on edge, like a coin in a slot.
 */
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
    heading: Math.PI / 2 - leaf.angle,
    lean: cupModel.wallLean,
    roll: leaf.roll + swing * 0.12 * scale,
  }
}

// ------------------------------------------------------------------------ fruit

/**
 * The slices are wedged against the wall near the top, not floated in the
 * middle (the brief, item 7).
 *
 * Their centres sit between these two heights. A slice is a disc of radius
 * ~0.09 whose plane ends up vertical, so it spans roughly +/- 0.09 in height —
 * which is what actually has to clear the rim above and the midpoint of the
 * drink below, and why the band is narrower than it looks.
 */
export const FRUIT_Y_MIN = 0.72
export const FRUIT_Y_MAX = 0.84

/** The wall's own lean. A slice pressed to the cone has to follow it. */
export const FRUIT_LEAN = cupModel.wallLean

/** Gap held between a slice and the interior wall, so it never pokes through. */
export const FRUIT_GAP = 0.012

/** Spring for the flavor swap: ~0.5s, with one small overshoot. */
export const FRUIT_SPRING = { stiffness: 170, damping: 13 }
