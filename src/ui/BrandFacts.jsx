import { flavors } from '../config/flavors.js'
import { FACTS_ID } from '../config/sections.js'
import {
  aboutBrandHeading,
  aboutBrandParagraph,
  factsFor,
} from '../config/siteContent.js'
import './BrandFacts.css'

/**
 * The section an AI crawler is meant to land on: what this brand is, in plain
 * sentences, then the same six facts for every flavor.
 *
 * Every string comes from `config/siteContent.js`, which is also what the build
 * writes into `index.html` and what the JSON-LD is generated from. Nothing here
 * is typed twice, so the page a person reads cannot drift from the page a crawler
 * reads.
 */
export default function BrandFacts() {
  return (
    <section id={FACTS_ID} className="section section--bottom facts">
      <div className="section__content facts__content">
        <h2 className="facts__title">{aboutBrandHeading}</h2>
        <p className="facts__intro">{aboutBrandParagraph}</p>

        <div className="facts__grid">
          {flavors.map((flavor) => (
            <article
              key={flavor.id}
              className="facts__card"
              style={{ '--flavor-accent': flavor.accentColor }}
            >
              <h3 className="facts__name">{flavor.name}</h3>

              <dl className="facts__list">
                {factsFor(flavor).map((fact) => (
                  <div key={fact.label} className="facts__row">
                    <dt>{fact.label}</dt>
                    <dd>{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
