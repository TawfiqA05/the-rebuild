// Simple, plain-language patterns for the Stats screen. No charts, just numbers
// derived from the same logs everything else uses.

import { lastNKeys, weekdayOf } from './time.js'
import { activeHabits, isRequiredOnDay, habitStatusOn, isDone } from './logic.js'

const LOOKBACK = 84 // ~12 weeks

// Best and worst weekday for one habit. Returns null for weekly-frequency
// habits (a weekday rate doesn't mean much there) or when there isn't enough
// signal to say anything honest.
export function weekdayInsight(state, habit, todayK) {
  if (habit.frequency.kind === 'perWeek') return null
  return rankWeekdays([habit], state, todayK)
}

// Same idea across every active daily/weekday habit — an overall "you're
// strongest on Tuesdays" read.
export function overallWeekday(state, todayK) {
  const habits = activeHabits(state).filter((h) => h.frequency.kind !== 'perWeek')
  return rankWeekdays(habits, state, todayK, 3)
}

function rankWeekdays(habits, state, todayK, minOpp = 2) {
  const days = lastNKeys(todayK, LOOKBACK)
  const done = new Array(7).fill(0)
  const opp = new Array(7).fill(0)
  for (const h of habits) {
    for (const k of days) {
      if (!isRequiredOnDay(h, k)) continue
      const w = weekdayOf(k)
      opp[w]++
      if (isDone(habitStatusOn(state, h, k))) done[w]++
    }
  }
  const rates = []
  for (let w = 0; w < 7; w++) if (opp[w] >= minOpp) rates.push({ w, pct: Math.round((done[w] / opp[w]) * 100) })
  if (rates.length < 2) return null
  rates.sort((a, b) => b.pct - a.pct)
  const best = rates[0]
  const worst = rates[rates.length - 1]
  if (best.pct === worst.pct) return null // flat — nothing worth saying
  return { best, worst }
}

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
