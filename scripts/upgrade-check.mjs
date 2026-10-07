// ---------------------------------------------------------------------------
// upgrade-check.mjs — prove a phone keeps its data when the app updates, and
// again when an update is reverted.
//
// Two builds are served one after the other from the SAME local address into
// the SAME browser profile, so the newer build opens exactly what the older one
// saved (that's what happens on a real phone after a deploy). The browser clock
// is pinned and the prayer-times service is stubbed, so nothing leaves the
// machine and every run sees the same day.
//
// Four saved states, each made with made-up data:
//   1. a place typed as an address (Chicago), set through the old build, with
//      this month's prayer times saved
//   2. a place from "use my location" (a mock position in Chicago), with this
//      month's prayer times saved
//   3. a location the old build filled in by default and saved. This only
//      exists while the old build still has a default; the script never holds
//      one itself. It seeds no location, lets the old build fill it in, and
//      skips the state cleanly when the old build leaves it empty.
//   4. no location setting at all, put straight into storage for the new build
//
// Forward (old build, then new): states 1 to 3 must keep every habit, log,
// streak and the saved location, and their exports must match apart from
// exportedAt and lastExportAt. Saved prayer times must match too, and the saved
// month must show on Today with no new request. State 4 must match the old build's view of the
// same save in everything but the location, which ends empty.
// Reverse (new build, then old again, which is what a revert does): the old
// build must open what the new one saved with nothing lost.
//
// Three more saved states, written in today's saved shape (the old build's own
// built-in habits plus made-up data), then opened and saved by the old build:
//   5. a new person on day one
//   6. a long-time person: every phase unlocked, months of logs, finished
//      tasks, wins, food, and every other part of the save filled in
//   7. a person with Islamic practices off
// For each, the new build opens what the old build saved, and separately
// imports the old build's export through the restore sheet. Both must match
// the old build on every habit, log, streak, percent and label on Today and
// Stats, and in the export apart from exportedAt and lastExportAt. Then the
// old build opens what the new one saved, with nothing lost.
// Reset: on the new build, Reset everything must leave the app's key holding
// only a fresh state, and the prayer cache key must be gone.
//
// Run:  npm run build
//       node scripts/upgrade-check.mjs --old <old dist folder> --new dist
// ---------------------------------------------------------------------------

import { chromium } from 'playwright'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, existsSync, statSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, extname, normalize } from 'node:path'
import { isDeepStrictEqual } from 'node:util'

const args = process.argv.slice(2)
const arg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null }
const OLD = arg('--old') && resolve(arg('--old'))
const NEW = resolve(arg('--new') || 'dist')
if (!OLD || !existsSync(join(OLD, 'index.html')) || !existsSync(join(NEW, 'index.html'))) {
  console.error('usage: node scripts/upgrade-check.mjs --old <old dist> --new <new dist>  (both need an index.html)')
  process.exit(2)
}

const STORAGE_KEY = 'the-rebuild:v1'
const PRAYER_CACHE_KEY = 'rebuild:prayer-cache:v2'
const TODAY = '2026-10-05'
const PINNED = new Date('2026-10-05T19:30:00-05:00') // a Monday evening in Chicago
const CHICAGO = { latitude: 41.8781, longitude: -87.6298 }
const TYPED_PLACE = 'Chicago, IL'

// Screen text that is meant to change between the two builds. Each pair is
// [old, new]; both read as the same thing when screens are compared. Anything
// not listed here must match exactly. Update this list with each wording change.
const WORDING_CHANGES = [
  [/^— /gm, ''], // the quote citation lost its leading dash
  ['Set your location to see prayer times. It stays on this device.',
    'Set your location to see prayer times. It’s saved on this device. To look up the times, AlAdhan gets the place you type, or your position rounded to about 1 km.'],
]
function sameWording(text) {
  let t = text
  for (const [from, to] of WORDING_CHANGES) t = typeof from === 'string' ? t.split(from).join(to) : t.replace(from, to)
  return t
}

