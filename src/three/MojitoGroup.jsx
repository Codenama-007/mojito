import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { FALLBACK_TARGET, GLASS_TARGETS } from '../config/sections.js'
import {
  CUP_SWAY,
  CUP_TILT_X,
  CUP_TILT_Z,
  MOBILE_GLASS_Y_OFFSET,
  isMobile,
  prefersReducedMotion,
  toRadians,
} from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import Cup from './Cup.jsx'
import Liquid from './Liquid.jsx'
import Bubbles from './Bubbles.jsx'
import WallBubbles from './WallBubbles.jsx'
import Ice from './Ice.jsx'
import Mint from './Mint.jsx'
import Fruit from './Fruit.jsx'
import FlavorFruits from './FlavorFruits.jsx'
import Splash from './Splash.jsx'
import Shatter from './Shatter.jsx'
import { BREAK_START } from './shardMath.js'

/** Position/scale ease. Frame-rate independent, ~95% settled in 0.66s. */
const MOVE_TAU = 0.22

/** How far the cup sinks on its way into the break. */
const DROP_DISTANCE = 0.16

/** The resting lean, converted once. degrees in performance.js, radians here. */
const TILT_Z = toRadians(CUP_TILT_Z)
const TILT_X = toRadians(CUP_TILT_X)
const SWAY = toRadians(CUP_SWAY)

/**
 * The one cup, choreographed. Everything the scroll does to it happens here and
 * nowhere else; the shards read breakProgress separately so the burst is
 * unaffected by the group's transform.
 *
 * Three nested groups, and the nesting is the whole design:
 *
 *   groupRef       position, uniform scale, yaw — everything the sections drive.
 *     centre       shifts the cup's own 0..1 body space so the *body* is
 *                  centred, not the body plus the lid plus the straw.
 *       tilt       the resting lean and the idle sway, shared by everything
 *                  the cup is made of, which is what keeps the drink level in
 *                  the cup instead of sliding about inside it.
 *
 * The tilt is inside the section transform so the cup leans *while* it moves,
 * and outside `intactRef` so the shards lean with it — a burst that happened in
 * a different orientation from the cup that produced it is the one thing that
 * would give the trick away.
 */
export default function MojitoGroup({ baseScale }) {
  const groupRef = useRef(null)
  const tiltRef = useRef(null)
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
    const targetScale = baseScale * target.scale

    // On mobile the cup sits a fixed slice of the viewport lower *in every
    // section*, so the whole journey moves down and the path between sections
    // is unchanged.
    const targetY =
      target.y * viewport.height -
      (isMobile ? MOBILE_GLASS_Y_OFFSET * viewport.height : 0)

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
    // back up rewinds them rather than leaving the cup stuck low.
    const drop = Math.min(breakProgress / BREAK_START, 1)
    const dropY = -drop * DROP_DISTANCE * viewport.height

    let shakeX = 0
    if (!prefersReducedMotion && breakProgress < BREAK_START) {
      const amplitude = Math.sin(drop * Math.PI)
      shakeX = Math.sin(breakProgress * 140) * 0.02 * viewport.width * amplitude
    }

    // Idle sway fades out as the cup breaks, so the burst stays steady.
    const sway = 1 - drop
    const time = state.clock.elapsedTime
    const swayY = prefersReducedMotion
      ? 0
      : Math.sin(time * 0.25) * 0.16 * sway
    const bob = prefersReducedMotion ? 0 : Math.sin(time * 0.5) * 0.012 * sway

    group.position.x = current.x + shakeX
    group.position.y = current.y + dropY + bob
    group.scale.setScalar(current.scale)
    group.rotation.y = current.rot + swayY
    // The yaw stays out here and the lean lives on the tilt group, so the two
    // can never compose into a roll the section targets did not ask for.
    group.rotation.z = 0

    const tilt = tiltRef.current
    if (tilt) {
      tilt.rotation.x = TILT_X
      tilt.rotation.z =
        TILT_Z + (prefersReducedMotion ? 0 : Math.sin(time * 0.21 + 0.7) * SWAY * sway)
    }

    // Swap the intact cup for the shards. Reversible in both directions.
    if (intactRef.current) {
      intactRef.current.visible = breakProgress < BREAK_START
    }
  })

  return (
    <group ref={groupRef}>
      {/*
        Centres the cup's own 0..1 body on the group origin. The lid and the
        straw deliberately live above y = 1, so they are not part of that span —
        which is what keeps the ingredient maths, the shatter and the section
        targets working in the same coordinates they always did.
      */}
      <group position={[0, -0.5, 0]}>
        <group ref={tiltRef}>
          {/*
            Everything that belongs to the drink goes inside intactRef, which is
            already hidden the moment the cup breaks. The ingredients need no
            shatter logic of their own, and that is the whole reason they are
            parented here rather than beside the cup.
          */}
          <group ref={intactRef}>
            <Cup />
            <Liquid />
            <Bubbles />
            <WallBubbles />
            <Ice />
            <Mint />
            <Fruit />
            {/*
              Phase 6A. The whole fruit orbits the cup and the splash leaves its
              lid, so both are placed in the cup's own local space (y 0 at the
              base, 1 at the rim) and inherit its position, scale and sway.
              Being inside intactRef is also what hides them at the shatter.
            */}
            <FlavorFruits />
            <Splash />
          </group>
          {/*
            Outside intactRef so it survives the swap, inside the tilt group so
            the shards burst in the same lean the cup was standing in.
          */}
          <Shatter />
        </group>
      </group>
    </group>
  )
}
