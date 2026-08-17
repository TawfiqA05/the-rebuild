// ---------------------------------------------------------------------------
// share.js — the accountability summary.
//
// Builds a clean, shareable snapshot of the week: each habit's score, its
// current streak, an overall number, and one optional line you type yourself.
// It reads ONLY habits/logs — never the private log, never the food log — so
// nothing sensitive can leak into a text you send a friend. share.test.js pins
// that down.
// ---------------------------------------------------------------------------

import { addDaysKey, weekKeyFor, keyToDate } from './time.js'
import { activeHabits, habitStatusOn, isRequiredOnDay, isDone, currentStreak } from './logic.js'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Score one habit across the week so far (future days of this week don't count). */
function weekScore(state, habit, weekStart, todayKey) {
  if (habit.frequency.kind === 'perWeek') {
    const target = habit.frequency.count || 1
    let count = 0
    for (let i = 0; i < 7; i++) {
      const k = addDaysKey(weekStart, i)
      if (k > todayKey) break
      if (isDone(habitStatusOn(state, habit, k))) count++
    }
    return { kind: 'perWeek', done: count, total: target, pct: Math.round((Math.min(count, target) / target) * 100) }
  }
  let done = 0
  let total = 0
  for (let i = 0; i < 7; i++) {
    const k = addDaysKey(weekStart, i)
    if (k > todayKey) break
    if (!isRequiredOnDay(habit, k)) continue
    total++
    if (isDone(habitStatusOn(state, habit, k))) done++
  }
  return { kind: 'daily', done, total, pct: total ? Math.round((done / total) * 100) : 0 }
}

function weekLabel(weekStart) {
  const d = keyToDate(weekStart)
  return `week of ${MONTHS[d.getMonth()]} ${d.getDate()}`
}

/**
 * Build the shareable summary. Pure and side-effect free. `note` is the single
 * optional line the user types; it's trimmed and length-capped.
 */
export function buildShareSummary(state, todayKey, { note = '' } = {}) {
  const weekStart = weekKeyFor(todayKey)
  const habits = activeHabits(state).filter((h) => !h.optional)

  const rows = habits.map((h) => {
    const s = weekScore(state, h, weekStart, todayKey)
    return {
      name: h.name,
      emoji: h.emoji || '•',
      kind: s.kind,
      done: s.done,
      total: s.total,
      pct: s.pct,
      streak: currentStreak(state, h, todayKey),
    }
  })

  let done = 0
  let total = 0
  for (const r of rows) { done += Math.min(r.done, r.total); total += r.total }
  const overallPct = total ? Math.round((done / total) * 100) : 0

  return {
    app: 'The Rebuild',
    weekStart,                 // raw day-key, so callers can localize the date
    weekLabel: weekLabel(weekStart),
    overallPct,
    rows,
    votes: typeof state.votes === 'number' ? state.votes : 0,
    note: String(note || '').trim().slice(0, 140),
  }
}

/** How a habit's score reads in one token: "90%" or "2/3". */
export function scoreLabel(row) {
  return row.kind === 'perWeek' ? `${row.done}/${row.total}` : `${row.pct}%`
}

/** Plain text, ready to drop into iMessage. Kept plain and human — no fluff. */
export function shareSummaryToText(summary) {
  const lines = [
    `${summary.app} · ${summary.weekLabel}`,
    `This week: ${summary.overallPct}%`,
    '',
  ]
  for (const r of summary.rows) {
    const streak = r.streak > 0 ? ` · ${r.streak}-day streak` : ''
    lines.push(`${r.emoji} ${r.name} — ${scoreLabel(r)}${streak}`)
  }
  if (summary.note) { lines.push('', `“${summary.note}”`) }
  lines.push('', 'Never miss twice.')
  return lines.join('\n')
}
