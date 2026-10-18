import { create } from 'zustand'
import { defaultFlavor, flavorDirectionFor } from '../config/flavors.js'
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
 *
 * `flavorDirection` is the one piece of flavor state that is not the flavor
 * itself: +1 or -1, which way through the list the last change went. Both
 * readers take it through getState() at the moment they see a new flavor — the
 * render that a new flavor causes — so it stays paired with the change that
 * produced it and never needs a subscription of its own.
 */
export const useStore = create((set) => ({
  activeFlavor: defaultFlavor.id,
  activeSection: HERO_ID,
  scrollProgress: 0,
  breakProgress: 0,
  qualityTier,
  flavorDirection: 1,

  /** @param {string} id Flavor id from config/flavors.js */
  setActiveFlavor: (id) =>
    set((state) =>
      state.activeFlavor === id
        ? {}
        : {
            activeFlavor: id,
            flavorDirection: flavorDirectionFor(state.activeFlavor, id),
          },
    ),

  /**
   * Section and flavor move together, in one update, so entering a section
   * costs a single render rather than two. Re-entering the section whose flavor
   * is already showing still moves the section, but does not count as a flavor
   * change — which is what stops the cup spinning every time a section boundary
   * is crossed on the way back up the page.
   * @param {string} sectionId
   * @param {string} flavorId
   */
  enterSection: (sectionId, flavorId) =>
    set((state) =>
      state.activeFlavor === flavorId
        ? { activeSection: sectionId }
        : {
            activeSection: sectionId,
            activeFlavor: flavorId,
            flavorDirection: flavorDirectionFor(state.activeFlavor, flavorId),
          },
    ),

  /** @param {number} value Scroll progress, 0 to 1 */
  setScrollProgress: (value) => set({ scrollProgress: value }),

  /** @param {number} value Shatter progress, 0 to 1 */
  setBreakProgress: (value) => set({ breakProgress: value }),
}))
