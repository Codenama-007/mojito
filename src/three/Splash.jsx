import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getFlavor } from '../config/flavors.js'
import { prefersReducedMotion, quality } from '../config/performance.js'
import { isFlavorSection } from '../config/sections.js'
import { useStore } from '../store/useStore.js'
import {
  BURST_LIFE,
  RIM_Y,
  ambientState,
  buildAmbient,
  buildBurst,
  burstDropletState,
  burstFade,
  ringState,
} from './splashMath.js'

/**
 * The juice splash: one InstancedMesh of droplets, plus one thin crown
 * (the brief, items 3 and 4).
 *
 * A burst is one shared start time, not a per-droplet state machine, which is
 * what lets a single material opacity be the exact fade for every droplet in
 * it. The burst ends on its own after BURST_LIFE and is only restarted by a
 * flavor change or a flavor section arriving — there is no loop (item 4).
 *
 * The droplets are juice, so they wear the flavor's own colours from
 * config/flavors.js; nothing here hardcodes one.
 */

/** Above the ingredients (0..0.6) and below the glass (2). */
const RENDER_ORDER = 1.5

/** The crown wall, in glass heights. */
const RING_HEIGHT = 0.11

/**
 * Per-droplet colour, without a second draw call.
 *
 * `setColorAt` allocates `instanceColor`, and three then defines USE_COLOR in
 * the fragment prefix on that alone — so the material must *not* set
 * vertexColors. Doing so would also define USE_COLOR in the vertex prefix,
 * where the shader would read a `color` attribute this geometry does not have
 * and multiply every droplet by black.
 */
function useDropletMaterial(opacity) {
  return useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color('#ffffff'),
        transparent: true,
        opacity,
        roughness: 0.12,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
        envMapIntensity: quality.environmentIntensity,
        depthWrite: false,
      }),
    [opacity],
  )
}

