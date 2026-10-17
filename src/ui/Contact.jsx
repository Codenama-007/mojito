import { CONTACT_ID } from '../config/sections.js'
import './Contact.css'

export default function Contact() {
  return (
    <section id={CONTACT_ID} className="section section--bottom contact">
      <div className="section__content contact__content">
        <h2 className="contact__title">Come find us.</h2>
        <p className="contact__placeholder">
          Phone, email, address and Instagram land here next.
        </p>
      </div>
    </section>
  )
}
