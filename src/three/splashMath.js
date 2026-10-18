import { lidModel } from '../config/cupProfile.js'
import { seededRandom } from './ingredientMath.js'

/**
 * The juice splash, as pure functions of a burst age.
 *
 * The droplets are ballistic in closed form — origin + v*t + g*t*t/2 — rather
 * than integrated frame by frame. It is the same motion and the same
 * precomputed random velocities the brief asks for, but a dropped frame cannot
 * change where a droplet lands, and the verifier can ask what the splash looks
 * like at any age without simulating up to it. No physics library is involved
 * (AGENTS.md section 2).
 *
 * One burst, one age: every droplet in a burst shares a start time, which is
 * what makes a single material opacity the exact fade for all of them at once.
 */

/**
 * The splash leaves the lid, not the liquid surface.
 *
 * Phase 6A fired it off the open rim, which read as a drink being poured. The
 * cup has a dome lid now, so the juice comes out from around the lid's flange —
 * exactly where it would if you squeezed the cup — and starts at the lid's own
 * radius rather than the cup's. `lidModel.baseY` is the bottom of the dome,
 * i.e. the flange line, which is the last place liquid could escape.
 */
export const RIM_Y = lidModel.baseY
export const RIM_RADIUS = lidModel.radius

/** Seconds. After BURST_LIFE the burst is over and stays over. */
export const BURST_LIFE = 1.2

/** Seconds. The crown is a flick at the start of the burst, not its whole life. */
export const RING_LIFE = 0.62

/** Glass heights per second squared. Tuned so droplets peak about mid-flight. */
export const GRAVITY = 2.2

/** How far the crown grows past the rim by the time it fades. */
const RING_GROWTH = 1.5

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value)

/**
 * The droplets for one burst.
 *
 * Velocities are aimed outward as well as up, so the spray opens over the rim
 * like a jet rather than going straight up like a fountain.
 *
 * @returns {object[]} Precomputed per-droplet randomness.
 */
export function buildBurst(count, seed = 0x5a15) {
  const random = seededRandom(seed)
  const droplets = []

  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2
    /**
     * Tighter than Phase 6A's 0.1..0.56, because the lid is a wider launch
     * point than the old rim was (0.311 against 0.145). The same outward speed
     * from a radius twice the size throws droplets twice as far out, and the
     * spray stops reading as a splash and starts reading as a shower.
     */
    const outward = 0.1 + random() * 0.42

    droplets.push({
      angle,
      vx: Math.cos(angle) * outward,
      vz: Math.sin(angle) * outward,
      vy: 0.8 + random() * 0.9,
      /**
       * In glass units. On a phone a flavor section draws the glass at about
       * 0.65 world units, so 0.009 to 0.02 is a droplet roughly 3 to 6 pixels
       * across — the floor for something meant to be seen moving.
       */
      size: 0.009 + random() * 0.011,
      /** A small stagger, so the burst opens rather than firing as one shell. */
      delay: random() * 0.1,
      /** 0 keeps the flavor's liquid colour; 1 takes the lighter splashTint. */
      tint: random() < 0.45 ? 1 : 0,
    })
  }

  return droplets
}

/**
 * Where one droplet is `age` seconds into the burst, and how big.
 *
 * The droplet's own life is BURST_LIFE minus its delay, so the last one to
 * leave is not cut off early by the mesh being hidden.
 */
export function burstDropletState(droplet, age) {
  const local = age - droplet.delay
  const life = BURST_LIFE - droplet.delay
  const t = local / life

  if (t <= 0 || t >= 1) {
    return { x: 0, y: 0, z: 0, scale: 0, alive: false }
  }

  return {
    x: Math.cos(droplet.angle) * RIM_RADIUS + droplet.vx * local,
    y: RIM_Y + droplet.vy * local - 0.5 * GRAVITY * local * local,
    z: Math.sin(droplet.angle) * RIM_RADIUS + droplet.vz * local,
    /**
     * A quick grow, then a long shrink. The shrink is the fade: at droplet size
     * a sphere that vanishes in place reads as a dropped frame, and one that
     * shrinks reads as a drop of juice.
     */
    scale: droplet.size * (t < 0.12 ? t / 0.12 : 1 - (t - 0.12) / 0.88),
    alive: true,
  }
}

/**
 * Opacity for the whole burst. Exact rather than approximate, because every
 * droplet in a burst shares one age.
 */
export function burstFade(age) {
  return 1 - clamp01((age - BURST_LIFE * 0.45) / (BURST_LIFE * 0.55))
}

/**
 * The crown: one thin wall of juice that expands off the rim and fades.
 *
 * A wall rather than a flat ring, because the camera sits level with the middle
 * of the glass and looks nearly edge-on at anything lying in the rim's plane.
 */
export function ringState(age) {
  const t = clamp01(age / RING_LIFE)

  return {
    radius: RIM_RADIUS * (1 + t * RING_GROWTH),
    opacity: (1 - t) * 0.8,
    alive: t < 1,
  }
}

/**
 * The few droplets that hang near the fruit while a flavor section is on
 * screen. Not a burst: they drift, and their size swells and shrinks slowly.
 *
 * @returns {object[]} Precomputed per-droplet randomness.
 */
export function buildAmbient(count, seed = 0xa6b1) {
  const random = seededRandom(seed)
  const droplets = []

  for (let i = 0; i < count; i++) {
    droplets.push({
      angle: random() * Math.PI * 2,
      /** Just inside the fruit's orbit, so they read as spray off it. */
      radius: 0.42 + random() * 0.34,
      y: 0.34 + random() * 0.5,
      speed: (random() < 0.5 ? -1 : 1) * (0.12 + random() * 0.22),
      bob: 0.025 + random() * 0.05,
      bobSpeed: 0.35 + random() * 0.5,
      bobPhase: random() * Math.PI * 2,
      pulsePhase: random() * Math.PI * 2,
      pulseSpeed: 0.12 + random() * 0.3,
      size: 0.006 + random() * 0.008,
      drift: 0.1 + random() * 0.2,
      /** 0 keeps the flavor's liquid colour; 1 takes the lighter splashTint. */
      tint: random() < 0.5 ? 1 : 0,
    })
  }

  return droplets
}

/**
 * Where one drifting droplet is.
 *
 * Reduced motion pins the swell to a constant: the droplets still exist and
 * still sit near the fruit, they just stop pulsing in and out.
 */
export function ambientState(droplet, time, motion = 1, progress = 0) {
  const angle =
    droplet.angle +
    time * droplet.speed * motion +
    progress * Math.PI * 2 * droplet.drift

  const y =
    droplet.y +
    Math.sin(time * droplet.bobSpeed + droplet.bobPhase) * droplet.bob * motion

  const pulse =
    motion === 0
      ? 0.6
      : 0.5 + 0.5 * Math.sin(time * droplet.pulseSpeed * 6 + droplet.pulsePhase)

  return {
    x: Math.cos(angle) * droplet.radius,
    y,
    z: Math.sin(angle) * droplet.radius,
    /** Never fully gone: they thin out rather than blinking off. */
    scale: droplet.size * (0.35 + 0.65 * pulse),
  }
}
