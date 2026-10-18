# Prompt 10

Recorded verbatim, 18 October 2026.

> while viewing navbar in the mobile the bg appears to plain white and no button to close it
> so do one thing is that keep it transparent blur and a close button to close the navbar

Followed later in the session by:

> also make sure to fix the navbar

## Notes taken at the time

Both halves were real and both had one cause each.

**"Plain white."** The overlay's background was `rgba(255, 255, 255, 0.9)` behind a
18 px blur — a near-opaque white sheet, which is what a 90% white veil over a bright
flavor base looks like. It is now a 16% white veil with a 26 px blur, so the canvas
and the fruit field stay visible behind the menu. Contrast is not a gamble: the ink
is near-black and all four flavor base colours are bright. A browser without
`backdrop-filter` gets a near-opaque sheet back through `@supports`, because a 16%
veil with no blur is a legibility gamble.

**"No button to close it."** The hamburger is z-index 3 and the overlay is z-index 4,
so opening the menu covered the only control that could close it. Escape worked, and
so did tapping a link, which is presumably how the menu was ever closed. The overlay
now has its own close button at the same 44 px corner the hamburger occupies, so the
hamburger appears to turn into an X in place. The bar underneath is `inert` while the
overlay is up, so the hidden logo and toggle cannot be reached by Tab.

The repeated nudge is recorded because it is fair: the fix landed in the same edits
as several other things, and until it was called out a second time it was not clear
whether it had been done.
