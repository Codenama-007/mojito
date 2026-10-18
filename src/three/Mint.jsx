import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mint } from '../config/flavors.js'
import { prefersReducedMotion, quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { REVEAL, buildMint, mintState, revealAt } from './ingredientMath.js'

/**
 * Eight to ten leaves in one InstancedMesh, lying flat on the surface and
 * swaying. The leaf outline is built in code — two quadratic curves meeting at
 * a point at each end — so there is no texture to download and the remaining
 * asset budget stays untouched (AGENTS.md section 5).
 *
 * The gradient is a vertex colour running stem to tip, not a mapped image.
 */

/** Above the drink (0) and the bubbles (0.2), below the ice (0.6) and the glass (2). */
const RENDER_ORDER = 0.4

/** Half-width as a fraction of the leaf's length. */
const LEAF_WIDTH = 0.34

/**
 * One unit-long leaf in the XY plane, coloured in place: the shape is built at
 * length 1 and every instance is scaled to its own length, so the gradient
 * survives the scale.
 */
function buildLeafGeometry() {
  const half = 0.5
  const outline = new THREE.Shape()
  outline.moveTo(0, -half)
  // A quadratic curve reaches half of its control offset at the midpoint, so
  // the control points sit at twice the intended half-width.
  outline.quadraticCurveTo(LEAF_WIDTH * 2, -half * 0.3, 0, half)
  outline.quadraticCurveTo(-LEAF_WIDTH * 2, -half * 0.3, 0, -half)

  const geometry = new THREE.ShapeGeometry(outline, 14)
  const position = geometry.attributes.position
  const colors = new Float32Array(position.count * 3)
  const stem = new THREE.Color(mint.stemColor)
  const tip = new THREE.Color(mint.tipColor)
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

export default function Mint({ count = quality.mintCount }) {
  const meshRef = useRef(null)
  const leaves = useMemo(() => buildMint(count), [count])
  const geometry = useMemo(() => buildLeafGeometry(), [])

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.5,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
    [],
  )

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      // Y first, so the heading turns the already-flattened leaf about the
      // world axis rather than sliding it around a tilted one.
      euler: new THREE.Euler(0, 0, 0, 'YXZ'),
    }),
    [],
  )

  const write = (time, reveal) => {
    const mesh = meshRef.current
    if (!mesh) return

    const motion = prefersReducedMotion ? 0 : 1
    const { matrix, position, scale, quaternion, euler } = scratch

    for (let i = 0; i < leaves.length; i++) {
      const leaf = leaves[i]
      const state = mintState(leaf, reveal, time, motion)

      // The leaf spans XY, so -90 degrees about X lays it flat on the surface.
      euler.set(-Math.PI / 2 + state.tilt, state.heading, 0)
      quaternion.setFromEuler(euler)
      position.set(state.x, state.y, state.z)
      scale.setScalar(leaf.length * state.scale)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(i, matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    mesh.visible = reveal > 0.001
  }

  useLayoutEffect(() => {
    write(0, revealAt(useStore.getState().scrollProgress, REVEAL.mint))
  })

  useFrame((state) => {
    const { scrollProgress } = useStore.getState()
    write(state.clock.elapsedTime, revealAt(scrollProgress, REVEAL.mint))
  })

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      renderOrder={RENDER_ORDER}
      frustumCulled={false}
    />
  )
}