// --- a static server whose folder can be swapped between builds -------------

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2',
}
let servedDir = OLD
const server = createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  if (path === '/__blank') {
    res.writeHead(200, { 'content-type': 'text/html' })
    return res.end('<!doctype html><title>blank</title>')
  }
  let file = normalize(join(servedDir, path))
  if (!file.startsWith(servedDir)) { res.writeHead(403); return res.end() }
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(servedDir, 'index.html')
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' })
  res.end(readFileSync(file))
})
await new Promise((ok) => server.listen(0, '127.0.0.1', ok))
const ORIGIN = `http://127.0.0.1:${server.address().port}`

const bundleOf = (dir) => (readFileSync(join(dir, 'index.html'), 'utf8').match(/assets\/index-[\w-]+\.js/) || [])[0]
const BUNDLE = { old: bundleOf(OLD), new: bundleOf(NEW) }
if (!BUNDLE.old || !BUNDLE.new) { console.error('could not find the app bundle in one of the builds'); process.exit(2) }
if (BUNDLE.old === BUNDLE.new) console.log('note: both folders hold the same bundle')

// --- the prayer-times stub (believable Chicago times, never a real request) ---

function stubMonth(url) {
  const m = /\/v1\/calendar(?:ByAddress)?\/(\d{4})\/(\d{1,2})/.exec(url)
  if (!m) return { code: 400, data: [] }
  const [y, mo] = [Number(m[1]), Number(m[2])]
  const days = new Date(y, mo, 0).getDate()
  // Early-October Chicago times (ISNA) with their daily drift.
  const base = { Fajr: [5, 34, 1.1], Sunrise: [6, 51, 1.2], Dhuhr: [12, 43, -0.3], Asr: [16, 3, -1.4], Maghrib: [18, 35, -1.7], Isha: [19, 49, -1.6] }
  const p = (n) => String(n).padStart(2, '0')
  const data = []
  for (let d = 1; d <= days; d++) {
    const timings = {}
    for (const [k, [h, min, drift]] of Object.entries(base)) {
      const t = h * 60 + min + Math.round(drift * (d - 1))
      timings[k] = `${p(Math.floor(t / 60))}:${p(t % 60)} (CDT)`
    }
    data.push({ timings, date: { gregorian: { date: `${p(d)}-${p(mo)}-${y}` } } })
  }
  return { code: 200, status: 'OK', data }
}

// --- made-up saved data -------------------------------------------------------

function addDays(key, n) {
  const [y, m, d] = key.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

// A save from someone a month in. `location` is left out entirely when undefined.
function sampleSave(location) {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const logs = {}
  for (let i = 1; i <= 34; i++) {
    const day = addDays(TODAY, -i)
    const l = {}
    l.salah = Object.fromEntries(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((p) => [p, rnd() < 0.85 ? 'ontime' : 'late']))
    if (rnd() < 0.9) l.sleep = { status: rnd() < 0.8 ? 'full' : 'min' }
    if (rnd() < 0.93) l.bed = { status: 'full' }
    if (i % 7 === 1 || i % 7 === 3 || i % 7 === 5) l.gym = { status: 'full' }
    if (rnd() < 0.7) l['plan-tomorrow'] = { status: rnd() < 0.7 ? 'full' : 'min' }
    if (rnd() < 0.6) l.read = { status: 'full' }
    if (rnd() < 0.8) l['stretch-x1'] = { status: 'full' }
    logs[day] = l
  }
  logs[TODAY] = { salah: { fajr: 'ontime', dhuhr: 'ontime', asr: 'late' }, bed: { status: 'full' }, sleep: { status: 'full' } }
  const settings = {
    onboarded: true, tourSeen: true, language: 'en', theme: 'ivory', currentPhase: 2, includeIslamic: true,
    dayRolloverHour: 3, collapseDefaultsApplied: true, tasksCollapsed: false, foodCollapsed: false,
  }
  if (location !== undefined) settings.prayerLocation = location
  return {
    version: 2,
    settings,
    habits: [{ id: 'stretch-x1', name: 'Evening stretch', emoji: '🧘', phase: 1, type: 'standard', frequency: { kind: 'daily' }, minVersion: 'One stretch', stock: false, archived: false, createdAt: '2026-09-01T12:00:00.000Z' }],
    logs,
    days: { [addDays(TODAY, -9)]: { roughDay: true }, [addDays(TODAY, -1)]: { gratitude: ['Long walk by the lake', 'Called my sister', 'Cooked dinner at home'] } },
    votes: 214,
    wins: [{ id: 'w1', at: Date.parse('2026-09-28T21:00:00Z'), text: 'Ran three miles without stopping' }],
    tasks: [{ id: 't1', text: 'Renew library card', createdAt: 1, createdDay: addDays(TODAY, -2), dueDay: TODAY, doneDay: null, doneAt: null, source: 'manual' }],
    food: [{ id: 'f1', text: 'Oatmeal with banana', at: Date.parse('2026-10-05T13:10:00Z'), day: TODAY }],
  }
}

// --- the browser: one profile, one address, pinned clock ---------------------

const profile = mkdtempSync(join(tmpdir(), 'rebuild-upgrade-'))
const context = await chromium.launchPersistentContext(profile, {
  viewport: { width: 390, height: 844 },
  locale: 'en-US',
  timezoneId: 'America/Chicago',
  geolocation: CHICAGO,
  permissions: ['geolocation'],
  acceptDownloads: true,
  // Without this the worker could hand back the previous build's files and the
  // check would compare a build with itself. The bundle check below confirms it.
  serviceWorkers: 'block',
})
await context.clock.setFixedTime(PINNED)

let prayerCalls = 0
const leaked = []
const finerThanTwoDecimals = [] // coordinates the new build sent with more than two decimals
await context.route('**/*', (route) => {
  const u = route.request().url()
  if (u.startsWith(ORIGIN)) return route.continue()
  if (u.includes('aladhan.com')) {
    prayerCalls++
    const q = new URL(u).searchParams
    for (const k of ['latitude', 'longitude']) {
      if (servedDir === NEW && q.has(k) && !/^-?\d+(\.\d{1,2})?$/.test(q.get(k))) finerThanTwoDecimals.push(k)
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stubMonth(u)) })
  }
  leaked.push(new URL(u).host)
  return route.abort() // fonts and anything else: never sent
})

