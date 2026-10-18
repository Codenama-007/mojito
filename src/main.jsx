import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const container = document.getElementById('root')

/*
 * The build writes the crawlable text into #root as plain HTML (see
 * plugins/ai-prerender.js). React owns that node from here on, so the shell is
 * removed explicitly rather than left to be replaced by the first commit — two
 * copies of the same sentences in the DOM is exactly what a search engine has to
 * guess about, and guessing is not this file's job.
 *
 * If this module never runs, the shell stays where it is and stays readable.
 */
container.querySelector('[data-static-shell]')?.remove()

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
