import * as THREE from 'three'
import { mint } from '../config/flavors.js'

/**
 * The leaf outline, built in code, so there is no texture to download and the
 * asset budget stays untouched (AGENTS.md section 5).
 *
 * It lives on its own because two things wear a leaf: the mint packed into the
 * cup (Mint.jsx) and the strawberry's crown (wholeFruits.js). The plant part of
 * a strawberry is the same plant part as the mint, so it is the same shape.
 *
 * Phase 5 drew this as two quadratic curves — a smooth, elliptical leaf. Phase 7
 * packs two dozen of them against the cup wall, where each one is seen on its
 * own, and a smooth margin there reads as a plastic leaf cutout. So the margin
 * is serrated now, and generated as a width function along the leaf rather than
 * as curves, because teeth are much easier to describe that way.
 */

/** Half-width as a fraction of the leaf's length, at its widest. */
export const LEAF_WIDTH = 0.34

/** The leaf is built one unit long and centred, so its half-length is 0.5. */
export const LEAF_HALF_LENGTH = 0.5

/** How far the margin's teeth stand out, as a fraction of the local width. */
const SERRATION = 0.14

/**
 * The furthest the serrated margin ever reaches, as a fraction of the length.
 *
 * Exported because `ingredientMath.js` has to subtract a leaf's radial reach
 * *before* it knows where the leaf goes, and a number that disagrees with the
 * outline by 5% is how a leaf ends up poking through the plastic. This is the
 * bound, not the widest tooth actually drawn.
 */
export const LEAF_HALF_WIDTH_MAX = LEAF_WIDTH * (1 + SERRATION)

/** Teeth along one side. Low odds read as a saw; high evens read as a fern. */
const TEETH = 9

/** Samples along one side — enough to resolve a tooth at phone size. */
const MARGIN_STEPS = 72

/** A triangle wave: -1 at the trough, +1 at the crest, period 1. */
const triangle = (x) => 2 * Math.abs(2 * (x - Math.floor(x + 0.5))) - 1

/** The leaf's half-width at t, running 0 at the stem to 1 at the tip. */
function halfWidthAt(t) {
  // Widest around the lower third, like a mint leaf, rather than at the middle.
  const body = Math.pow(Math.sin(Math.PI * Math.pow(t, 0.82)), 0.9)
  // Teeth stand out from the body rather than cutting into it.
  const tooth = 0.5 + 0.5 * triangle(t * TEETH)
  return LEAF_WIDTH * body * (1 + SERRATION * tooth)
}

/**
 * One unit-long leaf in the XY plane, coloured in place: the shape is built at
 * length 1 and every instance is scaled to its own length, so the gradient and
 * the UVs survive the scale.
 *
 * The gradient is a vertex colour running stem to tip. The mint ignores it and
 * uses UVs plus its own canvas texture instead (mintTexture.js); the
 * strawberry's crown passes no map and gets the gradient.
 *
 * @param {{ stemColor: string, tipColor: string }} [gradient]
 */
export function buildLeafGeometry(gradient = mint) {
  const half = 0.5
  const outline = new THREE.Shape()
  const right = []
  const left = []

  for (let i = 0; i <= MARGIN_STEPS; i++) {
    const t = i / MARGIN_STEPS
    const width = halfWidthAt(t)
    const y = -half + t
    right.push([width, y])
    left.push([-width, y])
  }

  outline.moveTo(right[0][0], right[0][1])
  for (let i = 1; i <= MARGIN_STEPS; i++) outline.lineTo(right[i][0], right[i][1])
  // Skip both ends of the left margin: they are the same two points the right
  // margin already supplied, and a repeated point breaks the triangulator.
  for (let i = MARGIN_STEPS - 1; i >= 1; i--) outline.lineTo(left[i][0], left[i][1])
  outline.closePath()

  const geometry = new THREE.ShapeGeometry(outline)
  const position = geometry.attributes.position

  // ShapeGeometry writes each vertex's *shape* coordinates straight into `uv`,
  // so this leaf arrives with UVs from -0.5 to 0.5 and the tip at (0, 0.5). A
  // texture mapped through that tiles and lands nowhere. Normalised to 0..1
  // across the true extent, so the vein texture runs exactly once, stem to tip.
  const uvs = new Float32Array(position.count * 2)
  let minX = Infinity
  let maxX = -Infinity

  for (let i = 0; i < position.count; i++) {
    minX = Math.min(minX, position.getX(i))
    maxX = Math.max(maxX, position.getX(i))
  }

  const spanX = maxX - minX || 1
  for (let i = 0; i < position.count; i++) {
    uvs[i * 2] = (position.getX(i) - minX) / spanX
    uvs[i * 2 + 1] = position.getY(i) + half
  }
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))

  const colors = new Float32Array(position.count * 3)
  const stem = new THREE.Color(gradient.stemColor)
  const tip = new THREE.Color(gradient.tipColor)
  const color = new THREE.Color()

  for (let i = 0; i < position.count; i++) {
    color.copy(stem).lerp(tip, (position.getY(i) + half) / (half * 2))
    colors[i * 3] = color.r
    colors[i * 3 + 1] = color.g
    colors[i * 3 + 2] = color.b
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geometry
}

/**
 * A material for anything wearing a `buildLeafGeometry` leaf.
 *
 * `map` is optional, and when it is given it *replaces* the vertex gradient
 * rather than multiplying it: the mint's canvas texture already carries its own
 * shading, and a gradient on top of that double-darkens the tip. The
 * strawberry's crown passes nothing and gets the gradient.
 */
export function createLeafMaterial(map = null) {
  return new THREE.MeshStandardMaterial({
    map,
    color: new THREE.Color('#ffffff'),
    vertexColors: map === null,
    roughness: map === null ? 0.5 : 0.58,
    metalness: 0,
    side: THREE.DoubleSide,
  })
}
