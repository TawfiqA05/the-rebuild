// ---------------------------------------------------------------------------
// viewport.mjs — the E2E pass. A real headless Chromium loads the built app
// at 390px (iPhone 12/13/14 width) with made-up saved data and runs 20 checks.
//
// Share sheet (5 checks). Opened from the Stats button and from the Sunday
// weekly-review path, across a few themes, a long typed-in line, and
// Arabic/RTL, where the card mirrors. For each we assert:
//   - the sheet opens scrolled to the top (its top edge isn't above the screen)
//   - the whole sheet fits inside the viewport (bottom edge on-screen)
//   - the preview card is fully visible (scaled down to fit, never clipped)
//   - Share / Copy / Save are all on-screen, reachable without scrolling
//   - nothing inside the sheet actually needs scrolling to reach them
//
// Then fifteen more:
//   - day editor: the "fix a past day" panel fits the screen
//   - daily anchor: it sits under the score card and above the habits
//   - no faith leak: with Islamic practices off, no Islamic term shows on any
//     screen, on a fresh save and on an old one
//   - location privacy: "use my location" contacts AlAdhan only, never a
//     reverse geocoder
//   - task calendar: the Google link and the .ics file are built on the
//     device from the title and date, and nothing is sent until a tap
//   - tutorial: the spotlight fits, the gestures advance it, it leaves no
//     trace, and an existing device never sees it
//   - import: a wrong or cut-off file changes nothing and says so, and a good
//     one asks first in the app's own sheet, with counts, before replacing
//   - failed save: a calm line shows, the next change tries again, and the
//     line goes once a save works
//   - two tabs: a change in one tab reaches the other with no repeated
//     writes, and neither tab's change is lost
//   - crash: a crash while drawing shows a plain screen with Reload and
//     Export my data, and the export is read from storage
//   - unreadable save: a copy is kept and read back before anything is
//     saved over it, and a calm screen says so before onboarding
//   - refused copy: when storage won't keep the copy, the original stays,
//     nothing saves until Start fresh, and Export leaves the screen up
//   - repaired save: a habit with no schedule is named and set to daily, the
//     original is kept under a new key, and saving goes on
//   - second failure: with a copy already kept, a new one gets its own key
//   No copy's content ever shows on screen in these.
//   - network: no service worker registers, the fonts were blocked, and no
//     request anywhere in the run got past the allow-list
//
// The network is closed in every check. Each browser context comes from
// newContext(), which blocks service workers and lets through only the
// preview server, blob: and data:. Everything else is aborted (or, for the one
// check that needs it, answered by a stub) and the run fails if any other
// address got through.
//
// Run with:  npm run e2e   (builds, then drives this)
// ---------------------------------------------------------------------------

import { preview } from 'vite'
import { chromium, devices } from 'playwright'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const artifacts = resolve(root, 'e2e-artifacts')
mkdirSync(artifacts, { recursive: true })

// iPhone 12/13/14 logical width. The home-bar inset is what the safe-area
// padding has to clear, so we emulate a device that reports one.
const VIEWPORT = { width: 390, height: 844 }

// --- the network allow-list ---------------------------------------------------

let ORIGIN = null // the preview server, set in run()
const isAllowed = (u) => u.startsWith(`${ORIGIN}/`) || u.startsWith('blob:') || u.startsWith('data:')
const NETWORK = {
  stubbed: new Set(), // answered by a check's stub, never sent
  blocked: [],        // aborted
  closed: new Set(),  // the outside requests the route aborted or stubbed
  outside: [],        // every outside request any page made, whatever happened to it
  fromWorker: [],     // answered by a service worker: fails the run
}
// An outside request the route didn't close was let through: fails the run.
const escaped = () => NETWORK.outside.filter((req) => !NETWORK.closed.has(req)).map((req) => req.url())

// Every context in this file comes from here. `stub(url)` may return a route
// fulfillment for an outside address (it is answered locally and never sent);
// `onExternal(url)` sees every outside address a page asked for.
async function newContext(browser, options = {}, { stub, onExternal } = {}) {
  const context = await browser.newContext({
    ...devices['iPhone 13'],
    viewport: VIEWPORT,
    ...options,
    serviceWorkers: 'block',
  })
  await context.route('**/*', (route) => {
    const u = route.request().url()
    if (isAllowed(u)) return route.continue()
    onExternal?.(u)
    const answer = stub?.(u)
    NETWORK.closed.add(route.request())
    if (answer) {
      NETWORK.stubbed.add(u)
      return route.fulfill(answer)
    }
    NETWORK.blocked.push(u)
    return route.abort()
  })
  // An independent record of every request, including redirects, which the
  // route never sees.
  context.on('request', (req) => {
    if (!isAllowed(req.url())) NETWORK.outside.push(req)
  })
  context.on('response', (res) => {
    if (res.fromServiceWorker()) NETWORK.fromWorker.push(res.url())
  })
  return context
}

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
  const context = await newContext(browser)
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
  const context = await newContext(browser)
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
    const context = await newContext(browser)
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
      // Reveal + open the extra tab (its first screen)
      await page.locator('nav button').nth(3).click()
      await page.waitForTimeout(150)
      // Both found by test id. If either is missing, the click throws and the
      // check fails, so this scan can never be skipped without a failure.
      const ver = page.locator('[data-testid="app-version"]')
      for (let i = 0; i < 5; i++) { await ver.click({ timeout: 5000 }); await page.waitForTimeout(50) }
      await page.waitForTimeout(150)
      await page.locator('[data-testid="nav-extra"]').click({ timeout: 5000 })
      await page.waitForTimeout(200)
      await scanForTerms(page, `${label}·extra`, () => (failed++))
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