const page = context.pages()[0] || await context.newPage()
const consoleErrors = []
page.on('pageerror', (e) => consoleErrors.push(e.message))

// --- helpers --------------------------------------------------------------------

async function openApp(which, { waitForNav = true } = {}) {
  servedDir = which === 'old' ? OLD : NEW
  await page.goto(`${ORIGIN}/`, { waitUntil: 'networkidle' })
  if (waitForNav) await page.locator('nav button').first().waitFor()
  const loaded = await page.evaluate(() => [...document.scripts].map((s) => s.src).join(' '))
  if (!loaded.includes(BUNDLE[which])) throw new Error(`expected the ${which} build, got another bundle`)
  await page.waitForTimeout(300)
}

async function resetStorage(save) {
  await page.goto(`${ORIGIN}/__blank`)
  await page.evaluate(([k, v]) => { localStorage.clear(); if (v) localStorage.setItem(k, v) }, [STORAGE_KEY, save ? JSON.stringify(save) : null])
}

const saved = () => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), STORAGE_KEY)
const savedPrayers = () => page.evaluate((k) => localStorage.getItem(k), PRAYER_CACHE_KEY)

// Wait until this month's prayer times are saved for the location just set.
const waitForSavedMonth = () => page.waitForFunction(([k, month]) => {
  const c = JSON.parse(localStorage.getItem(k) || '{}')
  return Object.values(c).some((byMonth) => byMonth && byMonth[month])
}, [PRAYER_CACHE_KEY, TODAY.slice(0, 7)])

// Today's Fajr as the stub serves it, in the two ways the card might print it.
function stubFajrToday() {
  const d = Number(TODAY.slice(8, 10))
  const t = 5 * 60 + 34 + Math.round(1.1 * (d - 1))
  const h = Math.floor(t / 60), m = String(t % 60).padStart(2, '0')
  return [`${String(h).padStart(2, '0')}:${m}`, `${h}:${m}`]
}

const tab = (name) => page.locator('nav button', { hasText: name }).click()

async function screenText(name) {
  await tab(name)
  await page.waitForTimeout(250)
  return sameWording(await page.evaluate(() => document.querySelector('main')?.innerText ?? document.body.innerText))
}

// The streak shown for each habit on Stats (🔥 number), by habit name.
async function streaks() {
  await tab('Stats')
  await page.waitForTimeout(250)
  return page.evaluate(() => [...document.querySelectorAll('button')]
    .map((b) => b.innerText)
    .filter((t) => t.includes('🔥'))
    .map((t) => t.replace(/\s+/g, ' ').trim()))
}

