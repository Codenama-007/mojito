import * as THREE from 'three'
import {
  mergeGeometries,
  mergeVertices,
} from 'three/examples/jsm/utils/BufferGeometryUtils.js'

/**
 * The handful of geometry operations the whole fruits need, kept apart from the
 * fruit shapes themselves so both files stay readable (AGENTS.md section 4).
 *
 * Everything here returns the geometry it was given, mutated, so a builder can
 * chain them.
 */

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value)

/**
 * Displaces every vertex along its own radius by a smooth ripple.
 *
 * The ripple is a pure function of the vertex position rather than a random
 * number, and the vertices are welded first, both for the same reason: a sphere
 * duplicates vertices along its UV seam and at its poles, and duplicates that
 * end up with different offsets tear a crack in the surface.
 *
 * Welding also fixes the shading. `mergeVertices` keys its hash on *every*
 * attribute, so the seam duplicates only merge once the differing `uv` is gone
 * — and without the merge, `computeVertexNormals` would leave a visible normals
 * seam running down the fruit. Neither attribute is needed here: the whole
 * fruits are untextured.
 *
 * @param {THREE.BufferGeometry} geometry Consumed: it is disposed.
 * @param {number} amount Peak displacement, as a fraction of the radius.
 * @param {number} frequency Ripples across the radius; higher is smaller.
 */
export function bumpify(geometry, amount, frequency) {
  geometry.deleteAttribute('normal')
  geometry.deleteAttribute('uv')

  const welded = mergeVertices(geometry)
  geometry.dispose()

  const position = welded.attributes.position

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i)
    const y = position.getY(i)
    const z = position.getZ(i)
    const ripple =
      Math.sin(x * frequency + 1.3) *
      Math.sin(y * frequency * 0.8 + 2.1) *
      Math.sin(z * frequency * 1.1 + 0.7)

    const factor = 1 + ripple * amount
    position.setXYZ(i, x * factor, y * factor, z * factor)
  }

  position.needsUpdate = true
  welded.computeVertexNormals()
  return welded
}

/**
 * Pushes the top of a unit sphere down and in, so it reads as dimpled rather
 * than round. The apple's dent.
 *
 * @param {number} depth How far the very top sinks, in radii.
 * @param {number} spread How far down the sphere the dent reaches, 0..1.
 */
export function dentTop(geometry, depth, spread) {
  const position = geometry.attributes.position
  const start = 1 - spread

  for (let i = 0; i < position.count; i++) {
    const y = position.getY(i)
    const t = clamp01((y - start) / spread)
    const eased = t * t * (3 - 2 * t)

    position.setY(i, y - depth * eased)
    // Narrow as well as lower: a dent with vertical walls reads as a hole.
    position.setX(i, position.getX(i) * (1 - 0.22 * eased))
    position.setZ(i, position.getZ(i) * (1 - 0.22 * eased))
  }

  position.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Per-vertex colour, for a fruit that is not one flat colour.
 *
 * Note this is the geometry's own `color` attribute, which is a different thing
 * from an InstancedMesh's `instanceColor`. A material reading this one needs
 * `vertexColors: true` and should be left white, because three multiplies the
 * two together.
 *
 * @param {(color: THREE.Color, x: number, y: number, z: number) => void} shade
 */
export function tintVertices(geometry, shade) {
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const color = new THREE.Color()

  for (let i = 0; i < position.count; i++) {
    shade(color, position.getX(i), position.getY(i), position.getZ(i))
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

/**
 * A two-tone body: every vertex takes a blend of `from` and `to`.
 *
 * @param {(x: number, y: number, z: number) => number} blend 0 is `from`, 1 is `to`.
 */
export function twoTone(geometry, from, to, blend) {
  const a = new THREE.Color(from)
  const b = new THREE.Color(to)

  return tintVertices(geometry, (color, x, y, z) => {
    color.copy(a).lerp(b, clamp01(blend(x, y, z)))
  })
}

/** A lathe from [radius, y] pairs, the same shape the glass and drink use. */
export function lathe(points, segments = 28) {
  return new THREE.LatheGeometry(
    points.map(([radius, y]) => new THREE.Vector2(radius, y)),
    segments,
  )
}

/**
 * One geometry from many, so a scatter of seed dots is a single mesh rather
 * than one draw call per dot.
 *
 * @param {THREE.BufferGeometry[]} parts Consumed: each is disposed.
 */
export function combine(parts) {
  const merged = mergeGeometries(parts)
  parts.forEach((part) => part.dispose())
  return merged
}

/**
 * The one opaque fruit material. `vertexColors` must be true exactly when the
 * geometry carries a `color` attribute, and the base colour must then be white.
 */
export function skinMaterial(color, vertexColors = false) {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    vertexColors,
    roughness: 0.42,
    metalness: 0,
  })
}

/** A body that has been through `twoTone`, and so carries its own colours. */
export const tintedSkin = () => skinMaterial('#ffffff', true)

/**
 * Scales and re-centres a built fruit so its bounding sphere has radius 1.
 *
 * This is what lets one number — the fruit's size in glass units — place a
 * lime, a strawberry, an apple and a mango. Every builder draws at whatever
 * scale suits its profile, and every fruit ends up comparable, instead of each
 * one being a different fraction of the glass depending on how it was drawn.
 */
export function normaliseToUnitRadius(inner) {
  inner.updateMatrixWorld(true)

  const sphere = new THREE.Box3()
    .setFromObject(inner)
    .getBoundingSphere(new THREE.Sphere())

  const factor = 1 / (sphere.radius || 1)

  // Scale about the origin, then move the measured centre onto it. A point p
  // ends up at factor * (p - centre), so the bounding sphere is exactly the
  // unit sphere at the origin.
  inner.scale.multiplyScalar(factor)
  inner.position.copy(sphere.center).multiplyScalar(-factor)

  return inner
}
