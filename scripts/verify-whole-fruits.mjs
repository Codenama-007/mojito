import * as THREE from 'three'
import { flavors } from '../src/config/flavors.js'
import { TIERS } from '../src/config/performance.js'
import { cupOuterRadiusAt } from '../src/three/liquidProfile.js'
import {
  FLY_OUT,
  WHOLE_FRUIT_SPRING,
  wholeFruitState,
  buildWholeFruits,
} from '../src/three/wholeFruitMath.js'
import { buildWholeFruit, disposeWholeFruit } from '../src/three/wholeFruits.js'

/**
 * The whole fruits, checked without a renderer.
 *
 * Three things are worth asserting here and nothing else is:
 *
 *  1. Nothing leaves the cup's own silhouette. Every orbit radius is derived
 *     from `cupOuterRadiusAt`, so this checks the derivation, not a guess.
 *  2. Nothing leaves the screen. The fruits sit outside the cup on purpose,
 *     which is exactly how they end up off the edge of a phone.
 *  3. Every fruit really is a unit bounding sphere, because the clearance and
 *     screen maths both treat `size * scale` as the fruit's reach. If a builder
 *     were 10% bigger than it claims, both of the checks above would pass while
 *     the fruit poked through the cup.
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

/**
 * The furthest a fruit's surface sits from the cup's axis, in cup units.
 *
 * Derived, not picked. A portrait phone is width-limited, so
 * `baseScale = viewport.width * 0.62` (hooks/useGlassBaseScale.js) and the
 * camera's own viewport is 3.6397 tall (fov 40 at z = 5), which makes the
 * half-width of the screen in cup units:
 *
 *   (viewport.width / 2) / (baseScale * heroScale)
 *     = (width / 2) / (0.62 * width * 0.78)
 *     = 1 / (2 * 0.62 * 0.78)
 *     = 1.034
 *
 * The width cancels, so this holds on every portrait phone. The hero is the
 * binding section because it draws the largest cup (0.78); every flavor and
 * content section is smaller and so has more room. 1.0 leaves ~3% of margin on
 * top of a bound that is itself the fruit's *surface*, not its centre.
 */
const MAX_OFFSCREEN_REACH = 1.0

const EMPTY = { value: 0, velocity: 0 }

// ------------------------------------------------------------------- the shapes

const built = flavors.map((flavor) => ({
  id: flavor.id,
  kind: flavor.fruit.kind,
  object: buildWholeFruit(flavor.fruit.kind, flavor.fruit.whole),
}))

const measured = built.map((entry) => {
  entry.object.updateMatrixWorld(true)
  const sphere = new THREE.Box3()
    .setFromObject(entry.object)
    .getBoundingSphere(new THREE.Sphere())

  let triangles = 0
  let vertices = 0
  let finite = true

  entry.object.traverse((child) => {
    if (!child.geometry) return

    const position = child.geometry.attributes.position
    vertices += position.count
    triangles += (child.geometry.index ? child.geometry.index.count : position.count) / 3

    for (let i = 0; i < position.count; i++) {
      if (
        !Number.isFinite(position.getX(i)) ||
        !Number.isFinite(position.getY(i)) ||
        !Number.isFinite(position.getZ(i))
      ) {
        finite = false
      }
    }
  })

  return { ...entry, sphere, triangles, vertices, finite }
})

console.log('\nwhole fruit shapes')

check('one whole fruit built per flavor', measured.length === flavors.length)

for (const entry of measured) {
  check(
    `${entry.id}: unit bounding sphere`,
    Math.abs(entry.sphere.radius - 1) < 0.02,
    `radius ${entry.sphere.radius.toFixed(4)}`,
  )

  check(
    `${entry.id}: centred on its origin`,
    entry.sphere.center.length() < 0.02,
    `offset ${entry.sphere.center.length().toFixed(4)}`,
  )

  check(`${entry.id}: all vertices finite`, entry.finite)
  check(`${entry.id}: under 4000 triangles`, entry.triangles <= 4000, `${entry.triangles} tris`)
  check(`${entry.id}: has geometry`, entry.vertices > 0, `${entry.vertices} vertices`)
}

