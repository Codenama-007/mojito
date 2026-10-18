# Prompt 9

Recorded verbatim, 18 October 2026.

> for brand name add Affan's Mojito and add a bit detalied content in the hero section and other fruits section as well for phone number take this 9322437454 for email take affanjavedshah@gmail.com and for instagram just make it direct their

## Notes taken at the time

Three things: the brand name, more copy in the hero and the flavor sections, and
the contact details.

The Instagram half is not actionable as written — "just make it direct their" says
to link to the owner's profile, but no handle is in the message, and the previous
value was `TODO_INSTAGRAM`. Inventing a handle would have shipped a link to somebody
else's account, so it was asked about rather than guessed.

Also decided, because they were needed and not supplied:

- **The address.** Not given, and it was a `TODO_ADDRESS` placeholder. Made empty
  and hidden, so no invented address ships.
- **"Order now".** Previously pointed at `TODO_ORDER_URL`. The phone number is the
  only channel we have.
- **The `TODO_` warning.** The contact section used to render an on-screen warning
  while any placeholder remained. With the real values in, the placeholders are gone
  and so is the warning — replaced by `scripts/verify-brand.mjs`, which asserts a
  field is either empty or real and presentable. A warning that renders on the page
  was a strange way to protect against shipping a placeholder; a test is not.
