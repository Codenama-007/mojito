import { useCallback, useLayoutEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { FALLBACK_TARGET, GLASS_TARGETS } from '../config/sections.js'
import {
  CUP_FIT,
  CUP_SWAY,
  CUP_TILT_X,
  CUP_TILT_Z,
  CUP_TOP_CLEARANCE,
  FLAVOR_SPIN,
  MOBILE_GLASS_Y_OFFSET,
  NAVBAR_HEIGHT_PX,
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
 * The cup's welcome for a new flavor, eased so it arrives rather than stops.
 * Cubic out: quick off the mark, gentle into the finish, and — the property
 * that matters — exactly 0 at 0 and exactly 1 at 1.
 */
const easeOutCubic = (t) => 1 - (1 - t) ** 3

/**
 * The one cup, choreographed. Everything the scroll does to it happens here and
 * nowhere else; the shards read breakProgress separately so the burst is
 * unaffected by the group's transform.
 *
 * Three nested groups, and the nesting is the whole design:
 *
 *   groupRef       position, uniform scale, yaw — everything the sections drive,
 *                  plus Phase 8A's fit and top-edge clamp.
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
 *
 * Because the fruits, the splash and the shatter are all inside this group,
 * Phase 8A's fit and clamp move them with the cup for free.
 */
export default function MojitoGroup({ baseScale }) {
  const groupRef = useRef(null)
  const cupRef = useRef(null)
  const tiltRef = useRef(null)
  const intactRef = useRef(null)
  const viewport = useThree((state) => state.viewport)
  const size = useThree((state) => state.size)

  const mode = isMobile ? 'mobile' : 'desktop'

  // Smoothed transform, eased toward the active section's target each frame.
  const smoothed = useRef(null)

  /**
   * How far the cup's top reaches above the group origin, and how tall it is,
   * both in un-scaled cup units.
   *
   * Measured off the live scene with a Box3 rather than written out from
   * cupProfile.js, so retuning the taper, the dome or the straw cannot silently
   * invalidate the fit below.
   */
  const bounds = useRef({ top: 0, height: 0 })

  /**
   * The flavor-change spin: which flavor it belongs to, how far through it is,
   * and which way round it goes.
   *
   * Started by watching `activeFlavor` in the frame loop rather than by an
   * effect, because the loop is where the value is *used* and an effect would
   * cost a render to do the same thing. `flavor` starts null so the first frame
   * records the flavor without spinning: the page loads onto a cup that is
   * already there, not one that turns up.
   */
  const spin = useRef({ flavor: null, t: 1, direction: 1 })

  const measure = useCallback(() => {
    const group = groupRef.current
    const tilt = tiltRef.current
    const cup = cupRef.current
    if (!group || !tilt || !cup) return

    /**
     * Measured at both extremes of the idle sway, not at rest. The clamp below
     * has to hold while the cup rocks, and a lean of one sway moves the top of
     * the straw by a few thousandths of a cup height — small, but exactly the
     * kind of small that puts a straw under the navbar on one phone.
     */
    let top = -Infinity
    let bottom = Infinity

    for (const lean of [TILT_Z - SWAY, TILT_Z + SWAY]) {
      tilt.rotation.x = TILT_X
      tilt.rotation.z = lean
      group.updateMatrixWorld(true)

      // setFromObject returns a *world* space box, so it carries the group's own
      // position, uniform scale and yaw. A yaw cannot change a height, the
      // position cancels out of both terms below, and the scale divides out — so
      // this is the cup's own geometry, tilted, in its own units.
      //
      // Measured off `cupRef`, not the tilt group: the fruit orbits wider than
      // the cup and would inflate the box, and the one thing that must not be
      // cropped is the straw.
      const box = new THREE.Box3().setFromObject(cup)
      top = Math.max(top, box.max.y)
      bottom = Math.min(bottom, box.min.y)
    }

    const scale = group.scale.x || 1

    bounds.current = {
      top: (top - group.position.y) / scale,
      height: (top - bottom) / scale,
    }
  }, [])

  // Once at load, and again whenever the canvas changes size.
  useLayoutEffect(() => {
    measure()
  }, [measure, size.height, viewport.width, viewport.height])

  useFrame((state, delta) => {
    const group = groupRef.current
    if (!group) return

    const { activeSection, breakProgress, activeFlavor, flavorDirection } =
      useStore.getState()
    const targets = GLASS_TARGETS[activeSection] ?? FALLBACK_TARGET
    const target = targets[mode]

    const targetX = target.x * viewport.width

    /**
     * Phase 8A, item 2. The cup has to fit the viewport height, measured after
     * the tilt, so a tall straw cannot leave the top on a short screen.
     *
     * A ceiling rather than a target: `Math.min(1, ...)` means the cup is only
     * ever scaled *down*, so the section targets keep the sizes they were tuned
     * to and this changes nothing on a screen that was already fitting.
     */
    const fit = isMobile ? CUP_FIT.mobile : CUP_FIT.desktop
    const measured = bounds.current.height
    const fitting =
      measured > 0 ? (viewport.height * fit) / (baseScale * target.scale * measured) : 1
    const targetScale = baseScale * target.scale * Math.min(1, fitting)

    // On mobile the cup sits a fixed slice of the viewport lower *in every
    // section*, so the whole journey moves down and the path between sections
    // is unchanged. The clamp below runs after it.
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

    /**
     * Phase 8A, item 2: the top-edge clamp, applied after
     * MOBILE_GLASS_Y_OFFSET so the offset still decides where the cup sits and
     * the clamp only takes back what the offset and the section target could
     * not fit.
     *
     * The navbar is fixed to the top of the window and the canvas is `inset:
     * 0`, so its height in world units is its CSS height over the canvas's own
     * CSS height — no assumptions about DPR or the address bar.
     */
    let y = current.y + dropY + bob
    const worldTop = y + bounds.current.top * current.scale
    const navbarY =
      size.height > 0 ? (NAVBAR_HEIGHT_PX / size.height) * viewport.height : 0
    const clearance = isMobile
      ? Math.max(viewport.height * CUP_TOP_CLEARANCE, navbarY)
      : viewport.height * CUP_TOP_CLEARANCE
    const topLimit = viewport.height / 2 - clearance
    if (worldTop > topLimit) y -= worldTop - topLimit

    /**
     * Phase 8C. A full turn on every flavor change, however the change was
     * made — a tap on the picker or a scroll into a flavor section both land in
     * `activeFlavor`, so both spin, which is why there is only one rule here.
     *
     * The turn is added to the section yaw rather than replacing it, and it is
     * a whole turn, so at t = 1 the angle is exactly 2 pi and the cup is back on
     * the yaw the section asked for. Nothing has to be reset and no end state
     * has to be reconciled: the spin is 0 modulo a turn.
     */
    if (spin.current.flavor === null) {
      spin.current.flavor = activeFlavor
    } else if (spin.current.flavor !== activeFlavor) {
      spin.current.flavor = activeFlavor
      spin.current.t = 0
      spin.current.direction = flavorDirection
    }

    if (spin.current.t < 1) {
      spin.current.t = Math.min(
        1,
        spin.current.t + (prefersReducedMotion ? 1 : delta / FLAVOR_SPIN),
      )
    }

    const spinAngle =
      easeOutCubic(spin.current.t) * Math.PI * 2 * spin.current.direction

    group.position.x = current.x + shakeX
    group.position.y = y
    group.scale.setScalar(current.scale)
    group.rotation.y = current.rot + swayY + spinAngle
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
        {/* The resting lean is set here as well as in the frame loop, so the
            Box3 measured on the first layout pass is the *tilted* cup. */}
        <group ref={tiltRef} rotation={[TILT_X, 0, TILT_Z]}>
          {/*
            Everything that belongs to the drink goes inside intactRef, which is
            already hidden the moment the cup breaks. The ingredients need no
            shatter logic of their own, and that is the whole reason they are
            parented here rather than beside the cup.
          */}
          <group ref={intactRef}>
            <group ref={cupRef}>
              <Cup />
            </group>
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