async function exportBackup() {
  await tab('Settings')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export JSON' }).click(),
  ])
  const json = JSON.parse(readFileSync(await download.path(), 'utf8'))
  await page.waitForTimeout(150)
  return json
}

// What a snapshot holds, in numbers, for the before and after table.
function summary(snap) {
  const st = snap.state
  return {
    habits: st.habits.filter((h) => !h.archived).length,
    loggedDays: Object.values(st.logs || {}).filter((d) => Object.keys(d).length).length,
    streaks: snap.streaks.length,
    percents: (snap.stats.match(/\d+%/g) || []).join(' '),
    votes: st.votes,
    tasks: (st.tasks || []).length,
    archived: (st.taskArchive || []).length,
    food: (st.food || []).length,
    wins: (st.wins || []).length,
    exportBytes: JSON.stringify(comparable(snap.exported)).length,
  }
}

// Import a backup file on the build that is open, through the restore sheet.
async function importFile(json) {
  await tab('Settings')
  await page.locator('input[type="file"][accept*="json"]').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(json) })
  await page.locator('[data-testid="restore-replace"]').click()
  await page.locator('[data-testid="restore-sheet"]').waitFor({ state: 'detached' })
  await page.waitForTimeout(300)
}

// Strip the two fields that are allowed to differ between exports.
function comparable(exported, { dropLocation = false } = {}) {
  const e = structuredClone(exported)
  delete e.exportedAt
  if (e.state?.settings) {
    delete e.state.settings.lastExportAt
    if (dropLocation) delete e.state.settings.prayerLocation
  }
  return e
}

async function snapshot() {
  const exported = await exportBackup()
  return {
    state: await saved(),
    prayers: await savedPrayers(),
    exported,
    streaks: await streaks(),
    stats: await screenText('Stats'),
    today: await screenText('Today'),
  }
}

// Which top-level parts of two exports differ (names only, never values).
function diffKeys(a, b) {
  const out = []
  const keys = new Set([...Object.keys(a.state || {}), ...Object.keys(b.state || {})])
  for (const k of keys) if (!isDeepStrictEqual(a.state?.[k], b.state?.[k])) out.push(`state.${k}`)
  if (a.schemaVersion !== b.schemaVersion) out.push('schemaVersion')
  return out
}

// The lines that differ between two screen texts, for the failure message.
function lineDiff(a, b) {
  const A = a.split('\n'), B = b.split('\n')
  const out = []
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] !== B[i]) out.push(`      - ${A[i] ?? ''}\n      + ${B[i] ?? ''}`)
  }
  return out.slice(0, 6).join('\n')
}

function compare(label, before, after, { location = 'same' } = {}) {
  const failures = []
  const dropLocation = location !== 'same'
  const s1 = before.state, s2 = after.state
  if (!isDeepStrictEqual(s1.habits, s2.habits)) failures.push('habits differ')
  if (!isDeepStrictEqual(s1.logs, s2.logs)) failures.push('logs differ')
  if (!isDeepStrictEqual(before.streaks, after.streaks)) failures.push('streaks on Stats differ')
  if (before.stats !== after.stats) failures.push('Stats screen text differs')
  if (location === 'same') {
    if (!isDeepStrictEqual(s1.settings.prayerLocation, s2.settings.prayerLocation)) failures.push('saved location differs')
    if (before.prayers !== after.prayers) failures.push('saved prayer times differ')
    if (before.today !== after.today) failures.push(`Today screen text differs:\n${lineDiff(before.today, after.today)}`)
  } else if (location === 'empty') {
    if (s2.settings.prayerLocation !== null) failures.push('location is not empty')
  }
  const e1 = comparable(before.exported, { dropLocation }), e2 = comparable(after.exported, { dropLocation })
  if (!isDeepStrictEqual(e1, e2)) failures.push(`exports differ in ${diffKeys(e1, e2).join(', ') || 'envelope'}`)
  if (failures.length) {
    console.log(`✗ ${label}`)
    for (const f of failures) console.log(`    · ${f}`)
    return false
  }
  const days = Object.keys(s2.logs || {}).length
  console.log(`✓ ${label}: ${s2.habits.length} habits, ${days} logged days, ${after.streaks.length} streaks, export matches`)
  return true
}

