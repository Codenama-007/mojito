import { brand, mailHref, telHref } from '../config/brand.js'
import { defaultFlavor } from '../config/flavors.js'
import { CONTACT_ID } from '../config/sections.js'
import { useStore } from '../store/useStore.js'
import './Contact.css'

/** A handle or a full URL becomes a link to the profile either way. */
const instagramHref = (handle) =>
  /^https?:\/\//i.test(handle)
    ? handle
    : `https://instagram.com/${handle.replace(/^@/, '')}`

export default function Contact() {
  // A primitive selector, so this re-renders once at the crossing rather than
  // on every scroll frame.
  const revealed = useStore((state) => state.breakProgress > 0.6)

  /**
   * Only the details there actually are.
   *
   * An empty string in config/brand.js means "not supplied", and the row is
   * dropped rather than rendered blank or filled with a placeholder — one place
   * to say a thing is missing, and no second flag to keep in step with it.
   */
  const details = [
    { label: 'Phone', value: brand.phone, href: telHref },
    { label: 'Email', value: brand.email, href: mailHref },
    { label: 'Address', value: brand.address },
    { label: 'Instagram', value: brand.instagram, href: instagramHref(brand.instagram) },
  ].filter((detail) => detail.value)

  return (
    <section
      id={CONTACT_ID}
      className="section section--bottom contact"
      style={{ '--flavor-accent': defaultFlavor.accentColor }}
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

          {/* Orders are taken on the phone, so the button dials. The label says
              what it is rather than what we hope: tapping it opens the dialer. */}
          <a className="contact__order" href={telHref}>
            Order now
          </a>
        </div>
      </div>
    </section>
  )
}
