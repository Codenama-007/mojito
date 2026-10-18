import * as THREE from 'three'
import { seededRandom } from './ingredientMath.js'
import { buildLeafGeometry, createLeafMaterial } from './leafGeometry.js'
import {
  bumpify,
  combine,
  dentTop,
  lathe,
  normaliseToUnitRadius,
  skinMaterial,
  tintedSkin,
  twoTone,
} from './fruitGeometry.js'

/**
 * The four whole fruits that float around the glass, built in code — no
 * external models (AGENTS.md section 4).
 *
 * A whole fruit is a different job from the slices in fruitModels.js. A slice
 * is a flat face with a rind; a whole fruit is a body with a cut, seeds or a
 * crown, and it has to look right from every angle because it orbits.
 *
 * Every builder draws into a body group at whatever scale suits its profile,
 * and `buildWholeFruit` then normalises the result to a unit bounding sphere.
 * That is what lets the caller place all four with a single size number.
 *
 * Colours arrive as `flavor.fruit.whole`; nothing here knows which flavor it is
 * drawing (AGENTS.md section 4.2).
 */

// -------------------------------------------------------------------------- lime

/** Where the lime is cut, as a distance from its centre in radii. */
const LIME_CUT = 0.7

/**
 * lime: a green sphere with one face cut clean off.
 *
 * The body is a partial sphere rather than a full one with a disc laid over it,
 * so the cut is a real hole in the surface and the rind has an edge to see. The
 * face is filled with two discs: pale pith around the outside, flesh in the
 * middle, which is the ring the brief asks for.
 */
function buildLime(body, colors) {
  const face = Math.sqrt(1 - LIME_CUT * LIME_CUT)
  const thetaStart = Math.acos(LIME_CUT)
  const discRadius = face * 1.02

  const shell = bumpify(
    new THREE.SphereGeometry(1, 30, 20, 0, Math.PI * 2, thetaStart, Math.PI - thetaStart),
    0.035,
    9,
  )
  // Darker at the base, lighter towards the cut, so the sphere has a light
  // direction even before the scene lights it.
  twoTone(shell, colors.skin, colors.skinAlt, (x, y) => (y + 1) / (1 + LIME_CUT))
  body.add(new THREE.Mesh(shell, tintedSkin()))

  const faceGroup = new THREE.Group()
  faceGroup.position.y = LIME_CUT
  // Circles are built facing +Z; -90 degrees about X turns them to face +Y.
  faceGroup.rotation.x = -Math.PI / 2

  // Offset in y only after the rotation, so the flesh sits above the pith and
  // the two cannot z-fight where they overlap.
  const pith = new THREE.Mesh(
    new THREE.RingGeometry(discRadius * 0.68, discRadius, 32),
    skinMaterial(colors.detail),
  )
  pith.position.z = 0.001

  const flesh = new THREE.Mesh(
    new THREE.CircleGeometry(discRadius * 0.7, 32),
    skinMaterial(colors.flesh),
  )
  flesh.position.z = 0.003

  faceGroup.add(pith, flesh)
  body.add(faceGroup)

  // Tip the cut towards the camera rather than straight up, or the fruit spends
  // most of its orbit showing nothing but rind.
  body.rotation.set(0.72, 0.2, 0.35)
}

// ------------------------------------------------------------------- strawberry

/** [radius, y] from the tip up to the shoulder. Normalised later. */
const STRAWBERRY_PROFILE = [
  [0.0, 0.0],
  [0.2, 0.07],
  [0.32, 0.18],
  [0.4, 0.32],
  [0.43, 0.47],
  [0.42, 0.62],
  [0.38, 0.75],
  [0.3, 0.87],
  [0.18, 0.96],
  [0.0, 1.0],
]

/** Seeds have to sit on the surface, so the profile needs to be queryable. */
function strawberryRadiusAt(y) {
  for (let i = 1; i < STRAWBERRY_PROFILE.length; i++) {
    const [radius, yi] = STRAWBERRY_PROFILE[i]
    if (y <= yi) {
      const [previousRadius, previousY] = STRAWBERRY_PROFILE[i - 1]
      const t = (y - previousY) / (yi - previousY)
      return previousRadius + (radius - previousRadius) * t
    }
  }
  return 0
}

/** Four rings of seed dots, up the widest part of the fruit. */
const STRAWBERRY_SEED_RINGS = [
  { y: 0.2, count: 4 },
  { y: 0.4, count: 5 },
  { y: 0.6, count: 6 },
  { y: 0.78, count: 5 },
]

/**
 * strawberry: a lathe from a point at the tip to a rounded shoulder, with seed
 * dots half-sunk into it and a crown of leaves.
 *
 * The crown is the mint's leaf from leafGeometry.js. A strawberry's calyx and a
 * mint leaf are the same plant part, so they are the same shape.
 */
