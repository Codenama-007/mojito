import * as THREE from 'three'
import { flavorDirectionFor, flavors } from '../src/config/flavors.js'
import {
  BACKDROP_SHADE,
  BACKDROP_SHADE_COLOR,
  FLAVOR_PUSH,
  FLAVOR_PUSH_DISTANCE,
  FLAVOR_SPIN,
  FRUIT_FIELD_OPACITY,
  FRUIT_FIELD_PARALLAX,
  FRUIT_FIELD_SOFTNESS,
  TIERS,
  toRadians,
} from '../src/config/performance.js'
import { ART_SIZE, FRUIT_KINDS, drawSlice, drawWhole } from '../src/three/fruitArt.js'
import {
  FIELD_CLEAR,
  FIELD_DEPTH,
  FIELD_DRIFT,
  FIELD_LAYERS,
  FIELD_SPREAD,
  buildFieldInstances,
  fieldPose,
} from '../src/three/fruitFieldMath.js'
import { createFruitFieldMaterial } from '../src/three/fruitFieldMaterial.js'
import { createFruitFieldScene } from '../src/three/fruitFieldScene.js'

/**
 * The fruit field, checked without a renderer.
 *
 * Four kinds of thing are asserted here and none of them are visible in a build:
 *
 *  1. **The shader injection still lands.** `createFruitFieldMaterial` adds code
 *     to `MeshBasicMaterial` by replacing three's own chunk names. A three
 *     upgrade that renames `#include <map_fragment>` would not fail a build, or
 *     a lint, or a test — it would produce a field of hard-edged opaque squares,
 *     or a shader that does not compile. So the chunk names are asserted against
 *     the library itself, and the injection is run against a stand-in shader and
 *     inspected.
 *  2. **The four flavors really do draw four different fruits.** This is the one
 *     that would have caught the field reading as empty on three of the four
 *     flavors: the art is driven with a stub 2D context that records every path
 *     and every color, so the silhouettes can be compared, the colors checked
 *     for NaN, and each drawing checked to fit inside its canvas before it is
 *     multiplied by a rim stroke.
 *  3. **The framing maths holds.** The field has to be wider than the screen,
 *     and to stay wider than the screen after the scroll parallax slides it, or
 *     a band of empty backdrop appears at one edge.
 *  4. **The flavor-change transitions land where they say.** The push has to
 *     keep the screen covered at every instant, and the cup's spin has to finish
 *     on a whole number of turns, or the cup ends every flavor change facing a
 *     direction no section asked for.
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

const TAU = Math.PI * 2

// ------------------------------------------------------------ the shader hooks

const VERTEX = THREE.ShaderLib.basic.vertexShader
const FRAGMENT = THREE.ShaderLib.basic.fragmentShader

check(
  'the vertex chunk the material hooks into is still there',
  VERTEX.includes('#include <common>') && VERTEX.includes('#include <begin_vertex>'),
  'MeshBasicMaterial, #include <common> and <begin_vertex>',
)
check(
  'the fragment chunks the material hooks into are still there',
  FRAGMENT.includes('#include <common>') && FRAGMENT.includes('#include <map_fragment>'),
  'MeshBasicMaterial, #include <common> and <map_fragment>',
)
check(
  'the vertex stage declares the uv attribute the injection reads',
  VERTEX.includes('uv'),
  'uv is a geometry attribute, so it is available before <begin_vertex>',
)

// A stand-in for what three hands `onBeforeCompile`, with the same shape: the
// strings get replaced and the uniforms object is what the material keeps.
const fakeShader = {
  uniforms: {},
  vertexShader: `#include <common>\n#include <begin_vertex>\n`,
  fragmentShader: `#include <common>\n#include <map_fragment>\n`,
}

const probeMaterial = createFruitFieldMaterial(null)
const uniforms = probeMaterial.userData.fieldUniforms
probeMaterial.onBeforeCompile(fakeShader)

check(
  'the injection declares both per-instance attributes',
  fakeShader.vertexShader.includes('attribute float aFieldAlpha') &&
    fakeShader.vertexShader.includes('attribute float aFieldSoft'),
)
check(
  'the injection passes the plane uv through to the fragment stage',
  fakeShader.vertexShader.includes('vFieldUv = uv') &&
    fakeShader.fragmentShader.includes('varying vec2 vFieldUv'),
)
check(
  'the soft edge is applied to the sampled colour',
  fakeShader.fragmentShader.includes('fieldEdge') &&
    fakeShader.fragmentShader.includes('diffuseColor.a'),
)
check(
  'the fade uniform reaches the frame loop, not just the shader',
  fakeShader.uniforms.uFieldOpacity === uniforms.uFieldOpacity,
  'the same object the frame loop mutates',
)
check(
  'the injected source still contains every chunk three expects',
  fakeShader.vertexShader.includes('#include <begin_vertex>') &&
    fakeShader.fragmentShader.includes('#include <map_fragment>'),
  'the injection appends rather than replaces the chunk',
)

check('the field is transparent', probeMaterial.transparent === true)
check(
  'the field writes no depth, so it cannot cut a seam into the cup',
  probeMaterial.depthWrite === false,
)
check(
  'the field is not tone-mapped, so the fruit keeps its colour',
  probeMaterial.toneMapped === false,
)

// ------------------------------------------------------------------- the art

/**
 * A canvas 2D context that draws nothing and remembers everything.
 *
 * `fillStyle` and `strokeStyle` go through a setter, because assigning a color
 * the canvas cannot parse is *silent* — it keeps the previous one. That is
 * precisely how `shade()` on a malformed color would have shipped: no throw, no
 * warning, just fruit filled in whatever color happened to be set last.
 */
