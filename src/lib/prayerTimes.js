// ---------------------------------------------------------------------------
// prayerTimes.js — real prayer times for Fishers, Indiana via the free AlAdhan
// API, built to work offline.
//
// Strategy:
//   • We fetch a WHOLE MONTH at a time (AlAdhan's calendar endpoint) and cache
//     it in localStorage. One fetch covers ~30 days offline.
//   • Reads always come from the cache; a missing month triggers a background
//     fetch. If you're offline and the month isn't cached, we fall back to any
//     times you entered manually in Settings.
//   • Per-prayer minute offsets (settings.prayerAdjustMin) let you nudge any
//     time to match your local masjid's iqamah.
//
// Method 2 = ISNA, the usual North-American calculation method.
// This module is framework-free; the React glue lives in hooks/usePrayerTimes.js
// ---------------------------------------------------------------------------

const CACHE_KEY = 'rebuild:prayer-cache:v1'
const METHOD = 2 // ISNA
const LOCATION = { city: 'Fishers', country: 'USA', state: 'Indiana' }

export const PRAYER_KEYS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
// Order including sunrise, used when finding the "current window".
export const TIME_KEYS = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha']

// --- cache ------------------------------------------------------------------

function loadCache() {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {} } catch { return {} }
}
function saveCache(c) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(c)) } catch { /* quota */ }
}
const monthOf = (dateKey) => dateKey.slice(0, 7) // "YYYY-MM"

/** The cached month record for a date, or null. */
export function getCachedMonth(dateKey) {
  return loadCache()[monthOf(dateKey)] || null
}

/** Raw (unadjusted) times for a day from cache: { times, source:'cache' } | null. */
export function getRawTimes(dateKey) {
  const m = getCachedMonth(dateKey)
  if (m && m.days[dateKey]) return { times: m.days[dateKey], source: 'cache', fetchedAt: m.fetchedAt }
  return null
}

// --- parsing / math ---------------------------------------------------------

function parseHM(s) {
  const m = /(\d{1,2}):(\d{2})/.exec(s || '')
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

/** Shift a "HH:mm" by ±minutes, returning "HH:mm" (clamped to the same day). */
function shiftHM(hm, minutes) {
  if (!hm) return hm
  if (!minutes) return hm
  const [h, m] = hm.split(':').map(Number)
  const d = new Date(2000, 0, 1, h, m + minutes)
  const p = (n) => String(n).padStart(2, '0')
  return `${p(d.getHours())}:${p(d.getMinutes())}`
}

// --- fetching ---------------------------------------------------------------

/**
 * Fetch and cache the month containing dateKey. Returns that day's raw times
 * (or null). Throws on network/API failure so callers can fall back to cache.
 */
export async function fetchMonth(dateKey) {
  const [y, m] = dateKey.split('-')
  // Path-style URL (calendarByCity/YEAR/MONTH). The query-param form 302-redirects
  // to this; hitting it directly avoids an extra round-trip.
  const url = `https://api.aladhan.com/v1/calendarByCity/${y}/${Number(m)}`
    + `?city=${encodeURIComponent(LOCATION.city)}`
    + `&country=${encodeURIComponent(LOCATION.country)}`
    + `&state=${encodeURIComponent(LOCATION.state)}`
    + `&method=${METHOD}`

  const res = await fetch(url)
  if (!res.ok) throw new Error(`AlAdhan HTTP ${res.status}`)
  const json = await res.json()
  if (json.code !== 200 || !Array.isArray(json.data)) throw new Error('AlAdhan bad payload')

  const days = {}
  for (const entry of json.data) {
    const g = entry.date?.gregorian?.date // "DD-MM-YYYY"
    if (!g) continue
    const [dd, mm, yy] = g.split('-')
    const key = `${yy}-${mm}-${dd}`
    const t = entry.timings || {}
    days[key] = {
      fajr: parseHM(t.Fajr), sunrise: parseHM(t.Sunrise), dhuhr: parseHM(t.Dhuhr),
      asr: parseHM(t.Asr), maghrib: parseHM(t.Maghrib), isha: parseHM(t.Isha),
    }
  }

  const cache = loadCache()
  cache[monthOf(dateKey)] = { fetchedAt: Date.now(), method: METHOD, city: LOCATION.city, days }
  saveCache(cache)
  return days[dateKey] || null
}

// --- public compute ---------------------------------------------------------

/**
 * The times to display for a day, with offsets applied and a source label:
 *   { times: {fajr,sunrise,dhuhr,asr,maghrib,isha} | null,
 *     source: 'cache' | 'manual' | 'none', fetchedAt }
 */
export function computeTimes(dateKey, settings) {
  const adjust = settings.prayerAdjustMin || {}
  const raw = getRawTimes(dateKey)
  if (raw) {
    const out = {}
    for (const k of TIME_KEYS) out[k] = shiftHM(raw.times[k], adjust[k] || 0)
    return { times: out, source: 'cache', fetchedAt: raw.fetchedAt }
  }
  // Offline + uncached → manual fallback if the user entered any times.
  const manual = settings.prayerTimes || {}
  if (PRAYER_KEYS.some((k) => manual[k])) {
    const out = { sunrise: null }
    for (const k of PRAYER_KEYS) out[k] = shiftHM(manual[k] || null, adjust[k] || 0)
    return { times: out, source: 'manual', fetchedAt: null }
  }
  return { times: null, source: 'none', fetchedAt: null }
}

/**
 * Which prayer window we're in right now, and when the next one starts.
 * Handles the overnight wrap (after Isha → next is tomorrow's Fajr; before
 * Fajr → we're still in Isha's window from last night).
 * Returns { current, next, nextAt: Date|null, minsToNext }.
 */
export function currentPrayer(times, now = new Date()) {
  if (!times) return { current: null, next: null, nextAt: null, minsToNext: null }
  const toDate = (hm) => {
    const [h, m] = hm.split(':').map(Number)
    const d = new Date(now); d.setHours(h, m, 0, 0); return d
  }
  const list = PRAYER_KEYS.filter((k) => times[k]).map((k) => ({ k, at: toDate(times[k]) }))
  list.sort((a, b) => a.at - b.at)
  if (list.length === 0) return { current: null, next: null, nextAt: null, minsToNext: null }

  let current = null
  for (const item of list) if (now >= item.at) current = item.k

  let next = null
  let nextAt = null
  const upcoming = list.find((x) => x.at > now)
  if (upcoming) { next = upcoming.k; nextAt = upcoming.at }
  else {
    // past the last prayer → next is the first prayer tomorrow
    next = list[0].k
    nextAt = new Date(list[0].at); nextAt.setDate(nextAt.getDate() + 1)
  }
  // before the first prayer of the day → still in last night's Isha window
  if (!current) current = 'isha'

  const minsToNext = nextAt ? Math.max(0, Math.round((nextAt - now) / 60000)) : null
  return { current, next, nextAt, minsToNext }
}

/** "1h 12m" / "8m" from a minute count. */
export function fmtDuration(mins) {
  if (mins == null) return ''
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/** "12:05 pm" from "HH:mm". */
export function fmt12(hm) {
  if (!hm) return '—'
  const [h, m] = hm.split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')} ${ampm}`
}