// --- the four states --------------------------------------------------------------

async function makeTyped() {
  await resetStorage(sampleSave(null))
  await openApp('old')
  await tab('Settings')
  await page.getByPlaceholder('City, Country').first().fill(TYPED_PLACE)
  await page.getByRole('button', { name: 'Set', exact: true }).first().click()
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k))?.settings?.prayerLocation?.mode === 'address', STORAGE_KEY)
  const loc = (await saved()).settings.prayerLocation
  if (loc.address !== TYPED_PLACE) throw new Error('typed place was not saved as typed')
  await waitForSavedMonth()
  return true
}

async function makeLocated() {
  await resetStorage(sampleSave(null))
  await openApp('old')
  await tab('Settings')
  await page.locator('[data-testid="use-my-location"]').first().click()
  await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k))?.settings?.prayerLocation?.mode === 'coords', STORAGE_KEY)
  const loc = (await saved()).settings.prayerLocation
  if (Math.abs(loc.lat - CHICAGO.latitude) > 1e-6 || Math.abs(loc.lng - CHICAGO.longitude) > 1e-6) throw new Error('mock position was not saved')
  await waitForSavedMonth()
  return true
}

// Seed no location setting and let the old build fill one in. Never printed.
async function makeOldDefault() {
  await resetStorage(sampleSave(undefined))
  await openApp('old')
  const loc = (await saved()).settings.prayerLocation
  if (loc == null) return false // the old build has no default any more: skip
  if (typeof loc !== 'object' || !loc.mode) throw new Error('old build saved an unexpected location shape')
  return true
}

const STATES = [
  { n: 1, name: 'typed address', make: makeTyped },
  { n: 2, name: 'use my location', make: makeLocated },
  { n: 3, name: 'default saved by the old build', make: makeOldDefault },
  { n: 4, name: 'no location setting', make: null },
]

// --- states 5 to 7, in today's saved shape --------------------------------------

// The old build's own built-in habits, exactly as it saves them.
async function builtInHabits() {
  await resetStorage({ settings: { onboarded: true, tourSeen: true } })
  await openApp('old')
  return (await saved()).habits
}

function fullSettings(patch) {
  return {
    dayRolloverHour: 3, currentPhase: 1, theme: 'ivory', language: 'en', includeIslamic: true, prayerLocation: null,
    tasksCollapsed: false, foodCollapsed: false, collapseDefaultsApplied: true, tourSeen: true,
    pinHash: null, pinSalt: null, pinFails: 0, pinLockUntil: 0, dismissedUnlock: {}, prayerAdjustMin: {},
    lastExportAt: null, onboarded: true, ...patch,
  }
}

function emptyParts() {
  return {
    days: {}, weeklyReviews: {}, focusThisWeek: null, privateLog: { entries: [], waves: [] },
    votes: 0, wins: [], tasks: [], taskArchive: [], myQuotes: [], food: [],
  }
}

const at = (day, hhmm) => Date.parse(`${day}T${hhmm}:00-05:00`)

function dayOneSave(habits) {
  return {
    version: 2,
    settings: fullSettings({ currentPhase: 1 }),
    habits: habits.map((h) => (h.id === 'clean-feed' || h.id === 'phone-kitchen' ? { ...h, archived: true } : h)),
    logs: { [TODAY]: { bed: { status: 'full', at: at(TODAY, '07:40') }, sleep: { status: 'min', at: at(TODAY, '07:41') }, salah: { fajr: 'ontime' } } },
    ...emptyParts(),
    votes: 3,
    tasks: [{ id: 'd1', text: 'Buy a water bottle', createdAt: at(TODAY, '08:00'), createdDay: TODAY, dueDay: TODAY, doneDay: null, doneAt: null, source: 'manual' }],
    food: [{ id: 'df1', text: 'Toast and eggs', at: at(TODAY, '08:15'), day: TODAY }],
  }
}

