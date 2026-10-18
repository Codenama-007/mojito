import { readFileSync } from 'node:fs'

/**
 * The navbar, checked.
 *
 * This suite exists because of one bug. On a phone, every link in the menu did
 * nothing at all: the menu stops Lenis while it is open, and a stopped Lenis
 * refuses a programmatic scroll, so the handler's `preventDefault` suppressed the
 * browser's own jump while the smooth scroll that replaced it returned on its
 * first line. It built, it linted, and eight other verification suites passed,
 * because none of them had anything to say about navigation.
 *
 * The interesting half of this file therefore drives the **real** Lenis against a
 * stub DOM, the way the rest of the project's suites compute real geometry instead
 * of trusting a screenshot. There is no browser available here, so the stub takes
 * care of `window`, `document` and a section that sits 2400px down the page; what
 * is being tested is Lenis's state machine and the project's own call into it,
 * which is where the bug lived and where a future one would.
 *
 * The first two checks fail if Lenis ever stops behaving the way the comment on
 * `scrollToSection` says it does — which is the point. They are not complaints
 * about a dependency, they are the assumptions the fix is built on, asserted.
 */
const failures = []
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`)
    return
  }
  console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`)
  failures.push(name)
}

// ------------------------------------------------------------- the stub browser

/** A section at `top` in a 20000px document seen through an 800px window. */
const makeElement = (top) => ({
  getBoundingClientRect: () => ({
    top,
    left: 0,
    right: 390,
    bottom: top + 800,
    width: 390,
    height: 800,
    x: 0,
    y: top,
  }),
})

class Window {
  innerWidth = 390
  innerHeight = 800
  scrollX = 0
  scrollY = 0
  lenis = {}

  matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })

  /** Real windows move when you tell them to; the stub has to as well, because */
  /** Lenis reads its own position back off this. */
  scrollTo = (options) => {
    this.scrollY = Math.round(options.top ?? 0)
  }

  addEventListener() {}
  removeEventListener() {}
  dispatchEvent() {}
}

const windowStub = new Window()

/** Every section the app has, each 800px below the last, starting at 1200. */
const sections = {}
const SECTION_TOPS = {}
const { NAV_LINKS, SECTION_ORDER } = await import('../src/config/sections.js')
SECTION_ORDER.forEach((id, index) => {
  SECTION_TOPS[id] = 1200 + index * 800
  sections[id] = makeElement(SECTION_TOPS[id])
})

/** Lenis puts `lenis` classes on the root element and reads them back off it. */
const makeClassList = () => {
  const names = new Set()
  return {
    add: (name) => names.add(name),
    remove: (name) => names.delete(name),
    contains: (name) => names.has(name),
    [Symbol.iterator]: () => names[Symbol.iterator](),
  }
}

