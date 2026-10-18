import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { prefersReducedMotion, quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { REVEAL, bubblePosition, buildBubbles, revealAt } from './ingredientMath.js'

/**
 * One InstancedMesh of low-poly spheres — 80 on desktop, 40 on mobile, still a
 * single draw call either way (AGENTS.md section 5).
 *
 * The climb is entirely a function of the clock: it loops from the floor to the
 * surface forever. Scroll only drives the fade, which is why scrolling up
 * cannot yank a bubble sideways or leave one stranded mid-column.
 */

/** Sits above the drink (renderOrder 0) and below the glass (2). */
const RENDER_ORDER = 0.2

export default function Bubbles({ count = quality.bubbleCount }) {
  const meshRef = useRef(null)
  const bubbles = useMemo(() => buildBubbles(count), [count])

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), [])

  // Physical rather than basic: the environment map gives each sphere a
  // highlight, which is most of what makes a small dot read as a bubble.
  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#f4fbff'),
        transparent: true,
        opacity: quality.bubbleOpacity,
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
      const { x, y, z } = bubblePosition(bubble, time, motion)

      // A sphere needs no rotation, so scale-then-translate is the whole
      // transform and skips a quaternion compose per instance.
      scale.setScalar(bubble.size)
      matrix.makeScale(scale.x, scale.y, scale.z)
      matrix.setPosition(x, y, z)
      mesh.setMatrixAt(i, matrix)
    }

    mesh.instanceMatrix.needsUpdate = true

    // Reached through the mesh rather than through the value useMemo handed
    // back: the material is a live three object, and this is the same access
    // pattern Liquid.jsx uses for its uniforms. Direct assignment on the memo
    // value is what react-hooks/immutability rejects.
    mesh.material.opacity = quality.bubbleOpacity * reveal
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
