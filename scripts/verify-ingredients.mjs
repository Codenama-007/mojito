import * as THREE from 'three'
import { flavors } from '../src/config/flavors.js'
import { cupModel } from '../src/config/cupProfile.js'
import { quality, TIERS } from '../src/config/performance.js'
import {
  cupRadiusAt,
  drinkBoundAt,
  drinkFloorY,
  drinkSurfaceY,
  drinkTopRadius,
} from '../src/three/liquidProfile.js'
import {
  BUILD_END,
  REVEAL,
  bubblePosition,
  buildBubbles,
  buildIce,
  buildMint,
  buildWallBubbles,
  iceState,
  mintState,
  revealAt,
  wallBubbleState,
} from '../src/three/ingredientMath.js'
import { buildLeafGeometry } from '../src/three/leafGeometry.js'
import { buildFruit, disposeFruit } from '../src/three/fruitModels.js'

/**
 * The ingredients, checked without a renderer.
 *
 * Everything here is a pure function of scroll progress and time, which is what
 * makes this possible at all. The checks fall into three groups:
 *
 *  1. Every ingredient stays inside the drink. Not inside the cup — inside the
 *     *drink*, because a leaf floating in the gap between the liquid and the
 *     wall is just as wrong as one poking through the plastic.
 *  2. Scroll is reversible. Sweeping up and back down has to retrace the same
 *     path exactly, or the build accumulates state and the second pass looks
 *     different from the first.
 *  3. The tier counts are the tier counts, so a performance regression is a
 *     failed test rather than something to notice on a phone.
 *
 * Phase 7 rebuilt the glass as a tapered takeaway cup and repacked the mint
 * against its wall, so the leaf check measures the real leaf geometry rather
 * than approximating a leaf as a line.
 */

const failures = []
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`)
  } else {
    console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`)
    failures.push(name)
  }
}

const WINDOWS = Object.entries(REVEAL)
const TIME = 3.7
const MOTION = 1

/**
 * Both tiers' ingredient sets, not just the one this process detects: Node has
 * no `window`, so `quality` is always mobile here and the desktop counts would
 * otherwise never be built, let alone checked.
 */
const bubbles = [
  ...buildBubbles(TIERS.mobile.bubbleCount),
  ...buildBubbles(TIERS.desktop.bubbleCount),
]
const wallBubbles = [
  ...buildWallBubbles(TIERS.mobile.wallBubbleCount),
  ...buildWallBubbles(TIERS.desktop.wallBubbleCount),
]
const cubes = buildIce(quality.iceCount)
const leaves = [
  ...buildMint(TIERS.mobile.mintCount),
  ...buildMint(TIERS.desktop.mintCount),
]
const fruits = flavors.flatMap((flavor) => [
  buildFruit(flavor.fruit, TIERS.mobile.fruitSliceCount),
  buildFruit(flavor.fruit, TIERS.desktop.fruitSliceCount),
])

// ------------------------------------------------------- scroll is reversible
// Sweep progress up, sweep it back down, compare every ingredient at the same
// progress. Anything that accumulated state would fail here.
const STEPS = 400

const sampleAt = (progress) => {
  const reveal = {
    bubbles: revealAt(progress, REVEAL.bubbles),
    ice: revealAt(progress, REVEAL.ice),
    mint: revealAt(progress, REVEAL.mint),
    fruit: revealAt(progress, REVEAL.fruit),
  }

  const out = [reveal.bubbles, reveal.ice, reveal.mint, reveal.fruit]

  for (const bubble of bubbles) {
    const p = bubblePosition(bubble, TIME, MOTION)
    out.push(p.x, p.y, p.z)
  }
  for (const bubble of wallBubbles) {
    const s = wallBubbleState(bubble, TIME, MOTION)
    out.push(s.x, s.y, s.z, s.scale)
  }
  for (const cube of cubes) {
    const s = iceState(cube, reveal.ice, TIME, MOTION)
    out.push(s.x, s.y, s.z, s.scale, s.spin, s.tilt)
  }
  for (const leaf of leaves) {
    const s = mintState(leaf, reveal.mint, TIME, MOTION)
    out.push(s.x, s.y, s.z, s.scale, s.heading, s.lean, s.roll)
  }

  return out
}

