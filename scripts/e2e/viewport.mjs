// ---------------------------------------------------------------------------
// viewport.mjs — the E2E pass: prove the accountability share view fits the
// screen on a small phone, with nothing hidden below the fold.
//
// A real headless Chromium loads the built app at 390px (iPhone 12/13/14
// width), seeds a fully-onboarded state, opens the share sheet from both the
// Stats button and the Sunday weekly-review path, then measures the real
// layout. We assert:
//   - the sheet opens scrolled to the top (its top edge isn't above the screen)
//   - the whole sheet fits inside the viewport (bottom edge on-screen)
//   - the preview card is fully visible (scaled down to fit, never clipped)
//   - Share / Copy / Save are all on-screen — reachable without scrolling
//   - nothing inside the sheet actually needs scrolling to reach them
//
// It runs across a couple of themes, a long typed-in line, and Arabic/RTL,
// where the card mirrors — the fit has to hold in both directions.
//
// Run with:  npm run e2e   (builds, then drives this)
// ---------------------------------------------------------------------------

import { preview } from 'vite'
import { chromium, devices } from 'playwright'
import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const artifacts = resolve(root, 'e2e-artifacts')
mkdirSync(artifacts, { recursive: true })

// iPhone 12/13/14 logical width. The home-bar inset is what the safe-area
// padding has to clear, so we emulate a device that reports one.
const VIEWPORT = { width: 390, height: 844 }

// A fully-onboarded save. migrate() backfills every other field and (because a
// save exists) marks the device onboarded, so no Welcome flow is in the way.
// Phase 5 unlocks every habit, so the card fills to its 9-row cap — the tallest
// it ever gets, the worst case for fitting on screen.
function seed({ language, theme }) {
  return JSON.stringify({
    settings: { language, theme, currentPhase: 5, onboarded: true, tourSeen: true },
    votes: 1284,
  })
}

const LONG_NOTE = {
  en: 'Seven clean days in a row this week and honestly it is the first time in months — hold me to it next week too, all of you.',
  ar: 'سبعة أيام متتالية نظيفة هذا الأسبوع، وهي أول مرة منذ شهور. أمسكوني على وعدي الأسبوع القادم، جميعكم.',
}

// Measure the real layout of the open sheet, in the page. Selected by stable
// data-testids so it reads identically in English and Arabic.
function measureSheet() {
  const eps = 1 // sub-pixel rounding slack
  const vh = window.innerHeight
  const panel = document.querySelector('[data-testid="share-sheet"]')
  if (!panel) return { ok: false, failures: ['no sheet panel found'] }
  const canvas = panel.querySelector('canvas')
  if (!canvas) return { ok: false, failures: ['no preview canvas found'] }

  const rect = (el) => {
    const r = el.getBoundingClientRect()
    return { top: r.top, bottom: r.bottom, height: r.height, width: r.width }
  }
  const panelR = rect(panel)
  const canvasR = rect(canvas)
  const actions = [...panel.querySelectorAll('[data-testid="share-action"]')].map((b) => ({
    name: (b.textContent || '').trim(), ...rect(b),
  }))

  // Any scroll region inside the sheet that actually overflows means the user
  // would have to scroll to reach what's below it — exactly the reported bug.
  const overflowing = [...panel.querySelectorAll('*')]
    .filter((el) => {
      const oy = getComputedStyle(el).overflowY
      return (oy === 'auto' || oy === 'scroll') && el.scrollHeight - el.clientHeight > eps
    })
    .map((el) => ({ scrollHeight: el.scrollHeight, clientHeight: el.clientHeight }))

  const failures = []
  if (panelR.top < -eps) failures.push(`sheet is scrolled above the top (top=${panelR.top.toFixed(1)})`)
  if (panelR.bottom > vh + eps) failures.push(`sheet bottom is off-screen (bottom=${panelR.bottom.toFixed(1)} > ${vh})`)
  if (canvasR.bottom > vh + eps) failures.push(`preview card is clipped (bottom=${canvasR.bottom.toFixed(1)} > ${vh})`)
  if (canvasR.height < 40) failures.push(`preview card collapsed (height=${canvasR.height.toFixed(1)})`)
  if (actions.length !== 3) failures.push(`expected 3 action buttons, found ${actions.length}`)
  for (const a of actions) {
    if (a.bottom > vh + eps) failures.push(`"${a.name}" is below the fold (bottom=${a.bottom.toFixed(1)} > ${vh})`)
    if (a.top < -eps) failures.push(`"${a.name}" is above the top (top=${a.top.toFixed(1)})`)
  }
  if (overflowing.length) failures.push(`sheet needs scrolling: ${JSON.stringify(overflowing)}`)

  return { ok: failures.length === 0, failures, vh, panel: panelR, canvas: canvasR, actions }
}

