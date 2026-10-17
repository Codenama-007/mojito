import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { dprCap, isMobile, prefersReducedMotion } from '../config/performance.js'
import { FALLBACK_TARGET, GLASS_TARGETS } from '../config/sections.js'
import { useStore } from '../store/useStore.js'
import Glass from './Glass.jsx'
import Liquid from './Liquid.jsx'

/** Position/scale ease. Frame-rate independent, ~95% settled in 0.66s. */
const MOVE_TAU = 0.22

function MojitoGroup() {
  const groupRef = useRef(null)
  const viewport = useThree((state) => state.viewport)

  const mode = isMobile ? 'mobile' : 'desktop'

  const baseScale = useMemo(
    () => Math.min(viewport.height * 0.55, viewport.width * 0.62, 2.4),
    [viewport.height, viewport.width],
  )

  // Smoothed transform, eased toward the active section's target each frame.
  const smoothed = useRef(null)

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    const { activeSection } = useStore.getState()
    const targets = GLASS_TARGETS[activeSection] ?? FALLBACK_TARGET
    const target = targets[mode]

    const targetX = target.x * viewport.width
    const targetY = target.y * viewport.height
    const targetScale = baseScale * target.scale

    if (smoothed.current === null) {
      smoothed.current = {
        x: targetX,
        y: targetY,
        scale: targetScale,
        rot: target.rot,
      }
    }

    const current = smoothed.current
    const step = 1 - Math.exp(-delta / MOVE_TAU)

    current.x += (targetX - current.x) * step
    current.y += (targetY - current.y) * step
    current.scale += (targetScale - current.scale) * step
    current.rot += (target.rot - current.rot) * step

    const time = state.clock.elapsedTime
    const swayY = prefersReducedMotion ? 0 : Math.sin(time * 0.25) * 0.16
    const swayZ = prefersReducedMotion ? 0 : Math.sin(time * 0.18 + 1.3) * 0.02
    const bob = prefersReducedMotion ? 0 : Math.sin(time * 0.5) * 0.012

    group.position.x = current.x
    group.position.y = current.y + bob
    group.scale.setScalar(current.scale)
    group.rotation.y = current.rot + swayY
    group.rotation.z = swayZ
  })

  return (
    <group ref={groupRef}>
      {/* Centres the 1.0-tall glass on the group origin. */}
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
