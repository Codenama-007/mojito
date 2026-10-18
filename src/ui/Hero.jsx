import FlavorPicker from './FlavorPicker.jsx'
import { brand } from '../config/brand.js'
import { HERO_ID } from '../config/sections.js'
import './Hero.css'

export default function Hero() {
  return (
    <section id={HERO_ID} className="section hero">
      <div className="hero__content">
        <p className="hero__eyebrow">{brand.tagline}</p>
        <h1 className="hero__title">{brand.name}</h1>
        <p className="hero__lede">
          Four mojitos built in one glass. Scroll and it fills in front of you:
          ice drops in, the mint gets muddled, the fruit lands, the fizz climbs.
        </p>
        <p className="hero__hint">
          Tap a flavor to pour it, or scroll to build it a step at a time.
        </p>
      </div>

      <div className="hero__controls">
        <FlavorPicker />
      </div>
    </section>
  )
}
