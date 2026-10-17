/**
 * Contact details and brand name.
 *
 * THESE ARE PLACEHOLDERS. Every value below renders on the page in the contact
 * section, so nothing invented can ship without being obvious on screen.
 * Replace each TODO_ with the real value.
 */

export const brand = {
  name: 'TODO_BRAND_NAME',
  tagline: 'Mojitos, muddled to order.',
  phone: 'TODO_PHONE',
  email: 'TODO_EMAIL',
  address: 'TODO_ADDRESS',
  instagram: 'TODO_INSTAGRAM',
  orderUrl: 'TODO_ORDER_URL',
}

/** True while any placeholder is still in place. Drives a visible warning. */
export const hasPlaceholderDetails = Object.values(brand).some(
  (value) => typeof value === 'string' && value.startsWith('TODO_'),
)
