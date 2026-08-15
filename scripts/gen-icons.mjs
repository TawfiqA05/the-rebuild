// Rasterise the icon SVGs to the PNG sizes iOS/Android actually use.
// Run locally after changing the SVGs:  node scripts/gen-icons.mjs
// Requires a local Chrome (uses playwright-core's `channel: 'chrome'`).
import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const base = readFileSync(new URL('../public/icon.svg', import.meta.url), 'utf8')
const maskable = readFileSync(new URL('../public/icon-maskable.svg', import.meta.url), 'utf8')

const jobs = [
  { svg: base, size: 180, out: 'public/apple-touch-icon.png' },
  { svg: base, size: 192, out: 'public/icon-192.png' },
  { svg: base, size: 512, out: 'public/icon-512.png' },
  { svg: maskable, size: 512, out: 'public/icon-maskable-512.png' },
  { svg: base, size: 32, out: 'public/favicon-32.png' },
]

const browser = await chromium.launch({ channel: 'chrome' })
for (const { svg, size, out } of jobs) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
  const sized = svg.replace('<svg ', `<svg width="${size}" height="${size}" `)
  await page.setContent(`<!doctype html><meta charset="utf-8"><style>html,body{margin:0;padding:0}</style>${sized}`)
  await page.screenshot({ path: out, omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } })
  await page.close()
  console.log('wrote', out, `${size}x${size}`)
}
await browser.close()
