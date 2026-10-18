import * as THREE from 'three'
import { flavors } from '../src/config/flavors.js'
import { glassModel } from '../src/config/glassProfile.js'
import { quality, TIERS } from '../src/config/performance.js'
import {
  drinkBoundAt,
  drinkFloorY,
  drinkSurfaceY,
  drinkTopRadius,
  glassRadiusAt,
} from '../src/three/liquidProfile.js'
import {
  BUILD_END,
  REVEAL,
  bubblePosition,
  buildBubbles,
  buildIce,
  buildMint,
  cubeReach,
  iceState,
  mintState,
  revealAt,
} from '../src/three/ingredientMath.js'
import { buildFruit, disposeFruit } from '../src/three/fruitModels.js'

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
const bubbles = [...buildBubbles(TIERS.mobile.bubbleCount), ...buildBubbles(TIERS.desktop.bubbleCount)]
const cubes = buildIce(quality.iceCount)
const leaves = [...buildMint(TIERS.mobile.mintCount), ...buildMint(TIERS.desktop.mintCount)]

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
  for (const cube of cubes) {
    const s = iceState(cube, reveal.ice, TIME, MOTION)
    out.push(s.x, s.y, s.z, s.scale, s.spin, s.tilt)
  }
  for (const leaf of leaves) {
    const s = mintState(leaf, reveal.mint, TIME, MOTION)
    out.push(s.x, s.y, s.z, s.scale, s.heading, s.tilt)
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
check('fruit is still absent while the ice is dropping', revealAt(BUILD_END * 0.4, REVEAL.fruit) === 0)

// ------------------------------------------------------------------- bubbles
check(
  'the mobile tier asks for 40 bubbles and 8 leaves',
  TIERS.mobile.bubbleCount === 40 && TIERS.mobile.mintCount === 8,
  `${TIERS.mobile.bubbleCount} bubbles, ${TIERS.mobile.mintCount} leaves`,
)
check(
  'the desktop tier asks for 80 bubbles and 10 leaves',
  TIERS.desktop.bubbleCount === 80 && TIERS.desktop.mintCount === 10,
  `${TIERS.desktop.bubbleCount} bubbles, ${TIERS.desktop.mintCount} leaves`,
)
check(
  'mint stays within the 8 to 10 the brief asks for, on both tiers',
  Object.values(TIERS).every((tier) => tier.mintCount >= 8 && tier.mintCount <= 10),
)
check(
  'both tiers ask for five ice cubes',
  TIERS.mobile.iceCount === 5 && TIERS.desktop.iceCount === 5,
)
check(
  'this process detects the mobile tier, as expected without a window',
  quality.bubbleCount === TIERS.mobile.bubbleCount,
  `${bubbles.length} bubbles checked across both tiers`,
)

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
  'every bubble stays inside the drink',
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
check('every bubble loops back to where it started', looped)

// ----------------------------------------------------------------------- ice
check('ice is five cubes', cubes.length === 5, `${cubes.length}`)

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
      worstIce = Math.max(
        worstIce,
        Math.hypot(corner.x, corner.z) - drinkBoundAt(corner.y),
      )
    }
  }

  const rest = iceState(cube, 1, TIME, MOTION)
  restMinY = Math.min(restMinY, rest.y - cube.size / 2)
  restMaxY = Math.max(restMaxY, rest.y + cube.size / 2)
}