// Keyed on the exact float values, so the up-sweep and the down-sweep look up
// the same progress rather than two values that differ in the last bit.
const ascending = []
for (let i = 0; i <= STEPS; i++) ascending.push(i / STEPS)

const sampledUp = new Map(ascending.map((progress) => [progress, sampleAt(progress)]))

let worstDelta = 0
let mismatches = 0
for (let i = STEPS; i >= 0; i--) {
  const progress = ascending[i]
  const up = sampledUp.get(progress)
  const back = sampleAt(progress)
  for (let k = 0; k < up.length; k++) {
    const delta = Math.abs(up[k] - back[k])
    if (delta > worstDelta) worstDelta = delta
    if (delta > 1e-12) mismatches++
  }
}
check(
  'scrolling back up retraces the exact same path',
  mismatches === 0,
  `worst delta ${worstDelta.toExponential(2)} across ${(STEPS + 1) * sampleAt(0).length} samples`,
)

// ---------------------------------------------------------- reveal behaviour
let zeroAtStart = true
let oneAtEnd = true
for (const [, window] of WINDOWS) {
  if (revealAt(0, window) !== 0) zeroAtStart = false
  if (revealAt(BUILD_END, window) !== 1) oneAtEnd = false
}
check(
  'every ingredient is hidden at progress 0',
  zeroAtStart,
  WINDOWS.map(([name]) => name).join(', '),
)
check('every ingredient has fully appeared by the end of the build', oneAtEnd)

// Monotone, and rising in the order the brief asks for.
let monotone = true
let ordered = true
for (let i = 0; i <= STEPS; i++) {
  const progress = (i / STEPS) * BUILD_END
  const values = WINDOWS.map(([, window]) => revealAt(progress, window))
  for (let k = 1; k < values.length; k++) {
    if (values[k] > values[k - 1] + 1e-12) ordered = false
  }
  if (i > 0) {
    const previous = WINDOWS.map(([, window]) =>
      revealAt(((i - 1) / STEPS) * BUILD_END, window),
    )
    for (let k = 0; k < values.length; k++) {
      if (values[k] < previous[k] - 1e-12) monotone = false
    }
  }
}
check('reveal never goes backwards as progress increases', monotone)
check(
  'they appear in order: bubbles, ice, mint, fruit',
  ordered,
  WINDOWS.map(([name, window]) => `${name}@${window[0]}`).join(' < '),
)
check(
  'fruit is still absent while the ice is dropping',
  revealAt(BUILD_END * 0.4, REVEAL.fruit) === 0,
)

// ------------------------------------------------------------------- counts
check(
  'the mobile tier asks for the Phase 7 counts',
  TIERS.mobile.bubbleCount === 40 &&
    TIERS.mobile.wallBubbleCount === 30 &&
    TIERS.mobile.mintCount === 14 &&
    TIERS.mobile.iceCount === 3 &&
    TIERS.mobile.fruitSliceCount === 2,
  `${TIERS.mobile.bubbleCount} rising, ${TIERS.mobile.wallBubbleCount} wall, ${TIERS.mobile.mintCount} leaves, ${TIERS.mobile.iceCount} cubes, ${TIERS.mobile.fruitSliceCount} slices`,
)
check(
  'the desktop tier asks for the Phase 7 counts',
  TIERS.desktop.bubbleCount === 80 &&
    TIERS.desktop.wallBubbleCount === 60 &&
    TIERS.desktop.mintCount === 24 &&
    TIERS.desktop.iceCount === 3 &&
    TIERS.desktop.fruitSliceCount === 3,
  `${TIERS.desktop.bubbleCount} rising, ${TIERS.desktop.wallBubbleCount} wall, ${TIERS.desktop.mintCount} leaves, ${TIERS.desktop.iceCount} cubes, ${TIERS.desktop.fruitSliceCount} slices`,
)
check(
  'this process detects the mobile tier, as expected without a window',
  quality.bubbleCount === TIERS.mobile.bubbleCount,
  `${bubbles.length} rising bubbles checked across both tiers`,
)
check(
  'the mint is dense enough to be packed rather than garnished',
  TIERS.mobile.mintCount >= 12 && TIERS.desktop.mintCount >= 20,
  `${TIERS.mobile.mintCount}/${TIERS.desktop.mintCount}`,
)

