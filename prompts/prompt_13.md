# Prompt 13

Recorded verbatim, 18 October 2026. Two prompts, one after the other.

> [the facts list and the questions, pasted back as rendered text]
>
> i think so these needed to be modified
> for the questions part use the Accordion Component
> here is the reference code for Accordion Component
>
> ```html
> <div id="accordion-collapse" data-accordion="collapse" ...>
>   <h2 id="accordion-collapse-heading-1">
>     <button type="button" ... data-accordion-target="#accordion-collapse-body-1"
>             aria-expanded="true" aria-controls="accordion-collapse-body-1">
>       <span>What is Flowbite?</span>
>       <svg data-accordion-icon class="w-5 h-5 rotate-180 shrink-0" ... />
>     </button>
>   </h2>
>   <div id="accordion-collapse-body-1" class="hidden ..." aria-labelledby="...">
>     <div class="p-4 md:p-5">...</div>
>   </div>
>   ...
> </div>
> ```
>
> it uses tailwind css but you use it in the form of vanilla css

Then:

> [the facts list and the questions, pasted back again]
>
> this part and the Accordion part
> bring it in the center of the page

## Notes taken at the time

**The reference is Flowbite's accordion.** It is built as that component — same
container attribute, same heading-around-a-button, same
`data-accordion-target`/`aria-controls` pair, same `data-accordion-icon` chevron —
with the utility classes replaced by `.accordion__*` rules, which is the project's
long-standing styling deviation. The state moved from Flowbite's script to React.

**Collapsed must not mean absent.** The one requirement that survives translation
from the reference is that the closed panels are `hidden`, not missing. The whole
of Phase 9B is that a crawler can read this page, and a FAQ that keeps seven
answers out of the DOM until somebody clicks would undo it one component at a
time. This is also why the accordion is not a `<details>` element.

**Four deliberate departures from the reference**, all recorded in the README:

- `<h3>` instead of `<h2>`, because the section's own `<h2>` already titles the
  group.
- the chevron rotates with its panel; the reference has `rotate-180` on the icon
  whether the row is open or closed.
- the `hidden` *attribute* rather than a `hidden` class, so the state cannot drift
  from `aria-expanded`.
- panels toggle independently, which is Flowbite's own default.

**"Center of the page" was one question with three answers.** The facts and the FAQ
sat low and against the left edge, and the glass is centred above them, so
"centre" could have meant the column, the column and the vertical position, or the
text alignment inside it. Asked rather than guessed, because two of the three would
have put paragraphs on top of the glass. Answered: **centred as a column** — so
`margin-inline: auto`, text inside still left-aligned, glass left where it is.
