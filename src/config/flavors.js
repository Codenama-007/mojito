/**
 * Every flavor's data lives here and nowhere else.
 * 3D and UI components must read from this file, never hardcode values.
 *
 * @typedef {Object} FlavorProperty
 * @property {string} label  Chip label, e.g. "Taste".
 * @property {string} value  Chip value, e.g. "Sharp citrus".
 *
 * @typedef {Object} WholeFruitTint
 * @property {string} skin     Whole fruit body, and the darker end of its gradient.
 * @property {string} skinAlt  The lighter end: the lime's lit side, the strawberry's shoulder,
 *                             the apple's green half, the mango's red blush.
 * @property {string} [flesh]  Cut face. Lime only — a strawberry is not cut open here.
 * @property {string} [detail] Pith ring, seed dots or stalk.
 *
 * @typedef {Object} FlavorFruit
 * @property {string} kind                Which builder in three/fruitModels.js draws the slice.
 * @property {number} radius             Slice radius in glass units (the glass is 1 tall).
 * @property {string} flesh              Cut face.
 * @property {string} inner              Pith, segment lines or secondary flesh.
 * @property {string} rind               Skin, rim or outer edge.
 * @property {string} seed               Pips, seeds or core speckle.
 * @property {WholeFruitTint} whole      The whole fruit that floats around the glass
 *                                       (three/wholeFruits.js, the same `kind`).
 *
 * @typedef {Object} Flavor
 * @property {string} id                 Stable key used by the store.
 * @property {string} name               Display name.
 * @property {string} liquidColor        Liquid color, hex.
 * @property {string} splashTint         Lighter juice, for some of the splash droplets.
 * @property {string} strawColor         The straw through the lid, hex. Saturated on
 *                                       purpose — the drink itself is washed 55% towards
 *                                       white (three/Liquid.jsx), so a pale straw would
 *                                       vanish into it.
 * @property {string} accentColor        UI accent for this flavor, hex.
 * @property {string} backgroundGradient Full CSS background-image value.
 * @property {number[][]} bokeh          Out-of-focus blobs: [x%, y%, sizeVmax, alpha].
 * @property {string} tagline            One short line of copy.
 * @property {FlavorProperty[]} properties  Exactly three chips.
 * @property {FlavorFruit} fruit         The slice that floats in the glass.
 */

