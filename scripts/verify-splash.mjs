import { flavors } from '../src/config/flavors.js'
import { TIERS } from '../src/config/performance.js'
import {
  BURST_LIFE,
  GRAVITY,
  RIM_RADIUS,
  RIM_Y,
  RING_LIFE,
  ambientState,
  buildAmbient,
  buildBurst,
  burstDropletState,
  burstFade,
  ringState,
} from '../src/three/splashMath.js'

/**
 * The splash, checked without a renderer.
 *
 * The interesting claims are that it starts on the rim and not inside the
 * drink, that it is genuinely ballistic, that it ends — a splash that loops is
 * the failure mode the brief names — and that its colours come from config
 * rather than from a component.
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

const EPSILON = 1e-6

// ------------------------------------------------------------------- the config

const hexToRgb = (hex) => {
  const value = Number.parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const luminance = (hex) => {
  const [r, g, b] = hexToRgb(hex)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

console.log('\nsplash colours')

check(
  'every flavor has a valid splashTint',
  flavors.every((flavor) => /^#[0-9a-fA-F]{6}$/.test(flavor.splashTint)),
)

check(
  'every splashTint is lighter than its liquid',
  flavors.every((flavor) => luminance(flavor.splashTint) > luminance(flavor.liquidColor)),
  flavors.map((f) => `${f.id} +${Math.round(luminance(f.splashTint) - luminance(f.liquidColor))}`).join(', '),
)

check(
  'splashTint is distinct per flavor',
  new Set(flavors.map((flavor) => flavor.splashTint)).size === flavors.length,
)

check(
  'every flavor carries whole-fruit colours',
  flavors.every(
    (flavor) =>
      flavor.fruit.whole &&
      /^#[0-9a-fA-F]{6}$/.test(flavor.fruit.whole.skin) &&
      /^#[0-9a-fA-F]{6}$/.test(flavor.fruit.whole.skinAlt) &&
      flavor.fruit.whole.detail !== undefined,
  ),
)

// -------------------------------------------------------------- the burst setup

const bursts = {
  mobile: buildBurst(TIERS.mobile.splashDroplets),
  desktop: buildBurst(TIERS.desktop.splashDroplets),
}

console.log('\nsplash burst')

check(
  'mobile fires fewer droplets than desktop',
  TIERS.mobile.splashDroplets === 30 && TIERS.desktop.splashDroplets === 60,
  `${TIERS.mobile.splashDroplets} / ${TIERS.desktop.splashDroplets}`,
)

for (const [tier, burst] of Object.entries(bursts)) {
  check(
    `${tier}: one velocity and size per droplet`,
    burst.length === TIERS[tier].splashDroplets &&
      burst.every(
        (droplet) =>
          Number.isFinite(droplet.vx) &&
          Number.isFinite(droplet.vy) &&
          Number.isFinite(droplet.vz) &&
          droplet.size > 0 &&
          droplet.delay >= 0 &&
          droplet.delay < 0.1,
      ),
  )

  check(`${tier}: the burst is deterministic`, JSON.stringify(burst) === JSON.stringify(buildBurst(burst.length)))

  check(
    `${tier}: every droplet leaves the rim under gravity alone`,
    burst.every((droplet) => droplet.vy > 0 && droplet.vy < 1.71),
  )

  check(
    `${tier}: the spray opens over the rim, not through it`,
    // Aimed outward as well as up: no droplet heads back down over the drink.
    burst.every((droplet) => Math.hypot(droplet.vx, droplet.vz) > 0.1),
    `outward ${Math.min(...burst.map((d) => Math.hypot(d.vx, d.vz))).toFixed(3)} to ${Math.max(...burst.map((d) => Math.hypot(d.vx, d.vz))).toFixed(3)}`,
  )
}

// ------------------------------------------------------------- the burst flight

const burst = bursts.desktop
const ageAt = (droplet) => droplet.delay + EPSILON

let startOffRim = true
let ballistic = true
let nanFound = false
let apexHigh = -Infinity
let apexLow = Infinity
let outwardWorst = 0
let scalePeak = 0
let aliveAtStart = 0

for (const droplet of burst) {
  const start = burstDropletState(droplet, ageAt(droplet))
  const radial = Math.hypot(start.x, start.z)

  if (Math.abs(radial - RIM_RADIUS) > 1e-3 || Math.abs(start.y - RIM_Y) > 1e-3) {
    startOffRim = false
  }

  if (start.alive) aliveAtStart += 1

  // Gravity is the only force: the vertical speed must fall off linearly.
  const speedAt = (age) => {
    const early = burstDropletState(droplet, age + EPSILON)
    const late = burstDropletState(droplet, age + 0.1)
    return (late.y - early.y) / 0.1
  }

  const first = speedAt(droplet.delay + 0.02)
  const second = speedAt(droplet.delay + 0.2)
  if (!(second < first) || Math.abs(first - second - GRAVITY * 0.18) > 0.01) {
    ballistic = false
  }

  let peak = -Infinity
  let peakScale = 0

  for (let age = droplet.delay; age <= BURST_LIFE; age += BURST_LIFE / 300) {
    const state = burstDropletState(droplet, age)

    if (
      !Number.isFinite(state.x) ||
      !Number.isFinite(state.y) ||
      !Number.isFinite(state.z) ||
      !Number.isFinite(state.scale)
    ) {
      nanFound = true
      continue
    }

    peak = Math.max(peak, state.y)
    peakScale = Math.max(peakScale, state.scale)
    outwardWorst = Math.max(outwardWorst, Math.hypot(state.x, state.z))
  }

  apexHigh = Math.max(apexHigh, peak)
  apexLow = Math.min(apexLow, peak)
  scalePeak = Math.max(scalePeak, peakScale)
}

check('every droplet starts on the rim', startOffRim)
check('every droplet is alive at the start of its own flight', aliveAtStart === burst.length)
check('no NaN across the flight', !nanFound)
check('the flight is purely ballistic', ballistic)
check(
  'every droplet rises above the rim',
  apexLow > RIM_Y + 0.1,
  `lowest apex +${(apexLow - RIM_Y).toFixed(3)}`,
)
check(
  'the spray stays a splash, not a shower',
  outwardWorst < 0.95,
  `widest ${outwardWorst.toFixed(3)} from the axis`,
)
check('droplets are visible, not sub-pixel specks', scalePeak > 0.012, `peak radius ${scalePeak.toFixed(4)}`)

// ------------------------------------------------------------------ it must end

let aliveAtEnd = 0
for (const droplet of burst) {
  if (burstDropletState(droplet, BURST_LIFE).alive) aliveAtEnd += 1
  if (burstDropletState(droplet, BURST_LIFE * 5).alive) aliveAtEnd += 1
}

check('the burst is over by BURST_LIFE', aliveAtEnd === 0)
check(
  'the burst opacity ends at zero',
  burstFade(BURST_LIFE) < 1e-9 && burstFade(BURST_LIFE * 5) === 0,
  `residual ${burstFade(BURST_LIFE).toExponential(1)}`,
)
check('the burst starts fully opaque', burstFade(0) === 1)
check(
  'the burst fades monotonically',
  Array.from({ length: 60 }, (_, i) => burstFade((i / 59) * BURST_LIFE)).every(
    (value, i, all) => i === 0 || value <= all[i - 1] + 1e-9,
  ),
)

// ------------------------------------------------------------------- the crown

const ringAges = Array.from({ length: 40 }, (_, i) => (i / 39) * RING_LIFE)
const rings = ringAges.map((age) => ringState(age))

check(
  'the crown only ever expands',
  rings.every((ring, i) => i === 0 || ring.radius >= rings[i - 1].radius),
  `${rings[0].radius.toFixed(3)} to ${rings[rings.length - 1].radius.toFixed(3)}`,
)
check(
  'the crown starts at the rim radius',
  Math.abs(rings[0].radius - RIM_RADIUS) < 1e-9,
)
check('the crown fades out', ringState(RING_LIFE).opacity === 0 && !ringState(RING_LIFE).alive)
check('the crown is shorter than the burst', RING_LIFE < BURST_LIFE)

// ----------------------------------------------------------- the drifting spray

const ambient = {
  mobile: buildAmbient(TIERS.mobile.ambientDroplets),
  desktop: buildAmbient(TIERS.desktop.ambientDroplets),
}

console.log('\nsplash drift')

check(
  'the drifting spray is six to ten droplets',
  TIERS.mobile.ambientDroplets === 6 && TIERS.desktop.ambientDroplets === 10,
  `${TIERS.mobile.ambientDroplets} / ${TIERS.desktop.ambientDroplets}`,
)

check(
  'the drifting spray is much smaller than the burst',
  TIERS.desktop.ambientDroplets < TIERS.desktop.splashDroplets,
)

const driftDroplets = ambient.desktop
let driftNan = false
let driftScaleLow = Infinity
let driftScaleHigh = 0
let driftRadiusLow = Infinity
let driftRadiusHigh = 0

for (const droplet of driftDroplets) {
  check(
    'drifting droplets have a base or tint colour',
    droplet.tint === 0 || droplet.tint === 1,
  )

  for (let step = 0; step < 400; step++) {
    const time = step * 0.4

    for (const motion of [0, 1]) {
      const state = ambientState(droplet, time, motion, step / 399)

      if (
        !Number.isFinite(state.x) ||
        !Number.isFinite(state.y) ||
        !Number.isFinite(state.z) ||
        !Number.isFinite(state.scale)
      ) {
        driftNan = true
        continue
      }

      driftScaleLow = Math.min(driftScaleLow, state.scale)
      driftScaleHigh = Math.max(driftScaleHigh, state.scale)
      driftRadiusLow = Math.min(driftRadiusLow, Math.hypot(state.x, state.z))
      driftRadiusHigh = Math.max(driftRadiusHigh, Math.hypot(state.x, state.z))
    }
  }
}

check('no NaN in the drifting spray', !driftNan)
check(
  'drifting droplets stay visible rather than blinking off',
  driftScaleLow > 0.001,
  `smallest ${driftScaleLow.toFixed(4)}`,
)
check(
  'drifting droplets sit outside the bowl',
  driftRadiusLow > 0.2,
  `${driftRadiusLow.toFixed(3)} to ${driftRadiusHigh.toFixed(3)} from the axis`,
)

const driftStill = ambientState(driftDroplets[0], 0, 0, 0.3)
const driftLater = ambientState(driftDroplets[0], 500, 0, 0.3)

check(
  'reduced motion stops the drift and the swell',
  driftStill.x === driftLater.x && driftStill.y === driftLater.y && driftStill.scale === driftLater.scale,
)

check('reduced motion still has droplets', driftStill.scale > 0.001)

console.log('')

if (failures.length > 0) {
  console.error(`${failures.length} splash check(s) failed\n`)
  process.exit(1)
}

console.log('all splash checks passed\n')