// ------------------------------------------------------------------- bubbles
let worstBubble = 0
let bubbleFinite = true
let bubbleMinY = Infinity
let bubbleMaxY = -Infinity
let bubbleSpread = 0
for (const bubble of bubbles) {
  for (let i = 0; i <= 200; i++) {
    const p = bubblePosition(bubble, i * 0.05, MOTION)
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.z)) {
      bubbleFinite = false
    }
    // The sphere, not its centre: it has to fit inside the drink at its height.
    worstBubble = Math.max(
      worstBubble,
      Math.hypot(p.x, p.z) + bubble.size - drinkBoundAt(p.y),
    )
    bubbleMinY = Math.min(bubbleMinY, p.y - bubble.size)
    bubbleMaxY = Math.max(bubbleMaxY, p.y + bubble.size)
  }
  bubbleSpread = Math.max(bubbleSpread, bubble.radialFrac)
}
check('no NaN in any bubble position', bubbleFinite)
check(
  'every rising bubble stays inside the drink',
  worstBubble <= 1e-9,
  `worst overhang ${worstBubble.toExponential(2)}`,
)
check(
  'bubbles stay between the floor and the surface',
  bubbleMinY >= drinkFloorY - 1e-9 && bubbleMaxY <= drinkSurfaceY + 1e-9,
  `y ${bubbleMinY.toFixed(4)} to ${bubbleMaxY.toFixed(4)}`,
)
check(
  'bubble radii reach the walls rather than clustering on the axis',
  bubbleSpread > 0.8,
  `widest radialFrac ${bubbleSpread.toFixed(2)}`,
)

// Looping rather than one-way: a bubble has to come back down to the bottom.
const looped = bubbles.every((bubble) => {
  const a = bubblePosition(bubble, 0, MOTION)
  const b = bubblePosition(bubble, 1 / bubble.speed, MOTION)
  return Math.abs(a.y - b.y) < 1e-9
})
check('every rising bubble loops back to where it started', looped)

// -------------------------------------------------------------- wall bubbles
let worstWall = 0
let wallFinite = true
let wallMinY = Infinity
let wallMaxY = -Infinity
let wallHug = 0
for (const bubble of wallBubbles) {
  // 40s at 0.25s steps covers every bubble's whole grip-and-release cycle twice,
  // because the slowest cycle is 20s.
  for (let i = 0; i <= 160; i++) {
    const t = i * 0.25
    const s = wallBubbleState(bubble, t, MOTION)
    if (!Number.isFinite(s.x) || !Number.isFinite(s.y) || !Number.isFinite(s.scale)) {
      wallFinite = false
    }
    // The sphere at its *shimmering* radius, which is the widest it ever gets.
    worstWall = Math.max(worstWall, Math.hypot(s.x, s.z) + s.scale - drinkBoundAt(s.y))
    wallMinY = Math.min(wallMinY, s.y - s.scale)
    wallMaxY = Math.max(wallMaxY, s.y + s.scale)
  }
  wallHug = Math.max(wallHug, bubble.radialFrac)
}
check('no NaN in any wall bubble', wallFinite)
check(
  'every wall bubble stays inside the drink, shimmer included',
  worstWall <= 1e-9,
  `worst overhang ${worstWall.toExponential(2)}`,
)
check(
  'wall bubbles stay under the surface and off the floor',
  wallMinY >= drinkFloorY - 1e-9 && wallMaxY <= drinkSurfaceY + 1e-9,
  `y ${wallMinY.toFixed(4)} to ${wallMaxY.toFixed(4)}`,
)
check(
  'wall bubbles cling to the wall rather than drifting in the middle',
  wallHug > 0.99,
  `closest radialFrac ${wallHug.toFixed(3)}`,
)

