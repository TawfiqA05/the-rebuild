import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Vite config. Tailwind v4 runs as a Vite plugin — no separate tailwind.config.js
// or postcss.config.js needed. `base` is relative so the built app works when
// served from a subpath (useful if you later host it on GitHub Pages, etc.).
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
