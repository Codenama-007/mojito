import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { flavors } from '../config/flavors.js'
import { prefersReducedMotion, quality } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { buildWholeFruit, disposeWholeFruit } from './wholeFruits.js'
import { WHOLE_FRUIT_SPRING, buildWholeFruits, wholeFruitState } from './wholeFruitMath.js'

/**
 * Whole fruit orbiting the glass — four of them on desktop, three on mobile,
 * one set per flavor, all built up front (the brief, item 1).
 *
 * They are mounted inside the glass group rather than beside it, so they follow
 * the glass's position from the store for free and the shatter hides them with
 * the glass and needs no change of its own (item 8).
 *
 * The parallax is not faked: each fruit sits on its own shelf in front of or
 * behind the glass, and the camera is a perspective one, so a fruit in front
 * sweeps further across the screen than one behind when the glass slides
 * between sections.
 *
 * Nothing here holds React state (item 6): the swap is a per-fruit spring and
 * every per-frame value is written straight onto the Object3Ds.
 */

/** Well under the smallest fruit, so a settled one is not drawn at all. */
const HIDDEN = 0.01

/** Distinct layouts per flavor, so an outgoing set is not the incoming one. */
const SEED_STEP = 977

export default function FlavorFruits({ count = quality.wholeFruitCount }) {
  const sets = useMemo(
    () =>
      flavors.map((flavor, index) => ({
        id: flavor.id,
        fruits: buildWholeFruits(count, 0xf00d + index * SEED_STEP).map((layout) => ({
          layout,
          object: buildWholeFruit(flavor.fruit.kind, flavor.fruit.whole),
        })),
      })),
    [count],
  )

  const nodes = useRef([])
  const springs = useRef(
    sets.map((set) => set.fruits.map(() => ({ value: 0, velocity: 0 }))),
  )

  useEffect(
    () => () =>
      sets.forEach((set) => set.fruits.forEach((fruit) => disposeWholeFruit(fruit.object))),
    [sets],
  )

  useFrame((state, delta) => {
    const { activeFlavor, scrollProgress } = useStore.getState()
    const time = state.clock.elapsedTime

    // A slow frame must not make a spring explode.
    const dt = Math.min(delta, 1 / 30)

    const { stiffness, damping } = WHOLE_FRUIT_SPRING
    // Critical damping when the user has asked for less motion: same speed, no
    // overshoot, so nothing bounces at them.
    const rate = prefersReducedMotion ? 2 * Math.sqrt(stiffness) : damping
    const motion = prefersReducedMotion ? 0 : 1

    for (let s = 0; s < sets.length; s++) {
      const set = sets[s]
      const target = set.id === activeFlavor ? 1 : 0

      for (let f = 0; f < set.fruits.length; f++) {
        const spring = springs.current[s][f]

        spring.velocity +=
          (target - spring.value) * stiffness * dt - spring.velocity * rate * dt
        spring.value += spring.velocity * dt

        const node = nodes.current[s * count + f]
        if (!node) continue

        const fruit = set.fruits[f]
        const presence = spring.value
        const state = wholeFruitState(fruit.layout, presence, time, scrollProgress, motion)

        // A negative presence is a fruit that has overshot on its way out, and
        // a negative scale would flip it inside out.
        const scale = Math.max(presence, 0)

        node.position.set(state.x, state.y, state.z)
        node.rotation.set(state.tilt, state.spin, state.tilt * 0.35)
        node.scale.setScalar(fruit.layout.size * scale)
        node.visible = scale > HIDDEN
      }
    }
  })

  return (
    <>
      {sets.map((set, s) =>
        set.fruits.map((fruit, f) => (
          <primitive
            key={`${set.id}-${f}`}
            object={fruit.object}
            visible={false}
            ref={(node) => {
              nodes.current[s * count + f] = node
            }}
          />
        )),
      )}
    </>
  )
}
