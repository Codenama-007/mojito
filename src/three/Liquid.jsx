import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getFlavor } from '../config/flavors.js'
import { quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { drinkProfile } from './liquidProfile.js'
import { liquidFragment, liquidVertex } from './shaders/liquid.js'

/** Time constant for the flavor color blend. ~95% settled at 3x, i.e. 0.6s. */
const COLOR_LERP_TAU = 0.2

/**
 * The drink is translucent, not opaque.
 *
 * Phase 4 ended the fragment shader with a hard 1.0 alpha, which was fine when
 * the drink was the last thing in the bowl. Phase 5 puts bubbles and ice
 * inside it, and an opaque solid hides anything behind its own front face. So:
 * transparent, 0.85 alpha, no depth writes, front faces only. The last part
 * matters — single-sided means the bowl's back wall is culled and you look
 * into the drink instead of at a solid block that reads as a wall.
 *
 * Nothing else moved: same lathe, same profile, same uniforms, same color
 * lerp, same fill level.
 */
const LIQUID_OPACITY = 0.85

export default function Liquid({ segments = quality.latheSegments }) {
  const meshRef = useRef(null)
  const activeFlavor = useStore((state) => state.activeFlavor)
  const targetColor = useRef(null)

  if (targetColor.current === null) {
    targetColor.current = new THREE.Color(
      getFlavor(useStore.getState().activeFlavor).liquidColor,
    )
  }

  const { geometry, floorY, topY } = useMemo(() => {
    const profile = drinkProfile()
    return {
      geometry: new THREE.LatheGeometry(
        profile.points.map(([radius, y]) => new THREE.Vector2(radius, y)),
        segments,
      ),
      floorY: profile.floorY,
      topY: profile.topY,
    }
  }, [segments])

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: {
            value: new THREE.Color(
              getFlavor(useStore.getState().activeFlavor).liquidColor,
            ),
          },
          uTime: { value: 0 },
          uAlpha: { value: LIQUID_OPACITY },
          uFloorY: { value: floorY },
          uTopY: { value: topY },
        },
        vertexShader: liquidVertex,
        fragmentShader: liquidFragment,
        transparent: true,
        depthWrite: false,
        side: THREE.FrontSide,
      }),
    [floorY, topY],
  )

  useEffect(() => {
    targetColor.current.set(getFlavor(activeFlavor).liquidColor)
  }, [activeFlavor])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  useFrame((state, delta) => {
    const uniforms = meshRef.current?.material.uniforms
    if (!uniforms) return

    uniforms.uTime.value = state.clock.elapsedTime

    // Frame-rate independent approach to the active flavor's color.
    const step = 1 - Math.exp(-delta / COLOR_LERP_TAU)
    uniforms.uColor.value.lerp(targetColor.current, step)
  })

  // The profile already carries real heights, so the mesh sits at the origin.
  // renderOrder 0 puts the drink under the bubbles, ice and mint that live in
  // it; the glass sits at 2 and the shards at 3, so neither changed.
  return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={0} />
}
