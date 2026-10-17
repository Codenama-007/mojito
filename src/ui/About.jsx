import { ABOUT_ID } from '../config/sections.js'
import './About.css'

export default function About() {
  return (
    <section id={ABOUT_ID} className="section section--bottom about">
      <div className="section__content">
        <h2 className="about__title">Muddled to order.</h2>
        <p className="about__body">
          Ice first. Mint pressed against the glass. Fruit dropped in, soda
          poured last. Four flavors, no syrups, nothing from a pump.
        </p>
        <p className="about__body">
          Built one glass at a time, the way you would at home if you had the
          time.
        </p>
      </div>
    </section>
  )
}
