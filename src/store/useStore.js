import { create } from 'zustand'
import { defaultFlavor } from '../config/flavors.js'
import { qualityTier } from '../config/performance.js'
import { HERO_ID } from '../config/sections.js'

/**
 * Small global state only: active flavor, active section, scroll progress,
 * quality tier. Anything flavor-specific (colors, copy) stays in
 * config/flavors.js.
 *
 * scrollProgress is written imperatively by ScrollTrigger callbacks and read
 * inside useFrame via getState(). Nothing subscribes to it, so a scroll frame
 * never triggers a React render.
 */
export const useStore = create((set) => ({
  activeFlavor: defaultFlavor.id,
  activeSection: HERO_ID,
  scrollProgress: 0,
  qualityTier,

  /** @param {string} id Flavor id from config/flavors.js */
  setActiveFlavor: (id) => set({ activeFlavor: id }),

  /**
   * Section and flavor move together, in one update, so entering a section
   * costs a single render rather than two.
   * @param {string} sectionId
   * @param {string} flavorId
   */
  enterSection: (sectionId, flavorId) =>
    set({ activeSection: sectionId, activeFlavor: flavorId }),

  /** @param {number} value Scroll progress, 0 to 1 */
  setScrollProgress: (value) => set({ scrollProgress: value }),
}))
