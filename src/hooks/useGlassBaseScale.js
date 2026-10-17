import { useMemo } from 'react'
import { useThree } from '@react-three/fiber'

/** Fraction of the viewport height the unit-tall glass fills at scale 1. */
const GLASS_SCREEN_FRACTION = 0.55

/**
 * Base world-unit scale for a unit-tall glass, from the viewport. Shared by the
 * glass group and the contact shadow below it, so the shadow knows where the
 * floor is.
 *
 * Must be called inside the Canvas, because it reads the viewport.
 */
export function useGlassBaseScale() {
  const viewport = useThree((state) => state.viewport)

  return useMemo(
    () =>
      Math.min(
        viewport.height * GLASS_SCREEN_FRACTION,
        viewport.width * 0.62,
        2.4,
      ),
    [viewport.height, viewport.width],
  )
}
