import { useEffect } from 'react'
import { useStore } from '../store/useStore.js'

/**
 * Takes down the loader that `index.html` puts on screen.
 *
 * It renders nothing, and that is the point. The loader has to be visible in the
 * half second before any of this JavaScript has parsed, so it cannot be rendered
 * by React — it belongs to the document. What React knows and the document does
 * not is *when* the scene is worth showing, so this component's whole job is to
 * wait for that and then retire the node.
 *
 * What "worth showing" means is the environment map being in: the cup's material
 * is built around image-based lighting, so arriving before it means arriving
 * unlit and then brightening a second later. `three/Scene.jsx` reports that from
 * inside the boundary the map loads in.
 */

/** Long enough to cover the fade in index.html, plus a frame. */
const FADE_MS = 480

/**
 * The way out when the scene never reports ready at all — an environment map that
 * 404s, a GPU that will not build a context. A page that is merely unlit is worth
 * more than a page nobody can reach.
 */
const GIVE_UP_MS = 10000

export default function Loader() {
  const booting = useStore((state) => state.booting)

  useEffect(() => {
    const loader = document.querySelector('[data-loader]')
    if (!loader) return

    if (booting) {
      const giveUp = setTimeout(() => useStore.getState().setBooting(false), GIVE_UP_MS)
      return () => clearTimeout(giveUp)
    }

    if (loader.classList.contains('is-done')) return

    loader.classList.add('is-done')

    /*
     * Out of the document once it has faded, so nothing is left sitting over the
     * page. Timed rather than waiting on `transitionend`, which never fires when
     * the visitor has asked for reduced motion and the transition is off.
     */
    const remove = setTimeout(() => loader.remove(), FADE_MS + 120)

    return () => clearTimeout(remove)
  }, [booting])

  return null
}
