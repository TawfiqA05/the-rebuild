import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { readFileSync } from 'node:fs'

// The app version lives in package.json only. It reaches the app as the
// build-time constant __APP_VERSION__, so the bundle never imports package.json.
const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Vite config. Tailwind v4 runs as a Vite plugin — no separate tailwind.config.js
// or postcss.config.js needed. `base` is relative so the built app works when
// served from a subpath (useful if you later host it on GitHub Pages, etc.).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify(version) },
})
