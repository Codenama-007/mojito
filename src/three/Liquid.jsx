import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getFlavor } from '../config/flavors.js'
import { useStore } from '../store/useStore.js'
import { liquidFragment, liquidVertex } from './shaders/liquid.js'

/** Interior of the glass: floor at 0.14, open to 1.0, so 0.86 tall. */
const INTERIOR_HEIGHT = 0.86
const INTERIOR_RADIUS = 0.443
const FLOOR_Y = 0.14
const DEFAULT_FILL = 0.8

/** Time constant for the flavor color blend. ~95% settled at 3x, i.e. 0.6s. */
const COLOR_LERP_TAU = 0.2

export default function Liquid({ radialSegments = 48 }) {
  const meshRef = useRef(null)
  const activeFlavor = useStore((state) => state.activeFlavor)
  const targetColor = useRef(null)

  if (targetColor.current === null) {
    targetColor.current = new THREE.Color(
      getFlavor(useStore.getState().activeFlavor).liquidColor,
    )
  }

  const geometry = useMemo(() => {
    const geo = new THREE.CylinderGeometry(
      INTERIOR_RADIUS,
      INTERIOR_RADIUS,
      INTERIOR_HEIGHT,
      radialSegments,
      12,
    )
    // Lift the base to y=0 so uFill scales the column up from the floor
    // rather than shrinking it toward its own midpoint.
    geo.translate(0, INTERIOR_HEIGHT / 2, 0)
    return geo
  }, [radialSegments])

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
          uFill: { value: DEFAULT_FILL },
        },
        vertexShader: liquidVertex,
        fragmentShader: liquidFragment,
      }),
    [],
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

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, FLOOR_Y, 0]}
      renderOrder={1}
    />
  )
}