// A builder that threw on an unknown kind must actually be reachable, or the
// guard is decorative.
let threwOnUnknown = false
try {
  buildWholeFruit('durian', flavors[0].fruit.whole)
} catch {
  threwOnUnknown = true
}
check('unknown fruit kind throws', threwOnUnknown)

for (const entry of built) disposeWholeFruit(entry.object)

// ------------------------------------------------------------------ the layouts

const layouts = {
  mobile: buildWholeFruits(TIERS.mobile.wholeFruitCount, 0xf00d),
  desktop: buildWholeFruits(TIERS.desktop.wholeFruitCount, 0xf00d),
}

console.log('\nwhole fruit layout')

check(
  'mobile orbits fewer fruits than desktop',
  TIERS.mobile.wholeFruitCount === 3 && TIERS.desktop.wholeFruitCount === 4,
  `${TIERS.mobile.wholeFruitCount} / ${TIERS.desktop.wholeFruitCount}`,
)

for (const [tier, set] of Object.entries(layouts)) {
  check(`${tier}: one layout per fruit`, set.length === TIERS[tier].wholeFruitCount)

  check(
    `${tier}: layouts are finite`,
    set.every((fruit) =>
      Object.values(fruit).every((value) => typeof value !== 'number' || Number.isFinite(value)),
    ),
  )

  check(
    `${tier}: layouts are deterministic`,
    JSON.stringify(set) === JSON.stringify(buildWholeFruits(set.length, 0xf00d)),
  )

  check(
    `${tier}: every fruit gets its own height`,
    new Set(set.map((fruit) => fruit.y.toFixed(4))).size === set.length,
  )
}

// ------------------------------------------------------- the sweep, per fruit

const STEPS = 320
const PRESENCES = [0, 0.05, 0.25, 0.5, 0.75, 1, 1.16, 1.25]

let clearanceWorst = Infinity
let offscreenWorst = 0
let heightLow = Infinity
let heightHigh = -Infinity
let nanFound = false

for (const set of Object.values(layouts)) {
  for (const fruit of set) {
    for (const presence of PRESENCES) {
      for (let step = 0; step <= STEPS; step++) {
        const time = (step / STEPS) * 40
        const progress = step / STEPS
        const state = wholeFruitState(fruit, presence, time, progress, 1)

        if (
          !Number.isFinite(state.x) ||
          !Number.isFinite(state.y) ||
          !Number.isFinite(state.z) ||
          !Number.isFinite(state.scale)
        ) {
          nanFound = true
          continue
        }

        const scale = Math.max(state.scale, 0)
        const reach = fruit.size * scale
        const radial = Math.hypot(state.x, state.z)

        // The cup widens all the way to the mouth, so the whole sphere the
        // fruit occupies has to clear the outermost radius anywhere it spans.
        const outer = Math.max(
          cupOuterRadiusAt(state.y - reach),
          cupOuterRadiusAt(state.y),
          cupOuterRadiusAt(state.y + reach),
        )

        clearanceWorst = Math.min(clearanceWorst, radial - reach - outer)
        heightLow = Math.min(heightLow, state.y - reach)
        heightHigh = Math.max(heightHigh, state.y + reach)

        // Only while the fruit is actually drawn: a fruit on its way out is
        // allowed to travel outward, because it is shrinking to nothing.
        if (scale >= 0.05) {
          offscreenWorst = Math.max(
            offscreenWorst,
            Math.abs(state.x) + reach,
            Math.abs(state.z) + reach,
          )
        }
      }
    }
  }
}

console.log('\nwhole fruit bounds')

