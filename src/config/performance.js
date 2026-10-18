/**
 * Quality tier, detected once at load and read from the store.
 * Rules this enforces (AGENTS.md section 5):
 *   - dpr capped at 1.5 on mobile, 2 on desktop.
 *   - Tier is decided once, not re-negotiated while the app runs.
 *   - No real-time shadows on mobile.
 *
 * Everything that differs by tier lives in the `quality` object below, so no
 * component has to ask which device it is running on.
 */

export const QUALITY_TIER = {
  MOBILE: 'mobile',
  DESKTOP: 'desktop',
}

function detectQualityTier() {
  if (typeof window === 'undefined') return QUALITY_TIER.MOBILE

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches
  const narrowScreen = window.matchMedia('(max-width: 768px)').matches

  return coarsePointer || narrowScreen
    ? QUALITY_TIER.MOBILE
    : QUALITY_TIER.DESKTOP
}

export const qualityTier = detectQualityTier()

export const isMobile = qualityTier === QUALITY_TIER.MOBILE

/** Degrees to radians. The pose constants below are in degrees so they read. */
export const toRadians = (degrees) => (degrees * Math.PI) / 180

/**
 * The cup's resting lean. Phase 7 asks for a cup set down at an angle rather
 * than stood to attention, which is most of what stops it reading as a
 * product-render turntable.
 *
 * Z is the visible lean across the screen and X tips it towards the camera,
 * which is what shows the lid's ellipse. In degrees, so they can be nudged by
 * eye.
 *
 * Z is *negative* because Phase 8A asks for the cup to lean to the right: in
 * three.js a positive Z rotation swings +X towards +Y, so it tips the top of
 * the cup to the left, and the sign has to flip to lean it the other way.
 */
export const CUP_TILT_Z = -10
export const CUP_TILT_X = 4

/**
 * A slow idle rock added on top of the tilt, plus or minus, in degrees. Fades
 * out as the shatter approaches so the burst happens on a steady cup.
 */
export const CUP_SWAY = 1.5

/**
 * Phase 8A. How much of the viewport height the whole cup may occupy — body,
 * lid, straw and all — measured after the tilt.
 *
 * A ceiling, not a target: the cup is only ever scaled *down* to meet it, so
 * the sections keep the sizes they were tuned to and this exists purely to stop
 * the straw riding off the top of a short screen.
 */
export const CUP_FIT = { mobile: 0.62, desktop: 0.72 }

/**
 * Phase 8A. The closest the top of the straw may come to the top edge, as a
 * fraction of the viewport height. The navbar is taller than this on most
 * phones, so on mobile the navbar wins (see NAVBAR_HEIGHT_PX).
 */
export const CUP_TOP_CLEARANCE = 0.08

/**
 * The navbar's height in CSS pixels — `--nav-h` in index.css. Duplicated here
 * only because the clamp works in world units and needs the conversion at the
 * point of use; if the two ever disagree the navbar simply gets a little more
 * room than it needs.
 */
export const NAVBAR_HEIGHT_PX = 64

/**
 * How far down the screen the cup sits on mobile, as a fraction of the viewport
 * height. Positive moves it down.
 *
 * Folded in from the (unbuilt) Phase 6B brief, item 2: at 360-390px the mobile
 * targets park the cup high enough that the flavour copy crowds its foot, and
 * the cure is to move the cup rather than shrink the type.
 */
export const MOBILE_GLASS_Y_OFFSET = 0.11

/**
 * Phase 8B. The fruit field behind the cup.
 *
 * `far` / `mid` / `near` are the most opaque a fruit in that layer is allowed
 * to be, and `overlay` is the flat dark wash over the whole page that keeps body
 * copy legible on top of a field of bright fruit. These four are the numbers the
 * brief names, and they are the ones to tune if the background reads too busy or
 * too flat.
 */
export const FRUIT_FIELD_OPACITY = {
  far: 0.25,
  mid: 0.4,
  near: 0.55,
  overlay: 0.15,
}

/**
 * How far out of focus each layer reads, as the fraction of a fruit's radius
 * over which its edge fades out. A far fruit has no hard silhouette at all; a
 * near one is only just soft.
 */
export const FRUIT_FIELD_SOFTNESS = { far: 0.92, mid: 0.6, near: 0.34 }

/**
 * How far towards the top of the screen each layer drifts as the page scrolls,
 * as a fraction of the viewport height. Near layers move further, which is what
 * makes the field read as having depth rather than as one flat picture.
 */
export const FRUIT_FIELD_PARALLAX = { far: 0.03, mid: 0.07, near: 0.11 }

