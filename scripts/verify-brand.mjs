import { brand, mailHref, telHref } from '../src/config/brand.js'
import { flavors } from '../src/config/flavors.js'

/**
 * The words on the page, checked.
 *
 * Nothing here is a rendering concern, which is exactly why it needs a test:
 * brand.js shipped `TODO_PHONE` for five phases and the only thing that caught
 * it was a warning rendered inside the contact section. A placeholder that
 * reaches a live page is worse than a missing one — it is a broken `tel:` link
 * and an address nobody owns — so the rule is stated here instead: either a
 * field is empty, or it is real and presentable.
 *
 * The copy checks are next to them because they fail in the same way. A story
 * that is blank, or a paragraph of lorem ipsum, or four flavors whose paragraphs
 * are the same sentence, all look fine to a build and to a lint.
 */

const failures = []
const check = (name, ok, detail = '') => {
  if (ok) {
    console.log(`  PASS  ${name}${detail ? ` (${detail})` : ''}`)
  } else {
    console.log(`  FAIL  ${name}${detail ? ` (${detail})` : ''}`)
    failures.push(name)
  }
}

const PLACEHOLDER = /TODO_/i
const LOREM = /lorem ipsum|dolor sit amet/i

// ------------------------------------------------------------ the brand details

check(
  'the brand has a name, and it is not a placeholder',
  Boolean(brand.name) && !PLACEHOLDER.test(brand.name) && brand.name.length <= 40,
  `"${brand.name}", ${brand.name.length} of 40 characters`,
)
check(
  'the tagline is present and not a placeholder',
  Boolean(brand.tagline) && !PLACEHOLDER.test(brand.tagline),
  `"${brand.tagline}"`,
)

check(
  'the phone number is long enough to dial, and has no letters in it',
  /^\+?\d{10,15}$/.test(brand.phone),
  `${brand.phone.replace(/\d/g, '#')} — 10 to 15 digits`,
)
check(
  'the email is well-formed',
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(brand.email),
  brand.email.replace(/^[^@]+/, '...'),
)

/**
 * The two links are built from the labels rather than typed twice, which is the
 * point of them living in brand.js. A `tel:` with a space in it is silently not
 * a link on some dialers, so its shape is asserted rather than assumed.
 */
check(
  'the dial link is a bare tel: number',
  telHref === `tel:${brand.phone.replace(/[^\d+]/g, '')}` && /^tel:\+?\d+$/.test(telHref),
  telHref.replace(/\d/g, '#'),
)
check(
  'the mail link is a bare mailto: address',
  mailHref === `mailto:${brand.email}` && !/[\s]/.test(mailHref),
  mailHref.replace(/^mailto:.{0,3}/, 'mailto:...'),
)

/**
 * Empty is a supported answer and the contact section hides the row. What is not
 * supported is a half-supplied field: whitespace, or a leftover placeholder.
 */
for (const field of ['instagram', 'address']) {
  const value = brand[field]
  check(
    `${field} is either empty or real`,
    value === '' || (!PLACEHOLDER.test(value) && value.trim() === value && value.length > 2),
    value === '' ? 'not supplied, so the row is hidden' : `"${value}"`,
  )
}

check(
  'nothing in brand.js is still a TODO_ placeholder',
  Object.values(brand).every((value) => !PLACEHOLDER.test(String(value))),
  'every field is either real or deliberately empty',
)

// ------------------------------------------------------------- the flavor copy

check(
  'every flavor has a tagline and a story, and none of them are placeholders',
  flavors.every(
    (flavor) =>
      Boolean(flavor.tagline) &&
      Boolean(flavor.story) &&
      !PLACEHOLDER.test(flavor.tagline) &&
      !PLACEHOLDER.test(flavor.story),
  ),
  `${flavors.length} flavors`,
)

check(
  'no flavor copy is lorem ipsum or a repeat of its own tagline',
  flavors.every(
    (flavor) =>
      !LOREM.test(flavor.story) &&
      !LOREM.test(flavor.tagline) &&
      !flavor.story.includes(flavor.tagline) &&
      !flavor.tagline.includes(flavor.story),
  ),
  'nothing generated, nothing padded',
)

/**
 * Two sentences, of one length a mobile paragraph can hold without pushing the
 * chips off the bottom of a 640 px screen. The section reads name, hook, detail,
 * chips, and each step is allowed a fixed share of the height.
 */
for (const flavor of flavors) {
  const sentences = flavor.story.split('.').filter((part) => part.trim()).length
  check(
    `${flavor.id}: the story is two sentences and fits its space`,
    sentences === 2 && flavor.story.length >= 90 && flavor.story.length <= 220,
    `${sentences} sentences, ${flavor.story.length} characters`,
  )
}

check(
  'the four stories are four different stories',
  new Set(flavors.map((flavor) => flavor.story)).size === flavors.length,
  `${new Set(flavors.map((flavor) => flavor.story)).size} distinct paragraphs`,
)

check(
  'every flavor still has all three chips filled in',
  flavors.every(
    (flavor) =>
      flavor.properties.length === 3 &&
      flavor.properties.every((property) => property.label && property.value),
  ),
  'label and value on each',
)

if (failures.length) {
  console.log(`\nFAIL: ${failures.join(' | ')}`)
  process.exit(1)
}

console.log(
  `\nPASS: all checks green (${Object.keys(brand).length} brand fields, ` +
    `${flavors.length} flavors of copy)`,
)