// Privacy: using "my location" must send the coordinates to AlAdhan (the prayer
// query the feature needs) and to NObody else — in particular never to a reverse
// geocoder. We grant a mock geolocation, record every request, and stub external
// hosts so nothing actually leaves, then assert what the app tried to reach.
async function checkNoReverseGeocode(browser, url) {
  const external = []
  const context = await newContext(browser, {
    geolocation: { latitude: 41.8781, longitude: -87.6298 },
    permissions: ['geolocation'],
  }, {
    onExternal: (u) => external.push(u),
    // Pretend AlAdhan answered, so useMyLocation completes without real network.
    // This is the one check with a stub. Fonts and anything else are aborted.
    stub: (u) => new URL(u).hostname.endsWith('aladhan.com')
      ? { status: 200, contentType: 'application/json', body: JSON.stringify({ code: 200, data: [] }) }
      : null,
  })
  await context.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    ['the-rebuild:v1', JSON.stringify({ settings: { onboarded: true, tourSeen: true, includeIslamic: true, currentPhase: 1, prayerLocation: null } })],
  )
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.locator('nav button').nth(3).click() // Settings
    // With no location set, the picker is shown inline; use my (mock) location.
    await page.locator('[data-testid="use-my-location"]').click()
    await page.waitForTimeout(600) // let useMyLocation → fetchMonth fire

    const hitGeocoder = external.filter((u) => /bigdatacloud|nominatim|geocod|opencage|mapbox|googleapis\.com\/maps/i.test(u))
    const aladhanByCoords = external.filter((u) => u.includes('aladhan.com') && /latitude=/.test(u))
    const failures = []
    if (hitGeocoder.length) failures.push(`reverse-geocoder was contacted: ${hitGeocoder[0]}`)
    if (aladhanByCoords.length === 0) failures.push('AlAdhan was not queried by coordinates (expected latitude= in the URL)')

    if (failures.length === 0) {
      console.log('✓ location privacy · en — coords go to AlAdhan only; no reverse geocoder contacted')
      return 0
    }
    console.log('✗ location privacy · en:')
    for (const f of failures) console.log(`    · ${f}`)
    if (external.length) console.log(`    external attempts: ${external.map((u) => new URL(u).host).join(', ')}`)
    return 1
  } catch (err) {
    console.log(`✗ location privacy · en — threw: ${err.message}`)
    return 1
  } finally {
    await context.close()
  }
}

// Privacy: the task calendar action must build both outputs on-device and send
// nothing anywhere until the user taps. We record every external request, seed a
// task plus unrelated data, open the calendar options, read the Google link and
// save the .ics — asserting nothing left, and that BOTH outputs carry only the
// task title and its due date (never any other field).
async function checkTaskCalendarPrivacy(browser, url) {
  // Local app assets, and blob:/data: (the .ics is a local blob) are on-device.
  const external = []
  const context = await newContext(browser, { acceptDownloads: true }, { onExternal: (u) => external.push(u) })

  // A task due TODAY (so it shows in the open list), plus unrelated state — a
  // food note with a marker, votes — that must never appear in any output.
  const localYMD = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const dayKeyFor = (date) => { const s = new Date(date.getTime()); s.setHours(s.getHours() - 3); return localYMD(s) }
  const today = dayKeyFor(new Date())
  const [yy, mm, dd] = today.split('-').map(Number)
  const startBasic = today.replaceAll('-', '')
  const endBasic = localYMD(new Date(yy, mm - 1, dd + 1)).replaceAll('-', '')
  const TITLE = 'Renew passport'
  const MARKER = 'ZZSECRETZZ'
  // includeIslamic:false keeps the prayer-times fetch out of the way, so the only
  // load-time request is the app's own web font — everything after the baseline
  // snapshot below is attributable to the calendar action.
  const save = JSON.stringify({
    settings: { language: 'en', onboarded: true, tourSeen: true, currentPhase: 1, tasksCollapsed: false, collapseDefaultsApplied: true, includeIslamic: false, prayerLocation: null },
    tasks: [{ id: 'cal1', text: TITLE, createdAt: 1, createdDay: today, dueDay: today, doneDay: null, doneAt: null, source: 'manual' }],
    food: [{ id: 'x', text: `${MARKER} pizza`, at: Date.now(), day: today }],
    votes: 7,
  })
  await context.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['the-rebuild:v1', save])

  const page = await context.newPage()
  const failures = []
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300) // let any load-time requests (fonts) settle
    // Snapshot what the app has already requested on its own. Anything AFTER this
    // point is the calendar action, which must be nothing.
    const baseline = external.length
    // Open the calendar options for the task — this alone must send nothing.
    await page.locator('[data-testid="task-calendar"]').first().click()
    await page.waitForTimeout(150)

    // Google link — host, exactly {action,dates,text}, correct values, no leaks.
    const href = await page.locator('[data-testid="task-cal-google"]').first().getAttribute('href')
    const g = new URL(href)
    if (g.host !== 'calendar.google.com') failures.push(`google link host is ${g.host}`)
    const keys = [...g.searchParams.keys()].sort().join(',')
    if (keys !== 'action,dates,text') failures.push(`google link params are {${keys}}`)
    if (g.searchParams.get('text') !== TITLE) failures.push(`google title is "${g.searchParams.get('text')}"`)
    if (g.searchParams.get('dates') !== `${startBasic}/${endBasic}`) failures.push(`google dates are "${g.searchParams.get('dates')}"`)
    if (href.includes(MARKER) || href.includes('pizza')) failures.push('google link leaked unrelated state')

    // .ics — saved locally (a blob), carrying only the title + due date.
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.locator('[data-testid="task-cal-ics"]').first().click(),
    ])
    const ics = readFileSync(await download.path(), 'utf8')
    if (!ics.includes(`SUMMARY:${TITLE}`)) failures.push('ics is missing the title')
    if (!ics.includes(`DTSTART;VALUE=DATE:${startBasic}`)) failures.push('ics is missing the due date')
    if (ics.includes(MARKER) || ics.includes('pizza')) failures.push('ics leaked unrelated state')

    // The whole calendar flow added NO new request (not even to Google — the link
    // only opens when a human clicks it, which this test never does).
    const leaked = external.slice(baseline)
    if (leaked.length) failures.push(`the calendar action hit the network: ${leaked.join(', ')}`)
    // And nothing the app ever requested carried the task or any other state.
    const carriers = external.filter((u) => /renew|passport|calendar\.google|ZZSECRETZZ|pizza/i.test(u))
    if (carriers.length) failures.push(`a request carried task/calendar data: ${carriers[0]}`)

    await page.screenshot({ path: resolve(artifacts, 'task-calendar.png') })
    if (failures.length === 0) {
      console.log('✓ task calendar · en — Google link + .ics built on-device from title/date only; nothing leaves until a tap')
      return 0
    }
    console.log('✗ task calendar · en:')
    for (const f of failures) console.log(`    · ${f}`)
    return 1
  } catch (err) {
    console.log(`✗ task calendar · en — threw: ${err.message}`)
    return 1
  } finally {
    await context.close()
  }
}