function buildStrawberry(body, colors) {
  const shell = lathe(STRAWBERRY_PROFILE, 28)
  twoTone(shell, colors.skin, colors.skinAlt, (x, y) => y * 1.1)
  body.add(new THREE.Mesh(shell, tintedSkin()))

  // One merged geometry, so twenty seeds are one draw call rather than twenty.
  const random = seededRandom(0x5eed)
  const seeds = []

  for (const ring of STRAWBERRY_SEED_RINGS) {
    const radius = strawberryRadiusAt(ring.y) * 0.97

    for (let i = 0; i < ring.count; i++) {
      const angle = (i / ring.count) * Math.PI * 2 + ring.y * 9 + random() * 0.3
      const seed = new THREE.IcosahedronGeometry(0.028, 0)
      seed.translate(Math.cos(angle) * radius, ring.y, Math.sin(angle) * radius)
      seeds.push(seed)
    }
  }

  body.add(new THREE.Mesh(combine(seeds), skinMaterial(colors.detail)))

  const leafGeometry = buildLeafGeometry()
  const leafMaterial = createLeafMaterial()

  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2 + 0.4
    const leaf = new THREE.Mesh(leafGeometry, leafMaterial)
    leaf.position.set(Math.cos(angle) * 0.14, 0.97, Math.sin(angle) * 0.14)
    leaf.scale.setScalar(0.45)
    // YXZ so the leaf is first laid down (X) and then swept around (Y).
    leaf.rotation.set(-Math.PI / 2 + 0.55, -angle, 0, 'YXZ')
    body.add(leaf)
  }
}

// ------------------------------------------------------------------------ apple

/**
 * apple: a sphere dented at the top with a stalk in the dent, red on one
 * shoulder and green on the other.
 *
 * "Red-green" is done per vertex rather than with a texture: the blend is a
 * function of position, so the two colours follow the fruit as it turns instead
 * of sliding across its surface.
 */
function buildApple(body, colors) {
  const shell = bumpify(new THREE.SphereGeometry(1, 30, 22), 0.014, 5)

  dentTop(shell, 0.17, 0.32)
  twoTone(shell, colors.skinAlt, colors.skin, (x, y, z) =>
    0.42 + 0.62 * (x * 0.7 + z * 0.4 - y * 0.2),
  )
  body.add(new THREE.Mesh(shell, tintedSkin()))

  // Base inside the dent, top just above where the sphere used to be, so the
  // stalk does not make the fruit's bounding sphere lopsided.
  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.045, 0.07, 0.25, 8),
    skinMaterial(colors.detail),
  )
  stalk.position.set(0.02, 0.9, 0.01)
  stalk.rotation.z = -0.12
  body.add(stalk)
}

// ------------------------------------------------------------------------ mango

/**
 * mango: an orange-yellow ellipsoid, taller than it is wide, with a red blush
 * across one cheek and a short stalk.
 *
 * The blush fades out with the square of the blend so it stays a patch rather
 * than washing over half the fruit.
 */
function buildMango(body, colors) {
  const shell = bumpify(new THREE.SphereGeometry(1, 30, 22), 0.02, 4)
  shell.scale(0.72, 1.15, 0.68)
  twoTone(shell, colors.skin, colors.skinAlt, (x, y) =>
    Math.pow(Math.max(0, x * 0.75 + y * 0.35 + 0.35), 2) * 0.95,
  )
  body.add(new THREE.Mesh(shell, tintedSkin()))

  const stalk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.04, 0.16, 7),
    skinMaterial(colors.detail),
  )
  stalk.position.set(0.1, 1.13, 0)
  stalk.rotation.z = -0.25
  body.add(stalk)
}

// ------------------------------------------------------------------- assembly

const BUILDERS = {
  lime: buildLime,
  strawberry: buildStrawberry,
  apple: buildApple,
  mango: buildMango,
}

/**
 * One whole fruit, inside a group whose bounding sphere has radius 1. The
 * caller places it by setting that group's scale to the radius it wants, in
 * glass units.
 *
 * @param {string} kind Which builder draws it, from flavor.fruit.kind.
 * @param {object} colors flavor.fruit.whole.
 */
export function buildWholeFruit(kind, colors) {
  const build = BUILDERS[kind]
  if (!build) throw new Error(`Unknown whole fruit kind: ${kind}`)

  const outer = new THREE.Group()
  const inner = new THREE.Group()
  const body = new THREE.Group()

  outer.add(inner)
  inner.add(body)

  build(body, colors)
  normaliseToUnitRadius(inner)

  return outer
}

/** Geometries and materials are per-fruit, so each one disposes its own. */
export function disposeWholeFruit(root) {
  root.traverse((child) => {
    if (child.geometry) child.geometry.dispose()
    if (child.material) child.material.dispose()
  })
}
