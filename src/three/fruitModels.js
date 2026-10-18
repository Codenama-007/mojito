import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { FRUIT_TILT, FRUIT_Y, seededRandom } from './ingredientMath.js'

/**
 * The four fruit slices, built in code — no external models (AGENTS.md section
 * 4). Each is a small group of primitives, which is enough because only one
 * fruit is ever on screen; none of them need instancing.
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
      // Kept shallow: the slice group is tilted, so height here is spent
      // against the rim rather than against the drink.
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

/** One slice, positioned just above the drink and inside the bowl mouth. */
export function buildFruit(spec) {
  const build = BUILDERS[spec.kind]
  if (!build) throw new Error(`Unknown fruit kind: ${spec.kind}`)

  const group = new THREE.Group()
  build(group, spec)
  group.position.y = FRUIT_Y
  group.rotation.z = FRUIT_TILT
  return group
}

/** Geometries and materials are per-fruit, so each one disposes its own. */
export function disposeFruit(root) {
  root.traverse((child) => {
    if (child.geometry) child.geometry.dispose()
    if (child.material) child.material.dispose()
  })
}