function recordingContext() {
  const colours = []
  const path = []

  const noteColour = (slot, value) => colours.push({ slot, value })

  const points = {
    moveTo: (args) => [{ x: args[0], y: args[1], r: 0 }],
    lineTo: (args) => [{ x: args[0], y: args[1], r: 0 }],
    bezierCurveTo: (args) => [
      { x: args[0], y: args[1], r: 0 },
      { x: args[2], y: args[3], r: 0 },
      { x: args[4], y: args[5], r: 0 },
    ],
    // arc(x, y, radius, ...) and ellipse(x, y, rx, ry, ...): a curve reaches its
    // centre plus its radius, so both are recorded that way.
    arc: (args) => [{ x: args[0], y: args[1], r: args[2] ?? 0 }],
    ellipse: (args) => [{ x: args[0], y: args[1], r: Math.max(args[2] ?? 0, args[3] ?? 0) }],
  }

  const ctx = {
    _colours: colours,
    _path: path,
    globalAlpha: 1,
    lineWidth: 1,
    lineJoin: 'miter',
    shadowColor: 'rgba(0, 0, 0, 0)',
    shadowBlur: 0,
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    closePath() {},
    fill() {},
    stroke() {},
    // A gradient is a legitimate `fillStyle`, so it is marked as one and its
    // stops are recorded as colours in their own right — which is where the
    // interesting colours actually are.
    createRadialGradient: () => ({
      __gradient: true,
      addColorStop: (at, value) => noteColour('stop', value),
    }),
  }

  for (const [slot, field] of [
    ['fillStyle', 'fillStyle'],
    ['strokeStyle', 'strokeStyle'],
  ]) {
    let value = '#000000'
    Object.defineProperty(ctx, field, {
      get: () => value,
      set: (next) => {
        if (typeof next !== 'string') {
          noteColour(slot, next)
          return
        }
        value = next
        noteColour(slot, next)
      },
    })
  }

  for (const [name, expand] of Object.entries(points)) {
    ctx[name] = (...args) => {
      path.push({ name, args })
      return expand(args)
    }
  }

  return ctx
}

/** Where a recorded call reaches, as a distance from the drawing's own origin. */
function reachOf(entry) {
  const points =
    entry.name === 'moveTo' || entry.name === 'lineTo'
      ? [{ x: entry.args[0], y: entry.args[1], r: 0 }]
      : entry.name === 'bezierCurveTo'
        ? [
            { x: entry.args[0], y: entry.args[1], r: 0 },
            { x: entry.args[2], y: entry.args[3], r: 0 },
            { x: entry.args[4], y: entry.args[5], r: 0 },
          ]
        : [
            {
              x: entry.args[0],
              y: entry.args[1],
              r: entry.name === 'arc' ? entry.args[2] : Math.max(entry.args[2], entry.args[3]),
            },
          ]

  return Math.max(
    ...points.map((point) => Math.hypot(point.x, point.y) + point.r),
  )
}

