/**
 * The cup's shape, in one place, as plain numbers — and computed, not measured.
 *
 * Phase 4 read this file's predecessor from public/models/glass.glb via
 * scripts/extract-glass-profile.mjs, because the glass was a modelled asset.
 * Phase 7 builds the cup in code, so there is nothing to extract: the profile
 * below *is* the shape, and everything downstream derives from it — the drink
 * and its fill line, the ice, the mint, the whole fruit orbiting outside, the
 * shatter's spawn points, and scripts/verify-*.mjs.
 *
 * Coordinates are the cup's own local space: y runs 0 at the base to 1 at the
 * rim, centred on the axis. The lid sits *above* y = 1 and is deliberately not
 * part of that span, so the ingredient maths that works in 0..1 did not have to
 * move when the dome was added.
 */

/**
 * The cup body. A tapered takeaway cup: wider at the mouth, narrower at the
 * foot, thin-walled, with the wall rolled into the floor rather than meeting it
 * at a corner.
 */
export const cupModel = {
  /** Outer radius at the rim. */
  rimRadius: 0.3,
  /** Outer radius at the base: the brief's 1.3x taper over the rim. */
  baseRadius: 0.231,
  /** Side wall thickness. A real cup is thinner, but 0.7% of the height is
   *  where the rim stops reading as a hairline at phone resolution. */
  wallThickness: 0.007,
  /** Floor thickness, which is also the height of the drink's floor. */
  floorThickness: 0.013,
  /** Rounding where the wall rolls into the floor. */
  baseFillet: 0.022,
  rimY: 1,
  /**
   * Widest radius, for scaling the shatter and for assertions. On the old
   * stemmed glass this was the bowl's belly; on a tapered cup the mouth is
   * always the widest part, so this is simply the rim.
   */
  widestRadius: 0.3,
}

/**
 * The wall's lean: how much the radius grows per unit of height, and the same
 * thing as an angle.
 *
 * Anything laid flat against the inside of the wall has to follow this. A slice
 * pressed to a cone with its face exactly horizontal-radial would drift through
 * the wall by `wallSlope * radius` at its own top and bottom edges — which at
 * this cup's proportions is 7mm of a 95mm slice, i.e. visible.
 */
cupModel.wallSlope =
  (cupModel.rimRadius - cupModel.baseRadius) / (cupModel.rimY - cupModel.baseFillet)
cupModel.wallLean = Math.atan(cupModel.wallSlope)

const FILLET_STEPS = 6
const WALL_STEPS = 14

/**
 * Outer radius of the cup at a height, rounded base edge included.
 *
 * This is the number things that sit *outside* the cup have to clear — the
 * whole fruit in Phase 6A. `liquidProfile.js`'s inner-wall lookup is the one
 * for things *inside* it.
 */
export function cupOuterRadiusAt(y) {
  const { baseRadius, baseFillet, rimRadius, rimY } = cupModel

  if (y <= 0) return baseRadius - baseFillet
  if (y >= rimY) return rimRadius

  if (y < baseFillet) {
    // The quarter-round: the wall curves from vertical at y = baseFillet to
    // horizontal at y = 0.
    const angle = Math.asin(y / baseFillet - 1)
    return baseRadius - baseFillet + baseFillet * Math.cos(angle)
  }

  const t = (y - baseFillet) / (rimY - baseFillet)
  return baseRadius + (rimRadius - baseRadius) * t
}

/**
 * Outer silhouette, [radius, y], base to rim.
 *
 * Sampled from `cupOuterRadiusAt` rather than written out by hand, so the
 * lookup and the profile cannot disagree. The fillet is sampled finely because
 * that is where the curve is; the straight taper needs only its endpoints,
 * which is why the interpolation in `cupOuterRadiusAt` is exact on it.
 */
export const outerProfile = (() => {
  const { baseRadius, baseFillet } = cupModel
  const points = []

  for (let i = 0; i <= FILLET_STEPS; i++) {
    const angle = -Math.PI / 2 + (Math.PI / 2) * (i / FILLET_STEPS)
    points.push([
      baseRadius - baseFillet + baseFillet * Math.cos(angle),
      baseFillet + baseFillet * Math.sin(angle),
    ])
  }

  for (let i = 1; i <= WALL_STEPS; i++) {
    const y = baseFillet + ((cupModel.rimY - baseFillet) * i) / WALL_STEPS
    points.push([cupOuterRadiusAt(y), y])
  }

  // The taper is a straight line, so it is exact with two points; the loop
  // above samples it anyway to keep `outerProfile` a dense, interpolatable
  // list. Rounding is the last thing done, so the numbers stay consistent.
  return points.map(([radius, y]) => [Number(radius.toFixed(6)), Number(y.toFixed(6))])
})()

/**
 * Inner wall of the cup, [radius, y], floor to rim.
 *
 * A moulded cup's inside is a straight cone: the wall is a single draft angle
 * from the floor to the mouth, and the floor is flat inside the fillet. Two
 * points describe it exactly, which is why this is not sampled like the outer
 * profile.
 */
const innerFloorRadius =
  cupOuterRadiusAt(cupModel.floorThickness) - cupModel.wallThickness

export const interiorProfile = [
  [Number(innerFloorRadius.toFixed(6)), cupModel.floorThickness],
  [cupModel.rimRadius - cupModel.wallThickness, cupModel.rimY],
]

/** Widest radius of the cup interior, for sizing and for assertions. */
export const interiorMaxRadius = interiorProfile[interiorProfile.length - 1][0]

/**
 * The lid: a dome that clips over the rim.
 *
 * `baseY` is the top of the flange that grips the rim, and the dome rises from
 * there. `topY` is the highest point of the lid, which is where the splash
 * starts from and where the straw is measured against.
 */