// The interactive tutorial: the spotlight overlay must portal to <body> and fit
// the viewport (LTR + RTL), driving it by real gestures must advance and finish,
// it must leave NO trace in storage, and a legacy device must never see it.
async function checkTutorial(browser, url) {
  const tap = async (page, sel) => {
    const b = await page.locator(sel).boundingBox()
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
  }
  const hold = async (page, sel) => {
    const b = await page.locator(sel).boundingBox()
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
    await page.mouse.down(); await page.waitForTimeout(560); await page.mouse.up()
  }
  const seed = (lang, legacy) => legacy
    ? JSON.stringify({ version: 1, settings: { onboarded: true, language: lang }, habits: [{ id: 'bed', name: 'Make the bed', phase: 1, frequency: { kind: 'daily' } }], logs: { '2026-08-16': { bed: { status: 'full' } } }, days: {}, votes: 5 })
    : JSON.stringify({ settings: { onboarded: true, tourSeen: false, language: lang, currentPhase: 1, includeIslamic: true }, votes: 0 })

  const open = async (lang, legacy) => {
    const context = await newContext(browser, { locale: lang === 'ar' ? 'ar' : 'en-US' })
    await context.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['the-rebuild:v1', seed(lang, legacy)])
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(400)
    return { context, page }
  }

  const failures = []
  // 1) Legacy device: never sees it.
  {
    const { context, page } = await open('en', true)
    if (await page.locator('[data-testid="tutorial-overlay"]').count()) failures.push('legacy device saw the tutorial')
    await context.close()
  }
  // 2) RTL: overlay renders and the instruction fits the viewport.
  {
    const { context, page } = await open('ar', false)
    const dir = await page.evaluate(() => document.documentElement.dir)
    const overlay = page.locator('[data-testid="tutorial-overlay"]')
    if (!(await overlay.isVisible())) failures.push('RTL: overlay not shown')
    if (dir !== 'rtl') failures.push(`RTL: expected dir=rtl, got ${dir}`)
    const fits = await page.evaluate(() => {
      const r = document.querySelector('[data-testid="tutorial-instruction"]')?.getBoundingClientRect()
      return r && r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1
    })
    if (!fits) failures.push('RTL: instruction card does not fit the viewport')
    await page.screenshot({ path: resolve(artifacts, 'tutorial-rtl.png') })
    await context.close()
  }
  // 3) Fresh EN: portal to body, drive every gesture, finish, and leave no trace.
  {
    const { context, page } = await open('en', false)
    const portaled = await page.evaluate(() => document.querySelector('[data-testid="tutorial-overlay"]')?.parentElement === document.body)
    if (!portaled) failures.push('overlay is not portaled to <body>')
    const ring = '[data-testid="practice-card"] button'
    await tap(page, ring); await page.waitForTimeout(1100)   // step 0 → 1
    await hold(page, ring); await page.waitForTimeout(1100)  // step 1 → 2
    await tap(page, ring); await page.waitForTimeout(1100)   // step 2 → 3
    await page.locator('[data-testid="tutorial-next"]').click(); await page.waitForTimeout(300) // 3 → 4
    await page.locator('[data-testid="tutorial-next"]').click(); await page.waitForTimeout(300) // finish

    if (await page.locator('[data-testid="tutorial-overlay"]').count()) failures.push('overlay did not close after finishing')
    if (await page.locator('[data-testid="practice-card"]').count()) failures.push('practice card did not vanish')
    const s = await page.evaluate(() => JSON.parse(localStorage.getItem('the-rebuild:v1')))
    if (s.settings.tourSeen !== true) failures.push('tourSeen not set after finishing')
    if (s.votes !== 0) failures.push(`practice left votes: ${s.votes}`)
    if (Object.keys(s.logs || {}).length !== 0) failures.push('practice left a log entry')
    if ((s.habits || []).some((h) => /practice/i.test(h.id) || /practice/i.test(h.name || ''))) failures.push('a practice habit was persisted')
    await context.close()
  }
  // 4) Reduced motion: the overlay still renders, with no rise animation.
  {
    const context = await newContext(browser, { reducedMotion: 'reduce' })
    await context.addInitScript(([k, v]) => window.localStorage.setItem(k, v), ['the-rebuild:v1', seed('en', false)])
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.waitForTimeout(300)
    const anim = await page.evaluate(() => {
      const el = document.querySelector('[data-testid="tutorial-instruction"]')
      return el ? getComputedStyle(el).animationName : null
    })
    if (anim === null) failures.push('reduced-motion: overlay not shown')
    else if (anim !== 'none') failures.push(`reduced-motion: instruction still animates (${anim})`)
    await context.close()
  }

  if (failures.length === 0) {
    console.log('✓ tutorial · en+ar — spotlight portals + fits, gestures advance, finishes with no trace, legacy skips')
    return 0
  }
  console.log(`✗ tutorial — ${failures.length} problem(s):`)
  for (const f of failures) console.log(`    · ${f}`)
  return 1
}

