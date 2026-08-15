import { describe, it, expect } from 'vitest'
import { addDaysKey, weekdayOf } from './time.js'
import { weekdayInsight } from './insights.js'

const read = { id: 'read', type: 'standard', frequency: { kind: 'daily' } }
const today = '2026-08-15'

// Mondays done, every other day missed, across the lookback window.
const logs = {}
for (let i = 0; i < 84; i++) {
  const k = addDaysKey(today, -i)
  if (weekdayOf(k) === 1) logs[k] = { read: { status: 'full' } }
}
const state = { settings: { dayRolloverHour: 3, currentPhase: 1 }, habits: [read], logs, days: {}, votes: 0 }

describe('weekday insight', () => {
  it('names the best and worst weekday', () => {
    const wi = weekdayInsight(state, read, today)
    expect(wi.best.w).toBe(1)     // Monday
    expect(wi.best.pct).toBe(100)
    expect(wi.worst.pct).toBe(0)
  })

  it('says nothing for a weekly-frequency habit', () => {
    expect(weekdayInsight(state, { ...read, frequency: { kind: 'perWeek', count: 3 } }, today)).toBe(null)
  })
})