const SCENARIOS = [
  { name: 'stats · ivory · en',          lang: 'en', theme: 'ivory',    path: 'stats',  note: '' },
  { name: 'stats · charcoal · long note',lang: 'en', theme: 'charcoal', path: 'stats',  note: LONG_NOTE.en },
  { name: 'weekly · sand · en',          lang: 'en', theme: 'sand',     path: 'weekly', note: '' },
  { name: 'stats · midnight · ar/rtl',   lang: 'ar', theme: 'midnight', path: 'stats',  note: LONG_NOTE.ar },
  { name: 'weekly · ivory · ar/rtl',     lang: 'ar', theme: 'ivory',    path: 'weekly', note: '' },
]

async function openSheet(page, scenario) {
  // Stats lives one tap away on the bottom nav; the weekly review is one more
  // tap from Stats. Both screens carry the same share button. Selected by
  // data-testid so navigation is identical in English and Arabic.
  // Bottom-nav order is today, stats, shutdown, settings — Stats is index 1.
  await page.locator('nav button').first().waitFor()
  await page.locator('nav button').nth(1).click()
  if (scenario.path === 'weekly') {
    await page.locator('[data-testid="weekly-review-link"]').click()
  }
  await page.locator('[data-testid="open-share"]').click()
  await page.locator('[data-testid="share-sheet"] canvas').waitFor({ state: 'visible' })
  // Fonts settle the card size; give the redraw a beat.
  await page.waitForTimeout(250)
}

// The sheets slide in with `animate-rise` (a translateY that ends at 0). Wait
// for that transform to settle before measuring, or a mid-flight frame reads a
// few pixels off. Falls back to a fixed wait if the transform never resolves.
async function settleRise(page, testid) {
  await page.waitForFunction((id) => {
    const el = document.querySelector(`[data-testid="${id}"]`)
    if (!el) return false
    const tr = getComputedStyle(el).transform
    return tr === 'none' || tr === 'matrix(1, 0, 0, 1, 0, 0)'
  }, testid, { timeout: 2000 }).catch(() => {})
}

// Does an overlay panel sit fully inside the viewport? This is the guarantee the
// portal-to-body fix restores: a `fixed` sheet must anchor to the screen, not to
// a transformed ancestor that pushes it below the fold.
function panelFits(testid) {
  const eps = 1
  const vh = window.innerHeight
  const panel = document.querySelector(`[data-testid="${testid}"]`)
  if (!panel) return { ok: false, failures: [`panel [${testid}] not found`] }
  const r = panel.getBoundingClientRect()
  const failures = []
  if (r.top < -eps) failures.push(`panel scrolled above the top (top=${r.top.toFixed(1)})`)
  if (r.bottom > vh + eps) failures.push(`panel bottom off-screen (bottom=${r.bottom.toFixed(1)} > ${vh})`)
  return { ok: failures.length === 0, failures, vh, top: r.top, bottom: r.bottom }
}

// The past-day fix sheet (DayEditor) is opened from a Stats heatmap cell. It's a
// `fixed` overlay rendered from inside a screen, so it shares the containing-block
// trap — this pins that it stays on-screen.
async function checkDayEditor(browser, url) {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: VIEWPORT })
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['the-rebuild:v1', seed({ language: 'en', theme: 'ivory' })],
  )
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.locator('nav button').first().waitFor()
    await page.locator('nav button').nth(1).click() // Stats
    // The "Fix a past day" row opens the day editor on a recent day.
    await page.locator('[data-testid="fix-day"]').first().click()
    await page.locator('[data-testid="day-editor"]').waitFor({ state: 'visible' })
    await settleRise(page, 'day-editor')
    const res = await page.evaluate(panelFits, 'day-editor')
    await page.screenshot({ path: resolve(artifacts, 'day-editor.png') })
    if (res.ok) {
      console.log(`✓ day editor · en — fits: panel ${res.top.toFixed(0)}–${res.bottom.toFixed(0)} within ${res.vh}px`)
      return 0
    }
    console.log(`✗ day editor · en — ${res.failures.length} problem(s):`)
    for (const f of res.failures) console.log(`    · ${f}`)
    return 1
  } catch (err) {
    console.log(`✗ day editor · en — threw: ${err.message}`)
    return 1
  } finally {
    await context.close()
  }
}

