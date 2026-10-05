// ---------------------------------------------------------------------------
// readme-shots.mjs — retake the README screenshots from a local build.
//
// Builds the app, serves it, and drives a headless phone (390x844 at 3x, so
// the files come out 1170x2532) through made-up data: the built-in habits with
// a month of logs, a good day today, and a prayer location in Chicago. The
// clock is pinned and the prayer-times service is stubbed with believable
// times, so every run draws the same screens. Web fonts load from Google Fonts
// like they do in the real app; every other outside request is blocked.
//
// Writes screenshots/today-ivory.png, today-arabic.png, today-charcoal.png
// and stats-ivory.png.
//
// Run:  node scripts/readme-shots.mjs            (writes into screenshots/)
//       node scripts/readme-shots.mjs --out DIR  (writes somewhere else)
// ---------------------------------------------------------------------------

import { build, preview } from 'vite'
import { chromium } from 'playwright'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import en from '../src/lib/i18n/en.js'
import ar from '../src/lib/i18n/ar.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outArg = process.argv.indexOf('--out')
const outDir = outArg > 0 ? resolve(process.argv[outArg + 1]) : resolve(root, 'screenshots')
mkdirSync(outDir, { recursive: true })

const STORAGE_KEY = 'the-rebuild:v1'
const TODAY = '2026-10-05'
const PINNED = new Date('2026-10-05T21:12:00-05:00') // Monday night, after Isha
const LOCATION = { mode: 'address', label: 'Chicago, IL', address: 'Chicago, IL', lat: null, lng: null }

// Believable early-October Chicago times (ISNA), drifting day to day.
function stubMonth(url) {
  const m = /\/v1\/calendar(?:ByAddress)?\/(\d{4})\/(\d{1,2})/.exec(url)
  if (!m) return { code: 400, data: [] }
  const [y, mo] = [Number(m[1]), Number(m[2])]
  const base = { Fajr: [5, 34, 1.1], Sunrise: [6, 51, 1.2], Dhuhr: [12, 43, -0.3], Asr: [16, 3, -1.4], Maghrib: [18, 35, -1.7], Isha: [19, 49, -1.6] }
  const p = (n) => String(n).padStart(2, '0')
  const data = []
  for (let d = 1; d <= new Date(y, mo, 0).getDate(); d++) {
    const timings = {}
    for (const [k, [h, min, drift]] of Object.entries(base)) {
      const t = h * 60 + min + Math.round(drift * (d - 1))
      timings[k] = `${p(Math.floor(t / 60))}:${p(t % 60)} (CDT)`
    }
    data.push({ timings, date: { gregorian: { date: `${p(d)}-${p(mo)}-${y}` } } })
  }
  return { code: 200, status: 'OK', data }
}

function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10)
}

// About four months of mostly-kept Phase 1 habits, with the odd single miss.
// The last two days are fully logged, so Today shows neither the "don't miss
// twice" banner nor the restart card.
function sampleSave({ language, theme }) {
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
  const logs = {}
  for (let i = 1; i <= 120; i++) {
    const day = addDays(TODAY, -i)
    const recent = i <= 2
    const l = {}
    const prayed = recent || rnd() < 0.94 ? prayers : prayers.slice(0, 4)
    l.salah = Object.fromEntries(prayed.map((p) => [p, rnd() < 0.95 ? 'ontime' : 'late']))
    if (recent || rnd() < 0.9) l.sleep = { status: rnd() < 0.8 ? 'full' : 'min' }
    if (recent || rnd() < 0.92) l.bed = { status: 'full' }
    if ([1, 3, 5].includes(i % 7)) l.gym = { status: 'full' }
    if (recent || rnd() < 0.75) l['phone-kitchen'] = { status: rnd() < 0.7 ? 'full' : 'min' }
    if (recent || rnd() < 0.7) l['clean-feed'] = { status: 'full' }
    logs[day] = l
  }
  logs[TODAY] = {
    salah: { fajr: 'ontime', dhuhr: 'ontime', asr: 'late', maghrib: 'ontime', isha: 'ontime' },
    sleep: { status: 'full' }, bed: { status: 'full' }, gym: { status: 'full' }, 'clean-feed': { status: 'full' },
  }
  return JSON.stringify({
    version: 2,
    settings: {
      onboarded: true, tourSeen: true, language, theme, currentPhase: 1, includeIslamic: true,
      dayRolloverHour: 3, collapseDefaultsApplied: true, tasksCollapsed: true, foodCollapsed: true,
      prayerLocation: LOCATION, dismissedUnlock: { 1: true }, lastExportAt: Date.parse('2026-10-04T20:00:00Z'),
    },
    logs,
    days: {
      [addDays(TODAY, -1)]: { gratitude: ['Long walk by the lake', 'Dinner with my family', 'Slept a full eight hours'] },
    },
    votes: 1172,
    wins: [
      { id: 'w3', at: Date.parse('2026-10-03T22:10:00Z'), text: 'Made the bed every day since July' },
      { id: 'w2', at: Date.parse('2026-09-26T16:40:00Z'), text: 'Hit the gym three times on a busy week' },
      { id: 'w1', at: Date.parse('2026-09-14T23:05:00Z'), text: 'Phone in the kitchen by 10:30 for a full week' },
    ],
  })
}

