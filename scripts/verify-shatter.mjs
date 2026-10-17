import * as THREE from 'three'
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

const shards = buildShards(60)
const out = new THREE.Vector3()
const quat = new THREE.Quaternion()

// ---------------------------------------------------------------- reversibility
// Sweep up, then sweep down, and compare every shard at the same breakProgress.
const STEPS = 200

const sampleUp = []
for (let i = 0; i <= STEPS; i++) {
  const bp = i / STEPS
  sampleUp.push({
    bp,
    transforms: shards.map((shard) => {
      const ti = shardTi(shard, progressToT(bp))
      const pos = shardDisplacement(shard, ti, new THREE.Vector3()).toArray()
      const rot = shardRotation(shard, ti, new THREE.Quaternion()).toArray()
      return [...pos, ...rot, shardFade(ti)]
    }),
  })
}

const sampleDown = []
for (let i = STEPS; i >= 0; i--) {
  const bp = i / STEPS
  sampleDown.push({
    bp,
    transforms: shards.map((shard) => {
      const ti = shardTi(shard, progressToT(bp))
      const pos = shardDisplacement(shard, ti, new THREE.Vector3()).toArray()
      const rot = shardRotation(shard, ti, new THREE.Quaternion()).toArray()
      return [...pos, ...rot, shardFade(ti)]
    }),
  })
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

// Shards must start inside the glass, but the glass is a cylinder: the radial
// constraint and the vertical constraint have to be checked separately.
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
  'shard origins stay inside the glass wall',
  worstRadial <= 0.445,
  `max radial ${worstRadial.toFixed(3)} vs interior 0.445`,
)
check(
  'shard origins stay within the glass height',
  minY >= -0.5 && maxY <= 0.5,
  `y range ${minY.toFixed(3)} to ${maxY.toFixed(3)}`,
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

// ------------------------------------------------------------------------ sane
let finite = true
let maxTravel = 0
for (const shard of shards) {
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
  'travel stays within a sane multiple of glass size',
  maxTravel < 6,
  `max distance ${maxTravel.toFixed(2)} glass-height units`,
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
