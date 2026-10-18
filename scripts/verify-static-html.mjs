/**
 * Does the built site say everything it is supposed to say, to a reader that
 * cannot run JavaScript?
 *
 * This runs the real production build with Vite's own API, then reads
 * `dist/index.html` as bytes — no DOM, no jsdom, no module execution — and makes
 * assertions about what is in it. That is the only form of this test that proves
 * anything: the site is a client-rendered SPA, so asserting against a rendered
 * DOM would pass while the page source stayed empty, which is exactly the failure
 * this whole phase exists to fix.
 *
 * It also checks the files a crawler reads before it ever fetches a page:
 * robots.txt, the sitemap and llms.txt.
 *
 * Finally it renders the FAQ accordion in isolation — a small Vite SSR build,
 * then `renderToStaticMarkup`, both from dependencies the project already has —
 * because the accordion is the one place where a change could hide seven answers
 * from every crawler while leaving every other check in this file green. See the
 * comment above that section.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import react from '@vitejs/plugin-react'
import { build } from 'vite'
import { brand } from '../src/config/brand.js'
import { flavors } from '../src/config/flavors.js'
import {
  aboutBrandHeading,
  aboutBrandParagraph,
  factsFor,
  faq,
  metaDescription,
  metaTitle,
} from '../src/config/siteContent.js'

let failures = 0

const check = (label, condition, detail = '') => {
  if (condition) {
    console.log(`  ok   ${label}`)
    return
  }
  failures += 1
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
}

/**
 * The text a person would read: tags removed, entities decoded, whitespace
 * collapsed. Checks run against this rather than the raw source so a passing
 * assertion means the words are visible, not merely present in an attribute or a
 * script block.
 *
 * Numeric entities are decoded because React emits `&#x27;` for an apostrophe,
 * and this script compares React's output to the same strings it renders.
 * `&amp;` is decoded last, or `&amp;lt;` would arrive as a tag.
 */
const textOf = (html) =>
  html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()

const isSubstring = (haystack, needle) => haystack.includes(needle.replace(/\s+/g, ' '))

console.log('\nAI-crawler content\n')

console.log('Building (this is the artifact under test)...')
await build({ logLevel: 'warn' })

const root = 'dist'
const htmlPath = `${root}/index.html`

if (!existsSync(htmlPath)) {
  console.log(`  FAIL ${htmlPath} was not written`)
  process.exit(1)
}

const html = readFileSync(htmlPath, 'utf8')
const visible = textOf(html)

/* --- The page source, without JavaScript -------------------------------- */

console.log('\nindex.html — text, with no JavaScript run\n')

check('the brand name is in the source', visible.includes(brand.name))
check('the "What is…?" heading is in the source', visible.includes(aboutBrandHeading))
check('the "What is…?" paragraph is in the source', isSubstring(visible, aboutBrandParagraph))

for (const flavor of flavors) {
  const facts = factsFor(flavor)
  check(`the ${flavor.name} flavor is named`, visible.includes(flavor.name))
  for (const fact of facts) {
    check(
      `  ${flavor.name} / ${fact.label}`,
      isSubstring(visible, fact.value),
      `expected "${fact.value}"`,
    )
  }
}

// The specific fields the brief names, asserted by label rather than by value,
// so a future edit that renames "Shelf life" is caught here.
const labels = ['Ingredients', 'Size', 'Price', 'Calories', 'Shelf life', 'Alcoholic']
for (const label of labels) {
  const count = (visible.match(new RegExp(`(^|\\s)${label}(\\s|$)`, 'g')) || []).length
  check(`facts list carries "${label}" (${count}x)`, count >= flavors.length)
}

for (const entry of faq()) {
  check(`FAQ question in source: ${entry.question}`, isSubstring(visible, entry.question))
  check(`FAQ answer in source: ${entry.question}`, isSubstring(visible, entry.answer))
}
check('there are eight FAQ entries', faq().length === 8, `found ${faq().length}`)

/* --- The FAQ accordion, actually rendered ------------------------------- */

/*
 * Everything above reads the built HTML, which is the static shell: a flat list
 * of answers, because there is no script in that document to disclose anything
 * with. The accordion itself only exists once React has run, so the only way to
 * check it without a browser is to render it.
 *
 * Worth the twenty lines, because the accordion is where this phase could be
 * quietly undone. Answers that are not the open one must be `hidden` — not
 * missing. A future swap to a component that renders only the open panel would
 * take seven answers off the live page, pass every other check in this file (the
 * shell still carries them) and look correct in a browser. So the contract is
 * asserted against a real render.
 *
 * The build is deliberately isolated: `configFile: false`, because the app's own
 * config brings a plugin that writes into dist/ on closeBundle, and this build is
 * a probe, not the site.
 */
