import { useState } from 'react'
import './Accordion.css'

/**
 * A disclosure list, in the shape Flowbite's accordion uses.
 *
 * The markup is deliberately that component's — the same `data-accordion`
 * container, the same `<h2>` around a `<button>`, the same `data-accordion-target`
 * and `aria-controls` pair, the same chevron carrying `data-accordion-icon` — with
 * the Tailwind utility classes replaced by `.accordion__*` rules in Accordion.css,
 * which is the project's styling deviation.
 *
 * The one difference is who owns the state. Flowbite reads those data attributes
 * from a script; here React owns it, so `aria-expanded` and the panel's `hidden`
 * attribute are the source of truth and the data attributes are markers that say
 * which component this is. They are not inert decoration, though:
 * `scripts/verify-static-html.mjs` resolves every `data-accordion-target` against
 * the built HTML and fails if a button points at a panel that is not there.
 *
 * Panels toggle independently, which is Flowbite's default (`alwaysOpen: true`).
 * One at a time suits a quiz; it does not suit eight questions someone may want to
 * compare.
 *
 * Every answer is in the DOM whether or not its panel is open — collapsed means
 * `hidden`, not absent. That is what keeps the FAQ readable to a crawler that does
 * not click.
 */
export default function Accordion({ id, items, defaultOpenIndex = 0 }) {
  const [openIds, setOpenIds] = useState(
    () => new Set(defaultOpenIndex === null ? [] : [items[defaultOpenIndex]?.id]),
  )

  const toggle = (itemId) =>
    setOpenIds((current) => {
      const next = new Set(current)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })

  return (
    <div id={id} className="accordion" data-accordion="collapse">
      {items.map((item) => {
        const isOpen = openIds.has(item.id)
        const headingId = `${item.id}-heading`
        const panelId = `${item.id}-body`

        return (
          <div key={item.id} className="accordion__item">
            {/* Flowbite's markup has an `<h2>` here because the accordion is
                standalone there. Inside this page the section's own `<h2>` titles
                the group, so each question is a step below it — eight more `<h2>`s
                would tell a screen reader that the questions and their heading are
                siblings. */}
            <h3 id={headingId} className="accordion__heading">
              <button
                type="button"
                className="accordion__trigger"
                aria-expanded={isOpen}
                aria-controls={panelId}
                data-accordion-target={`#${panelId}`}
                onClick={() => toggle(item.id)}
              >
                <span className="accordion__question">{item.question}</span>

                <svg
                  className={`accordion__icon${isOpen ? ' is-open' : ''}`}
                  data-accordion-icon
                  aria-hidden="true"
                  width="24"
                  height="24"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke="currentColor"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="m5 15 7-7 7 7"
                  />
                </svg>
              </button>
            </h3>

            <div
              id={panelId}
              className="accordion__panel"
              aria-labelledby={headingId}
              hidden={!isOpen}
            >
              <p className="accordion__answer">{item.answer}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
