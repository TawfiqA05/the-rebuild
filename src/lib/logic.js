// ---------------------------------------------------------------------------
// logic.js — the rules of the system, as pure functions over `state`.
//
// Nothing in here mutates. Given the stored state it derives everything the UI
// shows: what's scheduled today, who's at risk, streaks, phase progress, etc.
//
// The philosophy is baked into these rules, not just the copy:
//   • Never miss twice — one miss is fine; two in a row is the failure state.
//   • Shrink it, don't skip it — a "min" (2-minute) rep counts as a completion.
//   • No shame spirals — a miss only interrupts the consecutive-day count.
//     Lifetime totals never fall.
// ---------------------------------------------------------------------------

import {
  addDaysKey, prevDayKey, weekdayOf, weekKeyFor, lastNKeys, rangeKeys,
} from './time.js'
import { isFaithHabit } from './faith.js'

// Re-exported so callers can keep importing it from logic. The source of truth
// for what counts as an Islamic practice is the registry in faith.js.
export { isFaithHabit }

export const SALAH_PRAYERS = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha']
export const SALAH_LABELS = {
  fajr: 'Fajr', dhuhr: 'Dhuhr', asr: 'Asr', maghrib: 'Maghrib', isha: 'Isha',
}

// --- Scheduling -------------------------------------------------------------

/** Does this habit show up on the Today screen for the given day? */
export function appearsOnDay(habit, dayKey) {
  if (habit.archived) return false
  const f = habit.frequency
  if (f.kind === 'daily') return true
  if (f.kind === 'perWeek') return true // shown every day, tracked weekly
  if (f.kind === 'weekdays') return f.days.includes(weekdayOf(dayKey))
  return true
}

/**
 * Is this habit "required" today for the daily X/Y score?
 * perWeek habits are deliberately excluded — they show week progress instead
 * of daily guilt.
 */
export function isRequiredOnDay(habit, dayKey) {
  if (habit.archived || habit.optional) return false
  const f = habit.frequency
  if (f.kind === 'daily') return true
  if (f.kind === 'weekdays') return f.days.includes(weekdayOf(dayKey))
  return false // perWeek
}

// --- Salah ------------------------------------------------------------------

/** Summarize a salah log object → { prayed, onTime, done, rep }. */
export function salahSummary(salahLog) {
  const log = salahLog || {}
  let prayed = 0
  let onTime = 0
  for (const p of SALAH_PRAYERS) {
    if (log[p] === 'ontime' || log[p] === 'late') prayed++
    if (log[p] === 'ontime') onTime++
  }
  const done = prayed === 5
  const rep = !done ? null : onTime === 5 ? 'full' : 'min'
  return { prayed, onTime, done, rep }
}

// --- Per-day habit status ---------------------------------------------------

/**
 * The completion status of one habit on one day: 'full' | 'min' | null.
 * (Salah collapses its 5 sub-checkboxes into a single full/min/none.)
 */
export function habitStatusOn(state, habit, dayKey) {
  const dayLog = state.logs[dayKey]
  if (!dayLog) return null
  if (habit.type === 'salah') return salahSummary(dayLog[habit.id]).rep
  const entry = dayLog[habit.id]
  return entry ? entry.status : null
}

export function isDone(status) {
  return status === 'full' || status === 'min'
}

// --- Weekly-frequency progress ---------------------------------------------

/** For a perWeek habit: how many days it was completed in the day's week. */
export function weekProgress(state, habit, dayKey) {
  const target = habit.frequency.count || 1
  const weekStart = weekKeyFor(dayKey)
  let count = 0
  for (let i = 0; i < 7; i++) {
    const k = addDaysKey(weekStart, i)
    if (isDone(habitStatusOn(state, habit, k))) count++
  }
  return { count, target, met: count >= target }
}

// --- Daily score ------------------------------------------------------------

/**
 * The headline X/Y for a day. Denominator = required (daily/weekday) habits
 * that appear today; numerator = those completed. perWeek habits are shown
 * elsewhere and don't count here.
 */
export function dayScore(state, dayKey) {
  // Only phases you've unlocked count toward the score. A Phase 1 user shouldn't
  // see "3 / 18" because habits from Phase 5 are sitting locked in the denominator.
  const activePhase = state.settings.currentPhase ?? 5
  const hideFaith = !islamicOn(state)
  let done = 0
  let total = 0
  for (const h of state.habits) {
    if ((h.phase ?? 1) > activePhase) continue
    if (hideFaith && isFaithHabit(h)) continue
    if (!isRequiredOnDay(h, dayKey)) continue
    total++
    if (isDone(habitStatusOn(state, h, dayKey))) done++
  }
  return { done, total }
}

