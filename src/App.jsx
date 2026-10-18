import Backdrop from './ui/Backdrop.jsx'
import Navbar from './ui/Navbar.jsx'
import Hero from './ui/Hero.jsx'
import FlavorSection from './ui/FlavorSection.jsx'
import About from './ui/About.jsx'
import BrandFacts from './ui/BrandFacts.jsx'
import Faq from './ui/Faq.jsx'
import Contact from './ui/Contact.jsx'
import Loader from './ui/Loader.jsx'
import Scene from './three/Scene.jsx'
import { flavors, getFlavor } from './config/flavors.js'
import { CONTACT_ID } from './config/sections.js'
import { useStore } from './store/useStore.js'
import { useLenis } from './hooks/useLenis.js'
import { useScrollProgress } from './hooks/useScrollProgress.js'

export default function App() {
  const activeFlavor = useStore((state) => state.activeFlavor)
  const atContact = useStore((state) => state.activeSection === CONTACT_ID)
  const flavor = getFlavor(activeFlavor)

  useLenis()
  useScrollProgress()

  return (
    // `app--shaded` flips the ink tokens, because the shatter darkens the page
    // out from under them (Backdrop.css). It is a class rather than a style
    // write per frame, so the scroll loop still touches nothing in the DOM.
    <div
      className={`app${atContact ? ' app--shaded' : ''}`}
      style={{ '--flavor-accent': flavor.accentColor }}
    >
      <Backdrop />

      <Scene />
      <Navbar />

      <main className="page">
        <Hero />

        {flavors.map((flavorItem, index) => (
          <FlavorSection
            key={flavorItem.id}
            flavor={flavorItem}
            index={index + 1}
          />
        ))}

        <About />

        {/*
          The two sections that exist for machines as much as for people. They sit
          last, after the mood piece and next to the order button, because that is
          where someone who has decided they are interested looks for the
          specifics — and because the build writes the same two sections into
          index.html, so it helps to have them in one place.
        */}
        <BrandFacts />
        <Faq />

        <Contact />
      </main>

      {/* Retires the loader in index.html, and renders nothing itself. */}
      <Loader />
    </div>
  )
}
