import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { prefersReducedMotion, quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { REVEAL, buildWallBubbles, revealAt, wallBubbleState } from './ingredientMath.js'

/**
 * A film of bubbles stuck to the inside of the wall, in one InstancedMesh —
 * 60 on desktop, 30 on mobile (AGENTS.md section 5).
 *
 * Phase 5's bubbles all climbed, which reads as a fizzy drink and nothing else.
 * A real one also has bubbles gripping the plastic, and that film is most of
 * what separates "carbonated" from "just poured". They shimmer where they sit,
 * and every so often one lets go and climbs.
 *
 * Like the climbing set, the whole thing is a closed-form function of the
 * clock: one phase per bubble decides whether it is gripping or rising, so there
 * is no per-bubble state to get out of step when the user scrolls back up.
 */

/** Above the drink (0), below the mint (0.4), the ice (0.6) and the cup (2). */
const RENDER_ORDER = 0.3

export default function WallBubbles({ count = quality.wallBubbleCount }) {
  const meshRef = useRef(null)
  const bubbles = useMemo(() => buildWallBubbles(count), [count])

  // Detail 0, not 1: these are a third the size of the climbing bubbles and
  // hide against a wall, so 20 triangles read identically to 80.
  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 0), [])

  // Same recipe as the climbing bubbles: it is the environment map's highlight
  // on each sphere that makes a few pixels read as a bubble at all.
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#f4fbff'),
        transparent: true,
        opacity: quality.wallBubbleOpacity,
        roughness: 0.08,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.04,
        envMapIntensity: quality.environmentIntensity,
        depthWrite: false,
      }),
    [],
  )

  const scratch = useMemo(
    () => ({ matrix: new THREE.Matrix4(), scale: new THREE.Vector3() }),
    [],
  )

  const write = (time, reveal) => {
    const mesh = meshRef.current
    if (!mesh) return

    const motion = prefersReducedMotion ? 0 : 1
    const { matrix, scale } = scratch

    for (let i = 0; i < bubbles.length; i++) {
      const bubble = bubbles[i]
      const { x, y, z, scale: size } = wallBubbleState(bubble, time, motion)

      // A sphere needs no rotation, so scale-then-translate is the whole
      // transform and skips a quaternion compose per instance.
      scale.setScalar(size)
      matrix.makeScale(scale.x, scale.y, scale.z)
      matrix.setPosition(x, y, z)
      mesh.setMatrixAt(i, matrix)
    }

    mesh.instanceMatrix.needsUpdate = true

    // Reached through the mesh rather than the memo value, the same access
    // pattern Liquid.jsx uses for its uniforms.
    mesh.material.opacity = quality.wallBubbleOpacity * reveal
    mesh.visible = reveal > 0.001
  }

  // Seed the matrices before the first paint, or every instance renders at the
  // origin for one frame.
  useLayoutEffect(() => {
    write(0, revealAt(useStore.getState().scrollProgress, REVEAL.bubbles))
  })

  useFrame((state) => {
    const { scrollProgress } = useStore.getState()
    write(state.clock.elapsedTime, revealAt(scrollProgress, REVEAL.bubbles))
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
