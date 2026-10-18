import { brand } from '../config/brand.js'
import { flavors } from '../config/flavors.js'
import {
  aboutBrandHeading,
  aboutBrandParagraph,
  factsFor,
  faq,
  faqJsonLd,
  organizationJsonLd,
} from '../config/siteContent.js'

/**
 * The page, as static HTML, for anything that reads the response body without
 * running JavaScript.
 *
 * This is not a second implementation of the site. It is the same strings from
 * `config/siteContent.js` and the same data from `config/flavors.js` and
 * `config/brand.js`, laid out as plain HTML — so the built `index.html` carries
 * the whole about-brand and FAQ text in its source, and a crawler that never
 * executes a module still gets it.
 *
 * It is written into `#root` by `plugins/ai-prerender.js`. React replaces it on
 * mount, which is the standard static-shell arrangement: no hydration, so no
 * mismatch, and the copy a person reads is the copy the crawler read.
 *
 * One asymmetry is deliberate. The FAQ renders on the page as an accordion, and
 * *every* answer here is written out flat, with no disclosure buttons — because
 * there is no script in this document to disclose anything with. Eight dead
 * buttons would be a worse answer than a plain list, and a panel that is open
 * here but closed after React mounts is still indexed either way.
 */

/** Only the three characters that can change meaning inside text content. */
const escape = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

const factsHtml = (flavor) => `
      <article>
        <h3>${escape(flavor.name)}</h3>
        <p>${escape(flavor.story)}</p>
        <dl>
${factsFor(flavor)
  .map(
    (fact) =>
      `          <dt>${escape(fact.label)}</dt>\n          <dd>${escape(fact.value)}</dd>`,
  )
  .join('\n')}
        </dl>
      </article>`

/**
 * The shell. Marked with `data-static-shell` so `index.css` can keep it out of
 * the way for the moment between parse and React's first commit — a crawler does
 * not apply stylesheets, which is the whole reason this can be hidden and still
 * be read.
 */
export function renderStaticShell() {
  return `<div data-static-shell="true">
  <header>
    <h1>${escape(brand.name)}</h1>
    <p>${escape(brand.tagline)}</p>
  </header>

  <section id="about-brand">
    <h2>${escape(aboutBrandHeading)}</h2>
    <p>${escape(aboutBrandParagraph)}</p>
${flavors.map(factsHtml).join('\n')}
  </section>

  <section id="faq">
    <h2>Questions</h2>
    <dl>
${faq()
  .map(
    (entry) =>
      `      <dt>${escape(entry.question)}</dt>\n      <dd>${escape(entry.answer)}</dd>`,
  )
  .join('\n')}
    </dl>
  </section>
</div>`
}

/** Both JSON-LD blocks, ready for the head. `<` is escaped so nothing can end the tag early. */
export function renderStructuredData() {
  const blocks = [faqJsonLd(), organizationJsonLd()]
  return blocks
    .map(
      (block) =>
        `<script type="application/ld+json">${JSON.stringify(block).replace(/</g, '\\u003c')}</script>`,
    )
    .join('\n    ')
}

export { escape }