console.log('\nFAQ accordion\n')

const ssrOut = 'node_modules/.verify/accordion'

await build({
  logLevel: 'silent',
  configFile: false,
  plugins: [react()],
  build: { ssr: 'src/ui/Accordion.jsx', outDir: ssrOut, emptyOutDir: true, minify: false },
})

const { default: Accordion } = await import(pathToFileURL(resolve(ssrOut, 'Accordion.js')).href)

const accordionItems = faq().map((entry, index) => ({
  id: `faq-${index + 1}`,
  question: entry.question,
  answer: entry.answer,
}))

// `useState` in a server render yields the initial state, which is exactly the
// state a crawler that never clicks would find.
const accordion = renderToStaticMarkup(
  createElement(Accordion, { id: 'faq-accordion', items: accordionItems }),
)
const accordionText = textOf(accordion)

const tagAttr = (tag, name) => tag.match(new RegExp(`${name}="([^"]*)"`))?.[1] ?? null
const triggers = [...accordion.matchAll(/<button\b[^>]*>/g)].map((match) => match[0])
const buttons = [...accordion.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)].map((match) => match[0])
const panels = [...accordion.matchAll(/<div\b[^>]*accordion__panel[^>]*>/g)].map((match) => match[0])

check('the FAQ renders as eight disclosure buttons', triggers.length === 8, `found ${triggers.length}`)
check('and eight panels', panels.length === 8, `found ${panels.length}`)

const panelIds = panels.map((panel) => tagAttr(panel, 'id'))
const headingIds = [...accordion.matchAll(/<h[1-6] id="([^"]+)"/g)].map((match) => match[1])

check(
  'every button declares its expanded state',
  triggers.every((trigger) => ['true', 'false'].includes(tagAttr(trigger, 'aria-expanded'))),
)
check(
  'every button names a panel that exists',
  triggers.every((trigger) => panelIds.includes(tagAttr(trigger, 'aria-controls'))),
)
check(
  'every button also carries the Flowbite target for that panel',
  triggers.every((trigger) => tagAttr(trigger, 'data-accordion-target') === `#${tagAttr(trigger, 'aria-controls')}`),
)
check(
  'every panel points back at its own heading',
  panels.every((panel) => headingIds.includes(tagAttr(panel, 'aria-labelledby'))),
)
check(
  'a panel is hidden exactly when its button says it is',
  triggers.every((trigger, index) => {
    const isCollapsed = tagAttr(panels[index] ?? '', 'hidden') !== null
    return isCollapsed === (tagAttr(trigger, 'aria-expanded') === 'false')
  }),
)
check('one panel is open on arrival', panels.filter((panel) => !panel.includes('hidden')).length === 1)
check(
  /*
   * The chevron points down while a row is closed, inviting a press, and up while
   * it is open. The version this was copied from ships `rotate-180` on every icon
   * regardless of state, which tells the reader nothing.
   */
  'the chevron follows the panel it belongs to',
  buttons.length === 8 &&
    buttons.every(
      (button) =>
        button.includes('data-accordion-icon') &&
        button.includes('accordion__icon is-open') === button.includes('aria-expanded="true"'),
    ),
)
check(
  'the answers are in the markup even while their panels are collapsed',
  faq().every((entry) => isSubstring(accordionText, entry.answer)),
  'collapsed is the hidden attribute, not an absent answer',
)
check(
  'the questions are subheadings of the section, not headings beside it',
  (accordion.match(/<h3 /g) || []).length === 8 && !accordion.includes('<h2'),
)
check(
  'the questions are rendered in order',
  accordionItems.every((item, index) => {
    const position = accordionText.indexOf(item.question)
    const previous = index === 0 ? -1 : accordionText.indexOf(accordionItems[index - 1].question)
    return position > previous
  }),
)

const cssFile = readdirSync(`${root}/assets`).find((name) => name.endsWith('.css'))
const css = cssFile ? readFileSync(`${root}/assets/${cssFile}`, 'utf8') : ''
check(
  'the disclosure button clears the 44px tap target',
  /\.accordion__trigger\{[^}]*min-height:44px/.test(css),
  'AGENTS.md section 6',
)

check('the title comes from config', html.includes(`<title>${metaTitle}</title>`))
check('the description comes from config', html.includes(metaDescription))
check('a canonical link is present', /<link rel="canonical" href="[^"]+" \/>/.test(html))
check(
  'the static shell is marked so it can be hidden',
  html.includes('data-static-shell'),
  'index.css keys its hide rule off this attribute',
)

/* --- Structured data ---------------------------------------------------- */

