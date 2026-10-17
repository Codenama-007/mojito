import { Suspense, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import { glassModel, outerProfile } from '../config/glassProfile.js'
import { quality } from '../config/performance.js'
import { createGlassMaterial } from './shaders/glassMaterial.js'

/** public/models/glass.glb is served from the site root. */
const MODEL_URL = `/${glassModel.source.replace(/^public\//, '')}`

/**
 * The model is an FBX round-trip that declares KHR_materials_pbrSpecularGlossiness
 * as a *required* extension. Three has no implementation of it, so GLTFLoader
 * logs "Unknown extension" on every load. The file's own material is solid
 * black and is replaced below regardless, so this registers an empty handler
 * purely to keep the console clean. It does not change what is rendered.
 */
const specGlossPlaceholder = () => ({
  name: 'KHR_materials_pbrSpecularGlossiness',
  getMaterialType: () => null,
  extendMaterialParams: () => Promise.resolve(),
})

const extendLoader = (loader) => loader.register(specGlossPlaceholder)

/**
 * Scales the model so it is exactly 1 unit tall with its base at y = 0,
 * centred on x/z. That is the space glassProfile.js was measured in, and the
 * space the liquid and the shards are positioned in, so the three line up.
 */
function fitToUnitHeight(scene) {
  const box = new THREE.Box3().setFromObject(scene)
  const size = box.getSize(new THREE.Vector3())
  const centre = box.getCenter(new THREE.Vector3())
  const scale = 1 / size.y

  if (import.meta.env.DEV) {
    const drift = Math.abs(scale - glassModel.normaliseScale) / glassModel.normaliseScale
    if (drift > 0.01) {
      console.warn(
        `Glass measures ${scale.toFixed(5)} but glassProfile.js expects ` +
          `${glassModel.normaliseScale}. Re-run scripts/extract-glass-profile.mjs: ` +
          'the liquid and the shards are positioned from that file.',
      )
    }
  }

  return {
    scale,
    // Placing the scaled box so its base sits on y = 0 and its centre on x/z = 0.
    position: [-centre.x * scale, -box.min.y * scale, -centre.z * scale],
  }
}

function LoadedGlass() {
  const { scene } = useGLTF(MODEL_URL, true, true, extendLoader)
  const material = useMemo(() => createGlassMaterial(), [])

  const { scale, position } = useMemo(() => fitToUnitHeight(scene), [scene])

  useEffect(() => {
    scene.traverse((child) => {
      if (!child.isMesh) return
      // Mandatory: the file's own material is black.
      child.material = material
      child.renderOrder = 2
    })
  }, [scene, material])

  // The geometry belongs to drei's loader cache and is shared between mounts,
  // so only the material we created is disposed here.
  useEffect(() => () => material.dispose(), [material])

  return (
    <group scale={scale} position={position}>
      <primitive object={scene} />
    </group>
  )
}

/**
 * Shown only while the model loads, or if it fails to load. Built from the
 * outer silhouette the extractor measured, so even this has the glass's real
 * proportions rather than the old hand-written highball's.
 */
function FallbackGlass() {
  const material = useMemo(() => createGlassMaterial(), [])
  const geometry = useMemo(() => {
    const points = [
      new THREE.Vector2(0, 0),
      ...outerProfile.map(([radius, y]) => new THREE.Vector2(radius, y)),
    ]
    return new THREE.LatheGeometry(points, Math.min(quality.latheSegments, 40))
  }, [])

  useEffect(
    () => () => {
      geometry.dispose()
      material.dispose()
    },
    [geometry, material],
  )

  return <mesh geometry={geometry} material={material} renderOrder={2} />
}

export default function Glass() {
  return (
    <Suspense fallback={<FallbackGlass />}>
      <LoadedGlass />
    </Suspense>
  )
}