/** A colour is usable if a canvas would not silently ignore it. */
function colourProblem(value) {
  if (typeof value === 'object' && value !== null && value.__gradient) return null
  if (typeof value !== 'string') return `not a string: ${String(value)}`

  if (/^#[0-9a-f]{6}$/i.test(value)) return null

  const rgb = /^rgba?\((.+)\)$/.exec(value)
  if (!rgb) return `unparseable: ${value}`

  const parts = rgb[1].split(',').map((part) => part.trim())
  if (parts.length !== 3 && parts.length !== 4) return `wrong arity: ${value}`

  for (const [index, part] of parts.entries()) {
    const number = Number(part)
    if (!Number.isFinite(number)) return `NaN channel: ${value}`
    if (index < 3 && (number < 0 || number > 255)) return `channel out of range: ${value}`
    if (index === 3 && (number < 0 || number > 1)) return `alpha out of range: ${value}`
  }

  return null
}

const readHex = (hex) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16))

/** sRGB relative luminance, per WCAG. */
const luminance = ([r, g, b]) => {
  const linear = [r, g, b]
    .map((channel) => channel / 255)
    .map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
}

/** The luminance of a colour the stub recorded: hex, rgb() or rgba(). */
const recordLuminance = (value) => {
  if (value.startsWith('#')) return luminance(readHex(value))
  const parts = value.slice(value.indexOf('(') + 1, -1).split(',').map((p) => Number(p.trim()))
  return luminance(parts.slice(0, 3))
}

/** Only the string colours; the gradients are containers, not colours. */
const recordedColours = (ctx) =>
  ctx._colours.map((entry) => entry.value).filter((value) => typeof value === 'string')

check(
  'every flavor kind is one the artwork knows how to draw',
  flavors.every((flavor) => FRUIT_KINDS.includes(flavor.fruit.kind)),
  FRUIT_KINDS.join(', '),
)

const art = {}

for (const flavor of flavors) {
  for (const view of ['whole', 'slice']) {
    const ctx = recordingContext()
    if (view === 'whole') drawWhole(ctx, flavor.fruit)
    else drawSlice(ctx, flavor.fruit)

    const key = `${flavor.id}.${view}`
    art[key] = {
      signature: ctx._path
        .map(
          (entry) =>
            `${entry.name}(${entry.args
              .map((arg) => (typeof arg === 'number' ? arg.toFixed(3) : arg))
              .join(',')})`,
        )
        .join('|'),
      problems: ctx._colours
        .map((entry) => ({ ...entry, problem: colourProblem(entry.value) }))
        .filter((entry) => entry.problem),
      darkest: Math.min(...recordedColours(ctx).map(recordLuminance)),
      reaches: ctx._path.map(reachOf),
    }
  }

  check(
    `${flavor.id}: every colour the artwork assigns is one a canvas accepts`,
    art[`${flavor.id}.whole`].problems.length === 0 &&
      art[`${flavor.id}.slice`].problems.length === 0,
    [...art[`${flavor.id}.whole`].problems, ...art[`${flavor.id}.slice`].problems]
      .slice(0, 2)
      .map((entry) => `${entry.slot} ${entry.problem}`)
      .join('; ') || 'no NaN, no unparseable colours',
  )

  /**
   * The readability property, stated as a number. Each flavor's base colour is a
   * shade of its own fruit, so hue alone can never separate the two: the artwork
   * has to contain something clearly darker than its own backdrop, which is the
   * dark rim and halo the Phase 8C art added. Without it, mango on orange and
   * apple on green read as an empty background.
   */
  const base = luminance(readHex(flavor.colorA))
  check(
    `${flavor.id}: the fruit has an edge darker than its own backdrop`,
    art[`${flavor.id}.whole`].darkest < base - 0.2,
    `darkest ${art[`${flavor.id}.whole`].darkest.toFixed(3)} against a base of ${base.toFixed(3)}`,
  )

  check(
    `${flavor.id}: both the whole fruit and the slice fit their canvas`,
    [...art[`${flavor.id}.whole`].reaches, ...art[`${flavor.id}.slice`].reaches].every(
      (reach) => reach <= ART_SIZE / 2 - 1,
    ),
    `widest reach ${Math.max(
      ...art[`${flavor.id}.whole`].reaches,
      ...art[`${flavor.id}.slice`].reaches,
    ).toFixed(1)} of ${ART_SIZE / 2}`,
  )
}

