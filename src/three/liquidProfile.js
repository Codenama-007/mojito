import { cupModel, interiorProfile, outerProfile } from '../config/cupProfile.js'

/**
 * The shape of the drink, in one place, as plain numbers.
 *
 * Phase 4 built the liquid inside Liquid.jsx and kept these numbers to itself.
 * Phase 5 needs the same bounds for the ice, mint and bubbles, and two copies
 * of a profile is exactly how the cup and the drink drift apart. So the
 * geometry moved here: Liquid.jsx turns it into a lathe, the ingredients query
 * it, and the verifiers check against it.
 *
 * All coordinates are the cup's own local space: y 0 at the base, 1 at the rim,
 * centred on the axis.
 */

/** How full the cup is, as a fraction of its interior height. The brief's 85%. */
export const FILL = 0.85

/**
 * The liquid is built at this fraction of the cup's interior radius.
 *
 * Phase 4 had this at 0.92, which left a visible moat: the modelled bowl was
 * narrow and its measured profile wobbled, so the drink had to be pulled in to
 * stay off the wall. The cup's interior is a clean cone, so the only thing left
 * to clear is its own thickness — and at 0.965 of a 0.27 radius the drink sits
 * about 0.0095 from the plastic, which reads as touching it. Pull it further in
 * and the mint, which is placed against the drink rather than against the cup,
 * detaches from the wall with it.
 */
export const CLEARANCE = 0.965

const wallFloorY = interiorProfile[0][1]
const wallRimY = interiorProfile[interiorProfile.length - 1][1]

/** Where the drink starts, and where its flat surface sits. */
export const drinkFloorY = wallFloorY
export const drinkSurfaceY = wallFloorY + (wallRimY - wallFloorY) * FILL

/** One-entry cache: FILL never changes at runtime, but this is hot. */
let cachedFill = null
let cachedWall = null

/**
 * The cup's interior, inset and cut off at the fill line.
 *
 * The profile is a straight cone, so this is too — but the truncation still
 * matters: FILL is applied by cutting the profile at the fill line rather than
 * by scaling the mesh, so the wall stays on the cup at every height. Scaling
 * would move a tapered wall sideways and poke it through the cup.
 *
 * @returns {number[][]} [radius, y] pairs, floor to fill line.
 */
export function drinkWall(fill = FILL) {
  if (cachedFill === fill && cachedWall !== null) return cachedWall

  const topY = wallFloorY + (wallRimY - wallFloorY) * fill
  const points = [[interiorProfile[0][0] * CLEARANCE, wallFloorY]]

  for (let i = 1; i < interiorProfile.length; i++) {
    const [radius, y] = interiorProfile[i]

    if (y >= topY) {
      // Interpolate the wall to land exactly on the fill line.
      const [previousRadius, previousY] = interiorProfile[i - 1]
      const t = (topY - previousY) / (y - previousY)
      points.push([(previousRadius + (radius - previousRadius) * t) * CLEARANCE, topY])
      break
    }

    points.push([radius * CLEARANCE, y])
  }

  cachedFill = fill
  cachedWall = points
  return points
}

/** The drink as a closed lathe profile: wall, floor disc, flat surface. */
export function drinkProfile(fill = FILL) {
  const wall = drinkWall(fill)
  const topY = wall[wall.length - 1][1]

  return {
    points: [[0, wallFloorY], ...wall, [0, topY]],
    floorY: wallFloorY,
    topY,
  }
}

/**
 * Radius of the drink at height y, on the wall. 0 outside the drink, which is
 * what makes it safe to call on any height without a separate range check.
 */
export function drinkRadiusAt(y, fill = FILL) {
  const wall = drinkWall(fill)
  if (y <= wall[0][1] || y >= wall[wall.length - 1][1]) return 0

  for (let i = 1; i < wall.length; i++) {
    const [radius, yi] = wall[i]
    if (y <= yi) {
      const [previousRadius, previousY] = wall[i - 1]
      const t = (y - previousY) / (yi - previousY)
      return previousRadius + (radius - previousRadius) * t
    }
  }

  return 0
}

/**
 * Radius of the drink where it meets the air. The mint floats on the surface
 * rather than in it, so `drinkRadiusAt` would correctly return 0 for it; this
 * is the number that actually bounds leaves and surface fizz.
 */
export const drinkTopRadius = drinkWall(FILL)[drinkWall(FILL).length - 1][0]

/** Interior wall of the bare cup at height y, ignoring the drink. */
export function cupRadiusAt(y) {
  if (y <= interiorProfile[0][1]) return 0
  if (y >= wallRimY) return interiorProfile[interiorProfile.length - 1][0]

  for (let i = 1; i < interiorProfile.length; i++) {
    const [radius, yi] = interiorProfile[i]
    if (y <= yi) {
      const [previousRadius, previousY] = interiorProfile[i - 1]
      const t = (y - previousY) / (yi - previousY)
      return previousRadius + (radius - previousRadius) * t
    }
  }

  return 0
}

/**
 * The radius actually available at height y: never wider than the cup, and
 * never wider than the drink, except above the surface where the drink has
 * ended and the cup is all that is left.
 *
 * Every ingredient is fitted against this rather than against a number copied
 * into a component, so nothing can end up outside the cup.
 */
export function drinkBoundAt(y) {
  return Math.min(
    cupRadiusAt(y),
    y >= drinkSurfaceY ? drinkTopRadius : drinkRadiusAt(y),
  )
}

/**
 * The outside of the cup at height y — the silhouette, foot and all.
 *
 * This is the number the things that float *around* the cup have to clear, as
 * opposed to `cupRadiusAt`, which is the inside.
 */
export function cupOuterRadiusAt(y) {
  if (y <= outerProfile[0][1]) return outerProfile[0][0]
  if (y >= outerProfile[outerProfile.length - 1][1]) {
    return outerProfile[outerProfile.length - 1][0]
  }

  for (let i = 1; i < outerProfile.length; i++) {
    const [radius, yi] = outerProfile[i]
    if (y <= yi) {
      const [previousRadius, previousY] = outerProfile[i - 1]
      const t = (y - previousY) / (yi - previousY)
      return previousRadius + (radius - previousRadius) * t
    }
  }

  return cupModel.rimRadius
}
