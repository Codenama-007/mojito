import Backdrop from './ui/Backdrop.jsx'
import Navbar from './ui/Navbar.jsx'
import Hero from './ui/Hero.jsx'
import FlavorSection from './ui/FlavorSection.jsx'
import About from './ui/About.jsx'
import Contact from './ui/Contact.jsx'
import Scene from './three/Scene.jsx'
import { flavors, getFlavor } from './config/flavors.js'
import { useStore } from './store/useStore.js'
import { useLenis } from './hooks/useLenis.js'
import { useScrollProgress } from './hooks/useScrollProgress.js'

export default function App() {
  const activeFlavor = useStore((state) => state.activeFlavor)
  const flavor = getFlavor(activeFlavor)

  useLenis()
  useScrollProgress()

  return (
    <div className="app" style={{ '--flavor-accent': flavor.accentColor }}>
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
        <Contact />
      </main>
    </div>
  )
}
