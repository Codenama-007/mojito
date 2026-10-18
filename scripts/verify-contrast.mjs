import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * The ink flip, measured.
 *
 * The shatter darkens the whole page, and `index.css` answers that by redefining
 * the ink tokens on one class rather than restyling every section for a state that
 * lasts a second and a half. That trick has a failure mode with no symptom until
 * someone looks at the right screen at the right moment: a rule that paints a
 * *flipped* background and writes its text in a *fixed* colour goes invisible for
 * as long as the state lasts.
 *
 * Which is exactly what the order button did. It is a pill — `background:
 * var(--ink)` — labelled `#fff`, and in the one state it is ever shown in the ink
 * is a cream, so the label was white on white. The build was green, the lint was
 * green, and every other suite in this folder was green: none of them had a reason
 * to multiply two declarations together.
 *
 * So this one multiplies them. The tokens that flip are read out of the stylesheet
 * and out of the class `App.jsx` applies; the rules are read out of every
 * stylesheet in `src/`; and each pair is resolved in both states and measured with
 * the WCAG contrast ratio. Nothing is retyped — add a token to the shaded block and
 * it is in scope here, delete one and this file stops claiming to cover it.
 *
 * Translucent backgrounds are counted but not measured: what shows through them is
 * the page behind, which is a shader's business and not CSS's, so the structural
 * check above is the one that covers those.
 */

const failures = []
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`)
  } else {
    console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`)
    failures.push(name)
  }
}

// ------------------------------------------------------------------- the reading

const read = (path) => readFileSync(path, 'utf8')

/** Every stylesheet under a directory, at any depth. */
const stylesheetsIn = (directory) =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return stylesheetsIn(path)
    return entry.name.endsWith('.css') ? [path] : []
  })

/**
 * Every `selector { declarations }` in a stylesheet. Not a parser — but the rules
 * in this project do not nest, so a rule is the text between a `{` and its `}`, and
 * an at-rule's own block falls out as a rule with nothing to declare in it.
 */
const rulesIn = (css) =>
  [...css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map(([, selector, body]) => ({
      selector: selector.trim().split(/\s+/).at(-1),
      declarations: declarationsIn(body),
    }))
    .filter((rule) => rule.declarations.size > 0)

const declarationsIn = (body) => {
  const declarations = new Map()
  for (const part of body.split(';')) {
    const colon = part.indexOf(':')
    if (colon > 0) declarations.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim())
  }
  return declarations
}

const indexRules = rulesIn(read('src/index.css'))
const baseTokens = indexRules.find((rule) => rule.selector === ':root')?.declarations ?? new Map()

/*
 * The shaded class comes from the component that applies it, so renaming it there
 * renames it here rather than quietly emptying this file of its subject.
 */
const shadedClass = read('src/App.jsx').match(/app--[a-z-]+/)?.[0] ?? ''
const shadedRule = indexRules.find((rule) => rule.selector === `.${shadedClass}`)
const shadedTokens = shadedRule?.declarations ?? new Map()
const flipping = [...shadedTokens.keys()].filter((name) => name.startsWith('--'))

check(
  'the shatter state is findable, and it is the state this file measures',
  Boolean(shadedClass) && Boolean(shadedRule) && flipping.length > 0,
  shadedRule
    ? `.${shadedClass} redefines ${flipping.length} tokens: ${flipping.join(', ')}`
    : `no .${shadedClass} rule in src/index.css`,
)

// -------------------------------------------------------------- the two colours

const TOKEN = /^var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)$/
const HEX = /^#([\da-f]{3}|[\da-f]{6})$/i
const RGB = /^rgba?\(([^)]+)\)$/i
const NOT_A_COLOUR = /^(inherit|initial|unset|revert|revert-layer|currentcolor|transparent|none)$/i

/** A declaration's value in one state: tokens resolve, literals pass through. */
const resolve = (value, shaded) => {
  const token = value.trim().match(TOKEN)
  if (!token) return value.trim()
  const [, name, fallback] = token
  const found = (shaded ? shadedTokens.get(name) : null) ?? baseTokens.get(name) ?? fallback
  return found ? found.trim() : null
}

