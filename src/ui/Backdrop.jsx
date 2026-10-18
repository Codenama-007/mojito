import { useState } from 'react'
import { getFlavor } from '../config/flavors.js'
import {
  BACKDROP_SHADE,
  BACKDROP_SHADE_COLOR,
  FLAVOR_PUSH,
  FLAVOR_PUSH_DISTANCE,
  FRUIT_FIELD_OPACITY,
} from '../config/performance.js'
import { CONTACT_ID } from '../config/sections.js'
import { useStore } from '../store/useStore.js'
import './Backdrop.css'

/**
 * One flavor's base colour. A flat fill, not a gradient: Phase 8B put a field of
 * fruit in the canvas on top of it, and a gradient underneath that only muddied
 * the fruit — two things competing for the same job. The depth in the background
 * comes from the fruit field's three layers instead.
 */
function BackdropLayer({ flavor, className, onFaded }) {
  return (
    <div
      className={`backdrop ${className}`}
      style={{ backgroundColor: flavor.colorA }}
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onFaded?.()
      }}
    />
  )
}

/**
 * The page's background: a solid flavor colour, the fruit field (in the canvas,
 * which is transparent), and the three layers that keep text readable on both.
 *
 * **The handover is a push.** Phase 8C replaced the cross-fade with a movement:
 * the outgoing colour slides out to one side while the incoming one slides in
 * behind it, both travelling exactly one viewport, both linear, both on the same
 * clock as the fruit field in the canvas. The two layers are therefore always
 * exactly one viewport apart, which is what keeps the screen covered for the
 * whole transition — no gap, and no moment where the page shows through.
 *
 * The direction is the direction through the flavor list, so stepping forward
 * through the flavors always pushes the same way and stepping back undoes it.
 * `--push` carries the sign; `--push-distance` carries the distance, so the
 * keyframes below and `FruitField.jsx` are driven by one number.
 *
 * Depth is CSS only, and the whole thing costs no image assets — the fruit is
 * drawn to 128 px canvases in the renderer, not shipped as sprites.
 */
export default function Backdrop() {
  const activeFlavor = useStore((state) => state.activeFlavor)
  const atContact = useStore((state) => state.activeSection === CONTACT_ID)
  const flavor = getFlavor(activeFlavor)

  const [layers, setLayers] = useState({ current: flavor, previous: null })
  const [direction, setDirection] = useState(1)

  // Adjusting state during render rather than in an effect: React re-renders
  // before the browser paints, so the new flavor is never shown a frame late.
  // The direction is frozen with the layer pair, so a reader tapping through the
  // flavors gets a push that finishes the way it started.
  if (layers.current.id !== flavor.id) {
    setDirection(useStore.getState().flavorDirection)
    setLayers({ current: flavor, previous: layers.current })
  }

  const clearPrevious = () =>
    setLayers((current) => ({ ...current, previous: null }))

  /**
   * The incoming layer is keyed by flavor so that a change remounts it, which is
   * what restarts the entry animation. It only carries the entry class while a
   * swap is in flight, so the page loads onto a background that is simply
   * already there rather than one that slides in from off-screen.
   */
  const entering = layers.previous !== null

  return (
    <div
      className="backdrop__stage"
      style={{
        /**
         * The current flavor's colour, painted on the stage itself as well as on
         * the layer above it. In normal operation the sliding layer covers this
         * and it is never seen — but it means a color is on screen whatever
         * happens to the transition, so an interrupted or never-started
         * animation can never leave the page with no background at all.
         */
        backgroundColor: flavor.colorA,
        '--backdrop-overlay': FRUIT_FIELD_OPACITY.overlay,
        '--backdrop-shade': BACKDROP_SHADE,
        '--backdrop-shade-color': BACKDROP_SHADE_COLOR,
        '--push': direction,
        '--push-distance': `${FLAVOR_PUSH_DISTANCE * 100}%`,
        '--push-duration': `${FLAVOR_PUSH * 1000}ms`,
      }}
    >
      <BackdropLayer
        key={layers.current.id}
        flavor={layers.current}
        className={entering ? 'backdrop--entering' : ''}
      />
      {layers.previous && (
        <BackdropLayer
          key={layers.previous.id}
          flavor={layers.previous}
          className="backdrop--previous"
          onFaded={clearPrevious}
        />
      )}

      {/* A flat wash, not a gradient: its whole job is to take the glare off the
          fruit so body copy stays readable. */}
      <div className="backdrop__overlay" />

      {/* The one piece of the old bokeh worth keeping — a soft edge, so the
          fruit field does not stop abruptly at the corners. */}
      <div className="backdrop__vignette" />

      {/* The shatter. The fruit field fades out in the canvas and this fades in
          behind it, so the cup breaks against a neutral dark. A class toggle, so
          the fade is a CSS transition and the scroll loop writes no DOM. */}
      <div className={`backdrop__shade${atContact ? ' is-on' : ''}`} />
    </div>
  )
}
