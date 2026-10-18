import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { flavors } from '../config/flavors.js'
import { prefersReducedMotion } from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { buildFruit, disposeFruit } from './fruitModels.js'
import { FRUIT_SPRING, REVEAL, revealAt } from './ingredientMath.js'

/**
 * One slice per flavor, all four built up front and scaled in or out rather
 * than mounted and unmounted. That is what makes the flavor swap a scale
 * crossfade with no hard cut (the brief, item 5) and what lets the same slice
 * carry the scroll reveal from item 6.
 *
 * The scale is a damped spring, so it overshoots a little on the way up and
 * settles in about half a second. It is not a closed-form function of scroll:
 * a flavor tap is not a scroll event, and the bounce is the point.
 */

/** Well under the smallest meaningful slice, so a settled fruit is not drawn. */
const HIDDEN = 0.01

export default function Fruit() {
  const fruits = useMemo(
    () =>
      flavors.map((flavor) => ({
        id: flavor.id,
        object: buildFruit(flavor.fruit),
      })),
    [],
  )

  const nodes = useRef([])
  const springs = useRef(fruits.map(() => ({ value: 0, velocity: 0 })))

  useEffect(() => () => fruits.forEach((fruit) => disposeFruit(fruit.object)), [fruits])

  useFrame((state, delta) => {
    const { activeFlavor, scrollProgress } = useStore.getState()
    const reveal = revealAt(scrollProgress, REVEAL.fruit)
    const { stiffness, damping } = FRUIT_SPRING

    // A slow frame must not make the spring explode.
    const dt = Math.min(delta, 1 / 30)

    // Critical damping when the user has asked for less motion: same speed,
    // no overshoot.
    const rate = prefersReducedMotion ? 2 * Math.sqrt(stiffness) : damping

    for (let i = 0; i < fruits.length; i++) {
      const spring = springs.current[i]
      const target = fruits[i].id === activeFlavor && reveal > 0 ? 1 : 0

      spring.velocity +=
        (target - spring.value) * stiffness * dt - spring.velocity * rate * dt
      spring.value += spring.velocity * dt

      const node = nodes.current[i]
      if (!node) continue

      const scale = Math.max(spring.value, 0)
      node.scale.setScalar(scale)
      node.visible = scale > HIDDEN
      node.rotation.y = prefersReducedMotion ? 0 : state.clock.elapsedTime * 0.12
    }
  })

  return (
    <>
      {fruits.map((fruit, index) => (
        <primitive
          key={fruit.id}
          object={fruit.object}
          visible={false}
          ref={(node) => {
            nodes.current[index] = node
          }}
        />
      ))}
    </>
  )
}
