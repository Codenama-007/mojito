import { useState } from 'react'
import { getFlavor } from '../config/flavors.js'
import { useStore } from '../store/useStore.js'
import './Backdrop.css'

/**
 * Converts the flavor's hex accent and a 0..1 alpha into an #RRGGBBAA pair.
 *
 * The gradient's outer stop uses the same color at zero alpha rather than the
 * `transparent` keyword, because `transparent` is rgba(0,0,0,0) and fades
 * through grey, which shows as a dirty ring on the lighter flavors.
 */
function blob(accent, alpha) {
  const hex = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0')

  return `radial-gradient(circle closest-side, ${accent}${hex}, ${accent}00 72%)`
}

function BackdropLayer({ flavor, className, onFaded }) {
  return (
    <div
      className={`backdrop ${className}`}
      style={{ backgroundImage: flavor.backgroundGradient }}
      onAnimationEnd={(event) => {
        // The blobs animate too and their events bubble up here.
        if (event.target === event.currentTarget) onFaded?.()
      }}
    >
      {flavor.bokeh.map(([x, y, size, alpha], index) => (
        <span
          key={index}
          className="backdrop__bokeh"
          style={{
            left: `${x}%`,
            top: `${y}%`,
            width: `${size}vmax`,
            height: `${size}vmax`,
            backgroundImage: blob(flavor.accentColor, alpha),
            // Stagger the loops so the blobs never drift in lockstep.
            animationDelay: `${index * -3.7}s`,
          }}
        />
      ))}
    </div>
  )
}

/**
 * Two stacked layers, cross-faded, so switching flavor never hard-cuts the
 * mood. The outgoing layer is painted *over* the incoming one and animates out,
 * which is the only arrangement where a fade is visible at all: put it
 * underneath and the incoming opaque gradient hides it instantly. Phase 3A had
 * it underneath, so the cross-fade was a hard cut.
 *
 * Depth is CSS only: no image assets, which keeps the page inside the 2 MB
 * budget the model and the environment map already mostly use.
 */
export default function Backdrop() {
  const activeFlavor = useStore((state) => state.activeFlavor)
  const flavor = getFlavor(activeFlavor)

  const [layers, setLayers] = useState({ current: flavor, previous: null })

  // Adjusting state during render rather than in an effect: React re-renders
  // before the browser paints, so the new flavor is never shown a frame late.
  if (layers.current.id !== flavor.id) {
    setLayers({ current: flavor, previous: layers.current })
  }

  const clearPrevious = () =>
    setLayers((current) => ({ ...current, previous: null }))

  return (
    <>
      <BackdropLayer flavor={layers.current} className="" />
      {layers.previous && (
        <BackdropLayer
          flavor={layers.previous}
          className="backdrop--previous"
          onFaded={clearPrevious}
        />
      )}
    </>
  )
}
