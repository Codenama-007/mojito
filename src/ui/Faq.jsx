import { FAQ_ID } from '../config/sections.js'
import { faq } from '../config/siteContent.js'
import Accordion from './Accordion.jsx'
import './Faq.css'

/**
 * The FAQ: eight questions and eight direct answers, disclosed one panel at a
 * time.
 *
 * This was a definition list until the owner asked for an accordion. The reason it
 * matters that it is a *disclosure* and not a `<details>` element or a
 * click-to-reveal is in Accordion.jsx: collapsed is the `hidden` attribute, so
 * every answer is still in the page source whether or not anyone opens it. A
 * crawler reads all eight; a thumb opens one.
 *
 * Ids are derived from the position rather than random, so they are stable across
 * renders and legible in the page source: `faq-1-heading`, `faq-1-body`, and so on.
 */
export default function Faq() {
  const items = faq().map((entry, index) => ({
    id: `faq-${index + 1}`,
    question: entry.question,
    answer: entry.answer,
  }))

  return (
    <section id={FAQ_ID} className="section section--bottom faq">
      <div className="section__content faq__content">
        <h2 className="faq__title">Questions</h2>

        <Accordion id="faq-accordion" items={items} />
      </div>
    </section>
  )
}
