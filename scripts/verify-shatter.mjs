import * as THREE from 'three'
import { glassModel, interiorProfile, shardSpawns } from '../src/config/glassProfile.js'
import {
  BREAK_START,
  buildShards,
  progressToT,
  shardDisplacement,
  shardFade,
  shardRotation,
  shardTi,
} from '../src/three/shardMath.js'

const failures = []
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`)
  } else {
    console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`)
    failures.push(name)
  }
}

const WIDTH = glassModel.widestRadius * 2
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
// The glass is not centred on its origin: its local space runs y 0 (base) to
// 1 (rim). The shards are siblings of the glass, so they share that space. An
// earlier version spawned them at y -0.39..0.39, and the assertion here agreed
// with it, so the burst came out of the floor and nothing caught it.
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
  'shard origins sit on or inside the glass surface',
  worstRadial <= glassModel.widestRadius + 1e-6,
  `max radial ${worstRadial.toFixed(5)} vs widest ${glassModel.widestRadius.toFixed(5)}`,
)
check(
  'shard origins stay within the glass height',
  minY >= 0 && maxY <= 1,
  `y range ${minY.toFixed(3)} to ${maxY.toFixed(3)}`,
)
check(
  'the burst spans the whole glass, not one end of it',
  maxY - minY > 0.5,
  `y spread ${(maxY - minY).toFixed(3)} of 1.0`,
)
check(
  'every shard starts on the mesh, not in empty space',
  worstRadial > glassModel.widestRadius * 0.3,
  `furthest origin ${worstRadial.toFixed(5)} from the axis`,
)

// Origins must be points that were actually measured on the glass.
const spawnSet = new Set(shardSpawns.map((p) => p.map((v) => v.toFixed(6)).join(',')))
let unmatched = 0
for (const shard of shards) {
  const key = [shard.origin.x, shard.origin.y, shard.origin.z]
    .map((v) => v.toFixed(6))
    .join(',')
  if (!spawnSet.has(key)) unmatched++
}
check(
  'every shard origin is a measured surface point',
  unmatched === 0,
  `${shardSpawns.length} measured points, ${unmatched} unmatched`,
)

// ------------------------------------------------------------------- profile
let monotoneUp = true
let monotoneDown = true
let widestAt = 0
for (let i = 1; i < interiorProfile.length; i++) {
  const [radius, y] = interiorProfile[i]
  const [previousRadius, previousY] = interiorProfile[i - 1]
  if (y <= previousY) monotoneUp = false
  if (radius > interiorProfile[widestAt][0]) widestAt = i
}
for (let i = widestAt + 1; i < interiorProfile.length; i++) {
  if (interiorProfile[i][0] >= interiorProfile[i - 1][0]) monotoneDown = false
}
const interiorMax = Math.max(...interiorProfile.map((p) => p[0]))
check('interior profile rises then falls, with no stray ring', monotoneUp && monotoneDown)
check(
  'interior stays inside the outer silhouette',
  interiorMax < glassModel.widestRadius,
  `interior ${interiorMax.toFixed(5)} < outer ${glassModel.widestRadius.toFixed(5)}`,
)
check(
  'the bowl is narrower at the rim than at its middle',
  interiorProfile[interiorProfile.length - 1][0] < interiorMax,
  `rim ${interiorProfile[interiorProfile.length - 1][0].toFixed(5)} vs middle ${interiorMax.toFixed(5)}`,
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
  'travel stays within a sane multiple of glass height',
  maxTravel < 6,
  `max distance ${maxTravel.toFixed(2)} of 1.0`,
)
// The shard triangle spans about 1 unit across, so its scale is its width.
check(
  'no shard is larger than the glass it came from',
  maxShardSize < WIDTH,
  `largest shard ${maxShardSize.toFixed(3)} vs glass width ${WIDTH.toFixed(3)}`,
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
