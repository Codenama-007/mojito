import { flavors } from './flavors.js'

/**
 * The scroll journey. One source of truth for section order, which flavor each
 * section activates, and where the glass sits while that section is on screen.
 *
 * Glass targets are fractions of the viewport, not world units, so nothing
 * breaks on a different aspect ratio. +y moves the glass up the screen.
 */

export const HERO_ID = 'hero'
export const ABOUT_ID = 'about'
export const CONTACT_ID = 'contact'

/** @param {string} flavorId */
export const flavorSectionId = (flavorId) => `flavor-${flavorId}`

/** Desktop: glass parked to one side, text on the other. */
const desktopSide = (side, rot) => ({ x: side * 0.2, y: 0, scale: 0.92, rot })

/** Mobile: glass centred in the upper half, text below it. */
const mobileUp = (rot) => ({ x: 0, y: 0.22, scale: 0.62, rot: rot * 0.5 })

/** @type {Record<string, { desktop: object, mobile: object }>} */
export const GLASS_TARGETS = {
  [HERO_ID]: {
    desktop: { x: 0, y: 0, scale: 1, rot: 0 },
    mobile: { x: 0, y: 0.08, scale: 0.78, rot: 0 },
  },
  [flavorSectionId('lime')]: {
    desktop: desktopSide(-1, -0.35),
    mobile: mobileUp(-0.35),
  },
  [flavorSectionId('strawberry')]: {
    desktop: desktopSide(1, 0.35),
    mobile: mobileUp(0.35),
  },
  [flavorSectionId('apple')]: {
    desktop: desktopSide(-1, -0.35),
    mobile: mobileUp(-0.35),
  },
  [flavorSectionId('mango')]: {
    desktop: desktopSide(1, 0.35),
    mobile: mobileUp(0.35),
  },
  [ABOUT_ID]: {
    desktop: { x: 0, y: 0, scale: 0.62, rot: 0 },
    mobile: { x: 0, y: 0.04, scale: 0.5, rot: 0 },
  },
  [CONTACT_ID]: {
    desktop: { x: 0, y: 0, scale: 0.62, rot: 0 },
    mobile: { x: 0, y: 0.04, scale: 0.5, rot: 0 },
  },
}

/** Section order, top to bottom. */
export const SECTION_ORDER = [
  HERO_ID,
  ...flavors.map((flavor) => flavorSectionId(flavor.id)),
  ABOUT_ID,
  CONTACT_ID,
]

export const NAV_LINKS = [
  { href: `#${HERO_ID}`, label: 'Home' },
  { href: `#${flavorSectionId(flavors[0].id)}`, label: 'Flavors' },
  { href: `#${ABOUT_ID}`, label: 'About' },
  { href: `#${CONTACT_ID}`, label: 'Contact' },
]

/** Fallback so an unknown section still lands the glass somewhere sane. */
export const FALLBACK_TARGET = GLASS_TARGETS[HERO_ID]
