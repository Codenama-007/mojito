import { brand, hasPlaceholderDetails } from '../config/brand.js'
import { CONTACT_ID } from '../config/sections.js'
import { useStore } from '../store/useStore.js'
import './Contact.css'

export default function Contact() {
  // A primitive selector, so this re-renders once at the crossing rather than
  // on every scroll frame.
  const revealed = useStore((state) => state.breakProgress > 0.6)

  const details = [
    { label: 'Phone', value: brand.phone, href: `tel:${brand.phone}` },
    { label: 'Email', value: brand.email, href: `mailto:${brand.email}` },
    { label: 'Address', value: brand.address, href: null },
    { label: 'Instagram', value: brand.instagram, href: brand.orderUrl },
  ]

  return (
    <section
      id={CONTACT_ID}
      className="section section--bottom contact"
      style={{ '--flavor-accent': brand.instagram }}
    >
      <div className="section__content contact__content">
        <h2 className="contact__title">Come find us.</h2>

        <div
          className={`contact__details${revealed ? ' is-revealed' : ''}`}
          aria-hidden={!revealed}
        >
          <dl className="contact__list">
            {details.map((detail) => (
              <div key={detail.label} className="contact__row">
                <dt>{detail.label}</dt>
                <dd>
                  {detail.href ? (
                    <a href={detail.href}>{detail.value}</a>
                  ) : (
                    detail.value
                  )}
                </dd>
              </div>
            ))}
          </dl>

          <a className="contact__order" href={brand.orderUrl}>
            Order now
          </a>

          {hasPlaceholderDetails && (
            <p className="contact__warning">
              Placeholder details. Fill in <code>src/config/brand.js</code>.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