/**
 * A flavor change, as one thing rather than three.
 *
 * The whole background moves together: the outgoing base color and the outgoing
 * fruit field both slide out to one side while the incoming pair slides in from
 * the other. Driving the CSS and the frame loop from one duration and one linear
 * schedule is what keeps the two in step — the fruit is painted on the color, so
 * a drift between them would be visible as the fruit sliding over its own base.
 *
 * Linear, deliberately. Any easing would have to be implemented twice, once in
 * the keyframes and once in `Field`'s frame loop, and two easing curves that
 * are meant to match but do not is a worse look than a wipe that is merely
 * even. Change `FLAVOR_PUSH` freely; change the easing in one place only at
 * your peril.
 *
 * `FLAVOR_PUSH_DISTANCE` is how far each layer travels, as a fraction of the
 * viewport width, and 1 is exactly off-screen. The cup's spin runs a little
 * longer than the push, so the spin settles after the background has landed
 * rather than with it.
 */
export const FLAVOR_PUSH = 0.8

export const FLAVOR_PUSH_DISTANCE = 1

/** Seconds for the cup's one full turn on a flavor change. */
export const FLAVOR_SPIN = 0.9

/**
 * How far the page darkens for the shatter, and towards what.
 *
 * The darkening is a class toggle rather than a per-frame style write, so the
 * fade is a CSS transition and the scroll loop still touches nothing in the DOM.
 */
export const BACKDROP_SHADE = 0.72
export const BACKDROP_SHADE_COLOR = '#101a0c'

/**
 * Exported so scripts/verify-*.mjs can assert both tiers. At runtime only
 * `quality` below is read; nothing else should index this directly.
 *
 * `plastic` is read by createPlasticMaterial(), and is the single recipe for
 * the cup, the lid and the shards, so the whole drink breaks in one material.
 */
export const TIERS = {
  [QUALITY_TIER.MOBILE]: {
    dpr: 1.5,
    latheSegments: 40,
    shardCount: 40,
    environmentIntensity: 1.15,
    /** Real shadow-mapping is desktop only (AGENTS.md section 5). */
    contactShadows: false,
    contactShadowResolution: 128,
    /** Phase 5 ingredients. Each is one InstancedMesh, so these are counts. */
    bubbleCount: 40,
    /** Phase 7: tiny bubbles clinging to the wall, one more InstancedMesh. */
    wallBubbleCount: 30,
    iceCount: 3,
    mintCount: 14,
    /** Phase 7: slices wedged against the wall, per flavor. */
    fruitSliceCount: 2,
    bubbleOpacity: 0.5,
    wallBubbleOpacity: 0.55,
    iceOpacity: 0.46,
    /** Side of the square canvas the mint's vein texture is drawn at. */
    mintTextureSize: 128,
    /** Phase 6A: whole fruit orbiting the cup, and the juice splash. */
    wholeFruitCount: 3,
    splashDroplets: 30,
    ambientDroplets: 6,
    splashOpacity: 0.8,
    splashRingOpacity: 0.7,
    /** Phase 8B: planes per fruit type in the background field. Two types. */
    fruitFieldCount: 22,
    plastic: {
      opacity: 0.2,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.5,
      ior: 1.45,
      rimStrength: 0.42,
      depthWrite: false,
      /**
       * No transmission on mobile. AGENTS.md section 5 rules out real
       * refraction here, and the look is carried by opacity, clearcoat and the
       * injected fresnel rim instead.
       */
      transmission: 0,
      thickness: 0.1,
    },
  },
  [QUALITY_TIER.DESKTOP]: {
    dpr: 2,
    latheSegments: 72,
    shardCount: 60,
    environmentIntensity: 1.6,
    contactShadows: true,
    contactShadowResolution: 256,
    bubbleCount: 80,
    wallBubbleCount: 60,
    iceCount: 3,
    mintCount: 24,
    fruitSliceCount: 3,
    bubbleOpacity: 0.55,
    wallBubbleOpacity: 0.6,
    iceOpacity: 0.42,
    mintTextureSize: 192,
    wholeFruitCount: 4,
    splashDroplets: 60,
    ambientDroplets: 10,
    splashOpacity: 0.85,
    splashRingOpacity: 0.75,
    fruitFieldCount: 40,
    plastic: {
      opacity: 0.2,
      roughness: 0.08,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 1.2,
      ior: 1.45,
      rimStrength: 0.36,
      depthWrite: false,
      /**
       * The brief's desktop numbers, with one caveat worth knowing.
       *
       * `transmission` samples what the renderer drew *behind* the surface, but
       * this page's backdrop is CSS — the canvas is `alpha: true` and empty
       * behind the cup — so there is nothing to refract and the passthrough
       * reads as clear black rather than as the gradient the user sees. That is
       * the same reason AGENTS.md section 5 bans it on mobile.
       *
       * Set this to 0 and the desktop cup falls back to the mobile recipe,
       * which looks right today. It becomes safe to raise to 0.9 as soon as the
       * backdrop moves *inside* the canvas (the deferred Phase 6B shader).
       */
      transmission: 0.9,
      thickness: 0.1,
    },
  },
}

export const quality = TIERS[qualityTier]

/** Canvas dpr is always [1, dprCap]; it is never left uncapped. */
export const dprCap = quality.dpr

export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
