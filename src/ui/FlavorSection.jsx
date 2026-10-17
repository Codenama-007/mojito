import { GLASS_TARGETS, flavorSectionId } from '../config/sections.js'
import './FlavorSection.css'

export default function FlavorSection({ flavor, index }) {
  const id = flavorSectionId(flavor.id)

  // Text sits opposite the glass, read from the same config the 3D scene uses.
  const target = GLASS_TARGETS[id]
  const textOnRight = (target?.desktop.x ?? 0) < 0

  return (
    <section
      id={id}
      className="section flavor"
      style={{ '--flavor-accent': flavor.accentColor }}
    >
      <div
        className={`section__content flavor__content${
          textOnRight ? ' is-right' : ''
        }`}
      >
        <p className="flavor__index">{String(index).padStart(2, '0')}</p>
        <h2 className="flavor__name">{flavor.name}</h2>
        <p className="flavor__tagline">{flavor.tagline}</p>

        <ul className="flavor__chips">
          {flavor.properties.map((property) => (
            <li key={property.label} className="chip">
              <span className="chip__label">{property.label}</span>
              <span className="chip__value">{property.value}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
