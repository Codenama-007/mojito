import { create } from 'zustand'
import { defaultFlavor } from '../config/flavors.js'
import { qualityTier } from '../config/performance.js'

/**
 * Small global state only: active flavor, scroll progress, quality tier.
 * Anything flavor-specific (colors, copy) stays in config/flavors.js.
 */
export const useStore = create((set) => ({
  activeFlavor: defaultFlavor.id,
  scrollProgress: 0,
  qualityTier,

  /** @param {string} id Flavor id from config/flavors.js */
  setActiveFlavor: (id) => set({ activeFlavor: id }),

  /** @param {number} value Scroll progress, 0 to 1 */
  setScrollProgress: (value) => set({ scrollProgress: value }),
}))
