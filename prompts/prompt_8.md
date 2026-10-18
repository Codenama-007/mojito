# Prompt 8

Recorded verbatim, 18 October 2026.

> the limes background disappears and the other fruits havent yet got their backgrounds

## Notes taken at the time

This is the *second* report of the same thing, and it is the more useful one,
because it reports a change: lime's fruit used to be there and now it is not.

It was not the transition. **The fruit field had never rendered at all, on any
flavor, in `pnpm dev`.** The cause was in `fruitFieldScene.js`:

```js
dispose() {
  for (const { mesh, material, geometry } of fields) {
    group.remove(mesh)   // <-- this line
    ...
  }
}
```

The field's meshes are created imperatively and handed to React through
`<primitive object={group} />`. React runs an effect, its cleanup, and the effect
again on every mount in development, so that cleanup fired moments after the field
appeared and detached both meshes from a group that then stayed mounted and empty.
No error, no warning, no visual difference in a production build — where StrictMode
does not double-invoke, which is exactly why it survived a build, a lint and five
verification suites.

Every other instanced component here (`Ice`, `Mint`, `Bubbles`, `Shatter`) disposes
**only GPU resources** and lets React own the scene graph, which is why they work.
The field now does the same, and `verify-fruit-field.mjs` builds a whole field
without a renderer and asserts that disposing it leaves the children attached — the
one check that would have caught this.

That also revises the reading of prompt 7. `prompt_7.md` assumed the per-flavor
swap must be at fault because lime "worked". It did not work: what was visible at
the lime section was the solid lime-green base colour, and the assumption that the
field was fine on one flavor sent the search to the swap state machine instead of
to whether the field drew anything at all. The lesson is recorded rather than
quietly fixed: the first question about a field that is not on screen is whether it
is drawing, not whether it is drawing the wrong thing.
