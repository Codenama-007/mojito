import { create } from 'zustand'
import { defaultFlavor } from '../config/flavors.js'
import { qualityTier } from '../config/performance.js'
import { HERO_ID } from '../config/sections.js'

/**
 * Small global state only: active flavor, active section, scroll values,
 * quality tier. Anything flavor-specific (colors, copy) stays in
 * config/flavors.js.
 *
 * scrollProgress and breakProgress are written imperatively by ScrollTrigger
 * callbacks and read inside useFrame via getState(). Nothing subscribes to
 * them, so a scroll frame never triggers a React render.
 */
export const useStore = create((set) => ({
  activeFlavor: defaultFlavor.id,
  activeSection: HERO_ID,
  scrollProgress: 0,
  breakProgress: 0,
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

  /** @param {number} value Shatter progress, 0 to 1 */
  setBreakProgress: (value) => set({ breakProgress: value }),
}))
