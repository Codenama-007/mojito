import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { getFlavor } from '../config/flavors.js'
import {
  FLAVOR_PUSH,
  FLAVOR_PUSH_DISTANCE,
  prefersReducedMotion,
  quality,
} from '../config/performance.js'
import { useStore } from '../store/useStore.js'
import { BREAK_START } from './shardMath.js'
import { createFruitFieldScene } from './fruitFieldScene.js'
import { buildFruitTextures } from './fruitTextures.js'

/**
 * The fruit field behind the cup (Phase 8B; pushed rather than cross-faded in
 * Phase 8C).
 *
 * In the canvas rather than in the DOM, for one reason: the field is *behind the
 * cup*. Two `InstancedMesh`es of planes on one shader is also two draw calls for
 * eighty pieces of fruit, where eighty `<img>` elements would be eighty layers
 * for the compositor to keep alive on a phone.
 *
 * ## The handover is a push, and it has to match the backdrop's exactly
 *
 * The outgoing flavor is carried one viewport to one side while the incoming one
 * arrives behind it, both on the same linear schedule — so the fruit travels
 * with the color it is painted on. Give the two different easing, or ease one of
 * them, and the fruit visibly slides across its own backdrop. That is why both
 * read FLAVOR_PUSH and neither has a curve.
 */

/** @param {'in' | 'out'} phase  Which end of the push this field is at. */
function Field({ flavor, phase, direction, onPushedOut }) {
  const viewport = useThree((state) => state.viewport)
  const { width, height } = viewport
  const count = quality.fruitFieldCount

  const textures = useMemo(() => buildFruitTextures(flavor), [flavor])

  const scene = useMemo(
    () => createFruitFieldScene(textures, count, { width, height }),
    [textures, count, width, height],
  )

  /**
   * Both go together, and in that order: the meshes hold the maps.
   *
   * This cleanup runs twice on every mount in development, which is harmless —
   * `dispose()` frees resources and leaves the scene graph alone, so the field
   * comes back on the next frame with everything re-uploaded. It is worth
   * knowing that, because the version of this that also detached the meshes cost
   * the entire feature: an empty group renders nothing and reports nothing.
   */
  useEffect(
    () => () => {
      scene.dispose()
      textures.dispose()
    },
    [scene, textures],
  )

  /** 0 when the push starts, 1 when it has landed. The incoming one is done. */
  const progress = useRef(phase === 'in' ? 0 : 1)
  const reported = useRef(false)

  /**
   * The demotion rule, and the only place the clock is ever reset.
   *
   * A flavor change can arrive while the last one is still moving: tap three
   * flavors in a row and the second is still on its way in when the third sets
   * off. This element survives that — it is keyed by the swap, so React keeps
   * the instance and moves it from the incoming row to the outgoing row — and
   * subtracting one viewport's worth of progress is exactly what makes it
   * continue the conveyor it was already on instead of jumping back to the
   * start. A field that had already arrived was at 1 and starts its exit at 0; a
   * field mid-flight at 0.4 starts at -0.6, which is the same position it was
   * already in. One rule, both cases.
   *
   * In an effect rather than in the frame loop, because `phase` is a prop: by
   * the time the next frame runs, the demotion has already been applied.
   */
  useEffect(() => {
    if (phase === 'out') {
      progress.current -= 1
      reported.current = false
    }
  }, [phase])

  useFrame((state, delta) => {
    const { scrollProgress, breakProgress } = useStore.getState()

    // Linear, and identical to the backdrop's keyframes. Step by the frame's
    // share of FLAVOR_PUSH; reduced motion makes it a single step.
    const travel = prefersReducedMotion ? 1 : delta / FLAVOR_PUSH
    progress.current = Math.min(1, progress.current + travel)

    const s = progress.current

    /**
     * Offsets, in viewport widths. The outgoing field starts where it already
     * was and leaves towards -direction; the incoming one starts a full viewport
     * towards +direction and arrives at zero. The two are always exactly one
     * viewport apart, which is what makes this a push rather than two things
     * flying past each other.
     */
    const offset = phase === 'in' ? 1 - s : -s
    scene.group.position.x = offset * direction * FLAVOR_PUSH_DISTANCE * width

    // The shatter takes the whole field with it, so the cup breaks against the
    // neutral dark the backdrop is fading in rather than against fruit.
    const shatter = 1 - Math.min(breakProgress / BREAK_START, 1)

    /**
     * A quick ramp in, then full, then away over the last third.
     *
     * Not decoration. The field is wider than a screen, so at the end of the
     * push a sliver of the outgoing field is still on screen — it is only
     * invisible because its alpha has reached zero by then. Drop the fade and the
     * last flavor's fruit leaves a strip of itself behind.
     */
    const alpha =
      phase === 'in' ? Math.min(1, s / 0.3) : 1 - Math.max(0, (s - 0.65) / 0.35)

    scene.update(state.clock.elapsedTime, scrollProgress, alpha * shatter)

    if (phase === 'out' && s >= 1 && !reported.current) {
      reported.current = true
      onPushedOut?.()
    }
  })

  return <primitive object={scene.group} />
}

export default function FruitField() {
  const activeFlavor = useStore((state) => state.activeFlavor)
  const flavor = getFlavor(activeFlavor)

  /** Swap ids, from state: the id is read while rendering the layer pair. */
  const [lastId, setLastId] = useState(0)

  /**
   * The initial field has already arrived: `progress` 1, no push. The page loads
   * onto a finished background, exactly as the backdrop's first colour does.
   *
   * `direction` is read from the store at the moment of the change rather than
   * subscribed to. It is written by the same update that changed the flavor, so
   * it is already the new value by the time this render runs — and it is frozen
   * into the swap here, because an outgoing field has to keep pushing the way it
   * started even if the reader taps three flavors in a row.
   */
  const [swap, setSwap] = useState(() => ({
    incoming: { id: 0, flavor, direction: 1 },
    outgoing: null,
  }))

  // Adjusting state during render rather than in an effect, exactly as the
  // backdrop does: React re-renders before the browser paints, so the new
  // flavor's fruit is never a frame late.
  if (swap.incoming.flavor.id !== flavor.id) {
    setLastId(lastId + 1)
    setSwap({
      incoming: {
        id: lastId + 1,
        flavor,
        direction: useStore.getState().flavorDirection,
      },
      outgoing: swap.incoming,
    })
  }

  const clearOutgoing = (id) =>
    setSwap((current) =>
      current.outgoing?.id === id ? { ...current, outgoing: null } : current,
    )

  return (
    <>
      {/*
        Keyed by the swap, not by the flavor. Going strawberry -> lime ->
        strawberry must build a new field rather than revive the first one, whose
        clock and whose direction belong to a change that is long over.
      */}
      <Field
        key={swap.incoming.id}
        flavor={swap.incoming.flavor}
        phase="in"
        direction={swap.incoming.direction}
      />
      {swap.outgoing && (
        <Field
          key={swap.outgoing.id}
          flavor={swap.outgoing.flavor}
          phase="out"
          direction={swap.outgoing.direction}
          onPushedOut={() => clearOutgoing(swap.outgoing.id)}
        />
      )}
    </>
  )
}