let detached = 0
for (const bubble of wallBubbles) {
  const states = []
  for (let i = 0; i <= 160; i++) states.push(wallBubbleState(bubble, i * 0.25, MOTION))
  if (Math.max(...states.map((s) => s.scale)) > bubble.size * 1.001) detached++
}
check(
  'every wall bubble shimmers bigger at some point in its cycle',
  detached === wallBubbles.length,
  `${detached} of ${wallBubbles.length}`,
)

// ----------------------------------------------------------------------- ice
check('ice is three cubes', cubes.length === 3, `${cubes.length}`)

const corners = []
for (const sx of [-1, 1]) {
  for (const sy of [-1, 1]) {
    for (const sz of [-1, 1]) corners.push(new THREE.Vector3(sx, sy, sz))
  }
}

const scratchMatrix = new THREE.Matrix4()
const scratchPosition = new THREE.Vector3()
const scratchScale = new THREE.Vector3()
const scratchQuaternion = new THREE.Quaternion()
const scratchEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const corner = new THREE.Vector3()

let worstIce = 0
let iceFinite = true
let restMinY = Infinity
let restMaxY = -Infinity

for (const cube of cubes) {
  for (let i = 0; i <= 200; i++) {
    const reveal = i / 200
    const s = iceState(cube, reveal, TIME, MOTION)
    if (!Number.isFinite(s.y) || !Number.isFinite(s.scale)) iceFinite = false

    scratchEuler.set(s.tilt, s.spin, cube.tilt * 0.5)
    scratchQuaternion.setFromEuler(scratchEuler)
    scratchPosition.set(s.x, s.y, s.z)
    scratchScale.setScalar(cube.size * s.scale)
    scratchMatrix.compose(scratchPosition, scratchQuaternion, scratchScale)

    for (const c of corners) {
      corner.copy(c).multiplyScalar(0.5).applyMatrix4(scratchMatrix)
      worstIce = Math.max(worstIce, Math.hypot(corner.x, corner.z) - drinkBoundAt(corner.y))
    }
  }

  const rest = iceState(cube, 1, TIME, MOTION)
  restMinY = Math.min(restMinY, rest.y - cube.size / 2)
  restMaxY = Math.max(restMaxY, rest.y + cube.size / 2)
}

const start = iceState(cubes[0], 0, TIME, MOTION)
const startTop = start.y + cubes[0].size / 2
check('no NaN anywhere in the ice', iceFinite)
check(
  'every ice cube fits inside the drink for the whole drop',
  worstIce <= 1e-9,
  `worst overhang ${worstIce.toExponential(2)}`,
)
// Phase 7 put a lid on the cup, so the drop now starts *inside* it: above the
// surface, so it reads as falling in, and below the rim, so it does not fall
// through the plastic.
check(
  'ice appears above the drink surface',
  startTop > drinkSurfaceY,
  `starts at y ${startTop.toFixed(3)} vs surface ${drinkSurfaceY.toFixed(3)}`,
)
check(
  'ice appears below the rim, so it never falls through the lid',
  startTop < cupModel.rimY,
  `starts at y ${startTop.toFixed(3)} vs rim ${cupModel.rimY}`,
)
check(
  'ice lands at the surface, not on the floor',
  restMinY > (drinkSurfaceY + drinkFloorY) / 2,
  `rests y ${restMinY.toFixed(3)} to ${restMaxY.toFixed(3)}, surface ${drinkSurfaceY.toFixed(3)}`,
)
check(
  'the ice is fully hidden at progress 0',
  cubes.every((cube) => iceState(cube, 0, TIME, MOTION).scale === 0),
)

