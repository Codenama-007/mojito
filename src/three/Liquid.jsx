import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getFlavor } from '../config/flavors.js'
import { interiorProfile } from '../config/glassProfile.js'
import { quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { liquidFragment, liquidVertex } from './shaders/liquid.js'

/** How full the bowl is, as a fraction of its interior height. */
const FILL = 0.8

/**
 * The liquid is built at this fraction of the bowl's interior radius. The
 * glass wall is about 0.01 thick at the rim, so a little clearance reads as
 * wall thickness; with none, the surface z-fights the glass where the two
 * nearly touch.
 */
const CLEARANCE = 0.92

/** Time constant for the flavor color blend. ~95% settled at 3x, i.e. 0.6s. */
const COLOR_LERP_TAU = 0.2

/**
 * The bowl's interior, inset and cut off at the fill line, then closed with a
 * floor disc and a flat surface so the solid is watertight.
 *
 * The profile is measured, not guessed: the bowl is widest just below its
 * middle (0.20127) and narrower at the rim (0.14518), which is exactly why a
 * cylinder cannot sit inside it. FILL is applied by truncating the profile
 * rather than by scaling the mesh, so the wall stays on the glass at every
 * height.
 */
function buildLiquidProfile(fill) {
  const floorY = interiorProfile[0][1]
  const rimY = interiorProfile[interiorProfile.length - 1][1]
  const topY = floorY + (rimY - floorY) * fill

  const points = [new THREE.Vector2(0, floorY)]

  for (let i = 1; i < interiorProfile.length; i++) {
    const [radius, y] = interiorProfile[i]

    if (y >= topY) {
      // Interpolate the wall to land exactly on the fill line.
      const [previousRadius, previousY] = interiorProfile[i - 1]
      const t = (topY - previousY) / (y - previousY)
      const radiusAtTop = previousRadius + (radius - previousRadius) * t
      points.push(new THREE.Vector2(radiusAtTop * CLEARANCE, topY))
      break
    }

    points.push(new THREE.Vector2(radius * CLEARANCE, y))
  }

  // Watertight: close the surface across to the axis.
  points.push(new THREE.Vector2(0, topY))

  return { points, floorY, topY }
}

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
    const profile = buildLiquidProfile(FILL)
    return {
      geometry: new THREE.LatheGeometry(profile.points, segments),
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
          uFloorY: { value: floorY },
          uTopY: { value: topY },
        },
        vertexShader: liquidVertex,
        fragmentShader: liquidFragment,
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
  return <mesh ref={meshRef} geometry={geometry} material={material} renderOrder={1} />
}
