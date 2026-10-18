import { brand, mailHref, telHref } from './brand.js'
import { flavors } from './flavors.js'

/**
 * Everything an AI crawler or a search engine should be able to read, in one
 * place, as plain data.
 *
 * This module exists because the same words have to reach three places at once:
 * the React sections a person scrolls past, the static HTML the build writes into
 * `index.html` (so the text is in the page source without running JavaScript), and
 * the `FAQPage` structured data. Writing it a second time into any of them is how
 * a page ends up with an answer that disagrees with its own markup — and Google
 * treats FAQ markup that does not match the visible answer as a violation, not a
 * cosmetic problem.
 *
 * So: no JSX in here, no imports outside `config/`, and every consumer reads it.
 * The `faq` and `*JsonLd` exports are functions rather than constants only so the
 * phone number and the flavor list cannot be captured stale.
 */

/** A flavor's own chip text, e.g. its Ingredients line. */
const chip = (flavor, label) =>
  flavor.properties.find((property) => property.label === label)?.value ?? ''

export const aboutBrandHeading = `What is ${brand.name}?`

export const aboutBrandParagraph = [
  `${brand.name} is a small mojito brand. Every drink is built one glass at a time — ice, mint pressed against the glass, fruit dropped in, soda poured last — in four flavors: lime, strawberry, apple and mango.`,
  'Nothing comes from a syrup pump and nothing is pre-mixed. Orders are taken on the phone.',
].join(' ')

/**
 * The price, or what to do instead. See `config/brand.js`: an empty price is a
 * decision, not an omission.
 */
export const priceLabel = brand.serving.price || `Call to order — ${brand.phone}`

/**
 * The six facts the brief asks for, per flavor, in a fixed reading order.
 *
 * Five of the six are derived — ingredients and calories from the flavor's own
 * chips, size, shelf life and alcohol from the brand's shared serving facts — so
 * no figure on this page can disagree with the same figure elsewhere on it.
 */
export const factsFor = (flavor) => [
  {
    label: 'Ingredients',
    value: `${chip(flavor, 'Ingredients')}, ${brand.serving.baseIngredients}`,
  },
  { label: 'Size', value: brand.serving.size },
  { label: 'Price', value: priceLabel },
  { label: 'Calories', value: chip(flavor, 'Calories') },
  { label: 'Shelf life', value: brand.serving.shelfLife },
  { label: 'Alcoholic', value: brand.serving.alcohol },
]

const flavorNames = flavors.map((flavor) => flavor.name.toLowerCase())

/**
 * Eight real questions with short, direct answers.
 *
 * Every answer is either a fact already on this page, or a fact from
 * `config/brand.js`. Nothing here is invented, which is the point: an FAQ is the
 * most-quoted part of a page, and an assistant that lifts a wrong price from it
 * has no way to know it was made up. Where the brand has not published something,
 * the answer says so and gives the phone number.
 */
export const faq = () => [
  {
    question: `What is ${brand.name}?`,
    answer: `${brand.name} is a small mojito brand. One glass, four flavors — ${flavorNames.join(', ').replace(/, ([^,]*)$/, ' and $1')} — each muddled to order.`,
  },
  {
    question: 'Which flavors do you make?',
    answer: `Four: ${flavors.map((flavor) => flavor.name).join(', ')}.`,
  },
  {
    question: 'Is it alcoholic?',
    answer: `${brand.serving.alcohol}. Every flavor is built on a mojito base of ${brand.serving.baseIngredients.replace(', soda', '')}, mint, lime, cane sugar and soda.`,
  },
  {
    question: 'How big is one drink?',
    answer: `${brand.serving.size}.`,
  },
  {
    question: 'How much does it cost?',
    answer: `Prices are not published here. Call ${brand.phone} and we will quote you.`,
  },
  {
    question: 'How do I place an order?',
    answer: `Call ${brand.phone}. Orders are taken on the phone.`,
  },
  {
    question: 'How long does it keep?',
    answer: `${brand.serving.shelfLife}. It is not meant to sit in a fridge.`,
  },
  {
    question: 'What is in it?',
    answer: `A mojito base of ${brand.serving.baseIngredients}, mint, lime and cane sugar, plus the fruit the flavor is named for. Each flavor's full ingredient list is in the Facts above.`,
  },
]

/** The FAQ as `FAQPage` structured data, from the same strings as the page. */
export const faqJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faq().map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  })),
})

/** Who the brand is, for a crawler with no JavaScript and no eyes. */
export const organizationJsonLd = () => ({
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: brand.name,
  slogan: brand.tagline,
  ...(brand.email ? { email: brand.email } : {}),
  ...(brand.phone ? { telephone: brand.phone } : {}),
  ...(brand.instagram ? { sameAs: [`https://instagram.com/${brand.instagram.replace(/^@/, '')}`] } : {}),
})

/** A mail link is part of the "what is this" story; the phone is the order path. */
export const contactLinks = { telHref, mailHref }

/**
 * The `<title>` and the description, built from the same config as everything
 * else so a change to the brand name or the phone number lands in the head of
 * the document too. `plugins/ai-prerender.js` is what writes them in; the repo's
 * index.html carries a neutral placeholder.
 */
export const metaTitle = `${brand.name} — ${brand.tagline}`

export const metaDescription = `${brand.name}: four mojitos — ${flavorNames.join(', ')} — muddled to order with ${brand.serving.baseIngredients}. Call ${brand.phone}.`
