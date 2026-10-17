import FlavorPicker from './FlavorPicker.jsx'
import { brand } from '../config/brand.js'
import { HERO_ID } from '../config/sections.js'
import './Hero.css'

export default function Hero() {
  return (
    <section id={HERO_ID} className="section hero">
      <div className="hero__content">
        <p className="hero__eyebrow">{brand.tagline}</p>
        <h1 className="hero__title">Pour it with your thumb.</h1>
        <p className="hero__lede">
          Four flavors, one glass. Scroll down and watch it build.
        </p>
      </div>

      <div className="hero__controls">
        <FlavorPicker />
      </div>
    </section>
  )
}
