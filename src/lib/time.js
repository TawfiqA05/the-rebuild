// ---------------------------------------------------------------------------
// time.js — logical-day math.
//
// The whole app runs on "logical days" rather than calendar days. The day rolls
// over at a configurable hour (default 3am), so a 12:30am check-in still counts
// as *yesterday's* day. Every day is keyed as a "YYYY-MM-DD" string in the
// user's LOCAL timezone. We never store UTC day-keys — a day is whatever the
// user's wall clock says, shifted back by the rollover hour.
// ---------------------------------------------------------------------------

/** Format a Date's local calendar date as "YYYY-MM-DD". */
function localYMD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * The logical day-key for a given instant.
 * We subtract `rolloverHour` hours from the clock: at 2am with a 3am rollover
 * the shifted time lands in the previous calendar day, which is exactly the
 * "day" the user is still finishing.
 */
export function dayKeyFor(date, rolloverHour = 3) {
  const shifted = new Date(date.getTime())
  shifted.setHours(shifted.getHours() - rolloverHour)
  return localYMD(shifted)
}

/** Today's logical day-key. */
export function todayKey(rolloverHour = 3) {
  return dayKeyFor(new Date(), rolloverHour)
}

/** Parse "YYYY-MM-DD" into a local Date at noon (noon avoids DST edge bugs). */
export function keyToDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

/** Shift a day-key by n days (negative = past). Returns a new key. */
export function addDaysKey(key, n) {
  const d = keyToDate(key)
  d.setDate(d.getDate() + n)
  return localYMD(d)
}

export function prevDayKey(key) {
  return addDaysKey(key, -1)
}

/** Day of week for a key. 0 = Sunday … 6 = Saturday. */
export function weekdayOf(key) {
  return keyToDate(key).getDay()
}

/**
 * The Sunday-start "week key" that a day belongs to — the day-key of that
 * week's Sunday. Used for weekly-frequency habits and weekly reviews.
 */
export function weekKeyFor(key) {
  const dow = weekdayOf(key)
  return addDaysKey(key, -dow)
}

/** Inclusive list of day-keys from `startKey` up to and including `endKey`. */
export function rangeKeys(startKey, endKey) {
  const out = []
  let k = startKey
  // guard against pathological inputs
  for (let i = 0; i < 5000 && k <= endKey; i++) {
    out.push(k)
    k = addDaysKey(k, 1)
  }
  return out
}

/** The last N day-keys ending at (and including) endKey, oldest first. */
export function lastNKeys(endKey, n) {
  const out = []
  for (let i = n - 1; i >= 0; i--) out.push(addDaysKey(endKey, -i))
  return out
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Human label like "Saturday, Aug 15" (English fallback). */
export function prettyDate(key) {
  const d = keyToDate(key)
  return `${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

// --- locale-aware date formatting (via Intl) --------------------------------
// These follow the active language: Arabic gets Arabic month/weekday names and
// Arabic-Indic digits. Each falls back to the English helpers if Intl throws.

function intl(key, lang, opts, fallback) {
  try { return new Intl.DateTimeFormat(lang, opts).format(keyToDate(key)) }
  catch { return fallback() }
}

/** Just the weekday, e.g. "Saturday" / "السبت". */
export function fmtWeekday(key, lang = 'en') {
  return intl(key, lang, { weekday: 'long' }, () => DAYS[weekdayOf(key)])
}

/** Month + day, e.g. "Aug 15" / "١٥ أغسطس". */
export function fmtMonthDay(key, lang = 'en') {
  return intl(key, lang, { month: 'short', day: 'numeric' },
    () => `${MONTHS[keyToDate(key).getMonth()]} ${keyToDate(key).getDate()}`)
}

/** Full date, e.g. "Saturday, Aug 15" / "السبت، ١٥ أغسطس". */
export function fmtFullDate(key, lang = 'en') {
  return intl(key, lang, { weekday: 'long', month: 'short', day: 'numeric' }, () => prettyDate(key))
}

export function isSunday(key) {
  return weekdayOf(key) === 0
}