console.log('\nstructured data\n')

const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]

check('JSON-LD is present', blocks.length >= 2, `found ${blocks.length} blocks`)

const parsed = []
for (const [, body] of blocks) {
  try {
    parsed.push(JSON.parse(body.replace(/\\u003c/g, '<')))
  } catch (error) {
    check('every JSON-LD block parses', false, error.message)
  }
}

check('every JSON-LD block parses', parsed.length === blocks.length)

const faqPage = parsed.find((block) => block['@type'] === 'FAQPage')
check('an FAQPage block exists', Boolean(faqPage))

if (faqPage) {
  check(
    'FAQPage lists every question',
    faqPage.mainEntity.length === faq().length,
    `${faqPage.mainEntity?.length} of ${faq().length}`,
  )

  // The point of structured data is that it agrees with the page. Google treats
  // FAQ markup that does not match the visible answer as a violation.
  const markup = faqPage.mainEntity.map((question) => question.name)
  const rendered = faq().map((entry) => entry.question)
  check(
    'FAQPage questions match the rendered questions',
    markup.length === rendered.length && markup.every((name, index) => name === rendered[index]),
  )
  check(
    'FAQPage answers match the rendered answers',
    faqPage.mainEntity.every((question, index) =>
      isSubstring(visible, question.acceptedAnswer.text) &&
      question.acceptedAnswer.text === faq()[index].answer,
    ),
  )
}

const organization = parsed.find((block) => block['@type'] === 'Organization')
check('an Organization block exists', Boolean(organization))
check(
  'the Organization block carries the phone number',
  organization?.telephone === brand.phone,
)

/* --- The files a crawler reads first ------------------------------------ */

console.log('\ncrawler files\n')

const robots = readFileSync(`${root}/robots.txt`, 'utf8')

const namedBots = ['GPTBot', 'OAI-SearchBot', 'ClaudeBot', 'PerplexityBot']
check('robots.txt allows every crawler', /User-agent: \*\s*\nAllow: \//.test(robots))
for (const bot of namedBots) {
  check(`robots.txt names ${bot}`, new RegExp(`User-agent: ${bot}\\s*\\nAllow: /`).test(robots))
}
check('robots.txt points at a sitemap', /^Sitemap: \S+$/m.test(robots), robots.split('\n').pop())

const sitemap = readFileSync(`${root}/sitemap.xml`, 'utf8')
check('sitemap.xml is well formed', sitemap.includes('<urlset') && sitemap.includes('</urlset>'))
check('sitemap.xml lists a URL', /<loc>\S+<\/loc>/.test(sitemap))

/**
 * A crawler requires an absolute sitemap URL and silently ignores a relative one,
 * so once the site has a home the files have to say so. Before that they cannot,
 * and pretending otherwise would be the worse answer.
 *
 * The origin is resolved the same way `plugins/ai-prerender.js` resolves it, so
 * this check tests the file that was actually written rather than a second guess
 * at it.
 */
const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || ''
const origin = (brand.siteUrl || (vercelHost ? `https://${vercelHost}` : '')).replace(/\/$/, '')

if (origin) {
  check('robots.txt points at an absolute sitemap', robots.includes(`Sitemap: ${origin}/sitemap.xml`))
  check('sitemap.xml uses an absolute URL', sitemap.includes(`<loc>${origin}/</loc>`))
} else {
  console.log(
    '  note  no site origin yet, so robots.txt and sitemap.xml use paths —\n' +
      '        set `siteUrl` in src/config/brand.js before deploying',
  )
}

const llmsPath = `${root}/llms.txt`
check('llms.txt is shipped', existsSync(llmsPath))
if (existsSync(llmsPath)) {
  const llms = readFileSync(llmsPath, 'utf8')
  check('llms.txt names the brand', llms.includes(brand.name))
  check('llms.txt carries the order phone number', llms.includes(brand.phone))
  for (const flavor of flavors) {
    check(`llms.txt lists ${flavor.name}`, llms.includes(flavor.name))
  }
  check('llms.txt links to each section', ['/#flavor-', '/#about-brand', '/#faq', '/#contact']
    .every((fragment) => llms.includes(fragment)))
}

/* --- Nothing half-written ----------------------------------------------- */

console.log('\nsanity\n')

check('no TODO_ placeholders shipped', !html.includes('TODO_'))
check('no unrendered template tokens shipped', !/__[A-Z_]+__/.test(html))
check('the page is not a bare SPA shell', html.length > 4000, `${html.length} bytes`)

console.log(failures === 0 ? '\nAI content verified.\n' : `\n${failures} check(s) failed.\n`)
process.exit(failures === 0 ? 0 : 1)