// --- import, failed save, two tabs ------------------------------------------

const KEY = 'the-rebuild:v1'

// A made-up save for the checks below: two habits of my own on top of the
// built-in ones and a few days logged. Islamic practices are off unless asked
// for, so every habit button on Today is a plain one.
function plainSave({ votes = 21, winText = 'Took the stairs all week', days = 4, includeIslamic = false } = {}) {
  const logs = {}
  for (let i = 1; i <= days; i++) logs[`2026-09-${String(10 + i).padStart(2, '0')}`] = { 'read-x1': { status: 'full', at: i } }
  return {
    version: 2,
    settings: { onboarded: true, tourSeen: true, language: 'en', theme: 'ivory', currentPhase: 1, includeIslamic, prayerLocation: null, collapseDefaultsApplied: true },
    habits: [
      { id: 'read-x1', name: 'Read ten pages', emoji: '📖', phase: 1, type: 'standard', frequency: { kind: 'daily' }, minVersion: 'One page', stock: false, archived: false, createdAt: '2026-09-01T12:00:00.000Z' },
      { id: 'walk-x1', name: 'Evening walk', emoji: '🚶', phase: 1, type: 'standard', frequency: { kind: 'daily' }, minVersion: 'To the corner', stock: false, archived: false, createdAt: '2026-09-01T12:00:00.000Z' },
    ],
    logs,
    days: {},
    votes,
    wins: [{ id: 'w1', at: 1, text: winText }],
  }
}

// Counted from what the app saved, the way the restore sheet counts: habits
// on screen (not archived, in an unlocked phase) and days with anything logged.
// Only for saves with Islamic practices on, where no habit is hidden.
function countsIn(saved) {
  if (saved.settings.includeIslamic === false) throw new Error('countsIn needs Islamic practices on')
  return {
    habits: saved.habits.filter((h) => !h.archived && h.phase <= saved.settings.currentPhase).length,
    days: Object.values(saved.logs || {}).filter((d) => d && Object.keys(d).length > 0).length,
  }
}

// Replaces confirm and alert so a check can tell if either was used.
const RECORD_DIALOGS = () => {
  window.__dialogs = []
  window.confirm = (m) => { window.__dialogs.push(`confirm: ${m}`); return true }
  window.alert = (m) => { window.__dialogs.push(`alert: ${m}`) }
}

async function checkImport(browser, url) {
  const context = await newContext(browser)
  await context.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v) }, [KEY, JSON.stringify(plainSave({ includeIslamic: true }))])
  await context.addInitScript(RECORD_DIALOGS)
  const page = await context.newPage()
  const failures = []
  const nativeDialogs = []
  page.on('dialog', (d) => { nativeDialogs.push(d.type()); d.dismiss().catch(() => {}) })
  const raw = () => page.evaluate((k) => localStorage.getItem(k), KEY)
  const pick = (name, text) => page.locator('input[type="file"][accept*="json"]').setInputFiles({ name, mimeType: 'application/json', buffer: Buffer.from(text) })
  const sheet = page.locator('[data-testid="restore-sheet"]')

  // The bad files are hand-made. None of them is a real backup.
  const goodState = plainSave({ votes: 77, winText: 'Finished the long book', days: 6, includeIslamic: true })
  goodState.habits.push({ id: 'water-x1', name: 'Glass of water first', emoji: '💧', phase: 1, type: 'standard', frequency: { kind: 'daily' }, minVersion: 'A sip', stock: false, archived: false, createdAt: '2026-09-02T12:00:00.000Z' })
  const goodFile = JSON.stringify({ schemaVersion: 1, app: 'the-rebuild', exportedAt: '2026-10-01T18:00:00.000Z', state: goodState }, null, 2)
  const BAD = [
    { name: 'empty object', text: '{}', message: 'That file didn’t look like a valid backup.' },
    { name: 'list', text: '[]', message: 'That file didn’t look like a valid backup.' },
    { name: 'empty state', text: JSON.stringify({ schemaVersion: 1, app: 'the-rebuild', exportedAt: '2026-10-01T18:00:00.000Z', state: {} }), message: 'That file didn’t look like a valid backup.' },
    { name: 'another app', text: JSON.stringify({ schemaVersion: 2, app: 'notes-app', exportedAt: '2026-10-01T18:00:00.000Z', notes: [] }), message: 'That file comes from another app, not The Rebuild.' },
    { name: 'cut off', text: goodFile.slice(0, Math.floor(goodFile.length / 2)), message: 'That file couldn’t be read. It may be cut off, or it isn’t a backup.' },
  ]

  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="nav-settings"]').click()
    const original = await raw()
    if (!original) throw new Error('no saved state to start from')

    for (const bad of BAD) {
      await pick(`${bad.name}.json`, bad.text)
      await page.locator('[data-testid="restore-sheet"][data-state="refused"]').waitFor({ timeout: 3000 })
      const text = await sheet.innerText()
      if (!text.includes('Nothing was changed') || !text.includes(bad.message)) failures.push(`${bad.name}: sheet says "${text.replace(/\s+/g, ' ')}"`)
      if (bad.name === 'another app') await page.screenshot({ path: resolve(artifacts, 'import-refused.png') })
      await page.locator('[data-testid="restore-close"]').click()
      await sheet.waitFor({ state: 'detached' })
      if ((await raw()) !== original) failures.push(`${bad.name}: storage changed`)
      if (!(await page.locator('[data-testid="nav-settings"]').isVisible())) failures.push(`${bad.name}: the app went blank`)
    }

    // A good file: the sheet asks first, with counts. Cancel changes nothing.
    const now = countsIn(JSON.parse(original))
    await pick('backup.json', goodFile)
    await page.locator('[data-testid="restore-sheet"][data-state="confirm"]').waitFor({ timeout: 3000 })
    await settleRise(page, 'restore-sheet')
    const shown = await page.evaluate(() => {
      const n = (row, which) => Number(document.querySelector(`[data-testid="${row}"] [data-count="${which}"]`)?.textContent)
      return { now: { habits: n('restore-habits', 'now'), days: n('restore-days', 'now') }, file: { habits: n('restore-habits', 'file'), days: n('restore-days', 'file') } }
    })
    const fits = await page.evaluate(panelFits, 'restore-sheet')
    if (!fits.ok) failures.push(`restore sheet does not fit: ${fits.failures.join('; ')}`)
    await page.screenshot({ path: resolve(artifacts, 'import-confirm.png') })
    if (shown.now.habits !== now.habits || shown.now.days !== now.days) failures.push(`sheet shows ${JSON.stringify(shown.now)} on the device, saved data has ${JSON.stringify(now)}`)
    if (shown.file.days !== 6) failures.push(`sheet shows ${shown.file.days} days in the file, the file has 6`)
    await page.locator('[data-testid="restore-cancel"]').click()
    await sheet.waitFor({ state: 'detached' })
    if ((await raw()) !== original) failures.push('cancel changed storage')

    // Replace restores it, and the counts the sheet gave match what was saved.
    await pick('backup.json', goodFile)
    await page.locator('[data-testid="restore-replace"]').click()
    await sheet.waitFor({ state: 'detached' })
    await page.getByText('Backup restored.').waitFor({ timeout: 3000 })
    const after = JSON.parse(await raw())
    if (after.votes !== 77 || after.wins[0]?.text !== 'Finished the long book') failures.push('replace did not restore the file')
    const fileCounts = countsIn(after)
    if (fileCounts.habits !== shown.file.habits || fileCounts.days !== shown.file.days) failures.push(`sheet promised ${JSON.stringify(shown.file)}, restored ${JSON.stringify(fileCounts)}`)

    const dialogs = await page.evaluate(() => window.__dialogs)
    if (dialogs.length || nativeDialogs.length) failures.push(`a browser dialog was used: ${[...dialogs, ...nativeDialogs].join(', ')}`)
  } catch (err) {
    failures.push(`threw: ${err.message}`)
  } finally {
    await context.close()
  }
  if (failures.length === 0) {
    console.log(`✓ import · en — ${BAD.length} wrong files change nothing and say so; a good one asks first with counts, Cancel keeps, Replace restores; no browser dialogs`)
    return 0
  }
  console.log('✗ import · en:')
  for (const f of failures) console.log(`    · ${f}`)
  return 1
}

