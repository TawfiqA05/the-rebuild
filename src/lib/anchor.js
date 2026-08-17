// ---------------------------------------------------------------------------
// anchor.js — the Daily anchor: one piece of motivation per day.
//
// This is NOT a feed. The pick is fully deterministic by date, so it's the same
// line all day and only turns over at the logical-day boundary — there is no
// shuffle and no refresh button by design.
//
// It rotates across three pools:
//   1. curated  — the built-in verified quotes + the user's own "My quotes"
//   2. wins     — the user's past wins ("You, <date>: …"), once >= 5 are logged
//   3. journal  — "what went well" lines from full-win days ("You, <date>: …")
//
// On rough-day / restart states we bias toward pools 2 and 3: your own evidence
// that you've done hard things beats a stranger's wisdom on a hard day.
// ---------------------------------------------------------------------------

import { keyToDate } from './time.js'
import { isFullWin } from './logic.js'
import { CURATED } from './quotes.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const MIN_WINS_FOR_POOL = 5

function fmtDate(ts) {
  const d = new Date(ts)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/** A stable integer day-number, so selection is deterministic and cycles by date. */
function dayNumber(dayKey) {
  return Math.floor(keyToDate(dayKey).getTime() / 86_400_000)
}

/**
 * The two "own evidence" pools, drawn straight from the user's data:
 *   wins    — only surfaced once there are at least 5 (a thin list isn't proof)
 *   journal — "what went well" text, but only from days that were a full win
 */
export function ownPools(state) {
  const wins = state.wins || []
  const winPool = wins.length >= MIN_WINS_FOR_POOL
    ? wins.map((w) => ({ text: `You, ${fmtDate(w.at)}: ${w.text}`, pool: 'wins' }))
    : []

  const journalPool = []
  for (const [key, rec] of Object.entries(state.days || {})) {
    const well = rec?.journal?.well?.trim?.()
    if (well && isFullWin(state, key)) {
      journalPool.push({ text: `You, ${fmtDate(keyToDate(key).getTime())}: ${well}`, pool: 'journal' })
    }
  }
  // stable order so the daily index is deterministic
  journalPool.sort((a, b) => (a.text < b.text ? -1 : a.text > b.text ? 1 : 0))
  return { winPool, journalPool }
}

/**
 * Pick the anchor for `dayKey`. Deterministic: same state + same day → same
 * line. Returns { text, author?, pool }. Own-evidence entries carry no author
 * (the "You, <date>:" prefix is the attribution). The curated pool is never
 * empty, so this always returns something.
 */
export function dailyAnchor(state, dayKey, { biasOwn = false, lang = 'en' } = {}) {
  // In a language we don't have a sourced translation for, a curated quote only
  // qualifies if it ships that language's text (currently: scripture, which
  // carries its exact Arabic). Everything else is dropped rather than shown in
  // English or machine-translated. The user's own lines always qualify.
  const qualifies = (q) => lang === 'en' || !!q.ar
  const curated = [
    ...CURATED.filter(qualifies).map((q) => ({ text: q.text, author: q.author, ar: q.ar, arAuthor: q.arAuthor, pool: 'curated' })),
    ...(state.myQuotes || []).map((q) => ({ text: q.text, author: 'You', pool: 'mine' })),
  ]
  const { winPool, journalPool } = ownPools(state)
  const n = dayNumber(dayKey)

  // Preference order of pools for the day. Normally we rotate through all three
  // so no single pool dominates; when biasing we put the two own-pools first
  // (alternating which leads) and keep curated only as a fallback.
  let order
  if (biasOwn) {
    const ownFirst = n % 2 === 0 ? [winPool, journalPool] : [journalPool, winPool]
    order = [...ownFirst, curated]
  } else {
    const rot = [curated, winPool, journalPool]
    const s = n % 3
    order = [rot[s], rot[(s + 1) % 3], rot[(s + 2) % 3]]
  }

  const pool = order.find((p) => p.length > 0) || curated
  return pool[n % pool.length]
}