function longTimeSave(habits) {
  let seed = 11
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  const logs = {}
  const days = {}
  const food = []
  const ids = habits.filter((h) => h.type !== 'salah').map((h) => h.id)
  for (let i = 0; i <= 150; i++) {
    const day = addDays(TODAY, -i)
    const l = {}
    if (i > 0 || rnd() < 2) l.salah = Object.fromEntries(['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'].map((p) => [p, rnd() < 0.8 ? 'ontime' : 'late']))
    for (const id of ids) {
      const r = rnd()
      if (r < 0.62) l[id] = { status: 'full', at: at(day, '12:00') }
      else if (r < 0.74) l[id] = { status: 'min', at: at(day, '12:00') }
    }
    if (i % 23 === 7) delete l.gym // a few gaps
    logs[day] = l
    if (i % 3 === 0) food.push({ id: `lf${i}`, text: ['Oatmeal', 'Lentil soup', 'Chicken and rice', 'Apple and peanut butter'][i % 4], at: at(day, '13:05'), day })
    if (i % 9 === 4) days[day] = { roughDay: true }
    if (i % 5 === 1) days[day] = { ...(days[day] || {}), gratitude: ['A long walk', 'Dinner with family'], shutdownAt: at(day, '22:10') }
    if (i % 12 === 2) days[day] = { ...(days[day] || {}), journal: { text: 'Steady day. Slept on time.' } }
  }
  logs[TODAY] = { salah: { fajr: 'ontime', dhuhr: 'ontime' }, bed: { status: 'full', at: at(TODAY, '07:30') }, read: { status: 'min', at: at(TODAY, '08:00') } }
  return {
    version: 2,
    settings: fullSettings({ currentPhase: 5, theme: 'sage', dismissedUnlock: { 2: true }, prayerAdjustMin: { fajr: 2, isha: -3 }, lastExportAt: at(addDays(TODAY, -20), '20:00') }),
    habits: [...habits, { id: 'stretch-x2', name: 'Morning stretch', emoji: '🧘', phase: 2, type: 'standard', frequency: { kind: 'daily' }, minVersion: 'Touch my toes once', stock: false, archived: false, createdAt: '2026-05-10T12:00:00.000Z' }],
    logs,
    ...emptyParts(),
    days,
    weeklyReviews: { [addDays(TODAY, -8)]: { focus: 'Lights out by eleven', checklist: {}, done: true } },
    focusThisWeek: { text: 'Lights out by eleven', weekKey: addDays(TODAY, -1) },
    privateLog: {
      entries: [
        { id: 'pe1', at: at(addDays(TODAY, -12), '21:40'), trigger: 'boredom', note: 'Went for a walk instead', rodeOut: true },
        { id: 'pe2', at: at(addDays(TODAY, -3), '23:05'), trigger: 'urge', note: '', rodeOut: false },
      ],
      waves: [],
    },
    votes: 3912,
    wins: [
      { id: 'lw1', at: at(addDays(TODAY, -2), '19:00'), text: 'Ran my first 5k' },
      { id: 'lw2', at: at(addDays(TODAY, -40), '19:00'), text: 'Cooked every night this week' },
      { id: 'lw3', at: at(addDays(TODAY, -90), '19:00'), text: 'Paid off the card' },
    ],
    tasks: [
      { id: 'lt1', text: 'Return library books', createdAt: at(addDays(TODAY, -3), '09:00'), createdDay: addDays(TODAY, -3), dueDay: TODAY, doneDay: null, doneAt: null, source: 'manual' },
      { id: 'lt2', text: 'Call the dentist', createdAt: at(TODAY, '09:00'), createdDay: TODAY, dueDay: TODAY, doneDay: TODAY, doneAt: at(TODAY, '10:00'), source: 'manual' },
      { id: 'lt3', text: 'Plan the weekend trip', createdAt: at(addDays(TODAY, -1), '22:00'), createdDay: addDays(TODAY, -1), dueDay: addDays(TODAY, 1), doneDay: null, doneAt: null, source: 'shutdown' },
      { id: 'lt4', text: 'Send the rent', createdAt: at(addDays(TODAY, -4), '09:00'), createdDay: addDays(TODAY, -4), dueDay: addDays(TODAY, -2), doneDay: addDays(TODAY, -2), doneAt: at(addDays(TODAY, -2), '11:00'), source: 'manual' },
    ],
    taskArchive: [
      { id: 'la1', text: 'Renew car registration', createdAt: at(addDays(TODAY, -30), '09:00'), createdDay: addDays(TODAY, -30), dueDay: addDays(TODAY, -28), doneDay: addDays(TODAY, -28), doneAt: at(addDays(TODAY, -28), '10:00'), source: 'manual', reason: 'completed', archivedAt: at(addDays(TODAY, -27), '03:10'), archivedDay: addDays(TODAY, -27) },
      { id: 'la2', text: 'Old idea for a shelf', createdAt: at(addDays(TODAY, -15), '09:00'), createdDay: addDays(TODAY, -15), dueDay: addDays(TODAY, -15), doneDay: null, doneAt: null, source: 'manual', reason: 'deleted', archivedAt: at(addDays(TODAY, -14), '18:00'), archivedDay: addDays(TODAY, -14) },
    ],
    myQuotes: [{ id: 'mq1', at: at(addDays(TODAY, -60), '08:00'), text: 'Small and steady beats big and rare.' }],
    food,
  }
}