// Storage that throws on demand, for the app's key only, so the probe at
// start-up still sees working storage.
const FAILING_STORAGE = (key) => {
  window.__failSaves = false
  window.__writes = 0
  const real = Storage.prototype.setItem
  Storage.prototype.setItem = function (k, v) {
    if (k === key) {
      window.__writes++
      if (window.__failSaves) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    }
    return real.call(this, k, v)
  }
}

const habitButton = (page, i) => page.locator('[data-testid="habit-list"] button[aria-pressed]').nth(i)

async function checkSaveFailure(browser, url) {
  const context = await newContext(browser)
  await context.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v) }, [KEY, JSON.stringify(plainSave())])
  await context.addInitScript(FAILING_STORAGE, KEY)
  const page = await context.newPage()
  const failures = []
  const line = page.locator('[data-testid="save-failed"]')
  const raw = () => page.evaluate((k) => localStorage.getItem(k), KEY)
  try {
    await page.goto(url, { waitUntil: 'networkidle' })
    await habitButton(page, 0).waitFor()
    if (await line.count()) failures.push('the line shows before anything failed')
    const before = await raw()

    await page.evaluate(() => { window.__failSaves = true })
    await habitButton(page, 0).click()
    await line.waitFor({ timeout: 3000 })
    const text = await line.innerText()
    if (text !== 'Your last change didn’t save on this device. It will try again with your next change.') failures.push(`line says "${text}"`)
    // Headless Chromium has no safe area, so check the rule itself: the line
    // sticks below the status bar, not at the very top.
    const sticky = await line.evaluate((el) => ({ position: getComputedStyle(el).position, top: el.style.top }))
    if (sticky.position !== 'sticky' || sticky.top !== 'env(safe-area-inset-top)') failures.push(`line sticks at ${JSON.stringify(sticky)}`)
    await page.screenshot({ path: resolve(artifacts, 'save-failed.png') })
    if ((await raw()) !== before) failures.push('storage changed while saves were failing')

    // Still failing: the next change tries again and the line stays.
    const writes = await page.evaluate(() => window.__writes)
    await habitButton(page, 1).click()
    await page.waitForTimeout(200)
    if ((await page.evaluate(() => window.__writes)) <= writes) failures.push('the next change did not try to save')
    if (!(await line.isVisible())) failures.push('the line went while saves still fail')

    // Storage works again: the next change saves both earlier taps too.
    await page.evaluate(() => { window.__failSaves = false })
    await habitButton(page, 0).click() // full → min, still logged
    await line.waitFor({ state: 'detached', timeout: 3000 })
    const saved = JSON.parse(await raw())
    const today = Object.values(saved.logs).find((d) => d['walk-x1'])
    if (!today || today['read-x1']?.status !== 'min' || today['walk-x1']?.status !== 'full') failures.push('the change made while saves failed was not saved later')
  } catch (err) {
    failures.push(`threw: ${err.message}`)
  } finally {
    await context.close()
  }
  if (failures.length === 0) {
    console.log('✓ failed save · en — calm line shows, the next change retries, the line goes once a save works')
    return 0
  }
  console.log('✗ failed save · en:')
  for (const f of failures) console.log(`    · ${f}`)
  return 1
}

