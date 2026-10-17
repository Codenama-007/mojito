import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getFlavor } from '../config/flavors.js'
import { dprCap, prefersReducedMotion } from '../config/performance.js'
import { useStore } from '../store/useStore.js'

/**
 * Phase 1 test object. Replaced by the glass in Phase 2.
 * The color is read from config/flavors.js and lerped, never hard-cut.
 */
function TestCube() {
  const meshRef = useRef(null)
  const activeFlavor = useStore((state) => state.activeFlavor)
  const targetColor = useRef(null)

  if (targetColor.current === null) {
    targetColor.current = new THREE.Color(
      getFlavor(useStore.getState().activeFlavor).liquidColor,
    )
  }

  useEffect(() => {
    targetColor.current.set(getFlavor(activeFlavor).liquidColor)
  }, [activeFlavor])

  useFrame((_, delta) => {
    const mesh = meshRef.current
    if (!mesh) return

    if (!prefersReducedMotion) {
      mesh.rotation.x += delta * 0.4
      mesh.rotation.y += delta * 0.6
    }

    // Frame-rate independent easing toward the active flavor's color.
    mesh.material.color.lerp(targetColor.current, 1 - Math.exp(-6 * delta))
  })

  return (
    <mesh ref={meshRef}>
      <boxGeometry args={[1.5, 1.5, 1.5]} />
      <meshStandardMaterial
        color={getFlavor(activeFlavor).liquidColor}
        roughness={0.3}
        metalness={0.05}
      />
    </mesh>
  )
}

export default function Scene() {
  // Rendering stops while the tab is hidden (AGENTS.md section 5).
  const [frameloop, setFrameloop] = useState('always')

  useEffect(() => {
    const handleVisibility = () => {
      setFrameloop(document.visibilityState === 'visible' ? 'always' : 'never')
    }

    handleVisibility()
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  return (
    <div className="scene">
      <Canvas
        dpr={[1, dprCap]}
        frameloop={frameloop}
        camera={{ position: [0, 0, 5], fov: 40 }}
        gl={{ antialias: true, alpha: true }}
      >
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <TestCube />
      </Canvas>
    </div>
  )
}
