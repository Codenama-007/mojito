import { FAQ_ID } from '../config/sections.js'
import { faq } from '../config/siteContent.js'
import './Faq.css'

/**
 * The FAQ, as real HTML rather than an accordion.
 *
 * A `<details>` element per question would be tidier and would still be in the
 * page source, but it would also put eight tap targets in the way of the answers,
 * and AGENTS.md is explicit that scroll drives everything and no tap is required.
 * A definition list needs no JavaScript, reads in order, and is the shape the
 * `FAQPage` markup mirrors.
 */
export default function Faq() {
  return (
    <section id={FAQ_ID} className="section section--bottom faq">
      <div className="section__content faq__content">
        <h2 className="faq__title">Questions</h2>

        <dl className="faq__list">
          {faq().map((entry) => (
            <div key={entry.question} className="faq__row">
              <dt className="faq__question">{entry.question}</dt>
              <dd className="faq__answer">{entry.answer}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}