// Two tabs of the app in one browser profile share storage. A change in one
// must reach the other without either writing it again, so a later change in
// the other tab can't put the old state back.
async function checkTwoTabs(browser, url) {
  const context = await newContext(browser)
  await context.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v) }, [KEY, JSON.stringify(plainSave())])
  await context.addInitScript(FAILING_STORAGE, KEY)
  const failures = []
  try {
    const a = await context.newPage()
    await a.goto(url, { waitUntil: 'networkidle' })
    const b = await context.newPage()
    await b.goto(url, { waitUntil: 'networkidle' })
    await habitButton(a, 0).waitFor()
    await habitButton(b, 0).waitFor()
    await a.waitForTimeout(300)
    const writes = async () => [await a.evaluate(() => window.__writes), await b.evaluate(() => window.__writes)]
    const start = await writes()
    const pressed = (page) => page.locator('[data-testid="habit-list"] button[aria-pressed="true"]').count()

    await habitButton(a, 0).click()
    await b.waitForFunction(() => document.querySelectorAll('[data-testid="habit-list"] button[aria-pressed="true"]').length === 1, null, { timeout: 3000 })
    await habitButton(b, 1).click()
    await a.waitForFunction(() => document.querySelectorAll('[data-testid="habit-list"] button[aria-pressed="true"]').length === 2, null, { timeout: 3000 })
    await a.waitForTimeout(800) // room for any echo write to show up

    const end = await writes()
    const delta = [end[0] - start[0], end[1] - start[1]]
    if (delta[0] !== 1 || delta[1] !== 1) failures.push(`expected one write per tab, got ${delta[0]} and ${delta[1]}`)
    const saved = JSON.parse(await a.evaluate((k) => localStorage.getItem(k), KEY))
    // Only today has the walk logged; the older days hold the reading alone.
    const today = Object.values(saved.logs).find((d) => d['walk-x1']) || {}
    if (!today['read-x1'] || !today['walk-x1']) failures.push('a change was lost: storage does not hold both taps')
    if ((await pressed(a)) !== 2 || (await pressed(b)) !== 2) failures.push('the tabs show different days')
  } catch (err) {
    failures.push(`threw: ${err.message}`)
  } finally {
    await context.close()
  }
  if (failures.length === 0) {
    console.log('✓ two tabs · en — each change reaches the other tab, one write each, nothing lost')
    return 0
  }
  console.log('✗ two tabs · en:')
  for (const f of failures) console.log(`    · ${f}`)
  return 1
}

// --- saved data the app can't use, rescue copies, a crash -------------------

const RESCUE = 'the-rebuild:rescue:'
// Made-up text inside every damaged save and copy below. It must never show on
// screen: a copy can hold what the hidden tab saved.
const MARKER = 'made-up-marker-7Q2'
const storageNow = (page) => page.evaluate(() => Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)])))
const rescueIn = (all) => Object.keys(all).filter((k) => k.startsWith(RESCUE)).sort()
// Refuse every write to a rescue key, the way a full storage would.
const REFUSE_RESCUE = (prefix) => {
  const real = Storage.prototype.setItem
  Storage.prototype.setItem = function (k, v) {
    if (String(k).startsWith(prefix)) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    return real.call(this, k, v)
  }
}
const seedOnce = (context, entries) => context.addInitScript((pairs) => {
  if (sessionStorage.getItem('__seeded')) return
  sessionStorage.setItem('__seeded', '1')
  for (const [k, v] of pairs) localStorage.setItem(k, v)
}, entries)

// Click Export my data and read the file it hands over.
async function exportFile(page, testid) {
  const [download] = await Promise.all([page.waitForEvent('download'), page.locator(`[data-testid="${testid}"]`).first().click()])
  return JSON.parse(readFileSync(await download.path(), 'utf8'))
}

async function rescueCheck(browser, url, name, body) {
  const context = await newContext(browser)
  const failures = []
  try {
    await body(context, failures)
  } catch (err) {
    failures.push(`threw: ${err.message}`)
  } finally {
    await context.close()
  }
  if (failures.length === 0) return 0
  console.log(`✗ ${name}:`)
  for (const f of failures) console.log(`    · ${f}`)
  return 1
}

async function noMarker(page, failures, where) {
  if ((await page.locator('body').innerText()).includes(MARKER)) failures.push(`a copy's content shows on screen (${where})`)
}

// A crash while drawing: the error screen with Reload and Export my data. A
// null in the wins list is a shape the repair rules leave as it is, and it
// throws when the wins draw, so it stands in for any crash.
async function checkCrash(browser, url) {
  const save = { ...plainSave(), wins: [null] }
  const copyKey = `${RESCUE}2026-10-01T09:00:00.000Z`
  const r = await rescueCheck(browser, url, 'crash · en', async (context, failures) => {
    await seedOnce(context, [[KEY, JSON.stringify(save)], [copyKey, `{"note":"${MARKER}"`]])
    const page = await context.newPage()
    page.on('pageerror', () => {})
    await page.goto(url, { waitUntil: 'networkidle' })
    for (const tab of ['stats', 'shutdown', 'settings']) {
      if (await page.locator('[data-testid="crash-body"]').count()) break
      await page.locator(`[data-testid="nav-${tab}"]`).click({ timeout: 2000 }).catch(() => {})
    }
    await page.locator('[data-testid="crash-body"]').waitFor({ timeout: 5000 })
    const text = await page.locator('[data-testid="crash-body"]').innerText()
    if (text !== 'Something went wrong while showing this screen. What you’ve saved is still on this device.') failures.push(`crash line says "${text}"`)
    if (!(await page.locator('[data-testid="crash-reload"]').isVisible())) failures.push('no Reload button')
    await page.screenshot({ path: resolve(artifacts, 'crash.png') })
    const savedNow = (await storageNow(page))[KEY]
    const file = await exportFile(page, 'crash-export')
    if (JSON.stringify(file.state) !== JSON.stringify(JSON.parse(savedNow)) || file.state.wins[0] !== null) failures.push('the export does not hold what is saved')
    if (file.rescueCopies?.length !== 1 || file.rescueCopies[0].text !== `{"note":"${MARKER}"`) failures.push('the export does not hold the rescue copy')
    if (!(await page.locator('[data-testid="crash-body"]').isVisible())) failures.push('the screen went after Export')
    await noMarker(page, failures, 'crash')
  })
  if (!r) console.log('✓ crash · en — error screen with Reload and Export; the export is the saved data and every copy')
  return r
}