// ---------------------------------------------------------------------- mint
check(
  'the leaf pool covers both tiers, not one',
  leaves.length === TIERS.mobile.mintCount + TIERS.desktop.mintCount,
  `${leaves.length} leaves checked across both tiers`,
)

/**
 * The leaf's real outline, transformed exactly as Mint.jsx transforms it.
 *
 * Phase 5 treated a leaf as a line of its own length; Phase 7's leaves are
 * pressed against the wall, where the *width* of the blade and the serration on
 * it are what decides whether one pokes through the plastic. So the check walks
 * the actual geometry.
 */
const leafVertices = buildLeafGeometry().attributes.position

const leafMatrix = new THREE.Matrix4()
const leafQuaternion = new THREE.Quaternion()
const leafEuler = new THREE.Euler(0, 0, 0, 'YXZ')
const leafPosition = new THREE.Vector3()
const leafScaleVector = new THREE.Vector3()
const leafPoint = new THREE.Vector3()

let worstMint = 0
let mintFinite = true
let mintMinY = Infinity
let mintMaxY = -Infinity
let mintWallHug = Infinity
const mintScale = []

for (const leaf of leaves) {
  for (let i = 0; i <= 24; i++) {
    const s = mintState(leaf, i / 24, TIME, MOTION)
    if (!Number.isFinite(s.x) || !Number.isFinite(s.scale)) mintFinite = false

    leafEuler.set(s.lean, s.heading, s.roll)
    leafQuaternion.setFromEuler(leafEuler)
    leafPosition.set(s.x, s.y, s.z)
    leafScaleVector.setScalar(leaf.length * s.scale)
    leafMatrix.compose(leafPosition, leafQuaternion, leafScaleVector)

    for (let v = 0; v < leafVertices.count; v++) {
      leafPoint.fromBufferAttribute(leafVertices, v).applyMatrix4(leafMatrix)
      // A leaf is a sheet, so its vertices *are* its surface — no half-size
      // correction, the way the cube and the sphere need one.
      worstMint = Math.max(
        worstMint,
        Math.hypot(leafPoint.x, leafPoint.z) - drinkBoundAt(leafPoint.y),
      )
      mintMinY = Math.min(mintMinY, leafPoint.y)
      mintMaxY = Math.max(mintMaxY, leafPoint.y)
    }
  }
  mintScale.push(mintState(leaf, 1, TIME, MOTION).scale)
  mintWallHug = Math.min(mintWallHug, leaf.radius / drinkBoundAt(leaf.y))
}

const drinkMidY = (drinkSurfaceY + drinkFloorY) / 2

check('no NaN anywhere in the mint', mintFinite)
check(
  'every leaf fits inside the drink, serrated margin and all',
  worstMint <= 1e-9,
  `worst overhang ${worstMint.toExponential(2)}`,
)
check(
  'mint is packed into the upper half of the drink, not floated on top',
  mintMinY > drinkMidY,
  `y ${mintMinY.toFixed(3)} to ${mintMaxY.toFixed(3)}, halfway ${drinkMidY.toFixed(3)}`,
)
check(
  'mint stays clear of the rim, so nothing pokes out of the open cup',
  mintMaxY < cupModel.rimY,
  `tallest point ${mintMaxY.toFixed(3)} vs rim ${cupModel.rimY}`,
)
check(
  'every leaf is pressed out towards the wall, not stacked on the axis',
  mintWallHug > 0.6,
  `closest leaf at ${(mintWallHug * 100).toFixed(0)}% of its room`,
)
check(
  'every leaf is fully grown by the end',
  mintScale.every((scale) => scale > 0.999),
  `min scale ${Math.min(...mintScale).toFixed(4)}`,
)

// --------------------------------------------------------------------- fruit
check(
  'every flavor has a fruit',
  flavors.every((flavor) => flavor.fruit?.kind && flavor.fruit?.radius > 0),
)