// The Daily anchor must sit directly under the score card and above the habits
// (Salah is the first habit) — a small grace note, not buried below the list.
async function checkAnchorPosition(browser, url) {
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: VIEWPORT })
  await context.addInitScript(
    ([key, value]) => window.localStorage.setItem(key, value),
    ['the-rebuild:v1', seed({ language: 'en', theme: 'ivory' })],
  )
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle' }) // Today is the default screen
    await page.locator('[data-testid="daily-anchor"]').waitFor({ state: 'visible' })
    const res = await page.evaluate(() => {
      const top = (sel) => { const el = document.querySelector(sel); return el ? el.getBoundingClientRect() : null }
      const score = top('[data-testid="score-card"]')
      const anchor = top('[data-testid="daily-anchor"]')
      const habits = top('[data-testid="habit-list"]')
      if (!score || !anchor || !habits) return { ok: false, failures: ['missing score/anchor/habit-list'] }
      const failures = []
      if (anchor.top < score.bottom - 1) failures.push(`anchor is not below the score card (anchor.top=${anchor.top.toFixed(0)} < score.bottom=${score.bottom.toFixed(0)})`)
      if (anchor.bottom > habits.top + 1) failures.push(`anchor is not above the habits/Salah (anchor.bottom=${anchor.bottom.toFixed(0)} > habits.top=${habits.top.toFixed(0)})`)
      return { ok: failures.length === 0, failures }
    })
    await page.screenshot({ path: resolve(artifacts, 'anchor-position.png') })
    if (res.ok) { console.log('✓ daily anchor · en — sits under the score card, above the habits'); return 0 }
    console.log('✗ daily anchor · en — misplaced:')
    for (const f of res.failures) console.log(`    · ${f}`)
    return 1
  } catch (err) {
    console.log(`✗ daily anchor · en — threw: ${err.message}`)
    return 1
  } finally {
    await context.close()
  }
}

