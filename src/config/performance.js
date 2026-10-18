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

/**
 * `glass` is read by createGlassMaterial(). There is deliberately no
 * transmission setting on either tier: the page backdrop is CSS, so the scene
 * behind the glass is empty and a transmission pass would sample clear black
 * rather than the gradient the user sees. The glass reads as glass through
 * opacity, clearcoat and the injected fresnel rim instead.
 */
/**
 * Exported so scripts/verify-ingredients.mjs can assert both tiers. At runtime
 * only `quality` below is read; nothing else should index this directly.
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
    /** Phase 5 ingredients. Each is one InstancedMesh, so these are instance counts. */
    bubbleCount: 40,
    iceCount: 5,
    mintCount: 8,
    bubbleOpacity: 0.5,
    iceOpacity: 0.46,
    glass: {
      opacity: 0.3,
      roughness: 0.09,
      clearcoatRoughness: 0.14,
      envMapIntensity: 1.25,
      rimStrength: 0.34,
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
    iceCount: 5,
    mintCount: 10,
    bubbleOpacity: 0.55,
    iceOpacity: 0.42,
    glass: {
      opacity: 0.24,
      roughness: 0.04,
      clearcoatRoughness: 0.05,
      envMapIntensity: 1.7,
      rimStrength: 0.3,
    },
  },
}

export const quality = TIERS[qualityTier]

/** Canvas dpr is always [1, dprCap]; it is never left uncapped. */
export const dprCap = quality.dpr

export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
