import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useStore } from '../store/useStore.js'
import { defaultFlavor } from '../config/flavors.js'
import { SECTION_ORDER } from '../config/sections.js'

gsap.registerPlugin(ScrollTrigger)

/** Section id -> the flavor it activates. Non-flavor sections use the default. */
function flavorForSection(sectionId) {
  const prefix = 'flavor-'
  return sectionId.startsWith(prefix)
    ? sectionId.slice(prefix.length)
    : defaultFlavor.id
}

/** The section the viewport centre currently sits in. */
function sectionAtViewportCentre() {
  const middle = window.innerHeight / 2

  for (const sectionId of SECTION_ORDER) {
    const el = document.getElementById(sectionId)
    if (!el) continue
    const { top, bottom } = el.getBoundingClientRect()
    if (top <= middle && bottom > middle) return sectionId
  }

  return SECTION_ORDER[0]
}

/**
 * Every scroll-driven write to the store lives here. All of it goes through
 * useStore.getState(), never React state, so scrolling never re-renders.
 */
export function useScrollProgress() {
  useEffect(() => {
    const triggers = []

    // 1. Whole-page progress.
    triggers.push(
      ScrollTrigger.create({
        trigger: document.documentElement,
        start: 'top top',
        end: 'bottom bottom',
        onUpdate: (self) => useStore.getState().setScrollProgress(self.progress),
      }),
    )

    // 2. Section -> flavor. Bands are exactly one viewport tall and do not
    //    overlap, so precisely one section is active at a time. onEnter and
    //    onEnterBack both fire, which is what makes this work in both
    //    scroll directions rather than only downward.
    for (const sectionId of SECTION_ORDER) {
      const el = document.getElementById(sectionId)
      if (!el) continue

      const activate = () =>
        useStore.getState().enterSection(sectionId, flavorForSection(sectionId))

      triggers.push(
        ScrollTrigger.create({
          trigger: el,
          start: 'top center',
          end: 'bottom center',
          onEnter: activate,
          onEnterBack: activate,
        }),
      )
    }

    // A reload part-way down the page, or a hash jump, would otherwise leave
    // the store on whatever section it started with.
    const initial = sectionAtViewportCentre()
    useStore.getState().enterSection(initial, flavorForSection(initial))

    ScrollTrigger.refresh()

    // Section heights can shift once fonts settle.
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => ScrollTrigger.refresh())
    }

    return () => {
      triggers.forEach((trigger) => trigger.kill())
    }
  }, [])
}