let worstFruit = 0
let fruitBelowRim = true
let fruitAboveFloor = true
let fruitMinY = Infinity
let fruitMaxY = -Infinity
let fruitTriangles = 0
let fruitSlack = 0
let fruitSliceCount = 0

for (const fruit of fruits) {
  fruit.updateMatrixWorld(true)

  fruit.traverse((child) => {
    if (!child.isMesh) return
    const position = child.geometry.attributes.position
    fruitTriangles += child.geometry.index
      ? child.geometry.index.count / 3
      : position.count / 3

    for (let i = 0; i < position.count; i++) {
      corner.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)
      worstFruit = Math.max(worstFruit, Math.hypot(corner.x, corner.z) - cupRadiusAt(corner.y))
      fruitSlack = Math.max(
        fruitSlack,
        Math.hypot(corner.x, corner.z) - drinkBoundAt(corner.y),
      )
      fruitMinY = Math.min(fruitMinY, corner.y)
      fruitMaxY = Math.max(fruitMaxY, corner.y)
      if (corner.y >= cupModel.rimY) fruitBelowRim = false
      if (corner.y <= drinkFloorY) fruitAboveFloor = false
    }
  })

  fruitSliceCount += fruit.children.length
  disposeFruit(fruit)
}

check(
  'every fruit vertex is inside the cup it sits in',
  worstFruit <= 1e-9,
  `worst overhang ${worstFruit.toExponential(2)}`,
)
check(
  'no fruit vertex reaches the rim',
  fruitBelowRim,
  `tallest point y ${fruitMaxY.toFixed(3)} vs rim ${cupModel.rimY}`,
)
check(
  'no fruit vertex reaches the floor',
  fruitAboveFloor,
  `lowest point y ${fruitMinY.toFixed(3)} vs floor ${drinkFloorY.toFixed(3)}`,
)
check(
  'the slices are wedged in the upper half of the drink',
  fruitMinY > drinkMidY,
  `y ${fruitMinY.toFixed(3)} to ${fruitMaxY.toFixed(3)}, halfway ${drinkMidY.toFixed(3)}`,
)
check(
  'the slices reach down to the drink surface, not just the top',
  fruitMinY <= drinkSurfaceY + 0.02,
  `lowest point y ${fruitMinY.toFixed(3)}, surface ${drinkSurfaceY.toFixed(3)}`,
)
check(
  'both tiers build the slice count they ask for',
  fruitSliceCount ===
    flavors.length * (TIERS.mobile.fruitSliceCount + TIERS.desktop.fruitSliceCount),
  `${fruitSliceCount} slices across four flavors and both tiers`,
)
console.log(
  `  ....  slices overhang the drink by ${fruitSlack.toExponential(2)} at their tightest (they sit against the cup, and the drink stops short of it), ${Math.round(fruitTriangles)} triangles across all four flavors`,
)

// -------------------------------------------------------------- shared bounds
check(
  'the drink is narrower than the rim it has to pass',
  drinkTopRadius < cupModel.widestRadius,
  `surface radius ${drinkTopRadius.toFixed(5)} < widest ${cupModel.widestRadius.toFixed(5)}`,
)
check(
  'every ingredient is bounded by the drink, not by a guess',
  drinkBoundAt(drinkSurfaceY + 0.02) === drinkTopRadius,
)
check(
  'the drink never widens past the cup interior',
  drinkTopRadius <= cupRadiusAt(cupModel.rimY) + 1e-9,
  `${drinkTopRadius.toFixed(5)} vs interior ${cupRadiusAt(cupModel.rimY).toFixed(5)}`,
)

// --------------------------------------------------------------------- summary
console.log('')
console.log(
  failures.length === 0
    ? `PASS: all checks green (${bubbles.length} rising and ${wallBubbles.length} wall bubbles, ${leaves.length} leaves, ${cubes.length} cubes, ${fruitSliceCount} slices across both tiers)`
    : `FAIL: ${failures.join(' | ')}`,
)
process.exit(failures.length === 0 ? 0 : 1)
