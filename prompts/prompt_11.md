# Prompt 11

Recorded verbatim, 18 October 2026.

> the glass is rotating i want the glass to revolve 360 degree

Followed by:

> go ahead

## Notes taken at the time

The code already added exactly one whole turn (`2 pi`) to the cup's yaw on every
flavor change, so read literally the request was already implemented — which means
something else was being described. Put to the owner as a choice, and answered:
**one full turn per scroll section**, in addition to tapping the picker.

So the requirement was never a missing turn, it was an unreadable one. Two reasons
a whole turn could go unnoticed, both addressed:

1. **The ease.** It was cubic *out* — 70% of the revolution inside the first third of
   the duration. A glass is very nearly a solid of revolution, so a turn that fast
   reads as a snap, not a rotation. It is now cubic in and out at 1.35 s, which is
   also longer than the 0.8 s background push, so the cup settles after its backdrop.
2. **The shape.** Nothing about the fix changes the cup's near-symmetry, and nothing
   should: the straw, the mint and the fruit are what make a turn legible. Worth
   remembering before treating "the cup is symmetric" as a bug to fix with geometry.

"A full turn per section" is behaviour the architecture already gave for free: both
a picker tap and a scroll into a flavor section land in `activeFlavor`, so there is
one spin rule rather than one per input. Re-entering the section you are already in
does not re-spin, because the flavor has not changed.