/** Is a day a full win — every required habit completed? */
export function isFullWin(state, dayKey) {
  const { done, total } = dayScore(state, dayKey)
  return total > 0 && done === total
}

// --- Minimum Viable Day (the "Rough day" safety net) ------------------------

/**
 * The rough-day rule: make-the-bed + at least one other 2-minute rep counts the
 * day as a WIN so streaks survive. With the Islamic layer on, praying all five
 * is also part of the bar; with it off, the bar is just bed + one rep.
 */
export function isMVDWin(state, dayKey) {
  const bedDone = isDone(habitStatusOn(state, { id: 'bed', type: 'standard' }, dayKey))
  let otherReps = 0
  for (const h of state.habits) {
    if (h.id === 'salah' || h.id === 'bed') continue
    if (isDone(habitStatusOn(state, h, dayKey))) otherReps++
  }
  if (islamicOn(state)) {
    const salah = salahSummary(state.logs[dayKey]?.['salah'])
    return salah.done && bedDone && otherReps >= 1
  }
  return bedDone && otherReps >= 1
}

/** Did this day "survive" for streak purposes? Full win OR a rough-day MVD win. */
export function daySurvives(state, dayKey) {
  if (isFullWin(state, dayKey)) return true
  if (state.days[dayKey]?.roughDay && isMVDWin(state, dayKey)) return true
  return false
}

// --- Per-habit stats --------------------------------------------------------

/** All day-keys we have any record for, plus everything up to today. */
function historyStart(state, todayK) {
  const keys = [
    ...Object.keys(state.logs),
    ...Object.keys(state.days),
  ]
  if (keys.length === 0) return todayK
  keys.sort()
  return keys[0] < todayK ? keys[0] : todayK
}

/**
 * The scheduled-day sequence for a habit, newest → oldest, as booleans (done?).
 * Used for streaks. perWeek habits are collapsed to one entry per week.
 */
function scheduledSequence(state, habit, todayK) {
  const start = historyStart(state, todayK)
  const seq = [] // { key, scheduled, done }
  if (habit.frequency.kind === 'perWeek') {
    // one entry per week from this week back to the first week
    let wk = weekKeyFor(todayK)
    const firstWk = weekKeyFor(start)
    while (wk >= firstWk) {
      const wp = weekProgressForWeek(state, habit, wk)
      seq.push({ key: wk, scheduled: true, done: wp.met })
      wk = addDaysKey(wk, -7)
    }
    return seq
  }
  // daily / weekday: iterate days newest → oldest
  for (const key of rangeKeys(start, todayK).reverse()) {
    if (!isScheduledForStreak(habit, key)) continue
    seq.push({ key, scheduled: true, done: isDone(habitStatusOn(state, habit, key)) })
  }
  return seq
}

function isScheduledForStreak(habit, key) {
  const f = habit.frequency
  if (f.kind === 'daily') return true
  if (f.kind === 'weekdays') return f.days.includes(weekdayOf(key))
  return false
}

function weekProgressForWeek(state, habit, weekStart) {
  const target = habit.frequency.count || 1
  let count = 0
  for (let i = 0; i < 7; i++) {
    if (isDone(habitStatusOn(state, habit, addDaysKey(weekStart, i)))) count++
  }
  return { count, target, met: count >= target }
}

/**
 * Current streak: consecutive completed scheduled units, counting back from the
 * most recent one. The current unit (today / this week) is only allowed to
 * break the streak once it's actually over — a pending "today" is not a miss.
 */
export function currentStreak(state, habit, todayK) {
  const seq = scheduledSequence(state, habit, todayK) // newest → oldest
  if (seq.length === 0) return 0
  let i = 0
  // If the newest unit isn't done yet, it's still in progress — skip it rather
  // than counting it as a miss.
  if (!seq[0].done) i = 1
  let streak = 0
  for (; i < seq.length; i++) {
    if (seq[i].done) streak++
    else break
  }
  return streak
}

export function longestStreak(state, habit, todayK) {
  const seq = scheduledSequence(state, habit, todayK)
  let best = 0
  let run = 0
  for (const unit of seq) {
    if (unit.done) { run++; best = Math.max(best, run) } else run = 0
  }
  return best
}

/** Lifetime completions of a habit (count of completed days). */
export function lifetimeCompletions(state, habit) {
  let n = 0
  for (const dayKey of Object.keys(state.logs)) {
    if (isDone(habitStatusOn(state, habit, dayKey))) n++
  }
  return n
}