function islamicOffSave(habits) {
  const logs = {}
  for (let i = 0; i <= 40; i++) {
    const day = addDays(TODAY, -i)
    logs[day] = {
      salah: { fajr: 'ontime', dhuhr: i % 4 ? 'ontime' : 'late' },
      bed: { status: i % 6 ? 'full' : 'min', at: at(day, '07:00') },
      ...(i % 5 ? { sleep: { status: 'full', at: at(day, '07:00') } } : {}),
      ...(i % 2 ? { quran: { status: 'full', at: at(day, '21:00') } } : {}),
      ...(i % 3 === 0 ? { read: { status: 'full', at: at(day, '21:30') } } : {}),
      ...(i % 7 === 0 ? { 'weekly-plan': { status: 'full', at: at(day, '18:00') } } : {}),
    }
  }
  return {
    version: 2,
    settings: fullSettings({ currentPhase: 3, includeIslamic: false, theme: 'charcoal' }),
    habits,
    logs,
    ...emptyParts(),
    votes: 188,
    wins: [{ id: 'iw1', at: at(addDays(TODAY, -6), '20:00'), text: 'Kept the phone out of the bedroom all week' }],
    food: [{ id: 'if1', text: 'Greek yogurt', at: at(TODAY, '09:20'), day: TODAY }],
  }
}

const NEW_STATES = [
  { n: 5, name: 'day one', make: dayOneSave, base: islamicOffSave },
  { n: 6, name: 'long-time', make: longTimeSave, base: dayOneSave },
  { n: 7, name: 'Islamic practices off', make: islamicOffSave, base: dayOneSave },
]

let failed = 0
const fwd = { checked: 0, skipped: 0 }
const rev = { checked: 0, skipped: 0 }

