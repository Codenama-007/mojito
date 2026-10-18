import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { prefersReducedMotion, quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { createPlasticMaterial } from './shaders/plasticMaterial.js'
import { REVEAL, buildIce, iceState, revealAt } from './ingredientMath.js'

/**
 * Three small rounded cubes in one InstancedMesh, floating half-submerged near
 * the surface, each dropping in from above its own resting place.
 *
 * Down from five on both tiers in Phase 7: the upper half of the cup is now
 * packed with mint, and the ice is meant to be glimpsed *through* it rather
 * than to be the thing you notice.
 *
 * The material is the plastic recipe, so the ice picks up the same tier rules,
 * clearcoat and fresnel rim with no second set of numbers to keep in sync
 * (AGENTS.md section 4) — but with transmission forced off, because ice does
 * not need a second pass over the scene and on desktop the passthrough would
 * sample the empty canvas behind the cup and go black.
 *
 * The drop is a closed-form function of scroll progress, so scrolling up lifts
 * the cubes back out of the cup instead of leaving them in the drink.
 */

/** Above the drink (0), the bubbles (0.2/0.3) and the mint (0.4), below the cup (2). */
const RENDER_ORDER = 0.6

/** Unit cube; each instance is scaled to its own size. */
const CUBE_RADIUS = 0.18
const CUBE_SEGMENTS = 2

export default function Ice({ count = quality.iceCount }) {
  const meshRef = useRef(null)
  const cubes = useMemo(() => buildIce(count), [count])

  const geometry = useMemo(
    () => new RoundedBoxGeometry(1, 1, 1, CUBE_SEGMENTS, CUBE_RADIUS),
    [],
  )

  const material = useMemo(
    () => createPlasticMaterial({ opacity: quality.iceOpacity, transmission: 0 }),
    [],
  )

  const scratch = useMemo(
    () => ({
      matrix: new THREE.Matrix4(),
      position: new THREE.Vector3(),
      scale: new THREE.Vector3(),
      quaternion: new THREE.Quaternion(),
      euler: new THREE.Euler(0, 0, 0, 'YXZ'),
    }),
    [],
  )

  const write = (time, reveal) => {
    const mesh = meshRef.current
    if (!mesh) return

    const motion = prefersReducedMotion ? 0 : 1
    const { matrix, position, scale, quaternion, euler } = scratch

    for (let i = 0; i < cubes.length; i++) {
      const cube = cubes[i]
      const state = iceState(cube, reveal, time, motion)

      euler.set(state.tilt, state.spin, cube.tilt * 0.5)
      quaternion.setFromEuler(euler)
      position.set(state.x, state.y, state.z)
      scale.setScalar(cube.size * state.scale)
      matrix.compose(position, quaternion, scale)
      mesh.setMatrixAt(i, matrix)
    }

    mesh.instanceMatrix.needsUpdate = true

    // Through the mesh, like Liquid.jsx does for its uniforms: the material is
    // a live three object, and assigning to the memo value is what
    // react-hooks/immutability rejects.
    mesh.material.opacity = quality.iceOpacity * Math.min(reveal * 3, 1)
    mesh.visible = reveal > 0.001
  }

  useLayoutEffect(() => {
    write(0, revealAt(useStore.getState().scrollProgress, REVEAL.ice))
  })

  useFrame((state) => {
    const { scrollProgress } = useStore.getState()
    write(state.clock.elapsedTime, revealAt(scrollProgress, REVEAL.ice))
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
