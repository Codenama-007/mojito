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

  /**
   * The public origin, no trailing slash. Empty until the site has a domain:
   * the build falls back to Vercel's own `VERCEL_PROJECT_PRODUCTION_URL`, and
   * when neither is available the crawler files use paths instead of absolute
   * URLs and say so. One line here makes robots.txt, the sitemap, llms.txt and
   * the JSON-LD absolute.
   */
  siteUrl: '',

  /**
   * The facts that are the same for every flavor. These are the owner's answers,
   * not measurements: `size`, `shelfLife` and `alcohol` were supplied as defaults
   * and should be corrected if they are wrong, because everything below is
   * published to crawlers verbatim (config/siteContent.js).
   *
   * `price` is deliberately empty and stays that way. An invented price would be
   * repeated by every AI assistant that reads the page, which is the one factual
   * error this kind of content makes expensive — so an empty price renders as
   * "call to order" instead.
   */
  serving: {
    baseIngredients: 'white rum, soda',
    size: '300 ml — one glass',
    price: '',
    shelfLife: 'Made to order, so drink it fresh',
    alcohol: 'Yes — made with white rum',
  },
}

/**
 * The dialer and mail links, built in one place so the label and the link cannot
 * drift apart. `tel:` takes the number as dialled — no spaces, no punctuation.
 */
export const telHref = `tel:${brand.phone.replace(/[^\d+]/g, '')}`
export const mailHref = `mailto:${brand.email}`