// Text that isn't JSON: a copy is kept and read back before anything is
// saved, a calm screen says so before onboarding, then saving goes on.
async function checkUnreadable(browser, url) {
  const raw = `{"settings":{"note":"${MARKER}","onboarded":tr`
  const r = await rescueCheck(browser, url, 'unreadable save · en', async (context, failures) => {
    await seedOnce(context, [[KEY, raw]])
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="rescue-kept"]').waitFor({ timeout: 5000 })
    const all = await storageNow(page)
    const keys = rescueIn(all)
    if (keys.length !== 1 || all[keys[0]] !== raw) failures.push(`rescue keys ${JSON.stringify(keys)} do not hold the original`)
    if (all[KEY] === raw) failures.push('the app key still holds the original, so saving did not go on')
    const text = await page.locator('[data-testid="rescue-kept"]').innerText()
    if (!text.includes('A copy of the old data is kept on this device')) failures.push(`screen says "${text.replace(/\s+/g, ' ')}"`)
    await noMarker(page, failures, 'kept screen')
    await page.locator('[data-testid="rescue-continue"]').click()
    await page.getByText('Welcome', { exact: false }).first().waitFor({ timeout: 3000 }).catch(() => {})
    if (await page.locator('[data-testid="rescue-kept"]').count()) failures.push('Continue did not lead on to onboarding')
    if ((await storageNow(page))[keys[0]] !== raw) failures.push('the copy changed')
  })
  if (!r) console.log('✓ unreadable save · en — copy kept and read back, calm screen before onboarding, saving goes on')
  return r
}

// Storage refuses the copy: the original stays, the screen says nothing new
// can be saved, Export leaves it up, and only Start fresh saves again.
async function checkRefused(browser, url) {
  const raw = `not json ${MARKER}`
  const r = await rescueCheck(browser, url, 'refused copy · en', async (context, failures) => {
    await seedOnce(context, [[KEY, raw]])
    await context.addInitScript(REFUSE_RESCUE, RESCUE)
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    const screen = page.locator('[data-testid="rescue-refused"]')
    await screen.waitFor({ timeout: 5000 })
    const text = await screen.innerText()
    if (!text.includes('nothing new can be saved yet')) failures.push(`screen says "${text.replace(/\s+/g, ' ')}"`)
    if (text.includes('copy of the old data is kept')) failures.push('it claims a copy was kept')
    if (!text.includes('Start fresh erases what couldn’t be read')) failures.push('Start fresh does not say it erases')
    let all = await storageNow(page)
    if (all[KEY] !== raw || rescueIn(all).length) failures.push('storage changed before Start fresh')
    const file = await exportFile(page, 'rescue-export')
    if (file.savedText !== raw) failures.push('the export does not hold the original')
    if (!(await screen.isVisible())) failures.push('Export closed the screen')
    await noMarker(page, failures, 'refused screen')
    await page.locator('[data-testid="rescue-start-fresh"]').click()
    if ((await storageNow(page))[KEY] !== raw) failures.push('the first tap on Start fresh erased it without asking')
    await page.locator('[data-testid="rescue-fresh-yes"]').click()
    await screen.waitFor({ state: 'detached', timeout: 3000 })
    all = await storageNow(page)
    if (all[KEY] === raw) failures.push('Start fresh did not start saving again')
    else if (JSON.parse(all[KEY]).settings.onboarded !== false) failures.push('Start fresh did not save a fresh state')
  })
  if (!r) console.log('✓ refused copy · en — original kept as it was, nothing saved until Start fresh, Export leaves the screen up')
  return r
}

// A habit with no schedule: set to daily and named, the original kept, the
// repaired data saved; with an older copy already there it gets a new key.
async function checkRepaired(browser, url) {
  const save = plainSave()
  delete save.habits[1].frequency
  save.wins[0].text = MARKER
  const raw = JSON.stringify(save)
  const oldKey = `${RESCUE}2026-10-01T09:00:00.000Z`
  const oldCopy = `{"habits":"${MARKER}"`
  const r = await rescueCheck(browser, url, 'repaired save · en', async (context, failures) => {
    await seedOnce(context, [[KEY, raw], [oldKey, oldCopy]])
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    const notice = page.locator('[data-testid="rescue-notice"]')
    await notice.waitFor({ timeout: 5000 })
    const daily = await page.locator('[data-testid="rescue-daily"]').allInnerTexts()
    if (daily.length !== 1 || daily[0] !== '“Evening walk” had no schedule saved, so it’s set to daily for now. You can change it in Settings.') failures.push(`daily line: ${JSON.stringify(daily)}`)
    const all = await storageNow(page)
    const keys = rescueIn(all)
    if (keys.length !== 2 || all[oldKey] !== oldCopy) failures.push('the older copy was not left as it was')
    const newKey = keys.find((k) => k !== oldKey)
    if (all[newKey] !== raw) failures.push('the new copy does not hold the original')
    if (JSON.parse(all[KEY]).habits.find((h) => h.id === 'walk-x1')?.frequency?.kind !== 'daily') failures.push('the repaired data was not saved')
    // The win shows on Today as usual; the copies never do.
    const shown = (await page.locator('body').innerText()).split(MARKER).length - 1
    if (shown > 1) failures.push(`marker shows ${shown} times`)
    await page.locator('[data-testid="rescue-notice-ok"]').click()
    await notice.waitFor({ state: 'detached', timeout: 3000 })
    await habitButton(page, 1).click()
    await page.waitForTimeout(200)
    const after = JSON.parse((await storageNow(page))[KEY])
    if (!Object.values(after.logs).some((d) => d['walk-x1'])) failures.push('a habit logged afterwards was not saved')
  })
  if (!r) console.log('✓ repaired save · en — habit named and set to daily, original kept under a new key, older copy untouched, saving goes on')
  return r
}

