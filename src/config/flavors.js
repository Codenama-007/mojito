/**
 * Every flavor's data lives here and nowhere else.
 * 3D components must read colors from this file, never hardcode them.
 *
 * @typedef {Object} Flavor
 * @property {string} id                 Stable key used by the store.
 * @property {string} name               Display name for the picker.
 * @property {string} liquidColor        Liquid/cube base color, hex.
 * @property {string} accentColor        UI accent for this flavor, hex.
 * @property {string} backgroundGradient Full CSS background-image value.
 * @property {string} tagline            One short line of copy.
 */

export const flavors = [
  {
    id: 'lime',
    name: 'Lime',
    liquidColor: '#C6E62E',
    accentColor: '#5F8A00',
    backgroundGradient:
      'linear-gradient(180deg, #F6FFDE 0%, #D2F261 55%, #97CA20 100%)',
    tagline: 'Sharp enough to wake you up.',
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    liquidColor: '#FF4D6D',
    accentColor: '#C9184A',
    backgroundGradient:
      'linear-gradient(180deg, #FFF0F3 0%, #FFB6C4 55%, #FF5C8A 100%)',
    tagline: 'Summer, muddled.',
  },
  {
    id: 'apple',
    name: 'Apple',
    liquidColor: '#4FC14F',
    accentColor: '#1E7A2E',
    backgroundGradient:
      'linear-gradient(180deg, #EFFBEF 0%, #B9E7A9 55%, #6CCB57 100%)',
    tagline: 'Crisp enough to hear.',
  },
  {
    id: 'mango',
    name: 'Mango',
    liquidColor: '#FFB020',
    accentColor: '#C25E00',
    backgroundGradient:
      'linear-gradient(180deg, #FFF7E6 0%, #FFD98A 55%, #FFA51F 100%)',
    tagline: 'Thick sun, poured slow.',
  },
]

/** @type {Flavor} */
export const defaultFlavor = flavors[0]

/**
 * @param {string} id
 * @returns {Flavor} The matching flavor, or the default instead of undefined.
 */
export function getFlavor(id) {
  return flavors.find((flavor) => flavor.id === id) ?? defaultFlavor
}
