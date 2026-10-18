import * as THREE from 'three'
import {
  cupModel,
  cupShellProfile,
  highlightModel,
  lidModel,
  outerProfile,
  strawModel,
} from '../config/cupProfile.js'

/**
 * The cup, built from numbers — no external model (AGENTS.md section 4).
 *
 * Every shape here is a lathe or a primitive spun from the profile in
 * config/cupProfile.js, so the body, the lid, the straw and the highlight band
 * all agree about where the cup actually is. Nothing in this file reads the
 * store, a clock or a flavour: it returns geometry, and Cup.jsx assembles it.
 */

/** [radius, y] pairs to the Vector2 list LatheGeometry wants. */
const toLathe = (points) =>
  points.map(([radius, y]) => new THREE.Vector2(radius, y))

/** The cup body: a thin-walled shell, outside and back up the inside. */
export function buildCupBodyGeometry(segments) {
  return new THREE.LatheGeometry(toLathe(cupShellProfile()), segments)
}

/**
 * The rolled rim the lid clips onto. A torus rather than a flat ring, because a
 * takeaway cup's mouth is a lip with thickness, and a flat ring would vanish
 * edge-on — which is exactly how the camera sees it.
 */
export function buildRimFlangeGeometry() {
  const geometry = new THREE.TorusGeometry(cupModel.rimRadius + 0.005, 0.011, 8, 44)
  geometry.rotateX(-Math.PI / 2)
  geometry.translate(0, cupModel.rimY, 0)
  return geometry
}

/**
 * The dome lid, as one lathe: the flange's underside, up its outer wall, then
 * an elliptical dome to the apex.
 *
 * One surface rather than a flange cylinder plus a dome, because the two would
 * have to be sewn together along a seam the camera looks straight at. The dome
 * is an ellipse in profile — 0.311 across, 0.22 tall — not a hemisphere, which
 * is what the reference photo shows and what stops the lid from dominating the
 * cup.
 */
export function buildLidGeometry(segments) {
  const { radius, domeHeight, baseY } = lidModel
  const points = [
    [radius - 0.009, cupModel.rimY],
    [radius, cupModel.rimY],
    [radius, baseY],
  ]

  const steps = 14
  for (let i = 1; i <= steps; i++) {
    const t = (i / steps) * (Math.PI / 2)
    points.push([radius * Math.cos(t), baseY + domeHeight * Math.sin(t)])
  }

  return new THREE.LatheGeometry(toLathe(points), segments)
}

/** The point on the dome under (x, z), and the surface normal there. */
function domePoint(x, z) {
  const a2 = lidModel.radius * lidModel.radius
  const b2 = lidModel.domeHeight * lidModel.domeHeight
  const flat = Math.max(1 - (x * x + z * z) / a2, 0)
  const y = lidModel.baseY + lidModel.domeHeight * Math.sqrt(flat)

  return {
    y,
    normal: new THREE.Vector3(
      x / a2,
      (y - lidModel.baseY) / b2,
      z / a2,
    ).normalize(),
  }
}

/** The straw's collar: a small ring sitting flat in the dome's tangent plane. */
export function buildStrawHoleGeometry() {
  const geometry = new THREE.TorusGeometry(
    strawModel.radius * 1.45,
    strawModel.radius * 0.42,
    6,
    18,
  )

  const { y, normal } = domePoint(strawModel.holeX, strawModel.holeZ)
  // A torus is built in the XY plane facing +Z, so this stands it on the dome.
  geometry.applyQuaternion(
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal),
  )
  geometry.translate(strawModel.holeX, y + 0.002, strawModel.holeZ)
  return geometry
}

/**
 * A straw segment, split at the point where it leaves the lid.
 *
 * Two meshes rather than one because of transparency ordering: the part inside
 * the drink has to be drawn *before* the cup so the drink tints it, and the
 * part above the lid has to be drawn *after* it so the lid does not. One mesh
 * cannot be both.
 *
 * The geometry's origin is the hole, so the group that holds it pivots exactly
 * where the straw meets the lid and its lower end cannot swing out of the cup.
 */
function strawSegment(fromY, toY) {
  const geometry = new THREE.CylinderGeometry(
    strawModel.radius,
    strawModel.radius,
    toY - fromY,
    strawModel.segments,
    1,
    true,
  )
  geometry.translate(0, (fromY + toY) / 2 - strawModel.holeY, 0)
  return geometry
}

export const buildStrawInnerGeometry = () =>
  strawSegment(strawModel.bottomY, strawModel.holeY)

export const buildStrawOuterGeometry = () =>
  strawSegment(strawModel.holeY, strawModel.topY)

/**
 * The highlight streak: a narrow arc lathed from the body's own outer profile,
 * stood just proud of it so it cannot z-fight.
 *
 * A band of the *body* rather than a flat plane placed in front of it, because
 * the cup tapers. A plane would cut a corner, or hover off the wall, and read
 * as a sticker rather than as a reflection.
 */
export function buildHighlightGeometry() {
  const points = outerProfile
    .filter(([, y]) => y >= 0.05)
    .map(([radius, y]) => [radius * highlightModel.lift, y])

  return new THREE.LatheGeometry(
    toLathe(points),
    highlightModel.segments,
    highlightModel.phiStart,
    highlightModel.phiLength,
  )
}

const HIGHLIGHT_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

/**
 * Additive white, fading out at the band's edges across the arc and towards the
 * foot. Lathe UVs run v.x around the arc and v.y up the profile, so both fades
 * are one line each.
 */
const HIGHLIGHT_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float band = sin(clamp(vUv.x, 0.0, 1.0) * 3.14159265);
    float foot = smoothstep(0.0, 0.2, vUv.y);
    float up = mix(0.55, 1.0, smoothstep(0.0, 0.55, vUv.y));
    gl_FragColor = vec4(uColor, pow(band, 1.7) * foot * up * uOpacity);
  }
`

export function createHighlightMaterial(opacity = 0.5) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#ffffff') },
      uOpacity: { value: opacity },
    },
    vertexShader: HIGHLIGHT_VERTEX,
    fragmentShader: HIGHLIGHT_FRAGMENT,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  })
}