for (const view of ['whole', 'slice']) {
  const signatures = flavors.map((flavor) => art[`${flavor.id}.${view}`].signature)
  check(
    `the four flavors draw four different ${view === 'whole' ? 'whole fruits' : 'slices'}`,
    new Set(signatures).size === flavors.length,
    `${new Set(signatures).size} distinct silhouettes from ${flavors.length} flavors`,
  )
}

// ------------------------------------------------------------------- the framing

const CAMERA_FOV = 40
const CAMERA_Z = 5
const VIEWPORT_HEIGHT = 2 * Math.tan(toRadians(CAMERA_FOV / 2)) * CAMERA_Z

const viewportFor = (width, height) => ({
  width: VIEWPORT_HEIGHT * (width / height),
  height: VIEWPORT_HEIGHT,
})

const SCREENS = [
  { width: 360, height: 780 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
]

check(
  'the field is dealt out wider than the frame, so the parallax has room',
  FIELD_SPREAD > 1.25,
  `${FIELD_SPREAD} of the frame`,
)

check(
  'every layer appears in the config',
  FIELD_LAYERS.every((layer) => layer in FIELD_DEPTH) &&
    FIELD_LAYERS.every((layer) => layer in FRUIT_FIELD_PARALLAX),
  FIELD_LAYERS.join(', '),
)
check(
  'the layers are ordered far to near',
  FIELD_DEPTH.far < FIELD_DEPTH.mid && FIELD_DEPTH.mid < FIELD_DEPTH.near,
  `${FIELD_DEPTH.far} < ${FIELD_DEPTH.mid} < ${FIELD_DEPTH.near}`,
)
check(
  'near fruit is bigger, softer and more opaque than far fruit',
  FRUIT_FIELD_OPACITY.far < FRUIT_FIELD_OPACITY.mid &&
    FRUIT_FIELD_OPACITY.mid < FRUIT_FIELD_OPACITY.near &&
    FRUIT_FIELD_SOFTNESS.far > FRUIT_FIELD_SOFTNESS.mid &&
    FRUIT_FIELD_SOFTNESS.mid > FRUIT_FIELD_SOFTNESS.near &&
    FRUIT_FIELD_PARALLAX.far < FRUIT_FIELD_PARALLAX.mid &&
    FRUIT_FIELD_PARALLAX.mid < FRUIT_FIELD_PARALLAX.near,
  `opacity ${FRUIT_FIELD_OPACITY.far}/${FRUIT_FIELD_OPACITY.mid}/${FRUIT_FIELD_OPACITY.near}`,
)
check(
  'the far layer is blurred almost to nothing at its edge',
  FRUIT_FIELD_SOFTNESS.far > 0.8 && FRUIT_FIELD_SOFTNESS.near < 0.5,
  `softness ${FRUIT_FIELD_SOFTNESS.far} down to ${FRUIT_FIELD_SOFTNESS.near}`,
)

const pose = { x: 0, y: 0, z: 0, rotation: 0 }

// --------------------------------------------------------------- the scene graph

/**
 * A whole field, built and then thrown away, without a renderer.
 *
 * This block exists because of a bug that no build, lint or maths check could
 * see. The field's meshes are created imperatively and handed to React through
 * `<primitive>`, and the first version of `dispose()` detached them from their
 * own group as well as freeing them. React runs every mount's cleanup once
 * immediately in development, so that cleanup fired moments after the field
 * appeared and left a mounted group with no children: **the fruit field rendered
 * nothing, on every flavor, with no error anywhere**, and the only symptom was a
 * background that looked like it had never been added.
 */
{
  const viewport = viewportFor(390, 844)
  const stubTextures = { whole: null, slice: null }
  const scene = createFruitFieldScene(stubTextures, 6, viewport)

  check(
    'the field builds one mesh per fruit type',
    scene.group.children.length === 2,
    `${scene.group.children.length} children in the group`,
  )
  check(
    'every mesh is instanced, and instanced the requested number of times',
    scene.group.children.every((child) => child.isInstancedMesh && child.count === 6),
    scene.group.children.map((child) => `${child.count}`).join(', '),
  )
  check(
    'every mesh carries a per-instance alpha and softness',
    scene.group.children.every(
      (child) =>
        child.geometry.getAttribute('aFieldAlpha')?.count === 6 &&
        child.geometry.getAttribute('aFieldSoft')?.count === 6,
    ),
    'aFieldAlpha and aFieldSoft, one value per instance',
  )
  check(
    'the field is drawn before everything else and is never frustum-culled',
    scene.group.children.every(
      (child) => child.renderOrder < 0 && child.frustumCulled === false,
    ),
    `renderOrder ${scene.group.children.map((child) => child.renderOrder).join(', ')}`,
  )

  // One frame, so there is something in the matrices to inspect.
  scene.update(0, 0, 1)

  const matrices = scene.group.children.flatMap((child) => [...child.instanceMatrix.array])
  check(
    'a frame writes finite matrices for every instance',
    matrices.length === 2 * 6 * 16 && matrices.every(Number.isFinite),
    `${matrices.length} numbers, ${2 * 6 * 16} expected`,
  )

  const beforeDispose = scene.group.children.length
  scene.dispose()
  check(
    'disposing the field leaves the scene graph intact',
    scene.group.children.length === beforeDispose,
    `${scene.group.children.length} children still attached, from ${beforeDispose}`,
  )

  // And the field still draws after a dispose, which is what the second effect
  // pass in development relies on: a resource freed under a live mesh has to be
  // re-uploaded by three, not lost.
  scene.update(1, 0.5, 1)
  check(
    'a disposed field still produces finite matrices when it is drawn again',
    [...scene.group.children.flatMap((child) => [...child.instanceMatrix.array])].every(
      Number.isFinite,
    ),
    'the development double-mount path',
  )
}

for (const [tier, count] of [
  ['mobile', TIERS.mobile.fruitFieldCount],
  ['desktop', TIERS.desktop.fruitFieldCount],
]) {
  check(
    `${tier} asks for the brief's plane count`,
    tier === 'mobile' ? count === 22 : count === 40,
    `${count} planes per fruit type, so ${count * 2} in total`,
  )

  for (const screen of SCREENS) {
    const viewport = viewportFor(screen.width, screen.height)
    const instances = buildFieldInstances(count, viewport)
    const label = `${tier} ${screen.width}x${screen.height}`

    check(
      `${label}: all three layers are populated`,
      new Set(instances.map((instance) => instance.layer)).size === 3,
      FIELD_LAYERS.map(
        (layer) => `${layer} ${instances.filter((i) => i.layer === layer).length}`,
      ).join(', '),
    )
    check(
      `${label}: every value is finite`,
      instances.every((instance) =>
        [
          instance.x,
          instance.y,
          instance.z,
          instance.size,
          instance.rotation,
          instance.spin,
          instance.alpha,
          instance.soft,
        ].every(Number.isFinite),
      ),
    )

    const radiusOf = (instance) =>
      Math.hypot(
        instance.x / ((viewport.width * ((CAMERA_Z - instance.z) / CAMERA_Z)) / 2),
        instance.y / ((viewport.height * ((CAMERA_Z - instance.z) / CAMERA_Z)) / 2),
      )

    check(
      `${label}: no fruit is drawn over the cup`,
      instances.every((instance) => radiusOf(instance) >= FIELD_CLEAR - 1e-9),
      `clear radius ${FIELD_CLEAR} of the half-frame, tightest at ${Math.min(
        ...instances.map(radiusOf),
      ).toFixed(3)}`,
    )
    check(
      `${label}: no fruit is more opaque than its layer allows`,
      instances.every(
        (instance) => instance.alpha <= FRUIT_FIELD_OPACITY[instance.layer] + 1e-9,
      ),
      `ceilings ${FRUIT_FIELD_OPACITY.far}/${FRUIT_FIELD_OPACITY.mid}/${FRUIT_FIELD_OPACITY.near}`,
    )

    const mean = (layer, key) => {
      const rows = instances.filter((instance) => instance.layer === layer)
      return rows.reduce((total, row) => total + row[key], 0) / rows.length
    }

    check(
      `${label}: far fruit really is smaller and dimmer than near fruit`,
      mean('far', 'size') < mean('mid', 'size') &&
        mean('mid', 'size') < mean('near', 'size') &&
        mean('far', 'alpha') < mean('near', 'alpha'),
      `size ${mean('far', 'size').toFixed(3)} < ${mean('mid', 'size').toFixed(3)} < ${mean('near', 'size').toFixed(3)}`,
    )

    // How big a fruit actually looks, which is the size divided back out by the
    // depth it was scaled for. This is what the brief's readability condition
    // comes down to: no single piece of background fruit may be big enough to
    // read as the subject rather than as backdrop.
    const apparent = instances.map(
      (instance) =>
        instance.size / ((CAMERA_Z - instance.z) / CAMERA_Z) / viewport.height,
    )
    check(
      `${label}: no fruit is big enough to compete with the cup`,
      Math.max(...apparent) < 0.28,
      `largest fruit is ${(Math.max(...apparent) * 100).toFixed(1)}% of the screen height`,
    )
    check(
      `${label}: no fruit is small enough to be a speck`,
      Math.min(...apparent) > 0.05,
      `smallest fruit is ${(Math.min(...apparent) * 100).toFixed(1)}% of the screen height`,
    )

    /**
     * The band check.
     *
     * Deal the field out to exactly the frame and the parallax uncovers an empty
     * strip at the trailing edge as the page scrolls. This is the assertion that
     * the spare is genuinely enough for the longest shift, and it is written
     * against the *domain* the fruit is dealt from rather than against the
     * sampled extremes: the extremes of a handful of random points say nothing
     * about the design, and asserting on them would only ever be testing the
     * seed.
     */
    let worstMargin = Infinity
    let tightestAt = ''
    for (const layer of FIELD_LAYERS) {
      const depth = FIELD_DEPTH[layer]
      const reach = (CAMERA_Z - depth) / CAMERA_Z
      const halfHeight = (viewport.height * reach) / 2
      // The widest the drift can move a fruit: FIELD_DRIFT's ceiling, with the
      // 1.3 the vertical drift is stretched by in fieldPose.
      const drift = FIELD_DRIFT * reach * 1.5 * 1.3
      const shift = FRUIT_FIELD_PARALLAX[layer] * viewport.height

      const margin = halfHeight * (FIELD_SPREAD - 1) - shift - drift
      if (margin < worstMargin) {
        worstMargin = margin
        tightestAt = layer
      }
    }
    check(
      `${label}: the deal-out is wide enough to survive the parallax`,
      worstMargin >= 0,
      `tightest ${worstMargin.toFixed(4)} of spare frame in the ${tightestAt} layer`,
    )

    // And the pose itself: finite, and the parallax actually moves the layers
    // by different amounts.
    const shiftOf = (layer) => {
      const instance = instances.find((row) => row.layer === layer)
      const at0 = fieldPose(instance, 0, 0, viewport, { ...pose })
      const at1 = fieldPose(instance, 0, 1, viewport, { ...pose })
      return at1.y - at0.y
    }
    check(
      `${label}: the parallax moves near layers further than far ones`,
      shiftOf('far') < shiftOf('mid') && shiftOf('mid') < shiftOf('near'),
      `${shiftOf('far').toFixed(3)} < ${shiftOf('mid').toFixed(3)} < ${shiftOf('near').toFixed(3)}`,
    )
    check(
      `${label}: the parallax shifts the field up, not down`,
      shiftOf('near') > 0,
      'so the field lags the page rather than leading it',
    )
  }
}

// The drift is a wander, not a slide: over minutes it must not walk away, and
// what counts as "not walking away" is relative to the layer's own frame — a
// far fruit travels further in world units than a near one for the same visible
// movement, because it is further from the camera.
{
  const viewport = viewportFor(390, 844)
  const instances = buildFieldInstances(TIERS.mobile.fruitFieldCount, viewport)
  let worst = 0
  let worstLayer = ''
  for (const instance of instances) {
    const frame = viewport.height * ((CAMERA_Z - instance.z) / CAMERA_Z)
    let min = Infinity
    let max = -Infinity
    for (let step = 0; step <= 2400; step++) {
      const value = fieldPose(instance, step * 0.25, 0, viewport, { ...pose }).y
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
    const travel = (max - min) / frame
    if (travel > worst) {
      worst = travel
      worstLayer = instance.layer
    }
  }
  check(
    'the drift stays a wander rather than a slide',
    worst < 0.1,
    `widest travel ${(worst * 100).toFixed(1)}% of the frame in the ${worstLayer} layer, over 600 s`,
  )
}

// -------------------------------------------------------- the flavor change

check(
  'the push is long enough to read and short enough to sit through',
  FLAVOR_PUSH > 0.4 && FLAVOR_PUSH <= 1.2,
  `${FLAVOR_PUSH} s`,
)
check(
  'the push travels exactly one viewport',
  FLAVOR_PUSH_DISTANCE === 1,
  `${FLAVOR_PUSH_DISTANCE} viewport`,
)

/**
 * The coverage property of a push, which is the whole reason it is a push and
 * not two things crossing: the outgoing layer and the incoming one have to stay
 * exactly one viewport apart, so their union covers the screen at every instant.
 * Get that wrong — travel further than a viewport, or ease one of them — and a
 * stripe of nothing opens in the middle of the change.
 */
{
  let worstGap = 0
  let worstAt = 0
  for (let step = 0; step <= 100; step++) {
    const s = step / 100
    const incoming = 1 - s
    const outgoing = -s
    // The two layers are one viewport wide, so their union covers the screen
    // exactly when the incoming one's left edge meets the outgoing one's right
    // edge: (incoming - 0.5) - (outgoing + 0.5) === 0.
    const gap = incoming - 0.5 - (outgoing + 0.5)
    if (Math.abs(gap) > worstGap) {
      worstGap = Math.abs(gap)
      worstAt = s
    }
  }
  check(
    'the two background layers never leave a stripe of nothing between them',
    worstGap < 1e-9,
    `worst gap ${worstGap.toExponential(1)} of a viewport, at ${worstAt.toFixed(2)} of the push`,
  )
}

check(
  'the spin is quick and lands after the push',
  FLAVOR_SPIN > 0.4 && FLAVOR_SPIN <= 2 && FLAVOR_SPIN >= FLAVOR_PUSH,
  `${FLAVOR_SPIN} s of spin against ${FLAVOR_PUSH} s of push`,
)

/**
 * The spin, replayed exactly as `MojitoGroup` computes it.
 *
 * The property that matters is the last one: a full turn has to come back to
 * the yaw the section asked for, or every flavor change leaves the cup facing a
 * direction nothing chose. It does, because the angle is a whole 2 pi — but that
 * is worth asserting rather than assuming, since the easing is the only thing
 * standing between a one-turn animation and a cup that slowly accumulates a
 * rotation every time the reader taps a flavor.
 */
{
  const easeOutCubic = (t) => 1 - (1 - t) ** 3
  const angle = (t, direction) => easeOutCubic(t) * TAU * direction
  const turns = (value) => {
    const wrapped = ((value % TAU) + TAU) % TAU
    return Math.min(wrapped, TAU - wrapped)
  }

  check('the spin starts at the resting yaw', angle(0, 1) === 0)
  check(
    'the spin finishes exactly one whole turn',
    Math.abs(angle(1, 1) - TAU) < 1e-12 && turns(angle(1, 1)) < 1e-9,
    `${angle(1, 1).toFixed(6)} rad, which is ${turns(angle(1, 1)).toExponential(1)} rad off the resting yaw`,
  )
  check(
    'the spin is monotone, so the cup never turns back on itself',
    Array.from({ length: 99 }, (_, index) => index / 99).every(
      (t) => angle(t + 0.01, 1) > angle(t, 1),
    ),
  )
  check(
    'the spin reverses with the direction through the flavor list',
    angle(0.5, 1) > 0 && angle(0.5, -1) < 0,
    'forward turns one way, back turns the other',
  )
}

/**
 * The direction rule, checked as a symmetry: stepping one way through the
 * flavors has to be the exact opposite of stepping back, on every pair. A rule
 * that answered +1 for both would push the background the same way forwards and
 * backwards, which is the thing that makes a reversible change feel broken.
 */
{
  const asymmetric = []
  for (const from of flavors) {
    for (const to of flavors) {
      if (from.id === to.id) continue
      if (flavorDirectionFor(from.id, to.id) !== -flavorDirectionFor(to.id, from.id)) {
        asymmetric.push(`${from.id}->${to.id}`)
      }
    }
  }
  check(
    'the push direction reverses exactly when the flavor change does',
    asymmetric.length === 0,
    asymmetric.length ? asymmetric.join(', ') : `${flavors.length * (flavors.length - 1)} ordered pairs`,
  )
  check(
    'a flavor change always has a direction, even to itself or an unknown id',
    flavorDirectionFor('lime', 'lime') === 1 && flavorDirectionFor('nope', 'lime') === 1,
  )
}

// ------------------------------------------------------------------ the colours

const SHADE = readHex(BACKDROP_SHADE_COLOR)
const OVERLAY = readHex('#101a0c')

const contrast = (a, b) => {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

/** CSS alpha compositing, in sRGB: what the overlay and the shade actually do. */
const over = (base, top, alpha) =>
  base.map((channel, index) => channel * (1 - alpha) + top[index] * alpha)

const INK = readHex('#16210f')

check(
  'every flavor has a solid backdrop base',
  flavors.every((flavor) => /^#[0-9a-f]{6}$/i.test(flavor.colorA ?? '')),
  flavors.map((flavor) => `${flavor.id} ${flavor.colorA}`).join(', '),
)
check(
  'every flavor still has the fruit colours the field draws from',
  flavors.every(
    (flavor) =>
      flavor.fruit?.kind &&
      flavor.fruit.flesh &&
      flavor.fruit.rind &&
      flavor.fruit.seed &&
      flavor.fruit.whole?.skin &&
      flavor.fruit.whole?.skinAlt,
  ),
  flavors.map((flavor) => flavor.fruit.kind).join(', '),
)

for (const flavor of flavors) {
  const base = readHex(flavor.colorA)
  const washed = over(base, OVERLAY, FRUIT_FIELD_OPACITY.overlay)

  check(
    `${flavor.id}: body copy still reads on the overlaid backdrop`,
    contrast(INK, washed) >= 4.5,
    `contrast ${contrast(INK, washed).toFixed(2)}:1, needs 4.5:1`,
  )
  check(
    `${flavor.id}: the overlay darkens the base rather than lightening it`,
    luminance(washed) < luminance(base),
    `${luminance(base).toFixed(3)} down to ${luminance(washed).toFixed(3)}`,
  )
}

check(
  'the shatter shade is dark enough to be a different mood',
  luminance(over(readHex(flavors[0].colorA), SHADE, BACKDROP_SHADE)) < 0.08,
  `shaded base luminance ${luminance(over(readHex(flavors[0].colorA), SHADE, BACKDROP_SHADE)).toFixed(4)}`,
)
check(
  'the ink flips to light for the shatter, and reads against it',
  contrast(readHex('#f2fae6'), SHADE) >= 4.5,
  `contrast ${contrast(readHex('#f2fae6'), SHADE).toFixed(2)}:1`,
)

// --------------------------------------------------------------------- summary

console.log('')
console.log(
  failures.length === 0
    ? `PASS: all checks green (${flavors.length} flavors x 2 views of art, both tiers x ${SCREENS.length} screens, 3 layers)`
    : `FAIL: ${failures.join(' | ')}`,
)
process.exit(failures.length === 0 ? 0 : 1)
