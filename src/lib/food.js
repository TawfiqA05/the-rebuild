// ---------------------------------------------------------------------------
// food.js — a plain food log. Awareness only, never a diet tracker.
//
// This is deliberately the opposite of a calorie app: text only, no numbers,
// no goals, no windows, no streaks. Logging food NEVER touches the daily score,
// streaks, or never-miss-twice — `logic.js` doesn't even read `food`. A day
// with nothing logged is neutral, not a failure.
//
// Entry shape:
//   { id, text, at, day }
//     at  — ms timestamp, the display time (backdatable within the day)
//     day — logical day-key (3am rollover), authoritative for grouping/history
//
// Stored as a flat array (like tasks), so edit/delete/undo are simple id ops.
// ---------------------------------------------------------------------------

import { dayKeyFor, lastNKeys } from './time.js'

/** Build a food entry, bucketed to its logical day via the rollover hour. */
export function makeFoodEntry({ text, at, rolloverHour = 3, id }) {
  const when = at ?? Date.now()
  return {
    id: id ?? (globalThis.crypto?.randomUUID?.() || String(when + Math.random())),
    text: String(text).trim(),
    at: when,
    day: dayKeyFor(new Date(when), rolloverHour),
  }
}

/** Entries for one logical day, oldest first (chronological). */
export function foodForDay(food, dayKey) {
  return (food || [])
    .filter((e) => e.day === dayKey)
    .sort((a, b) => a.at - b.at)
}

/**
 * Time-of-day band for an entry, used purely as a quiet derived section header.
 * The user never picks a "meal type" — it's inferred from the clock.
 *   morning 5–10 · midday 11–16 · evening 17–21 · night 22–4
 */
export function foodBand(at) {
  const h = new Date(at).getHours()
  if (h >= 5 && h < 11) return 'morning'
  if (h >= 11 && h < 17) return 'midday'
  if (h >= 17 && h < 22) return 'evening'
  return 'night'
}

const BAND_LABEL = { morning: 'Morning', midday: 'Midday', evening: 'Evening', night: 'Night' }
export function bandLabel(band) {
  return BAND_LABEL[band] || ''
}

/** Group already-chronological entries into consecutive band sections. */
export function groupFoodByBand(entries) {
  const groups = []
  for (const e of entries) {
    const band = foodBand(e.at)
    const last = groups[groups.length - 1]
    if (last && last.band === band) last.entries.push(e)
    else groups.push({ band, label: bandLabel(band), entries: [e] })
  }
  return groups
}

/**
 * The most frequent recent entries for the quick re-add chips: count entries
 * over the trailing `days` logical days, dedupe case-insensitively (keeping the
 * most recent spelling), and return the top `cap` texts, most-frequent first
 * (ties broken by recency).
 */
export function frequentFoods(food, todayKey, { days = 14, cap = 6 } = {}) {
  const window = new Set(lastNKeys(todayKey, days))
  const byKey = new Map() // normalized -> { text, count, last }
  for (const e of food || []) {
    if (!window.has(e.day)) continue
    const norm = e.text.trim().toLowerCase()
    if (!norm) continue
    const cur = byKey.get(norm)
    if (cur) {
      cur.count++
      if (e.at > cur.last) { cur.last = e.at; cur.text = e.text }
    } else {
      byKey.set(norm, { text: e.text, count: 1, last: e.at })
    }
  }
  return [...byKey.values()]
    .sort((a, b) => (b.count - a.count) || (b.last - a.last))
    .slice(0, cap)
    .map((x) => x.text)
}

/** How many distinct logical days have at least one entry (the one Stats number). */
export function daysLoggedCount(food) {
  return new Set((food || []).map((e) => e.day)).size
}

// --- edit / delete (pure; the store delegates here) -------------------------

/** Edit an entry's text only — id, at, and day are preserved. */
export function updateFoodText(food, id, text) {
  return (food || []).map((e) => (e.id === id ? { ...e, text: String(text).trim() } : e))
}

/**
 * Backdate an entry within its day: set the hour/minute on the entry's existing
 * date, keeping the same logical `day` bucket. `hhmm` is "HH:MM".
 */
export function setFoodEntryTime(food, id, hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return food || []
  return (food || []).map((e) => {
    if (e.id !== id) return e
    const d = new Date(e.at)
    d.setHours(h, m, 0, 0)
    return { ...e, at: d.getTime() }
  })
}

export function deleteFoodById(food, id) {
  return (food || []).filter((e) => e.id !== id)
}

export function insertFood(food, entry) {
  return entry ? [...(food || []), entry] : (food || [])
}