export const lidModel = (() => {
  /** A little wider than the rim, so the flange clips over it, not into it. */
  const radius = 0.311
  /** Height of the flange wall that grips the rim. */
  const lipHeight = 0.018
  /**
   * How tall the dome rises above the flange. A full hemisphere would be
   * `radius` tall (0.311) and would dominate the cup; the reference photo shows
   * a squat dome, so it is 0.22 — an ellipsoid, not a sphere.
   */
  const domeHeight = 0.22
  const baseY = cupModel.rimY + lipHeight

  return {
    radius,
    lipHeight,
    domeHeight,
    baseY,
    topY: baseY + domeHeight,
    latheSegments: 40,
  }
})()

/**
 * The straw: through a hole off the dome's apex, standing above the lid.
 *
 * Kept vertical rather than leaning like the reference photo, because a leaning
 * straw has to clear the dome on one side and the drink on the other, and the
 * safe lean is small enough that it reads as a wobble rather than a lean.
 */
export const strawModel = (() => {
  const radius = 0.021
  const bottomY = 0.34
  /** How far the straw stands above the top of the lid, in cup heights. */
  const aboveLid = 0.25
  /** Off the axis, so it does not hide the middle of the drink. */
  const holeX = 0.1
  const holeZ = 0.04
  const tiltZ = 0.08

  // Where the straw actually passes through the dome: the ellipsoid's surface
  // directly above its own hole.
  const radialFrac = Math.hypot(holeX / lidModel.radius, holeZ / lidModel.radius)
  const holeY =
    lidModel.baseY + lidModel.domeHeight * Math.sqrt(Math.max(1 - radialFrac * radialFrac, 0))

  return {
    radius,
    bottomY,
    holeX,
    holeZ,
    holeY,
    tiltZ,
    topY: lidModel.topY + aboveLid,
    segments: 12,
  }
})()

const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5))

/**
 * Points on the real surface, for the shatter to start its shards from.
 *
 * Phase 4 measured 60 of these off the modelled glass. A golden-angle spiral
 * over the wall plus a ring over the dome gives the same even coverage without
 * an RNG, and without the bare patches a random scatter leaves. The dome is
 * included because Phase 7's shatter has to break the lid too.
 */
function buildShardSpawns(count) {
  const lidCount = Math.round(count * 0.28)
  const wallCount = count - lidCount
  const spawns = []

  for (let i = 0; i < wallCount; i++) {
    // 0.06 and 0.92 keep the spawns off the fillet and off the open rim.
    const y = 0.06 + ((i + 0.5) / wallCount) * 0.86
    const angle = i * GOLDEN_ANGLE
    const radius = cupOuterRadiusAt(y)
    spawns.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius])
  }

  for (let i = 0; i < lidCount; i++) {
    const climb = Math.sqrt((i + 0.5) / lidCount)
    const angle = i * GOLDEN_ANGLE + 0.7
    // Polar cap: the ring shrinks as it climbs the dome.
    const radius = lidModel.radius * Math.cos((climb * Math.PI) / 2)
    const y = lidModel.baseY + lidModel.domeHeight * Math.sin((climb * Math.PI) / 2)
    spawns.push([Math.cos(angle) * radius, y, Math.sin(angle) * radius])
  }

  return spawns
}

export const shardSpawns = buildShardSpawns(60)

/** One-entry cache: the shell never changes at runtime, but it is rebuilt often. */
let cachedShell = null

/**
 * The closed lathe profile of the cup body: out along the floor, up the
 * outside, across the rim, back down the inside.
 *
 * A shell rather than a single surface, because a clear cup's whole read is the
 * wall thickness visible at the rim and the floor. One surface drawn
 * double-sided would show no thickness anywhere, and the rim is the one place
 * the eye checks.
 */
export function cupShellProfile() {
  if (cachedShell !== null) return cachedShell

  const { rimRadius } = cupModel
  const innerRimRadius = interiorProfile[interiorProfile.length - 1][0]
  const radiusSteps = 12
  const points = [[0, 0]]

  // Out along the floor, then the fillet and the wall.
  for (const point of outerProfile) points.push(point)

  // Across the rim. Not a single step: a zero-width rim gives the lathe
  // degenerate quads at exactly the place the eye is looking.
  for (let i = 1; i <= 2; i++) {
    const t = i / 2
    points.push([rimRadius + (innerRimRadius - rimRadius) * t, cupModel.rimY])
  }

  // Down the inside.
  const [floorRadius, floorY] = interiorProfile[0]
  for (let i = 1; i <= radiusSteps; i++) {
    const t = i / radiusSteps
    points.push([
      innerRimRadius + (floorRadius - innerRimRadius) * t,
      cupModel.rimY + (floorY - cupModel.rimY) * t,
    ])
  }

  // Across the inside of the floor, back to the axis.
  points.push([0, floorY])

  cachedShell = points.map(([radius, y]) => [Number(radius.toFixed(6)), Number(y.toFixed(6))])
  return cachedShell
}

/**
 * A narrow vertical band of the wall, for the white highlight that makes the
 * plastic read as shiny.
 *
 * `LatheGeometry` starts phi at 0, which is +Z — dead in front of a camera at
 * `[0, 0, 5]` — so this is centred slightly off it, like a window reflection
 * down one side of the cup. It is lathed from the *same* outer profile as the
 * body, so it hugs the taper exactly instead of cutting a corner.
 */
export const highlightModel = {
  phiStart: 0.06,
  phiLength: 0.86,
  segments: 12,
  /** How far the band stands proud of the wall, so the two cannot z-fight. */
  lift: 1.006,
}