const documentStub = {
  documentElement: {
    scrollHeight: 20000,
    scrollWidth: 390,
    clientHeight: 800,
    className: '',
    classList: makeClassList(),
  },
  getElementById: (id) => sections[id] ?? null,
  querySelector: (selector) => sections[selector.replace(/^#/, '')] ?? null,
  createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
  addEventListener() {},
  removeEventListener() {},
  querySelectorAll: () => [],
}

// `getComputedStyle` is asked for scroll margins and paddings, all of which are
// zero here; anything else it is asked for is not interesting to the scroll.
const style = new Proxy({}, { get: () => '0px' })

globalThis.window = windowStub
globalThis.document = documentStub
// Lenis decides how to measure the page with `wrapper instanceof Window`, so the
// stub window has to be an instance of a real global `Window`.
globalThis.Window = Window
// Node 22 ships a `navigator` with a getter and no setter, so this is defined
// rather than assigned.
Object.defineProperty(globalThis, 'navigator', {
  value: { userAgent: 'verify-nav' },
  configurable: true,
  writable: true,
})
globalThis.getComputedStyle = () => style
globalThis.ResizeObserver = class {
  observe() {}
  disconnect() {}
}
globalThis.CustomEvent = class {
  constructor(type, init = {}) {
    this.type = type
    Object.assign(this, init)
  }
}
// Never invoked, and deliberately so: gsap's ticker starts its own rAF loop on
// import and would recurse forever against a synchronous one, and a timer-based
// one would keep the process alive. Nothing here needs a clock — Lenis is driven
// by hand with `runFrames`.
globalThis.requestAnimationFrame = () => 0
globalThis.cancelAnimationFrame = () => {}

// Imported after the stubs, never before: `useLenis.js` pulls in gsap and
// ScrollTrigger, which feature-detect the document on the way in.
const { default: Lenis } = await import('lenis')
const { scrollToSection, SCROLL_OFFSET } = await import('../src/hooks/useLenis.js')

/** Lenis, fresh, with the page parked at `scrollY`. */
const newLenis = (scrollY = 0) => {
  windowStub.scrollY = scrollY
  return new Lenis({ duration: 1, autoRaf: false })
}

/** Turn the rAF handle by hand: 90 frames is 1.44s, past a one-second scroll. */
const runFrames = (lenis) => {
  let time = 0
  for (let frame = 0; frame < 90; frame += 1) {
    time += 16
    lenis.raf(time)
  }
  return windowStub.scrollY
}

// --------------------------------------------------------------------- the config

check(
  'every nav link points at a section that exists',
  NAV_LINKS.every((link) => link.href.startsWith('#') && SECTION_ORDER.includes(link.href.slice(1))),
  `${NAV_LINKS.length} links against ${SECTION_ORDER.length} sections`,
)
check(
  'no two nav links point at the same section',
  new Set(NAV_LINKS.map((link) => link.href)).size === NAV_LINKS.length,
  NAV_LINKS.map((link) => link.href.slice(1)).join(', '),
)
check(
  'every nav link has a label',
  NAV_LINKS.every((link) => Boolean(link.label) && link.label === link.label.trim()),
)
check(
  'every section id is unique, so a link cannot land on the wrong one',
  new Set(SECTION_ORDER).size === SECTION_ORDER.length,
  `${SECTION_ORDER.length} sections`,
)

// --------------------------------------------------------- the two traps, shown

// Trap 1: the bug as reported. A stopped instance swallows the scroll, and the
// click handler has already suppressed the browser's own jump.
{
  const lenis = newLenis()
  lenis.stop()
  lenis.scrollTo('#faq', { offset: SCROLL_OFFSET })
  const landed = runFrames(lenis)

  check(
    'a scroll asked of a stopped Lenis goes nowhere — the report, reproduced',
    landed === 0,
    `landed at ${landed}px`,
  )
}

// Trap 2: the one that made the first fix wrong. Making the scroll survive the
// stopped check is not enough, because closing the menu starts the instance, and
// starting resets, and a reset stops the animation already in flight.
{
  const lenis = newLenis()
  lenis.stop()
  lenis.scrollTo('#faq', { offset: SCROLL_OFFSET, force: true })
  lenis.start()
  const landed = runFrames(lenis)

  check(
    'and a scroll started before the menu closes is cancelled by the close',
    landed === 0,
    `landed at ${landed}px — which is why scrollToSection starts the instance first`,
  )
}

// ------------------------------------------------------- the journey, for real

for (const id of SECTION_ORDER) {
  const lenis = newLenis()
  lenis.stop()

  // Exactly what Navbar does: hand it to the helper, then let the menu close.
  scrollToSection(`#${id}`, lenis)
  lenis.start()

  const landed = runFrames(lenis)
  const expected = SECTION_TOPS[id] + SCROLL_OFFSET

  check(
    `#${id} lands on its section, clear of the navbar`,
    landed === expected,
    `${landed}px, wanted ${expected}px`,
  )
}

// The fallback, for a device where Lenis never constructed: no smooth scroll, but
// the link still has to go somewhere.
{
  windowStub.scrollY = 0
  scrollToSection('#faq', null)

  check(
    'with no Lenis at all, the link still moves the page',
    windowStub.scrollY === SECTION_TOPS.faq + SCROLL_OFFSET,
    `landed at ${windowStub.scrollY}px`,
  )
}

// --------------------------------------------------------------- the tap targets

/**
 * Every nav control is a thumb target, and AGENTS.md section 6 makes that
 * non-negotiable. The size is read out of the stylesheet rather than trusted:
 * `--nav-h` is resolved from `index.css` so the two cannot drift, and the largest
 * declared height wins, which is how a `height` and a larger `min-height` resolve.
 */
const NAV_H = Number((readFileSync('src/index.css', 'utf8').match(/--nav-h:\s*(\d+)px/) ?? [])[1])
const navbarCss = readFileSync('src/ui/Navbar.css', 'utf8')

const declaredHeight = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const block = navbarCss.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))
  if (!block) return null

  const sizes = [...block[1].matchAll(/(?:min-)?height:\s*(?:var\(--nav-h\)|(\d+)px)/g)].map((match) =>
    match[1] ? Number(match[1]) : NAV_H,
  )

  return sizes.length ? Math.max(...sizes) : null
}

check('--nav-h is a real number of pixels', Number.isFinite(NAV_H), `${NAV_H}px`)

for (const selector of [
  '.navbar__logo',
  '.navbar__links a',
  '.navbar__toggle',
  '.navbar__close',
  '.navbar__overlay-nav a',
]) {
  const size = declaredHeight(selector)
  check(
    `${selector} is at least 44px tall`,
    size !== null && size >= 44,
    size === null ? 'no height declared' : `${size}px`,
  )
}

check(
  'the menu can scroll itself if the links do not fit a short screen',
  /\.navbar__overlay\s*\{[^}]*overflow-y:\s*auto/.test(navbarCss),
  'six 56px links do not fit a landscape phone',
)

if (failures.length) {
  console.log(`\nFAIL: ${failures.join(' | ')}`)
  process.exit(1)
}

console.log(`\nPASS: all checks green (${NAV_LINKS.length} nav links, ${SECTION_ORDER.length} sections)`)
