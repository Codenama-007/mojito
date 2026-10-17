import { useEffect } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

/**
 * One Lenis instance for the app, exposed through a module singleton so the
 * navbar can scrollTo / stop / start without prop drilling or context.
 *
 * Lenis is driven by gsap.ticker, so the whole page has a single rAF loop
 * instead of Lenis and GSAP each running their own.
 */
let lenisInstance = null

export function getLenis() {
  return lenisInstance
}

export function useLenis() {
  useEffect(() => {
    const lenis = new Lenis({
      duration: 1.05,
      // respectReducedMotion defaults to true: Lenis forces lerp to 1 and
      // makes programmatic scrolls instant, which satisfies AGENTS.md
      // section 6 without a manual branch.
    })

    lenisInstance = lenis

    const handleScroll = () => ScrollTrigger.update()
    lenis.on('scroll', handleScroll)

    const tick = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    ScrollTrigger.refresh()

    return () => {
      gsap.ticker.remove(tick)
      lenis.off('scroll', handleScroll)
      lenis.destroy()
      lenisInstance = null
    }
  }, [])
}