try {
  for (const st of STATES) {
    const label = `state ${st.n} (${st.name})`
    try {
      let before, location = 'same'
      if (st.make) {
        const made = await st.make()
        if (!made) {
          console.log(`- ${label}: skipped, the old build saved no default location`)
          fwd.skipped++; rev.skipped++
          continue
        }
        before = await snapshot()
      } else {
        // Reference: the old build's view of the same save. Then wipe it and put
        // the save straight into storage for the new build.
        await resetStorage(sampleSave(undefined))
        await openApp('old')
        before = await snapshot()
        await resetStorage(sampleSave(undefined))
        location = 'empty'
      }

      const callsBefore = prayerCalls
      await openApp('new')
      const after = await snapshot()
      if (location === 'empty' && prayerCalls !== callsBefore) {
        console.log(`✗ ${label}: the new build asked for prayer times with no location set`)
        failed++
      }
      if (location === 'same' && before.prayers) {
        if (prayerCalls !== callsBefore) {
          console.log(`✗ ${label}: the new build asked for a month that was already saved`)
          failed++
        } else if (!stubFajrToday().some((t) => after.today.includes(t))) {
          console.log(`✗ ${label}: the saved month does not show on Today`)
          failed++
        } else {
          console.log(`✓ ${label}: saved month shows on Today with no new request`)
        }
      }
      if (compare(`forward ${label}`, before, after, { location })) fwd.checked++
      else failed++

      // Revert: the old build opens what the new one saved.
      await openApp('old')
      const reverted = await snapshot()
      if (compare(`reverse ${label}`, after, reverted)) rev.checked++
      else failed++
    } catch (err) {
      console.log(`✗ ${label}: threw: ${err.message}`)
      failed++
    }
  }

  const habits = await builtInHabits()
  const table = []
  for (const st of NEW_STATES) {
    const label = `state ${st.n} (${st.name})`
    try {
      // The old build opens the save and writes it back in its own hands.
      await resetStorage(st.make(habits))
      await openApp('old')
      const before = await snapshot()
      const oldExport = JSON.stringify(before.exported)

      // The new build opens what the old one saved.
      await openApp('new')
      const opened = await snapshot()
      if (compare(`forward ${label}`, before, opened)) fwd.checked++
      else failed++
      await openApp('old')
      if (compare(`reverse ${label}`, opened, await snapshot())) rev.checked++
      else failed++

      // The new build imports the old build's export over someone else's save.
      await resetStorage(st.base(habits))
      await openApp('new')
      await importFile(oldExport)
      const imported = await snapshot()
      if (compare(`import ${label}`, before, imported)) fwd.checked++
      else failed++
      await openApp('old')
      const revertedImport = await snapshot()
      if (compare(`reverse after import ${label}`, imported, revertedImport)) rev.checked++
      else failed++

      table.push({ state: `${st.n} ${st.name}`, old: summary(before), new: summary(opened), imported: summary(imported), reverted: summary(revertedImport) })
    } catch (err) {
      console.log(`✗ ${label}: threw: ${err.message}`)
      failed++
    }
  }
  console.log('\nbefore and after (old build, new build opening it, new build importing its export, old build again):')
  for (const row of table) {
    for (const k of ['old', 'new', 'imported', 'reverted']) console.log(`  ${row.state.padEnd(26)} ${k.padEnd(9)} ${JSON.stringify(row[k])}`)
  }

  // Reset everything on the new build: the app's key holds only a fresh state
  // and the prayer cache key is gone.
  try {
    await resetStorage(null)
    await openApp('new', { waitForNav: false })
    await page.waitForFunction((k) => localStorage.getItem(k) !== null, STORAGE_KEY)
    const fresh = await saved()
    await resetStorage(sampleSave({ mode: 'coords', lat: CHICAGO.latitude, lng: CHICAGO.longitude }))
    await openApp('new')
    await waitForSavedMonth()
    await tab('Settings')
    page.once('dialog', (d) => d.accept())
    await page.getByRole('button', { name: 'Reset everything' }).click()
    await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k))?.settings?.onboarded === false, STORAGE_KEY)
    await page.waitForTimeout(300)
    const after = await saved()
    const cacheLeft = await savedPrayers()
    const keysLeft = await page.evaluate(() => Object.keys(localStorage).sort())
    // createdAt stamps are the only thing allowed to differ between two fresh states.
    const strip = (st) => JSON.parse(JSON.stringify(st, (k, v) => (k === 'createdAt' ? undefined : v)))
    const problems = []
    if (!isDeepStrictEqual(strip(after), strip(fresh))) problems.push('the app key does not hold a fresh state')
    if (cacheLeft !== null) problems.push('the prayer cache key is still there')
    if (problems.length) { console.log('✗ reset'); for (const p of problems) console.log(`    · ${p}`); failed++ }
    else console.log(`✓ reset: fresh state only, prayer cache gone (keys left: ${keysLeft.join(', ')})`)
  } catch (err) {
    console.log(`✗ reset: threw: ${err.message}`)
    failed++
  }
} finally {
  await context.close()
  server.close()
  rmSync(profile, { recursive: true, force: true })
}

if (leaked.length) console.log(`blocked outside requests: ${[...new Set(leaked)].join(', ')}`)
if (consoleErrors.length) { console.log(`page errors: ${consoleErrors.length}`); for (const e of consoleErrors) console.log(`    · ${e}`); failed++ }
console.log(`prayer-times requests answered by the stub: ${prayerCalls}`)
if (finerThanTwoDecimals.length) { console.log(`✗ the new build sent coordinates finer than two decimals (${finerThanTwoDecimals.length})`); failed++ }
console.log(`forward: ${fwd.checked} checked, ${fwd.skipped} skipped`)
console.log(`reverse: ${rev.checked} checked, ${rev.skipped} skipped`)
if (failed) {
  console.log(`\nupgrade check: ${failed} problem(s).`)
  process.exit(1)
}
console.log('\nUPGRADE CHECK PASSED')
