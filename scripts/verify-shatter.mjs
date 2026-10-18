import * as THREE from 'three'
import { cupModel, lidModel, shardSpawns } from '../src/config/cupProfile.js'
import { cupOuterRadiusAt, cupRadiusAt } from '../src/three/liquidProfile.js'
import {
  BREAK_START,
  buildShards,
  progressToT,
  shardDisplacement,
  shardFade,
  shardRotation,
  shardTi,
} from '../src/three/shardMath.js'

/**
 * The shatter, checked without a renderer.
 *
 * Phase 4 measured the spawn points off public/models/glass.glb. Phase 7 builds
 * the cup in code, so there is nothing to measure: config/cupProfile.js computes
 * the points and this file checks the computation — that they sit on the real
 * surface, that they cover the lid as well as the body, and that the interior
 * profile the drink is built from cannot escape the outer one.
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

/** Matches Shatter.jsx: the number shard sizes and speeds are scaled by. */
const WIDTH = cupModel.widestRadius * 2

/** The lid clips *over* the rim, so it is legitimately a little wider. */
const WIDEST_RADIUS = Math.max(cupModel.widestRadius, lidModel.radius)

const shards = buildShards(60, { spawns: shardSpawns, width: WIDTH })
const out = new THREE.Vector3()
const quat = new THREE.Quaternion()

// ---------------------------------------------------------------- reversibility
// Sweep up, then sweep down, and compare every shard at the same breakProgress.
const STEPS = 200

const sampleAt = (bp) =>
  shards.map((shard) => {
    const ti = shardTi(shard, progressToT(bp))
    const pos = shardDisplacement(shard, ti, new THREE.Vector3()).toArray()
    const rot = shardRotation(shard, ti, new THREE.Quaternion()).toArray()
    return [...pos, ...rot, shardFade(ti)]
  })

const sampleUp = []
for (let i = 0; i <= STEPS; i++) {
  const bp = i / STEPS
  sampleUp.push({ bp, transforms: sampleAt(bp) })
}

const sampleDown = []
for (let i = STEPS; i >= 0; i--) {
  const bp = i / STEPS
  sampleDown.push({ bp, transforms: sampleAt(bp) })
}

// sampleDown is reversed relative to sampleUp; align by breakProgress.
const downByBp = new Map(sampleDown.map((entry) => [entry.bp, entry.transforms]))

let worstDelta = 0
let mismatches = 0
for (const { bp, transforms } of sampleUp) {
  const reverse = downByBp.get(bp)
  for (let s = 0; s < transforms.length; s++) {
    for (let k = 0; k < transforms[s].length; k++) {
      const delta = Math.abs(transforms[s][k] - reverse[s][k])
      if (delta > worstDelta) worstDelta = delta
      if (delta > 1e-12) mismatches++
    }
  }
}

check(
  'scrolling back up retraces the exact same path',
  mismatches === 0,
  `worst delta ${worstDelta.toExponential(2)} across ${STEPS * shards.length} samples`,
)

// ------------------------------------------------------------------- monotonic
let fadeMonotonic = true
let fadeAtEnd = 0
for (const shard of shards) {
  let previous = shardFade(shardTi(shard, 0))
  for (let i = 1; i <= STEPS; i++) {
    const next = shardFade(shardTi(shard, i / STEPS))
    if (next > previous + 1e-12) fadeMonotonic = false
    previous = next
  }
  fadeAtEnd = Math.max(fadeAtEnd, previous)
}
check('alpha falls monotonically, never rises', fadeMonotonic)
check('every shard is fully faded by the end', fadeAtEnd < 1e-9, `max residual ${fadeAtEnd}`)

// ---------------------------------------------------------------- break point
const tAtBreak = progressToT(BREAK_START)
const tBeforeBreak = progressToT(BREAK_START - 0.001)
check('t is 0 at the break point', tAtBreak === 0, `t=${tAtBreak}`)
check('t is 0 just before the break', tBeforeBreak === 0, `t=${tBeforeBreak}`)
check('t is 1 at the end', progressToT(1) === 1)

// ------------------------------------------------------------- spawn locations
// The cup is not centred on its origin: its local space runs y 0 (base) to 1
// (rim), and the lid's dome runs on up to lidModel.topY. The shards are
// siblings of the cup, so they share that space. An earlier version spawned
// them at y -0.39..0.39, and the assertion here agreed with it, so the burst
// came out of the floor and nothing caught it.
let worstRadial = 0
let minY = Infinity
let maxY = -Infinity
for (const shard of shards) {
  const { x, y, z } = shard.origin
  worstRadial = Math.max(worstRadial, Math.hypot(x, z))
  minY = Math.min(minY, y)
  maxY = Math.max(maxY, y)
}

check(
  'shard origins sit on or inside the cup surface',
  worstRadial <= WIDEST_RADIUS + 1e-6,
  `max radial ${worstRadial.toFixed(5)} vs widest ${WIDEST_RADIUS.toFixed(5)}`,
)
check(
  'shard origins stay within the cup and its lid',
  minY >= 0 && maxY <= lidModel.topY + 1e-6,
  `y range ${minY.toFixed(3)} to ${maxY.toFixed(3)} of ${lidModel.topY.toFixed(3)}`,
)
check(
  'the burst spans the whole cup, not one end of it',
  maxY - minY > 0.5,
  `y spread ${(maxY - minY).toFixed(3)} of ${lidModel.topY.toFixed(3)}`,
)
check(
  'every shard starts on the surface, not in empty space',
  worstRadial > WIDEST_RADIUS * 0.3,
  `furthest origin ${worstRadial.toFixed(5)} from the axis`,
)
// Phase 7 put the lid in the burst, so the spawns have to reach above the rim.
check(
  'the lid breaks too, and its shards start on the dome',
  maxY > cupModel.rimY + 0.05,
  `highest origin ${maxY.toFixed(3)} vs rim ${cupModel.rimY.toFixed(3)}`,
)

