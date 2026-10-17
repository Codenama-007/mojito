import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { FALLBACK_TARGET, GLASS_TARGETS } from '../config/sections.js'
import { isMobile, prefersReducedMotion } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import Glass from './Glass.jsx'
import Liquid from './Liquid.jsx'
import Shatter from './Shatter.jsx'
import { BREAK_START } from './shardMath.js'

/** Position/scale ease. Frame-rate independent, ~95% settled in 0.66s. */
const MOVE_TAU = 0.22

/** How far the glass sinks on its way into the break. */
const DROP_DISTANCE = 0.16

/**
 * The one glass, choreographed. Everything the scroll does to it happens here
 * and nowhere else; the shards read breakProgress separately so the burst is
 * unaffected by the group's transform.
 */
export default function MojitoGroup({ baseScale }) {
  const groupRef = useRef(null)
  const intactRef = useRef(null)
  const viewport = useThree((state) => state.viewport)

  const mode = isMobile ? 'mobile' : 'desktop'

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
          <Glass />
          <Liquid />
        </group>
        <Shatter />
      </group>
    </group>
  )
}
