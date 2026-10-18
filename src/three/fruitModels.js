import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { cupRadiusAt } from './liquidProfile.js'
import {
  FRUIT_GAP,
  FRUIT_LEAN,
  FRUIT_Y_MAX,
  FRUIT_Y_MIN,
  seededRandom,
} from './ingredientMath.js'

/**
 * The four fruit slices, built in code — no external models (AGENTS.md section
 * 4). Each is a small group of primitives, which is enough because only one
 * flavor is ever on screen; none of them need instancing.
 *
 * Phase 6A floated one slice per flavor in the middle of the glass. Phase 7
 * wedges two or three against the inside of the cup wall near the top (the
 * brief, item 7) — which is where fruit sits in a real cup, and, more to the
 * point, where the camera can see the cut face through the plastic instead of
 * looking at it edge-on from the side.
 *
 * Kept out of Fruit.jsx so the component stays about the crossfade and this
 * file stays about the shapes.
 */

/** Shared surface numbers for fruit. Opaque, so it sorts correctly against the drink. */
function skin(color, extra) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: 0.42,
    metalness: 0,
    ...extra,
  })
}

/** A flat slice lying in the XZ plane: a cylinder whose axis is already Y. */
function disc(radius, height, color, y = 0, segments = 30) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, segments),
    skin(color),
  )
  mesh.position.y = y
  return mesh
}

/** lime: green disc, lighter inner face, radial segments across the cut. */
function buildLime(group, spec) {
  const { radius, rind, flesh, inner } = spec
  group.add(disc(radius, 0.014, rind), disc(radius * 0.9, 0.016, flesh, 0.001))

  // A bar spans a full diameter, so eight of them at 180/8 steps cover the
  // face without repeating a direction.
  const barGeometry = new THREE.BoxGeometry(radius * 1.62, 0.006, 0.0055)
  const barMaterial = skin(inner)

  for (let i = 0; i < 8; i++) {
    const bar = new THREE.Mesh(barGeometry, barMaterial)
    bar.rotation.y = (i / 8) * Math.PI
    bar.position.y = 0.009
    group.add(bar)
  }
}

/**
 * strawberry: a heart-like wedge built from two bezier curves, with seed dots.
 * The shape is drawn in the XY plane and laid flat by the slice group.
 */
function buildStrawberry(group, spec) {
  const { radius: r, rind, flesh, seed } = spec

  const outline = new THREE.Shape()
  outline.moveTo(0, -r)
  outline.bezierCurveTo(r * 1.02, -r * 0.2, r * 0.95, r * 0.72, 0, r * 0.78)
  outline.bezierCurveTo(-r * 0.95, r * 0.72, -r * 1.02, -r * 0.2, 0, -r)

  const slice = new THREE.Group()
  slice.rotation.x = -Math.PI / 2

  const extrude = (shape, depth, material) =>
    new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth,
        bevelEnabled: false,
        curveSegments: 18,
      }),
      material,
    )

  slice.add(extrude(outline, 0.013, skin(rind)))

  const inner = new THREE.Shape()
  inner.copy(outline)
  const fleshMesh = extrude(inner, 0.014, skin(flesh))
  fleshMesh.scale.setScalar(0.86)
  fleshMesh.position.z = 0.002
  slice.add(fleshMesh)

  // Seeds on a deterministic ellipse, jittered by a seeded RNG so the layout is
  // identical on every load.
  const random = seededRandom(0x5eed)
  const seedGeometry = new THREE.IcosahedronGeometry(0.006, 0)
  const seedMaterial = skin(seed)

  for (let i = 0; i < 9; i++) {
    const angle = (i / 9) * Math.PI * 2
    const dot = new THREE.Mesh(seedGeometry, seedMaterial)
    dot.position.set(
      Math.cos(angle) * r * 0.44 + (random() - 0.5) * 0.006,
      -r * 0.1 + Math.sin(angle) * r * 0.42 + (random() - 0.5) * 0.006,
      0.015,
    )
    slice.add(dot)
  }

  group.add(slice)
}

/** apple: pale flesh with a red rim around the edge. */
function buildApple(group, spec) {
  const { radius, rind, flesh, seed } = spec
  group.add(disc(radius * 0.93, 0.016, flesh))

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(radius * 0.95, 0.0095, 8, 34),
    skin(rind),
  )
  rim.rotation.x = -Math.PI / 2
  group.add(rim)

  // Three pips in the core.
  const pipGeometry = new THREE.IcosahedronGeometry(0.008, 0)
  const pipMaterial = skin(seed)
  for (let i = 0; i < 3; i++) {
    const pip = new THREE.Mesh(pipGeometry, pipMaterial)
    const angle = (i / 3) * Math.PI * 2
    pip.position.set(Math.cos(angle) * radius * 0.16, 0.011, Math.sin(angle) * radius * 0.16)
    pip.scale.set(1, 0.7, 1.5)
    group.add(pip)
  }
}