const SHOTS = [
  { file: 'today-ivory.png', language: 'en', theme: 'ivory', screen: 'today' },
  { file: 'today-arabic.png', language: 'ar', theme: 'ivory', screen: 'today' },
  { file: 'today-charcoal.png', language: 'en', theme: 'charcoal', screen: 'today' },
  { file: 'stats-ivory.png', language: 'en', theme: 'ivory', screen: 'stats' },
]

async function run() {
  await build({ root, logLevel: 'error' })
  const server = await preview({ root, preview: { port: 0 }, logLevel: 'silent' })
  const url = server.resolvedUrls.local[0]
  const origin = new URL(url).origin
  const browser = await chromium.launch()
  let failed = 0

  for (const s of SHOTS) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: s.language === 'ar' ? 'ar' : 'en-US',
      timezoneId: 'America/Chicago',
      serviceWorkers: 'block',
    })
    await context.clock.setFixedTime(PINNED)
    await context.route('**/*', (route) => {
      const u = route.request().url()
      if (u.startsWith(origin)) return route.continue()
      if (u.includes('aladhan.com')) {
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stubMonth(u)) })
      }
      if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.continue()
      return route.abort()
    })
    await context.addInitScript(([k, v]) => {
      if (!localStorage.getItem(k)) localStorage.setItem(k, v)
    }, [STORAGE_KEY, sampleSave(s)])
    const page = await context.newPage()
    try {
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.locator('nav button').first().waitFor()
      if (s.screen === 'stats') {
        await page.locator('nav button').nth(1).click()
        // Open the Salah row's heatmap, then scroll so the phase progress card
        // sits at the top with the habit rows and that heatmap under it.
        await page.locator('main button', { hasText: '🔥' }).first().click()
        await page.waitForTimeout(300)
        await page.getByText(en['stats.trailing21']).first().evaluate((el) => {
          const top = el.getBoundingClientRect().top + window.scrollY
          window.scrollTo(0, Math.max(0, top - 50))
        })
      } else {
        // The prayer times arrive from the stub on first load; wait for them.
        await page.getByText(/(\d{1,2}:\d{2}[ap])/).first().waitFor({ timeout: 5000 })
      }
      await page.evaluate(() => document.fonts.ready)
      await page.waitForTimeout(600)
      // A good day: no slip banner, no restart card, no "missed yesterday" row.
      const text = await page.evaluate(() => document.body.innerText)
      const table = s.language === 'ar' ? { ...en, ...ar } : en
      for (const key of ['today.atRisk.sub', 'today.restart.body', 'habit.atRisk']) {
        if (text.includes(table[key])) throw new Error(`"${key}" is showing`)
      }
      await page.screenshot({ path: resolve(outDir, s.file) })
      console.log(`✓ ${s.file}`)
    } catch (err) {
      failed++
      console.log(`✗ ${s.file}: ${err.message}`)
    } finally {
      await context.close()
    }
  }

  await browser.close()
  await server.close()
  if (failed) process.exit(1)
  console.log(`\nREADME shots written to ${outDir}`)
}

run().catch((err) => { console.error(err); process.exit(1) })
