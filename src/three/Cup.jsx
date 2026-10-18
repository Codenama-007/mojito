import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { strawModel } from '../config/cupProfile.js'
import { getFlavor } from '../config/flavors.js'
import { quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import {
  buildCupBodyGeometry,
  buildHighlightGeometry,
  buildLidGeometry,
  buildRimFlangeGeometry,
  buildStrawHoleGeometry,
  buildStrawInnerGeometry,
  buildStrawOuterGeometry,
  createHighlightMaterial,
} from './cupGeometry.js'
import { createPlasticMaterial } from './shaders/plasticMaterial.js'

/** Time constant for the straw colour blend. ~95% settled at 3x, i.e. 0.6s. */
const COLOR_LERP_TAU = 0.2

/**
 * Draw order. Every surface here is transparent with `depthWrite` off, so the
 * order things are drawn in *is* what is in front of what. The straw has to be
 * split across two of these, which is why it is two meshes.
 */
const INSIDE_ORDER = 0.7
const BODY_ORDER = 2
const HOLE_ORDER = 2.1
const HIGHLIGHT_ORDER = 2.2
const OUTSIDE_ORDER = 2.5

/**
 * The whole cup, built in code: tapered body, rolled rim, dome lid with a
 * straw hole, and the straw through it.
 *
 * Everything is a lathe or a primitive spun from config/cupProfile.js, so the
 * component below is only assembly and the straw's colour blend. The numbers —
 * taper, wall thickness, dome height, how far the straw stands proud — all live
 * in that config file, so they can be nudged without touching this.
 *
 * There is no fallback lathe and no Suspense boundary any more: there is
 * nothing to load, so there is nothing to wait for.
 */
export default function Cup() {
  const activeFlavor = useStore((state) => state.activeFlavor)
  const strawRef = useRef(null)

  const parts = useMemo(
    () => ({
      body: buildCupBodyGeometry(quality.latheSegments),
      flange: buildRimFlangeGeometry(),
      lid: buildLidGeometry(quality.latheSegments),
      hole: buildStrawHoleGeometry(),
      inner: buildStrawInnerGeometry(),
      outer: buildStrawOuterGeometry(),
      highlight: buildHighlightGeometry(),
    }),
    [],
  )

  const materials = useMemo(() => {
    const strawColor = getFlavor(useStore.getState().activeFlavor).strawColor

    return {
      plastic: createPlasticMaterial(),
      /**
       * A touch more opaque than the body. The lid sits over the mint, and at
       * the body's own alpha the leaves read through it as if it were not
       * there.
       */
      lid: createPlasticMaterial({ opacity: quality.plastic.opacity * 1.2 }),
      hole: new THREE.MeshStandardMaterial({
        color: new THREE.Color('#c9d6e2'),
        roughness: 0.45,
        metalness: 0,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
      straw: new THREE.MeshStandardMaterial({
        color: new THREE.Color(strawColor),
        roughness: 0.34,
        metalness: 0,
        side: THREE.DoubleSide,
      }),
      highlight: createHighlightMaterial(),
    }
  }, [])

  /** The colour the straw is easing towards. A ref, so nothing re-renders. */
  const targetColor = useRef(null)
  if (targetColor.current === null) {
    targetColor.current = new THREE.Color(getFlavor(activeFlavor).strawColor)
  }

  useEffect(() => {
    targetColor.current.set(getFlavor(activeFlavor).strawColor)
  }, [activeFlavor])

  useEffect(
    () => () => {
      Object.values(parts).forEach((geometry) => geometry.dispose())
      Object.values(materials).forEach((material) => material.dispose())
    },
    [parts, materials],
  )

  useFrame((state, delta) => {
    // Read through the mesh rather than the memo value: the material is a live
    // three object, and assigning to the memo is what react-hooks/immutability
    // rejects. Same access pattern Liquid.jsx uses for its uniforms.
    const material = strawRef.current?.material
    if (!material) return

    material.color.lerp(targetColor.current, 1 - Math.exp(-delta / COLOR_LERP_TAU))
  })

  return (
    <group>
      <mesh geometry={parts.body} material={materials.plastic} renderOrder={BODY_ORDER} />
      <mesh geometry={parts.flange} material={materials.plastic} renderOrder={BODY_ORDER} />
      <mesh geometry={parts.lid} material={materials.lid} renderOrder={BODY_ORDER} />
      <mesh geometry={parts.hole} material={materials.hole} renderOrder={HOLE_ORDER} />
      <mesh
        geometry={parts.highlight}
        material={materials.highlight}
        renderOrder={HIGHLIGHT_ORDER}
      />

      {/*
        Pivots on the hole, so the lean opens the straw above the lid and pushes
        its lower end further into the drink rather than sideways out of the cup.
      */}
      <group
        position={[strawModel.holeX, strawModel.holeY, strawModel.holeZ]}
        rotation={[0, 0, strawModel.tiltZ]}
      >
        <mesh
          ref={strawRef}
          geometry={parts.inner}
          material={materials.straw}
          renderOrder={INSIDE_ORDER}
        />
        <mesh
          geometry={parts.outer}
          material={materials.straw}
          renderOrder={OUTSIDE_ORDER}
        />
      </group>
    </group>
  )
}
