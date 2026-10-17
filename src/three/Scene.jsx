import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { dprCap, isMobile, prefersReducedMotion } from '../config/performance.js'
import { FALLBACK_TARGET, GLASS_TARGETS } from '../config/sections.js'
import { useStore } from '../store/useStore.js'
import Glass from './Glass.jsx'
import Liquid from './Liquid.jsx'
import Shatter from './Shatter.jsx'
import { BREAK_START } from './shardMath.js'

/** Position/scale ease. Frame-rate independent, ~95% settled in 0.66s. */
const MOVE_TAU = 0.22

/** How far the glass sinks on its way into the break. */
const DROP_DISTANCE = 0.16

function MojitoGroup() {
  const groupRef = useRef(null)
  const intactRef = useRef(null)
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

    const { activeSection, breakProgress } = useStore.getState()
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

    // Drop and shake. Both are pure functions of breakProgress, so scrolling
    // back up rewinds them rather than leaving the glass stuck low.
    const drop = Math.min(breakProgress / BREAK_START, 1)
    const dropY = -drop * DROP_DISTANCE * viewport.height

    let shakeX = 0
    if (!prefersReducedMotion && breakProgress < BREAK_START) {
      const amplitude = Math.sin(drop * Math.PI)
      shakeX = Math.sin(breakProgress * 140) * 0.02 * viewport.width * amplitude
    }

    // Idle sway fades out as the glass breaks, so the burst stays steady.
    const sway = 1 - drop
    const time = state.clock.elapsedTime
    const swayY = prefersReducedMotion
      ? 0
      : Math.sin(time * 0.25) * 0.16 * sway
    const swayZ = prefersReducedMotion
      ? 0
      : Math.sin(time * 0.18 + 1.3) * 0.02 * sway
    const bob = prefersReducedMotion ? 0 : Math.sin(time * 0.5) * 0.012 * sway

    group.position.x = current.x + shakeX
    group.position.y = current.y + dropY + bob
    group.scale.setScalar(current.scale)
    group.rotation.y = current.rot + swayY
    group.rotation.z = swayZ

    // Swap the intact glass for the shards. Reversible in both directions.
    if (intactRef.current) {
      intactRef.current.visible = breakProgress < BREAK_START
    }
  })

  return (
    <group ref={groupRef}>
      {/* Centres the 1.0-tall glass on the group origin. */}
      <group position={[0, -0.5, 0]}>
        <group ref={intactRef}>
          <Glass segments={isMobile ? 40 : 72} />
          <Liquid radialSegments={isMobile ? 32 : 56} />
        </group>
        <Shatter />
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
