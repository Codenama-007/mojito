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

/** Clears the fixed navbar when a section is scrolled to. Mirrors `--nav-h`. */
export const SCROLL_OFFSET = -64

/**
 * Smoothly brings a section into view, by `href` (`'#faq'`, `'#flavor-lime'`).
 *
 * Returns as soon as the scroll has been handed to Lenis, so it has not
 * necessarily arrived yet.
 *
 * On a phone this used to do nothing at all. The menu stops Lenis while it is
 * open — that is how the page is held still behind the veil — and Lenis then stood
 * in the way twice over:
 *
 * ```js
 * // 1. A stopped instance refuses a programmatic scroll outright.
 * if ((this.isStopped || this.isLocked) && !force) return
 *
 * // 2. Starting it resets it, and a reset stops any animation already running.
 * internalStart() { this.reset(); this.isStopped = false }
 * reset() { this.animatedScroll = this.targetScroll = this.actualScroll
 *           this.animate.stop() }
 * ```
 *
 * So the click did nothing, and the handler's `preventDefault` suppressed the
 * browser's own jump to the anchor in the same breath. Nothing happened, only on a
 * phone, which is where those links are the only navigation there is.
 *
 * Hence `start()` before the scroll, and not the other way around. Starting it is
 * what lets the scroll be accepted at all, and starting it first also means the
 * menu's own close — which starts it again — finds it already running and no-ops
 * instead of resetting the travel out from under the user. `scripts/verify-nav.mjs`
 * drives a real Lenis through both orderings and fails on the wrong one.
 *
 * Reduced motion needs no branch here. With `respectReducedMotion` (the default)
 * Lenis forces `immediate` on programmatic scrolls, so this jumps rather than
 * animates for anyone who asked for that.
 *
 * `lenis` is injectable so `scripts/verify-nav.mjs` can drive a real instance
 * without a browser. Pass `null` for the fallback below.
 */
export function scrollToSection(href, lenis = getLenis()) {
  if (lenis) {
    lenis.start()
    lenis.scrollTo(href, { offset: SCROLL_OFFSET })
    return
  }

  // No instance at all — it failed to construct, or the effect has not run yet.
  // Jump the same distance by hand so the link still goes somewhere.
  const target = document.querySelector(href)
  if (!target) return

  window.scrollTo({
    top: target.getBoundingClientRect().top + window.scrollY + SCROLL_OFFSET,
    behavior: 'smooth',
  })
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
