import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { prefersReducedMotion, quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { buildLeafGeometry, createLeafMaterial } from './leafGeometry.js'
import { createMintLeafTexture } from './mintTexture.js'
import { REVEAL, buildMint, mintState, revealAt } from './ingredientMath.js'

/**
 * A packed bunch of mint in one InstancedMesh — 24 leaves on desktop, 14 on
 * mobile, still a single draw call (AGENTS.md section 5).
 *
 * Phase 5 laid eight leaves flat on the drink's surface, which was right for a
 * stemmed glass you look *down* into: the surface was the show. A takeaway cup
 * is a wall you look *through*, so these are pressed against the inside of the
 * wall and stacked up the upper half of the drink — which is also how a mojito
 * cup is really built. Muddle the mint, then wedge it against the side.
 *
 * The placement and the orientation both live in ingredientMath.js; this file
 * only composes matrices. The outline is shared with the strawberry's crown
 * (leafGeometry.js) and the veins are a canvas texture (mintTexture.js).
 */

/** Above the drink (0) and the wall bubbles (0.3), below the ice (0.6) and the cup (2). */
const RENDER_ORDER = 0.4

export default function Mint({ count = quality.mintCount }) {
  const meshRef = useRef(null)
  const leaves = useMemo(() => buildMint(count), [count])
  const geometry = useMemo(() => buildLeafGeometry(), [])
  const texture = useMemo(() => createMintLeafTexture(), [])
  const material = useMemo(() => createLeafMaterial(texture), [texture])

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      /**
       * Y, then X, then Z. The heading turns the leaf's *normal* onto the wall's
       * radius, the lean tilts it to the cone's draft angle, and the roll spins
       * it in its own plane. That order is the whole reason a leaf ends up lying
       * flat against the wall instead of standing on edge like a coin in a slot.
       */
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

      euler.set(state.lean, state.heading, state.roll)
      quaternion.setFromEuler(euler)
      position.set(state.x, state.y, state.z)
      scale.setScalar(leaf.length * state.scale)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(i, matrix)
    }

    mesh.instanceMatrix.needsUpdate = true
    // The reveal is carried by the leaf's own scale, so there is nothing to
    // fade — a zero-scale leaf is simply not there.
    mesh.visible = reveal > 0.001
  }

  // Seed the matrices before the first paint, or every instance renders at the
  // origin for one frame.
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
      texture.dispose()
    },
    [geometry, material, texture],
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
