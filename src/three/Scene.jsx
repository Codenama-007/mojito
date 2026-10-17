import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { dprCap, isMobile, prefersReducedMotion } from '../config/performance.js'
import Glass from './Glass.jsx'
import Liquid from './Liquid.jsx'

/**
 * Fits the glass to whatever screen it lands on. Glass geometry is 1.0 tall
 * and 1.0 wide at the rim, so the scale factor is also the world height.
 */
function useGlassScale() {
  const viewport = useThree((state) => state.viewport)

  return useMemo(() => {
    const byHeight = viewport.height * 0.55
    const byWidth = viewport.width * 0.62
    return Math.min(byHeight, byWidth, 2.4)
  }, [viewport.height, viewport.width])
}

/** Idle sway so the glass reads as alive rather than parked. */
function MojitoGroup() {
  const groupRef = useRef(null)
  const scale = useGlassScale()

  useFrame((state) => {
    const group = groupRef.current
    if (!group) return

    if (prefersReducedMotion) return

    const t = state.clock.elapsedTime
    group.rotation.y = Math.sin(t * 0.25) * 0.16
    group.rotation.z = Math.sin(t * 0.18 + 1.3) * 0.02
    group.position.y = 0.12 + Math.sin(t * 0.5) * 0.012
  })

  return (
    <group ref={groupRef} scale={scale} position={[0, 0.12, 0]}>
      {/* Lift so the 1.0-tall glass is centered on its own origin. */}
      <group position={[0, -0.5, 0]}>
        <Glass segments={isMobile ? 40 : 72} />
        <Liquid radialSegments={isMobile ? 32 : 56} />
      </group>
    </group>
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
        <ambientLight intensity={0.7} />
        <directionalLight position={[-2.5, 3, -4]} intensity={2.4} />
        <MojitoGroup />
      </Canvas>
    </div>
  )
}