// Origins must be points on the computed surface, not arbitrary offsets.
const spawnSet = new Set(shardSpawns.map((p) => p.map((v) => v.toFixed(6)).join(',')))
let unmatched = 0
for (const shard of shards) {
  const key = [shard.origin.x, shard.origin.y, shard.origin.z]
    .map((v) => v.toFixed(6))
    .join(',')
  if (!spawnSet.has(key)) unmatched++
}
check(
  'every shard origin is a computed surface point',
  unmatched === 0,
  `${shardSpawns.length} computed points, ${unmatched} unmatched`,
)

// ------------------------------------------------------------------- profile
// The interior is a two-point cone, so the checks are the ones a cone can fail:
// it must rise without reversing, its mouth must be its widest part, and it
// must stay behind the outer silhouette at every height — including through the
// fillet, which is the one place the gap is not a constant.
const INTERIOR_BASE = cupModel.floorThickness
let interiorRises = true
let previousRadius = cupRadiusAt(INTERIOR_BASE + 1e-6)

for (let y = INTERIOR_BASE + 0.01; y <= cupModel.rimY; y += 0.01) {
  const radius = cupRadiusAt(y)
  if (radius < previousRadius - 1e-9) interiorRises = false
  previousRadius = radius
}

check('the interior rises to the mouth with no step or reversal', interiorRises)

const mouthRadius = cupRadiusAt(cupModel.rimY)
let widestUntilMouth = true
for (let y = INTERIOR_BASE + 0.01; y < cupModel.rimY; y += 0.01) {
  if (cupRadiusAt(y) > mouthRadius + 1e-9) widestUntilMouth = false
}
check(
  'the mouth is the widest part of the cup interior',
  widestUntilMouth,
  `mouth ${mouthRadius.toFixed(5)}`,
)

let thinnestWall = Infinity
let thickestWall = 0
for (let y = INTERIOR_BASE + 0.01; y <= cupModel.rimY; y += 0.01) {
  const wall = cupOuterRadiusAt(y) - cupRadiusAt(y)
  thinnestWall = Math.min(thinnestWall, wall)
  thickestWall = Math.max(thickestWall, wall)
}
check(
  'the drink stays inside the plastic at every height',
  thinnestWall > 0,
  `thinnest wall ${thinnestWall.toFixed(5)}`,
)
check(
  'the wall never doubles back on itself',
  thickestWall < cupModel.wallThickness * 2,
  `thickest ${thickestWall.toFixed(5)} vs ${cupModel.wallThickness}`,
)

// ------------------------------------------------------------------- staggering
const midT = 0.5
const tis = shards.map((shard) => shardTi(shard, midT))
const spread = Math.max(...tis) - Math.min(...tis)
check(
  'shards are staggered rather than moving as one',
  spread > 0.05,
  `ti spread ${spread.toFixed(3)} at t=0.5`,
)
check(
  'all shards move by the end',
  shards.every((shard) => shardTi(shard, 1) === 1),
)

// -------------------------------------------------------------- burst scale
let finite = true
let maxTravel = 0
let maxShardSize = 0
for (const shard of shards) {
  maxShardSize = Math.max(maxShardSize, shard.scale)
  for (let i = 0; i <= STEPS; i++) {
    const ti = shardTi(shard, i / STEPS)
    shardDisplacement(shard, ti, out)
    shardRotation(shard, ti, quat)
    if (!Number.isFinite(out.x) || !Number.isFinite(out.y) || !Number.isFinite(out.z)) {
      finite = false
    }
    if (!Number.isFinite(quat.x) || !Number.isFinite(quat.w)) finite = false
    maxTravel = Math.max(maxTravel, out.length())
  }
}
check('no NaN anywhere in the burst', finite)
check(
  'travel stays within a sane multiple of cup height',
  maxTravel < 6,
  `max distance ${maxTravel.toFixed(2)} of 1.0`,
)
// The shard triangle spans about 1 unit across, so its scale is its width.
check(
  'no shard is larger than the cup it came from',
  maxShardSize < WIDTH,
  `largest shard ${maxShardSize.toFixed(3)} vs cup width ${WIDTH.toFixed(3)}`,
)

// Quaternions must stay unit length, or instances render scaled/sheared.
let worstQuatError = 0
for (const shard of shards) {
  for (let i = 0; i <= STEPS; i++) {
    const ti = shardTi(shard, i / STEPS)
    shardRotation(shard, ti, quat)
    worstQuatError = Math.max(worstQuatError, Math.abs(quat.length() - 1))
  }
}
check(
  'rotation quaternions stay unit length',
  worstQuatError < 1e-9,
  `worst error ${worstQuatError.toExponential(2)}`,
)

// --------------------------------------------------------------------- summary
console.log('')
console.log(
  failures.length === 0
    ? `PASS: all checks green (${shards.length} shards, ${STEPS} scroll steps)`
    : `FAIL: ${failures.join(' | ')}`,
)
process.exit(failures.length === 0 ? 0 : 1)
