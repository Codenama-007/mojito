import { flavors } from '../config/flavors.js'
import { useStore } from '../store/useStore.js'
import './FlavorPicker.css'

export default function FlavorPicker() {
  const activeFlavor = useStore((state) => state.activeFlavor)
  const setActiveFlavor = useStore((state) => state.setActiveFlavor)

  return (
    <nav className="picker" aria-label="Choose a flavor">
      {flavors.map((flavor) => {
        const isActive = flavor.id === activeFlavor

        return (
          <button
            key={flavor.id}
            type="button"
            className={`picker__btn${isActive ? ' is-active' : ''}`}
            style={{ '--btn-accent': flavor.accentColor }}
            aria-pressed={isActive}
            onClick={() => setActiveFlavor(flavor.id)}
          >
            {flavor.name}
          </button>
        )
      })}
    </nav>
  )
}