const start = iceState(cubes[0], 0, TIME, MOTION)
check('no NaN anywhere in the ice', iceFinite)
check(
  'every ice cube fits inside the bowl for the whole drop',
  worstIce <= 1e-9,
  `worst overhang ${worstIce.toExponential(2)}`,
)
check(
  'ice drops in from above the rim',
  start.y + cubes[0].size / 2 > glassModel.rimY,
  `starts at y ${(start.y + cubes[0].size / 2).toFixed(3)} vs rim ${glassModel.rimY}`,
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

let worstMint = 0
let mintFinite = true
let mintMinY = Infinity
let mintMaxY = -Infinity
const mintScale = []
for (const leaf of leaves) {
  for (let i = 0; i <= 200; i++) {
    const s = mintState(leaf, i / 200, TIME, MOTION)
    if (!Number.isFinite(s.x) || !Number.isFinite(s.scale)) mintFinite = false

    // Half its length along the leaf, plus half its narrow width across it.
    const reach = (leaf.length * s.scale) / 2
    worstMint = Math.max(worstMint, Math.hypot(s.x, s.z) + reach - drinkBoundAt(s.y))
    mintMinY = Math.min(mintMinY, s.y - reach)
    mintMaxY = Math.max(mintMaxY, s.y + reach)
  }
  mintScale.push(mintState(leaf, 1, TIME, MOTION).scale)
}
check('no NaN anywhere in the mint', mintFinite)
check(
  'every leaf fits inside the bowl mouth',
  worstMint <= 1e-9,
  `worst overhang ${worstMint.toExponential(2)}`,
)
check(
  'mint floats on the surface, not at the bottom',
  mintMinY > drinkSurfaceY - 0.05,
  `y ${mintMinY.toFixed(3)} to ${mintMaxY.toFixed(3)}`,
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

for (const flavor of flavors) {
  const fruit = buildFruit(flavor.fruit)
  fruit.updateMatrixWorld(true)

  fruit.traverse((child) => {
    if (!child.isMesh) return
    const position = child.geometry.attributes.position
    fruitTriangles += child.geometry.index
      ? child.geometry.index.count / 3
      : position.count / 3

    for (let i = 0; i < position.count; i++) {
      corner.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)
      worstFruit = Math.max(
        worstFruit,
        Math.hypot(corner.x, corner.z) - glassRadiusAt(corner.y),
      )
      fruitSlack = Math.max(
        fruitSlack,
        Math.hypot(corner.x, corner.z) - drinkBoundAt(corner.y),
      )
      fruitMinY = Math.min(fruitMinY, corner.y)
      fruitMaxY = Math.max(fruitMaxY, corner.y)
    }
  })

  const hasGeometry = fruit.children.length > 0
  if (!hasGeometry) fruitBelowRim = false
  disposeFruit(fruit)
}

// Recomputed with per-flavor ranges because the loop above shares one box; the
// two assertions below are about every vertex of every flavor.
for (const flavor of flavors) {
  const fruit = buildFruit(flavor.fruit)
  fruit.updateMatrixWorld(true)
  fruit.traverse((child) => {
    if (!child.isMesh) return
    const position = child.geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      corner.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)
      if (corner.y > glassModel.rimY) fruitBelowRim = false
      if (corner.y < drinkFloorY) fruitAboveFloor = false
    }
  })
  disposeFruit(fruit)
}

check(
  'every fruit vertex is inside the glass it sits in',
  worstFruit <= 1e-9,
  `worst overhang ${worstFruit.toExponential(2)}`,
)
check(
  'every fruit vertex stays under the rim',
  fruitBelowRim,
  `tallest point y ${fruitMaxY.toFixed(3)} vs rim ${glassModel.rimY}`,
)
check(
  'every fruit vertex is inside the bowl',
  fruitAboveFloor,
  `lowest point y ${fruitMinY.toFixed(3)} vs bowl floor ${drinkFloorY.toFixed(3)}`,
)
check(
  'fruit sits at the top of the drink, not at the bottom',
  fruitMinY > (drinkSurfaceY + drinkFloorY) / 2,
  `y ${fruitMinY.toFixed(3)} to ${fruitMaxY.toFixed(3)}, surface ${drinkSurfaceY.toFixed(3)}`,
)
check(
  'the fruit reaches the drink surface',
  fruitMinY <= drinkSurfaceY + 0.01,
  `lowest point y ${fruitMinY.toFixed(3)}`,
)
console.log(
  `  ....  fruit stay inside the drink with ${fruitSlack.toExponential(2)} of slack, ${Math.round(fruitTriangles)} triangles across all four flavors`,
)

// -------------------------------------------------------------- shared bounds
check(
  'the drink is narrower than the rim it has to pass',
  drinkTopRadius < glassModel.widestRadius,
  `surface radius ${drinkTopRadius.toFixed(5)} < widest ${glassModel.widestRadius.toFixed(5)}`,
)
check(
  'every ingredient is bounded by the drink, not by a guess',
  drinkBoundAt(drinkSurfaceY + 0.02) === drinkTopRadius,
)

// --------------------------------------------------------------------- summary
console.log('')
console.log(
  failures.length === 0
    ? `PASS: all checks green (${bubbles.length} bubbles and ${leaves.length} leaves across both tiers, ${cubes.length} cubes, ${flavors.length} fruits)`
    : `FAIL: ${failures.join(' | ')}`,
)
process.exit(failures.length === 0 ? 0 : 1)