check('no NaN across the sweep', !nanFound)
check(
  'every fruit clears the glass silhouette',
  clearanceWorst >= 0,
  `worst margin ${clearanceWorst.toFixed(4)}`,
)
check(
  'every drawn fruit stays on screen',
  offscreenWorst <= MAX_OFFSCREEN_REACH,
  `worst reach ${offscreenWorst.toFixed(4)} of ${MAX_OFFSCREEN_REACH}`,
)
check(
  'fruits stay around the bowl, not through it',
  heightLow > 0.05 && heightHigh < 1.3,
  `y ${heightLow.toFixed(3)} to ${heightHigh.toFixed(3)}`,
)

// ------------------------------------------------------------ the swap, item 2

const swap = layouts.desktop.map((fruit) => {
  const at = (presence) => wholeFruitState(fruit, presence, 0, 0, 0)
  return {
    fruit,
    home: at(1),
    gone: at(0),
    mid: at(0.5),
  }
})

check(
  'a fruit that has left is scaled to nothing',
  swap.every((entry) => entry.gone.scale === 0),
)
check(
  'a fruit at rest is full size',
  swap.every((entry) => entry.home.scale === 1),
)

check(
  'leaving pushes a fruit outward, monotonically',
  swap.every((entry) => {
    const radius = (state) => Math.hypot(state.x, state.z)
    return radius(entry.mid) > radius(entry.home)
  }),
)

const outerTravel = swap.map(
  (entry) => Math.hypot(entry.gone.x, entry.gone.z) - Math.hypot(entry.home.x, entry.home.z),
)

check(
  'outward travel is about FLY_OUT for every fruit',
  outerTravel.every((travel) => travel >= FLY_OUT * 0.9 && travel <= FLY_OUT * 1.1),
  `${Math.min(...outerTravel).toFixed(3)} to ${Math.max(...outerTravel).toFixed(3)} glass units`,
)

check(
  'a fruit travels outward continuously as it leaves',
  swap.every((entry) => {
    const radius = (presence) => {
      const state = wholeFruitState(entry.fruit, presence, 0, 0, 0)
      return Math.hypot(state.x, state.z)
    }

    let previous = radius(1)
    for (let step = 1; step <= 20; step++) {
      const next = radius(1 - step / 20)
      if (next < previous) return false
      previous = next
    }

    return true
  }),
)

// The spring has to settle inside the half second the brief asks for, and its
// overshoot is what OVERSHOOT_ALLOWANCE in wholeFruitMath.js has to cover.
const simulate = (presenceTarget, dt = 1 / 60, seconds = 1.2) => {
  const spring = { ...EMPTY }
  const { stiffness, damping } = WHOLE_FRUIT_SPRING
  let peak = 0
  let settled = null

  for (let t = 0; t < seconds; t += dt) {
    spring.velocity +=
      (presenceTarget - spring.value) * stiffness * dt - spring.velocity * damping * dt
    spring.value += spring.velocity * dt
    peak = Math.max(peak, spring.value)

    if (settled === null && Math.abs(spring.value - presenceTarget) < 0.01) settled = t
  }

  return { peak, settled }
}

const growing = simulate(1)

check('the swap settles in about half a second', growing.settled < 0.6, `${growing.settled.toFixed(2)}s`)
check('the incoming fruit bounces once', growing.peak > 1.02, `overshoot to ${growing.peak.toFixed(3)}`)
check(
  'the bounce stays inside the clearance allowance',
  growing.peak <= 1.25,
  `${growing.peak.toFixed(3)} of 1.25`,
)

// --------------------------------------------------------------- reduced motion

const still = wholeFruitState(layouts.desktop[0], 1, 0, 0.4, 0)
const later = wholeFruitState(layouts.desktop[0], 1, 900, 0.4, 0)

check(
  'reduced motion stops the orbit and the bob',
  still.x === later.x && still.y === later.y && still.z === later.z,
)

check(
  'reduced motion still follows the scroll',
  wholeFruitState(layouts.desktop[0], 1, 0, 0.9, 0).x !== still.x,
)

console.log('')

if (failures.length > 0) {
  console.error(`${failures.length} whole-fruit check(s) failed\n`)
  process.exit(1)
}

console.log('all whole-fruit checks passed\n')
