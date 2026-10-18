import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import aiPrerender from './plugins/ai-prerender.js'

// https://vite.dev/config/
export default defineConfig({
  // `aiPrerender` writes the crawlable text into the built index.html. The site is
  // a client-rendered SPA, so without it the page source is a single empty div.
  plugins: [react(), aiPrerender()],
})