/** `[r, g, b, a]`, or null for anything this file cannot measure. */
const channels = (value) => {
  const hex = value.match(HEX)
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map((digit) => digit + digit).join('') : hex[1]
    return [0, 2, 4].map((at) => parseInt(digits.slice(at, at + 2), 16)).concat(1)
  }

  const rgb = value.match(RGB)
  if (rgb) {
    const parts = rgb[1].split(/[\s,/]+/).filter(Boolean).map(Number)
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
  }

  return null
}

/** WCAG relative luminance: the sRGB transfer function, then the weights. */
const luminance = ([red, green, blue]) => {
  const channel = (value) => {
    const fraction = value / 255
    return fraction <= 0.03928 ? fraction / 12.92 : ((fraction + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(red) + 0.7152 * channel(green) + 0.0722 * channel(blue)
}

const contrast = (one, other) => {
  const [lighter, darker] = [luminance(one), luminance(other)].sort((a, b) => b - a)
  return (lighter + 0.05) / (darker + 0.05)
}

// ------------------------------------------------------------------- the pairing

const literals = []
const undeclared = []
const pairs = []

for (const file of stylesheetsIn('src')) {
  for (const { selector, declarations } of rulesIn(read(file))) {
    const background = declarations.get('background') ?? declarations.get('background-color') ?? ''
    const token = background.match(/var\(\s*(--[\w-]+)/)?.[1]
    if (!token || !flipping.includes(token)) continue

    /** The paint, in either state, where the paint is solid enough to measure. */
    const solid = [false, true]
      .map((shaded) => channels(resolve(background, shaded) ?? ''))
      .filter((paint) => paint && paint[3] >= 1)

    const colour = declarations.get('color')

    /*
     * No colour declared, on a solid paint: the label is whatever is inherited,
     * which on this page is the ink — an ink pill labelled in ink. Translucent
     * paints are left to inheritance on purpose, because what shows through them is
     * the shader's business and not something to insist on here.
     */
    if (!colour) {
      if (solid.length) undeclared.push(`${file} ${selector} — ${background} with no color`)
      continue
    }

    /*
     * The rule this file exists for: a colour written onto a background that moves
     * under it.
     */
    if (!colour.includes('var(') && !NOT_A_COLOUR.test(colour)) {
      literals.push(`${file} ${selector} — color: ${colour} on ${background}`)
    }

    for (const shaded of [false, true]) {
      const behind = channels(resolve(background, shaded) ?? '')
      const written = channels(resolve(colour, shaded) ?? '')
      if (!behind || !written || behind[3] < 1 || written[3] < 1) continue
      pairs.push({
        where: `${selector} ${shaded ? 'shaded' : 'lit'}`,
        ratio: contrast(written, behind),
      })
    }
  }
}

check(
  'no rule writes text in a colour the shatter cannot move',
  literals.length === 0,
  literals.length ? literals.join('; ') : 'every label on a flipped background is painted in a token',
)

check(
  'a solid background that flips says what colour its own label is',
  undeclared.length === 0,
  undeclared.length ? undeclared.join('; ') : 'left to inheritance only where the paint is translucent',
)

const weakest = pairs.sort((one, other) => one.ratio - other.ratio)[0]

check(
  'every label on a flipped background is readable in both states',
  pairs.every((pair) => pair.ratio >= 4.5),
  weakest
    ? `${pairs.length} pairs, weakest ${weakest.ratio.toFixed(1)}:1 (${weakest.where}), AA is 4.5:1`
    : 'nothing opaque to measure — see the note at the top of this file',
)

if (failures.length) {
  console.log(`\nFAIL: ${failures.join(' | ')}`)
  process.exit(1)
}

console.log(`\nPASS: all checks green (${flipping.length} tokens that flip, ${pairs.length} pairs measured)`)
