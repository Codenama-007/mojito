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
 * The drink is pale and translucent: 55% of the way to white, at 0.75 alpha.
 *
 * Phase 7 keeps the flavour colours in config/flavors.js, where they are the
 * accent colour, the splash colour and the straw colour, and lets the *drink*
 * be the washed-out version of them. Through clear plastic, a drink at full
 * saturation looks like cordial; this is what a mojito in a takeaway cup
 * actually looks like.
 *
 * Not opaque, for the reason Phase 5 introduced: bubbles, ice and mint sit
 * inside it, and an opaque solid hides anything behind its own front face.
 * Single-sided, so the far wall is culled and you look *into* the drink rather
 * than at a solid block that reads as a wall.
 */
const LIQUID_OPACITY = 0.75

/** How far the drink is washed towards white. */
const PALE_MIX = 0.55

const WHITE = new THREE.Color('#ffffff')

const pale = (hex) => new THREE.Color(hex).lerp(WHITE, PALE_MIX)

export default function Liquid({ segments = quality.latheSegments }) {
  const meshRef = useRef(null)
  const activeFlavor = useStore((state) => state.activeFlavor)
  const targetColor = useRef(null)

  if (targetColor.current === null) {
    targetColor.current = pale(getFlavor(useStore.getState().activeFlavor).liquidColor)
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
            value: pale(getFlavor(useStore.getState().activeFlavor).liquidColor),
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
    targetColor.current.copy(pale(getFlavor(activeFlavor).liquidColor))
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

    // Frame-rate independent approach to the active flavor's colour. Both ends
    // are already washed towards white, so the blend never passes through a
    // saturated colour on its way.
    const step = 1 - Math.exp(-delta / COLOR_LERP_TAU)
    uniforms.uColor.value.lerp(targetColor.current, step)
  })

  // The profile already carries real heights, so the mesh sits at the origin.
  // renderOrder 0 puts the drink under the bubbles, mint and ice that live in
  // it; the cup sits at 2 and the shards at 3, so neither changed.
  return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={0} />
}
