/**
 * Brand name and contact details.
 *
 * Real values, supplied by the owner. Two fields are deliberately empty: no
 * Instagram handle and no address were given, so the contact section renders
 * neither rather than shipping a dead link or an invented address. Add them here
 * and the rows appear; nothing else needs changing.
 *
 * `scripts/verify-brand.mjs` asserts that whatever is set is presentable — that
 * the phone number is dialable, the email well-formed, and no `TODO_` placeholder
 * ever reaches the page again.
 */

export const brand = {
  name: "Affan's Mojito",
  tagline: 'Mojitos, muddled to order.',
  phone: '9322437454',
  email: 'affanjavedshah@gmail.com',

  /** Empty: no handle was supplied, so the row is not rendered. */
  instagram: '',

  /** Empty: no address was supplied, so the row is not rendered. */
  address: '',
}

/**
 * The dialer and mail links, built in one place so the label and the link cannot
 * drift apart. `tel:` takes the number as dialled — no spaces, no punctuation.
 */
export const telHref = `tel:${brand.phone.replace(/[^\d+]/g, '')}`
export const mailHref = `mailto:${brand.email}`