/** Completion % over the last 30 logical days (type-aware). */
export function pct30(state, habit, todayK) {
  const days = lastNKeys(todayK, 30)
  if (habit.frequency.kind === 'perWeek') {
    // average weekly fill ratio across the ~4-5 weeks touched
    const weeks = new Set(days.map(weekKeyFor))
    let ratio = 0
    for (const wk of weeks) {
      const wp = weekProgressForWeek(state, habit, wk)
      ratio += Math.min(wp.count, wp.target) / wp.target
    }
    return weeks.size ? Math.round((ratio / weeks.size) * 100) : 0
  }
  let opp = 0
  let done = 0
  for (const k of days) {
    if (!isScheduledForStreak(habit, k)) continue
    opp++
    if (isDone(habitStatusOn(state, habit, k))) done++
  }
  return opp ? Math.round((done / opp) * 100) : 0
}

/**
 * Never-miss-twice signals for a daily/weekday habit:
 *   missedYesterday — the most recent scheduled day before today was a miss.
 *   missedTwice     — the two most recent scheduled days before today were both misses (failure state).
 *   atRisk          — missedYesterday AND today is scheduled AND not yet done.
 */
export function riskSignals(state, habit, todayK) {
  if (habit.frequency.kind === 'perWeek') {
    return { missedYesterday: false, missedTwice: false, atRisk: false }
  }
  // gather scheduled days strictly before today, newest → oldest
  const seq = scheduledSequence(state, habit, todayK).filter((u) => u.key < todayK)
  const prev1 = seq[0]
  const prev2 = seq[1]
  const missedYesterday = !!prev1 && !prev1.done
  const missedTwice = missedYesterday && !!prev2 && !prev2.done
  const scheduledToday = isScheduledForStreak(habit, todayK)
  const doneToday = isDone(habitStatusOn(state, habit, todayK))
  const atRisk = missedYesterday && scheduledToday && !doneToday
  return { missedYesterday, missedTwice, atRisk }
}

export function habitStats(state, habit, todayK) {
  return {
    current: currentStreak(state, habit, todayK),
    longest: longestStreak(state, habit, todayK),
    lifetime: lifetimeCompletions(state, habit),
    pct30: pct30(state, habit, todayK),
    ...riskSignals(state, habit, todayK),
  }
}

// --- Restart protocol -------------------------------------------------------

/**
 * Number of consecutive fully-missed days immediately before today.
 * A day is "fully missed" if it had a required habit, recorded zero
 * completions, and wasn't rescued as a rough-day win. Two or more → the
 * Restart-protocol card appears (no lecture, just: first day back = min reps).
 */
export function missGapBeforeToday(state, todayK) {
  let gap = 0
  let k = prevDayKey(todayK)
  for (let i = 0; i < 60; i++) {
    const { done, total } = dayScore(state, k)
    if (total === 0) break            // nothing was ever scheduled that far back
    const survived = daySurvives(state, k)
    if (done === 0 && !survived) { gap++; k = prevDayKey(k) } else break
  }
  return gap
}

// --- Phases -----------------------------------------------------------------

/** Is the Islamic-practices layer switched on? Defaults to on for older saves. */
export function islamicOn(state) {
  return state.settings?.includeIslamic !== false
}

export function activeHabits(state) {
  const hideFaith = !islamicOn(state)
  return state.habits.filter((h) =>
    !h.archived && h.phase <= state.settings.currentPhase && !(hideFaith && isFaithHabit(h)))
}

export function phaseHabits(state, phase) {
  return state.habits.filter((h) => !h.archived && h.phase === phase)
}

/**
 * Trailing-21-day completion % for a phase. daily/weekday habits contribute one
 * opportunity per scheduled day; perWeek habits contribute `target` per week.
 */
export function phaseProgress(state, phase, todayK) {
  const habits = phaseHabits(state, phase)
  const days = lastNKeys(todayK, 21)
  let opp = 0
  let done = 0
  for (const h of habits) {
    if (h.optional) continue
    if (h.frequency.kind === 'perWeek') {
      const weeks = new Set(days.map(weekKeyFor))
      for (const wk of weeks) {
        const wp = weekProgressForWeek(state, h, wk)
        opp += wp.target
        done += Math.min(wp.count, wp.target)
      }
    } else {
      for (const k of days) {
        if (!isScheduledForStreak(h, k)) continue
        opp++
        if (isDone(habitStatusOn(state, h, k))) done++
      }
    }
  }
  return { pct: opp ? Math.round((done / opp) * 100) : 0, opp, done }
}

/** Should we suggest unlocking the next phase? (>=80% trailing 21d, not maxed). */
export function shouldSuggestUnlock(state, todayK) {
  const phase = state.settings.currentPhase
  if (phase >= 5) return false
  if (state.settings.dismissedUnlock?.[phase]) return false
  return phaseProgress(state, phase, todayK).pct >= 80
}
