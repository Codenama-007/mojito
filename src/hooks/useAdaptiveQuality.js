import { useEffect, useState } from 'react'
import { dprCap } from '../config/performance.js'

/** Below this, the renderer sheds resolution (AGENTS.md section 5). */
const FPS_FLOOR = 45

/** One FPS reading per second, so a single slow frame cannot trigger it. */
const SAMPLE_MS = 1000

/** How much dpr to give up each time the floor is missed. */
const STEP = 0.25

/** Ignore readings while the first load is still settling. */
const WARMUP_MS = 2000

/**
 * Samples frame rate and lowers the canvas dpr toward 1 while it stays under
 * 45 FPS. It never raises dpr again, so a device that dips once cannot
 * oscillate between two resolutions.
 *
 * Request-animation-frame timing is used rather than a counter inside the
 * render loop: the canvas renders on the same callbacks, so if rendering is
 * the bottleneck those callbacks are delayed and the reading drops. It also
 * pauses for free while the tab is hidden, so a backgrounded tab cannot be
 * mistaken for a slow device.
 */
export function useAdaptiveQuality() {
  const [dpr, setDpr] = useState(dprCap)

  useEffect(() => {
    let frames = 0
    let windowStart = performance.now()
    const startedAt = windowStart
    let raf = 0

    const tick = (now) => {
      frames++

      if (now - windowStart >= SAMPLE_MS) {
        const fps = (frames * 1000) / (now - windowStart)
        const settled = now - startedAt > WARMUP_MS

        if (settled && fps < FPS_FLOOR) {
          setDpr((current) =>
            current <= 1 ? current : Math.max(1, Number((current - STEP).toFixed(2))),
          )
        }

        frames = 0
        windowStart = now
      }

      raf = requestAnimationFrame(tick)
    }

    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return dpr
}
