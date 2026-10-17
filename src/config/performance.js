/**
 * Quality tier, detected once at load and read from the store.
 * Rules this enforces (AGENTS.md section 5):
 *   - dpr capped at 1.5 on mobile, 2 on desktop.
 *   - Tier is decided once, not re-negotiated while the app runs.
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

/** Canvas dpr is always [1, dprCap]; it is never left uncapped. */
export const dprCap = isMobile ? 1.5 : 2

export const prefersReducedMotion =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