export const flavors = [
  {
    id: 'lime',
    name: 'Lime',
    liquidColor: '#C6E62E',
    splashTint: '#E9FF8F',
    accentColor: '#5F8A00',
    strawColor: '#3E8E1E',
    backgroundGradient:
      'linear-gradient(180deg, #F6FFDE 0%, #D2F261 55%, #97CA20 100%)',
    bokeh: [
      [14, 16, 54, 0.5],
      [84, 12, 42, 0.34],
      [70, 76, 58, 0.3],
      [20, 88, 38, 0.26],
      [48, 44, 30, 0.16],
    ],
    tagline: 'Sharp enough to wake you up.',
    properties: [
      { label: 'Taste', value: 'Sharp citrus' },
      { label: 'Ingredients', value: 'Lime, mint, cane sugar' },
      { label: 'Calories', value: '92 kcal' },
    ],
    fruit: {
      kind: 'lime',
      radius: 0.095,
      flesh: '#CDE96B',
      inner: '#A8CE4A',
      rind: '#3F6B12',
      seed: '#EAF6C8',
      whole: {
        skin: '#3F7A16',
        skinAlt: '#74B42E',
        flesh: '#CFEA74',
        detail: '#EDF7CE',
      },
    },
  },
  {
    id: 'strawberry',
    name: 'Strawberry',
    liquidColor: '#FF4D6D',
    splashTint: '#FF9DB1',
    accentColor: '#C9184A',
    strawColor: '#E0244A',
    backgroundGradient:
      'linear-gradient(180deg, #FFF0F3 0%, #FFB6C4 55%, #FF5C8A 100%)',
    bokeh: [
      [78, 20, 50, 0.46],
      [16, 10, 40, 0.3],
      [26, 78, 60, 0.32],
      [86, 70, 36, 0.24],
      [56, 48, 26, 0.18],
    ],
    tagline: 'Summer, muddled.',
    properties: [
      { label: 'Taste', value: 'Soft and sweet' },
      { label: 'Ingredients', value: 'Strawberry, basil, cane sugar' },
      { label: 'Calories', value: '98 kcal' },
    ],
    fruit: {
      kind: 'strawberry',
      radius: 0.092,
      flesh: '#F4647E',
      inner: '#E04664',
      rind: '#B81F3F',
      seed: '#FFE9A8',
      whole: {
        skin: '#A81E3C',
        skinAlt: '#F0455F',
        detail: '#FFE9A8',
      },
    },
  },
  {
    id: 'apple',
    name: 'Apple',
    liquidColor: '#4FC14F',
    splashTint: '#A9E9A3',
    accentColor: '#1E7A2E',
    strawColor: '#2F9E44',
    backgroundGradient:
      'linear-gradient(180deg, #EFFBEF 0%, #B9E7A9 55%, #6CCB57 100%)',
    bokeh: [
      [10, 62, 52, 0.42],
      [88, 34, 44, 0.32],
      [44, 12, 34, 0.28],
      [72, 88, 46, 0.24],
      [34, 40, 28, 0.15],
    ],
    tagline: 'Crisp enough to hear.',
    properties: [
      { label: 'Taste', value: 'Dry, green crunch' },
      { label: 'Ingredients', value: 'Green apple, mint, lime' },
      { label: 'Calories', value: '88 kcal' },
    ],
    fruit: {
      kind: 'apple',
      radius: 0.095,
      flesh: '#F7F3E4',
      inner: '#EDE6CE',
      rind: '#D8453F',
      seed: '#7A5A2E',
      whole: {
        skin: '#D8453F',
        skinAlt: '#8FBF3F',
        detail: '#5A3A22',
      },
    },
  },
  {
    id: 'mango',
    name: 'Mango',
    liquidColor: '#FFB020',
    splashTint: '#FFD98C',
    accentColor: '#C25E00',
    strawColor: '#F08C0B',
    backgroundGradient:
      'linear-gradient(180deg, #FFF7E6 0%, #FFD98A 55%, #FFA51F 100%)',
    bokeh: [
      [50, 14, 62, 0.44],
      [18, 46, 40, 0.3],
      [86, 58, 48, 0.32],
      [64, 90, 36, 0.22],
      [30, 80, 26, 0.16],
    ],
    tagline: 'Thick sun, poured slow.',
    properties: [
      { label: 'Taste', value: 'Thick and tropical' },
      { label: 'Ingredients', value: 'Mango, chilli, lime' },
      { label: 'Calories', value: '104 kcal' },
    ],
    fruit: {
      kind: 'mango',
      radius: 0.092,
      flesh: '#FFB43C',
      inner: '#F59318',
      rind: '#C9710A',
      seed: '#8A4E08',
      whole: {
        skin: '#F2A61C',
        skinAlt: '#D2542A',
        detail: '#7A4A18',
      },
    },
  },
]

/**
 * Every mojito gets the same mint, so it is not per-flavor data and does not
 * belong on the flavor objects. It lives here rather than in the 3D component
 * so there is still one place for ingredient colours.
 */
export const mint = {
  stemColor: '#2F6B2A',
  tipColor: '#9ED85A',
}

/** @type {Flavor} */
export const defaultFlavor = flavors[0]

/**
 * @param {string} id
 * @returns {Flavor} The matching flavor, or the default instead of undefined.
 */
export function getFlavor(id) {
  return flavors.find((flavor) => flavor.id === id) ?? defaultFlavor
}