/** mango: rough-cut orange chunks rather than a neat slice. */
function buildMango(group, spec) {
  const { radius, flesh, inner } = spec
  const chunkGeometry = new RoundedBoxGeometry(1, 1, 1, 1, 0.22)
  const random = seededRandom(0xb0ba)
  const chunkSize = radius * 0.5

  for (let i = 0; i < 5; i++) {
    const chunk = new THREE.Mesh(chunkGeometry, skin(i % 2 === 0 ? flesh : inner))
    const angle = (i / 5) * Math.PI * 2 + 0.4
    const spread = radius * (i === 0 ? 0 : 0.42)
    chunk.position.set(
      Math.cos(angle) * spread,
      // Local Y is the wall's outward normal once the slice is pressed to the
      // wall, so depth here is depth *into* the pile, not height up the cup.
      (random() - 0.4) * radius * 0.25,
      Math.sin(angle) * spread,
    )
    chunk.scale.setScalar(chunkSize * (0.8 + random() * 0.4))
    chunk.rotation.set(random() * 2, random() * 2, random() * 2)
    group.add(chunk)
  }
}

const BUILDERS = {
  lime: buildLime,
  strawberry: buildStrawberry,
  apple: buildApple,
  mango: buildMango,
}

/**
 * Where the slices sit round the wall. Two or three per flavor, never
 * overlapping, and biased towards the front of the cup — a slice hidden behind
 * the mint is a slice nobody paid for.
 */
const SLICE_ANGLES = {
  2: [1.2, 2.9],
  3: [0.9, 2.6, 5.2],
}

/** A stable seed per flavor, so the layout is the same on every load. */
function seedFrom(text) {
  let hash = 0x5127
  for (let i = 0; i < text.length; i++) hash = (hash * 31 + text.charCodeAt(i)) >>> 0
  return hash
}

/**
 * The largest radius at which a slice can sit, at a given height, and still be
 * inside the cup.
 *
 * Solved rather than bounded, because the obvious bound is wrong in both
 * directions. A slice stands in the wall's tangent plane, so a vertex at the
 * disc's own three-o'clock — not the top or the bottom — is the one that sticks
 * out furthest from the axis, and the difference at this size is 18mm of a 95mm
 * slice. Bound with the lean alone and the slice hovers off the wall; bound with
 * the whole disc radius and it sits out in the middle of the drink.
 *
 * So each vertex is inverted for the radius it allows, and the tightest vertex
 * wins. Walking the vertices is also the only honest option across four
 * builders with nothing in common geometrically: two discs and eight bars, two
 * extrusions and nine seed dots, five rotated rounded cubes, and a torus.
 *
 * The holder's rotation is `Rz(-PI/2 - lean)` then `Ry(-angle)`, and the yaw
 * only swings the radial direction round the cup. In the slice's own frame that
 * leaves a vertex at:
 *
 *   dx = -x*sinLean + y*cosLean     outward, before the radius offset
 *   dy = -x*cosLean - y*sinLean     height
 *   dz =  z                         tangential
 */
function maxSliceRadius(slice, y, gap) {
  const point = new THREE.Vector3()
  const cosLean = Math.cos(FRUIT_LEAN)
  const sinLean = Math.sin(FRUIT_LEAN)
  let radius = Infinity

  slice.updateMatrixWorld(true)

  slice.traverse((child) => {
    if (!child.isMesh) return

    const position = child.geometry.attributes.position
    for (let i = 0; i < position.count; i++) {
      point.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld)

      const dx = -point.x * sinLean + point.y * cosLean
      const dy = -point.x * cosLean - point.y * sinLean
      const dz = point.z

      // The cone widens upward, so each vertex is measured against the wall at
      // its *own* height rather than at the slice's centre.
      const room = cupRadiusAt(y + dy) - gap
      const allowed = -dx + Math.sqrt(Math.max(room * room - dz * dz, 0))
      radius = Math.min(radius, allowed)
    }
  })

  return Math.max(radius, 0)
}

/**
 * One flavor's slices: a group of two or three, each standing in the wall's
 * tangent plane at its own angle and height.
 *
 * Built once and cloned, so three slices share geometry and materials rather
 * than tripling the setup — and `disposeFruit` walks the frame anyway, so
 * nothing is leaked by sharing.
 */
export function buildFruit(spec, count = 2) {
  const build = BUILDERS[spec.kind]
  if (!build) throw new Error(`Unknown fruit kind: ${spec.kind}`)

  const group = new THREE.Group()
  const random = seededRandom(seedFrom(spec.kind))
  const angles = SLICE_ANGLES[count] ?? SLICE_ANGLES[2]

  const prototype = new THREE.Group()
  build(prototype, spec)

  for (let i = 0; i < angles.length; i++) {
    const y = FRUIT_Y_MIN + random() * (FRUIT_Y_MAX - FRUIT_Y_MIN)
    const angle = angles[i] + (random() - 0.5) * 0.5

    const radius = maxSliceRadius(prototype, y, FRUIT_GAP)

    const holder = new THREE.Group()
    holder.position.set(Math.cos(angle) * radius, y, Math.sin(angle) * radius)
    // Y then Z: the yaw swings the slice round the cup, the Z rotation is what
    // stands it upright and leans it to the wall's draft angle.
    holder.rotation.set(0, -angle, -Math.PI / 2 - FRUIT_LEAN, 'YXZ')
    holder.add(i === 0 ? prototype : prototype.clone())
    group.add(holder)
  }

  return group
}

/**
 * Geometries and materials are per-fruit, so each one disposes its own — but
 * the slices share theirs, so they are collected into sets first rather than
 * disposed once per traverse hit.
 */
export function disposeFruit(root) {
  const geometries = new Set()
  const materials = new Set()

  root.traverse((child) => {
    if (child.geometry) geometries.add(child.geometry)
    if (child.material) materials.add(child.material)
  })

  geometries.forEach((geometry) => geometry.dispose())
  materials.forEach((material) => material.dispose())
}