// A second failure with a copy already kept: a new dated copy, the old one
// untouched, and the screen says only what happened.
async function checkSecondFailure(browser, url) {
  const oldKey = `${RESCUE}2026-10-01T09:00:00.000Z`
  const oldCopy = `{"habits":"${MARKER}"`
  const raw = `{"settings":{"onbo ${MARKER}`
  const r = await rescueCheck(browser, url, 'second failure · en', async (context, failures) => {
    await seedOnce(context, [[KEY, raw], [oldKey, oldCopy]])
    const page = await context.newPage()
    await page.goto(url, { waitUntil: 'networkidle' })
    await page.locator('[data-testid="rescue-kept"]').waitFor({ timeout: 5000 })
    const all = await storageNow(page)
    const keys = rescueIn(all)
    if (keys.length !== 2 || all[oldKey] !== oldCopy) failures.push('the older copy was not left as it was')
    if (all[keys.find((k) => k !== oldKey)] !== raw) failures.push('the new copy does not hold the original')
    await noMarker(page, failures, 'kept screen')
  })
  if (!r) console.log('✓ second failure · en — a new dated copy, the older one untouched, calm screen')
  return r
}

// The app registers a service worker and loads its fonts from Google. In this
// run neither may happen: the worker is blocked and the fonts are aborted
// (that they show up as blocked also proves the allow-list is in force).
async function checkNetworkClosed(browser, url) {
  const context = await newContext(browser)
  await context.addInitScript(([k, v]) => { if (!localStorage.getItem(k)) localStorage.setItem(k, v) }, [KEY, JSON.stringify(plainSave())])
  const page = await context.newPage()
  const failures = []
  try {
    await page.goto(url, { waitUntil: 'load' })
    await page.waitForTimeout(1500) // the app registers its worker after load
    const worker = await page.evaluate(async () => ({
      controlled: Boolean(navigator.serviceWorker?.controller),
      registrations: navigator.serviceWorker ? (await navigator.serviceWorker.getRegistrations()).length : 0,
    }))
    if (worker.controlled || worker.registrations) failures.push(`a service worker registered (${worker.registrations})`)
  } catch (err) {
    failures.push(`threw: ${err.message}`)
  } finally {
    await context.close()
  }
  const blockedHosts = [...new Set(NETWORK.blocked.map((u) => new URL(u).host))]
  if (!blockedHosts.some((h) => h.endsWith('googleapis.com') || h.endsWith('gstatic.com'))) failures.push('the fonts were not seen and blocked, so the allow-list may not be in force')
  if (escaped().length) failures.push(`got past the allow-list: ${[...new Set(escaped())].join(', ')}`)
  if (NETWORK.fromWorker.length) failures.push(`answered by a service worker: ${[...new Set(NETWORK.fromWorker)].join(', ')}`)
  const stubbedHosts = [...new Set([...NETWORK.stubbed].map((u) => new URL(u).host))]
  if (failures.length === 0) {
    console.log(`✓ network — no service worker; ${NETWORK.outside.length} outside requests, all closed: blocked ${blockedHosts.join(', ')}; stubbed ${stubbedHosts.join(', ') || 'nothing'}`)
    return 0
  }
  console.log('✗ network:')
  for (const f of failures) console.log(`    · ${f}`)
  return 1
}

async function run() {
  const server = await preview({ root, preview: { port: 0 }, logLevel: 'silent' })
  const url = server.resolvedUrls.local[0]
  ORIGIN = new URL(url).origin
  const browser = await chromium.launch()
  let failed = 0

  for (const s of SCENARIOS) {
    const context = await newContext(browser, { locale: s.lang === 'ar' ? 'ar' : 'en-US' })
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
  // And using my location must not touch a reverse geocoder.
  failed += await checkNoReverseGeocode(browser, url)
  // And the task calendar action must send nothing until a tap (title/date only).
  failed += await checkTaskCalendarPrivacy(browser, url)
  // And the interactive tutorial: portal, fit, gesture flow, no trace, legacy skip.
  failed += await checkTutorial(browser, url)
  // And importing a file, a failed save, and two open tabs.
  failed += await checkImport(browser, url)
  failed += await checkSaveFailure(browser, url)
  failed += await checkTwoTabs(browser, url)
  // And saved data that can't be used as it was, and a crash while drawing.
  failed += await checkCrash(browser, url)
  failed += await checkUnreadable(browser, url)
  failed += await checkRefused(browser, url)
  failed += await checkRepaired(browser, url)
  failed += await checkSecondFailure(browser, url)
  // Last, so it covers every request the run made.
  failed += await checkNetworkClosed(browser, url)

  await browser.close()
  await server.close()

  const total = SCENARIOS.length + 15
  if (failed) {
    console.log(`\nviewport-fit E2E: ${failed} of ${total} check(s) failed.`)
    process.exit(1)
  }
  console.log(`\nviewport-fit E2E: all ${total} checks passed.`)
}

run().catch((err) => { console.error(err); process.exit(1) })