// With "Include Islamic practices?" set to No, not a single Islamic term may
// appear anywhere in the UI. This walks every screen on a fresh AND a legacy
// profile and fails if one leaks — so any future Islamic feature that forgets to
// register itself in faith.js breaks CI instead of shipping a leak.
const FAITH_TERMS = /\b(salah|adhkar|wudu|dua|fajr|dhuhr|asr|maghrib|isha|qur['’]?an|hadith|sunnah|fasting|fast|ramadan|athan|iqamah|masjid|mosque|prophet|allah|ayah|prayer)\b/i

function noFaithSeed(legacy) {
  if (legacy) {
    // Pre-localization device: literal English names incl. Islamic ones + logs,
    // now viewed with the layer turned off. These must all be hidden.
    return JSON.stringify({
      version: 1,
      settings: { onboarded: true, tourSeen: true, includeIslamic: false, currentPhase: 5, dayRolloverHour: 3 },
      habits: [
        { id: 'salah', name: 'Salah on time', emoji: '🕌', phase: 1, type: 'salah', frequency: { kind: 'daily' }, minVersion: 'Pray it' },
        { id: 'quran', name: 'Quran daily', emoji: '📗', phase: 2, type: 'standard', frequency: { kind: 'daily' }, minVersion: 'One ayah' },
        { id: 'adhkar', name: 'Adhkar AM/PM', emoji: '📿', phase: 5, type: 'standard', frequency: { kind: 'daily' }, minVersion: 'One line' },
        { id: 'bed', name: 'Make the bed', emoji: '🛏️', phase: 1, type: 'standard', frequency: { kind: 'daily' }, minVersion: 'Covers straight' },
      ],
      logs: { '2026-08-16': { salah: { fajr: 'ontime' }, quran: { status: 'full' }, bed: { status: 'full' } } },
      days: {}, votes: 9,
    })
  }
  return JSON.stringify({ settings: { onboarded: true, tourSeen: true, includeIslamic: false, currentPhase: 5 }, votes: 40 })
}

async function checkNoFaithLeak(browser, url) {
  let failed = 0
  for (const legacy of [false, true]) {
    const label = legacy ? 'legacy' : 'fresh'
    const context = await browser.newContext({ ...devices['iPhone 13'], viewport: VIEWPORT })
    await context.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['the-rebuild:v1', noFaithSeed(legacy)])
    const page = await context.newPage()
    try {
      await page.goto(url, { waitUntil: 'networkidle' })
      await page.locator('nav button').first().waitFor()
      const screens = ['today', 'stats', 'shutdown', 'settings']
      for (let i = 0; i < screens.length; i++) {
        await page.locator('nav button').nth(i).click()
        await page.waitForTimeout(200)
        await scanForTerms(page, `${label}·${screens[i]}`, () => (failed++))
      }
      // Weekly review
      await page.locator('nav button').nth(1).click()
      await page.locator('[data-testid="weekly-review-link"]').click().catch(() => {})
      await page.waitForTimeout(200)
      await scanForTerms(page, `${label}·weekly`, () => (failed++))
      // Reveal + open the Private tab (PIN setup screen)
      await page.locator('nav button').nth(3).click()
      await page.waitForTimeout(150)
      const ver = page.getByText(/v0\.1\.0/)
      for (let i = 0; i < 5; i++) { await ver.click().catch(() => {}); await page.waitForTimeout(50) }
      await page.waitForTimeout(150)
      await page.getByText('🔒', { exact: false }).click().catch(() => {})
      await page.waitForTimeout(200)
      await scanForTerms(page, `${label}·private`, () => (failed++))
    } catch (err) {
      console.log(`✗ no-leak ${label} — threw: ${err.message}`)
      failed++
    } finally {
      await context.close()
    }
  }
  if (!failed) console.log('✓ no faith leak · en — no Islamic term appears in No mode (fresh + legacy)')
  return failed
}

async function scanForTerms(page, ctx, onFail) {
  // Exclude the Islamic-practices toggle itself — it's the control that turns the
  // layer back on, so it's allowed (and needs) to name what it enables.
  const text = await page.evaluate(() => {
    const clone = document.body.cloneNode(true)
    clone.querySelectorAll('[data-testid="islamic-toggle"]').forEach((el) => el.remove())
    document.body.appendChild(clone)
    const t = clone.innerText
    clone.remove()
    return t
  })
  const m = text.match(FAITH_TERMS)
  if (m) {
    const at = text.indexOf(m[0])
    console.log(`✗ faith leak at ${ctx}: "${m[0]}" — …${text.slice(Math.max(0, at - 25), at + 25).replace(/\n/g, ' ')}…`)
    onFail()
  }
}

async function run() {
  const server = await preview({ root, preview: { port: 0 }, logLevel: 'silent' })
  const url = server.resolvedUrls.local[0]
  const browser = await chromium.launch()
  let failed = 0

  for (const s of SCENARIOS) {
    const context = await browser.newContext({
      ...devices['iPhone 13'],
      viewport: VIEWPORT,
      locale: s.lang === 'ar' ? 'ar' : 'en-US',
    })
    // Seed the save before any app code runs.
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      ['the-rebuild:v1', seed({ language: s.lang, theme: s.theme })],
    )
    const page = await context.newPage()
    try {
      await page.goto(url, { waitUntil: 'networkidle' })
      await openSheet(page, s)

      if (s.note) {
        await page.locator('[data-testid="share-sheet"] input').first().fill(s.note)
        await page.waitForTimeout(200)
      }

      const dir = await page.evaluate(() => document.documentElement.dir || 'ltr')
      if (s.lang === 'ar' && dir !== 'rtl') {
        console.log(`✗ ${s.name}: expected RTL, got dir=${dir}`)
        failed++
      }

      await settleRise(page, 'share-sheet')
      const res = await page.evaluate(measureSheet)
      const shot = resolve(artifacts, `share-${s.name.replace(/[^a-z0-9]+/gi, '-')}.png`)
      await page.screenshot({ path: shot })

      if (res.ok) {
        console.log(`✓ ${s.name} (${dir}) — fits: sheet ${res.panel.bottom.toFixed(0)}/${res.vh}px, card ${res.canvas.height.toFixed(0)}px`)
      } else {
        failed++
        console.log(`✗ ${s.name} (${dir}) — ${res.failures.length} problem(s):`)
        for (const f of res.failures) console.log(`    · ${f}`)
        console.log(`    screenshot: ${shot}`)
      }
    } catch (err) {
      failed++
      console.log(`✗ ${s.name} — threw: ${err.message}`)
    } finally {
      await context.close()
    }
  }

  // Other fixed overlays must clear the same containing-block trap.
  failed += await checkDayEditor(browser, url)
  // And the Daily anchor must stay pinned under the score card.
  failed += await checkAnchorPosition(browser, url)
  // And no Islamic term may leak when the layer is off.
  failed += await checkNoFaithLeak(browser, url)

  await browser.close()
  await server.close()

  const total = SCENARIOS.length + 3
  if (failed) {
    console.log(`\nviewport-fit E2E: ${failed} of ${total} check(s) failed.`)
    process.exit(1)
  }
  console.log(`\nviewport-fit E2E: all ${total} checks fit the viewport.`)
}

run().catch((err) => { console.error(err); process.exit(1) })
