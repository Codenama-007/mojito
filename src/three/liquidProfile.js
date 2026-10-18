import { interiorProfile } from '../config/glassProfile.js'

/**
 * The shape of the drink, in one place, as plain numbers.
 *
 * Phase 4 built the liquid inside Liquid.jsx and kept these numbers to itself.
 * Phase 5 needs the same bounds for the ice, mint and bubbles, and two copies
 * of a measured profile is exactly how the glass and the liquid drift apart.
 * So the geometry moved here: Liquid.jsx turns it into a lathe, the
 * ingredients query it, and scripts/verify-ingredients.mjs checks against it.
 *
 * All coordinates are the glass's own local space: y 0 at the base, 1 at the
 * rim, centred on the axis.
 */

/** How full the bowl is, as a fraction of its interior height. */
export const FILL = 0.8

/**
 * The liquid is built at this fraction of the bowl's interior radius. The
 * glass wall is about 0.01 thick at the rim, so a little clearance reads as
 * wall thickness; with none, the surface z-fights the glass where the two
 * nearly touch.
 */
export const CLEARANCE = 0.92

const wallFloorY = interiorProfile[0][1]
const wallRimY = interiorProfile[interiorProfile.length - 1][1]

/** Where the drink starts, and where its flat surface sits. */
export const drinkFloorY = wallFloorY
export const drinkSurfaceY = wallFloorY + (wallRimY - wallFloorY) * FILL

/** One-entry cache: FILL never changes at runtime, but this is hot. */
let cachedFill = null
let cachedWall = null

/**
 * The bowl's interior, inset and cut off at the fill line.
 *
 * The profile is measured, not guessed: the bowl is widest just below its
 * middle (0.20127) and narrower at the rim (0.14518), which is exactly why a
 * cylinder cannot sit inside it. FILL is applied by truncating the profile
 * rather than by scaling the mesh, so the wall stays on the glass at every
 * height.
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

/** Interior wall of the bare glass at height y, ignoring the drink. */
export function glassRadiusAt(y) {
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
 * The radius actually available at height y: never wider than the glass, and
 * never wider than the drink, except above the surface where the drink has
 * ended and the glass is all that is left.
 *
 * Every ingredient is fitted against this rather than against a number copied
 * into a component, so nothing can end up outside the bowl.
 */
export function drinkBoundAt(y) {
  return Math.min(
    glassRadiusAt(y),
    y >= drinkSurfaceY ? drinkTopRadius : drinkRadiusAt(y),
  )
}
