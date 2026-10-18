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
 * @property {string} colorA             The backdrop base: this flavor's own color a shade
 *                                       down. Solid, not a gradient — Phase 8B's fruit
 *                                       field is what gives the background its depth now,
 *                                       and a gradient behind it only muddied the fruit.
 * @property {string} tagline            One short line of copy.
 * @property {string} story              Two sentences on what the drink is and how it
 *                                       drinks. The flavor section's paragraph.
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
    colorA: '#B6E23C',
    tagline: 'Sharp enough to wake you up.',
    story:
      'Pressed lime and mint, muddled just long enough to smell green. The cane syrup is a short measure, so this one stays sharp to the bottom of the glass.',
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
    colorA: '#FF8AA6',
    tagline: 'Summer, muddled.',
    story:
      'Ripe berries muddled to a pulp, seeds and all, then lifted with basil. It lands sweet and finishes tart.',
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
    colorA: '#93D97F',
    tagline: 'Crisp enough to hear.',
    story:
      'Green apple, sliced thin with the skin left on, so the drink keeps its bite. Lime and mint pull the sweetness back.',
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
    colorA: '#FFC24F',
    tagline: 'Thick sun, poured slow.',
    story:
      'Ripe mango pulp, one hard squeeze of lime, and a pinch of chilli to cut through the sugar. Thick enough that the straw stands up in it.',
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

/**
 * Which way through the flavor list a change travels: +1 towards the last
 * flavor, -1 towards the first.
 *
 * The background push and the cup's spin both read this, so stepping forward
 * through the flavors always pushes and spins the same way and stepping back
 * undoes it. That symmetry is the point: a change you can reverse should look
 * reversible.
 *
 * Unknown ids and a change to the flavor already showing both resolve to +1,
 * so callers never have to handle a direction of zero.
 *
 * @param {string} fromId
 * @param {string} toId
 * @returns {1 | -1}
 */
export function flavorDirectionFor(fromId, toId) {
  const from = flavors.findIndex((flavor) => flavor.id === fromId)
  const to = flavors.findIndex((flavor) => flavor.id === toId)

  if (from === -1 || to === -1 || from === to) return 1
  return to > from ? 1 : -1
}