export default function Splash({
  burstCount = quality.splashDroplets,
  ambientCount = quality.ambientDroplets,
}) {
  const burstRef = useRef(null)
  const ambientRef = useRef(null)
  const ringRef = useRef(null)

  const burst = useMemo(() => buildBurst(burstCount), [burstCount])
  const ambient = useMemo(() => buildAmbient(ambientCount), [ambientCount])

  const geometry = useMemo(() => new THREE.IcosahedronGeometry(1, 1), [])
  const ringGeometry = useMemo(
    () => new THREE.CylinderGeometry(1, 1, RING_HEIGHT, 40, 1, true),
    [],
  )

  const burstMaterial = useDropletMaterial(quality.splashOpacity)
  const ambientMaterial = useDropletMaterial(quality.splashOpacity * 0.7)
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color('#ffffff'),
        transparent: true,
        opacity: quality.splashRingOpacity,
        side: THREE.DoubleSide,
        roughness: 0.25,
        metalness: 0,
        emissiveIntensity: 0.4,
        envMapIntensity: quality.environmentIntensity,
        depthWrite: false,
      }),
    [],
  )

  /**
   * Where the last flavor change left us. Null until the first frame, so the
   * page opening on its default flavor is not treated as a change: a splash
   * before the user has done anything would read as a glitch.
   */
  const seen = useRef(null)
  const burstAt = useRef(Number.NEGATIVE_INFINITY)

  const scratch = useMemo(
    () => ({ matrix: new THREE.Matrix4(), scale: new THREE.Vector3(), color: new THREE.Color() }),
    [],
  )

  /** Repaints every droplet for a flavor. Called only when the flavor changes. */
  const paint = (flavorId) => {
    const flavor = getFlavor(flavorId)
    const base = new THREE.Color(flavor.liquidColor)
    const tint = new THREE.Color(flavor.splashTint)
    const { color } = scratch

    for (const mesh of [burstRef.current, ambientRef.current]) {
      if (!mesh) continue

      const droplets = mesh === burstRef.current ? burst : ambient
      for (let i = 0; i < droplets.length; i++) {
        color.copy(base).lerp(tint, droplets[i].tint)
        mesh.setColorAt(i, color)
      }

      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    }

    const ring = ringRef.current
    if (ring) {
      ring.material.color.copy(base)
      ring.material.emissive.copy(base)
    }
  }

  // Colours before the first paint, so instanceColor exists by the time three
  // compiles the program and USE_INSTANCING_COLOR is part of the shader. No
  // dependency array, like Bubbles.jsx and Mint.jsx: it is idempotent, and
  // running it on every commit keeps the colours current for the same cost.
  useLayoutEffect(() => {
    paint(useStore.getState().activeFlavor)
  })

  useFrame((state) => {
    const now = useStore.getState()
    const time = state.clock.elapsedTime
    const previous = seen.current

    const flavorChanged = previous !== null && now.activeFlavor !== previous.flavor
    const sectionArrived =
      previous !== null &&
      now.activeSection !== previous.section &&
      isFlavorSection(now.activeSection)

    seen.current = { flavor: now.activeFlavor, section: now.activeSection }

    if (flavorChanged || sectionArrived) {
      paint(now.activeFlavor)
      burstAt.current = time
    }

    const { matrix, scale } = scratch
    const motion = prefersReducedMotion ? 0 : 1

    // ------------------------------------------------------------- the burst
    const age = time - burstAt.current
    const burstMesh = burstRef.current
    const bursting = age >= 0 && age < BURST_LIFE

    if (burstMesh) {
      burstMesh.visible = bursting

      if (bursting) {
        for (let i = 0; i < burst.length; i++) {
          const droplet = burstDropletState(burst[i], age)
          scale.setScalar(droplet.scale)
          matrix.makeScale(scale.x, scale.y, scale.z)
          matrix.setPosition(droplet.x, droplet.y, droplet.z)
          burstMesh.setMatrixAt(i, matrix)
        }

        burstMesh.instanceMatrix.needsUpdate = true
        burstMesh.material.opacity = quality.splashOpacity * burstFade(age)
      }
    }

    // ------------------------------------------------------------- the crown
    const ring = ringRef.current
    if (ring) {
      const crown = ringState(age)
      ring.visible = bursting && crown.alive

      if (ring.visible) {
        ring.position.y = RIM_Y + RING_HEIGHT * 0.5
        ring.scale.set(crown.radius, 1, crown.radius)
        ring.material.opacity = crown.opacity * quality.splashRingOpacity
      }
    }

    // --------------------------------------------------- the drifting spray
    const ambientMesh = ambientRef.current
    if (ambientMesh) {
      // Only while a flavor is the section on screen (the brief, item 5).
      ambientMesh.visible = isFlavorSection(now.activeSection)

      if (ambientMesh.visible) {
        for (let i = 0; i < ambient.length; i++) {
          const droplet = ambientState(ambient[i], time, motion, now.scrollProgress)
          scale.setScalar(droplet.scale)
          matrix.makeScale(scale.x, scale.y, scale.z)
          matrix.setPosition(droplet.x, droplet.y, droplet.z)
          ambientMesh.setMatrixAt(i, matrix)
        }

        ambientMesh.instanceMatrix.needsUpdate = true
      }
    }
  })

  useEffect(
    () => () => {
      geometry.dispose()
      ringGeometry.dispose()
      burstMaterial.dispose()
      ambientMaterial.dispose()
      ringMaterial.dispose()
    },
    [geometry, ringGeometry, burstMaterial, ambientMaterial, ringMaterial],
  )

  return (
    <group>
      <instancedMesh
        ref={burstRef}
        args={[geometry, burstMaterial, burstCount]}
        renderOrder={RENDER_ORDER}
        visible={false}
        frustumCulled={false}
      />
      <instancedMesh
        ref={ambientRef}
        args={[geometry, ambientMaterial, ambientCount]}
        renderOrder={RENDER_ORDER}
        visible={false}
        frustumCulled={false}
      />
      <mesh
        ref={ringRef}
        geometry={ringGeometry}
        material={ringMaterial}
        renderOrder={RENDER_ORDER}
        visible={false}
      />
    </group>
  )
}
