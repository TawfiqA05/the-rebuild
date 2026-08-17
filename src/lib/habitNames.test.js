import { describe, it, expect } from 'vitest'
import { freshState } from './seed.js'
import { migrate } from './migrate.js'
import { currentStreak, dayScore } from './logic.js'
import { addDaysKey, dayKeyFor } from './time.js'
import {
  habitDisplayName, habitDisplayMin, stockHabitLabel, SEED_HABIT_NAMES,
} from './i18n/seedHabits.js'

// Stock habit names are stored as keys, not literals, so they follow the
// language. Custom habits stay literal. The migration decides which is which by
// matching the saved name against the shipped stock names — and must never
// disturb ids, logs, or streaks while doing it.

const EN_SALAH = SEED_HABIT_NAMES.en.salah.name   // 'Salah on time'
const AR_SALAH = SEED_HABIT_NAMES.ar.salah.name   // 'الصلاة في وقتها'

describe('display names follow the language for stock habits', () => {
  it('renders a stock habit in the active language and switches live', () => {
    const salah = freshState().habits.find((h) => h.id === 'salah')
    expect(salah.stock).toBe(true)
    expect(habitDisplayName(salah, 'en')).toBe(EN_SALAH)
    expect(habitDisplayName(salah, 'ar')).toBe(AR_SALAH)
    expect(habitDisplayMin(salah, 'ar')).toBe(SEED_HABIT_NAMES.ar.salah.minVersion)
  })

  it('a fresh Arabic onboarding shows Arabic seed names', () => {
    // Habits are stock from freshState, so language alone drives the label.
    for (const h of freshState().habits) {
      const ar = SEED_HABIT_NAMES.ar[h.id]
      if (ar) expect(habitDisplayName(h, 'ar')).toBe(ar.name)
    }
  })

  it('a custom habit stays literal in every language', () => {
    const custom = { id: 'cold-x1', name: 'Cold plunge', minVersion: '30 seconds', frequency: { kind: 'daily' } }
    expect(habitDisplayName(custom, 'en')).toBe('Cold plunge')
    expect(habitDisplayName(custom, 'ar')).toBe('Cold plunge')
    expect(habitDisplayMin(custom, 'ar')).toBe('30 seconds')
  })

  it('falls back to English for an unknown stock key', () => {
    expect(stockHabitLabel('salah', 'fr')).toEqual(SEED_HABIT_NAMES.en.salah)
    expect(stockHabitLabel('nope', 'ar')).toBeNull()
  })
})

describe('migration: name → key conversion', () => {
  const legacy = (habits) => ({ version: 1, settings: { onboarded: true }, habits, logs: {}, days: {} })

  it('an untouched English seed habit converts to a stock key', () => {
    const m = migrate(legacy([{ id: 'salah', name: EN_SALAH, phase: 1, type: 'salah', frequency: { kind: 'daily' } }]))
    const salah = m.habits.find((h) => h.id === 'salah')
    expect(salah.stock).toBe(true)
    expect(salah.stockKey).toBe('salah')
    expect(habitDisplayName(salah, 'ar')).toBe(AR_SALAH) // now follows the language
  })

  it('an Arabic-onboarded seed habit (literal Arabic name) also converts', () => {
    const m = migrate(legacy([{ id: 'salah', name: AR_SALAH, phase: 1, type: 'salah', frequency: { kind: 'daily' } }]))
    expect(m.habits.find((h) => h.id === 'salah').stock).toBe(true)
  })

  it('a renamed seed habit is treated as custom and left literal', () => {
    const m = migrate(legacy([{ id: 'gym', name: 'CrossFit', phase: 1, frequency: { kind: 'perWeek', count: 3 } }]))
    const gym = m.habits.find((h) => h.id === 'gym')
    expect(gym.stock).toBe(false)
    expect(gym.name).toBe('CrossFit')
    expect(habitDisplayName(gym, 'ar')).toBe('CrossFit')
    // and it is NOT duplicated by the seed re-add (same id already present)
    expect(m.habits.filter((h) => h.id === 'gym')).toHaveLength(1)
  })

  it('a user-authored habit is untouched', () => {
    const m = migrate(legacy([{ id: 'cold-x1', name: 'Cold plunge', phase: 3, frequency: { kind: 'daily' } }]))
    const c = m.habits.find((h) => h.id === 'cold-x1')
    expect(c.stock).toBe(false)
    expect(c.name).toBe('Cold plunge')
  })

  it('is idempotent and respects an explicit prior decision', () => {
    const once = migrate(legacy([{ id: 'salah', name: EN_SALAH, phase: 1, type: 'salah', frequency: { kind: 'daily' } }]))
    const twice = migrate(once)
    expect(twice.habits.find((h) => h.id === 'salah').stock).toBe(true)
    // an explicit stock:false is never re-stamped to true even if the name matches
    const pinned = migrate(legacy([{ id: 'salah', name: EN_SALAH, stock: false, phase: 1, type: 'salah', frequency: { kind: 'daily' } }]))
    expect(pinned.habits.find((h) => h.id === 'salah').stock).toBe(false)
  })
})

describe('migration never disturbs history or streaks', () => {
  it('keeps ids, logs, and the computed streak identical', () => {
    const today = '2026-08-17'
    // 5 straight days of the "bed" habit done, ending today.
    const logs = {}
    for (let i = 0; i < 5; i++) logs[addDaysKey(today, -i)] = { bed: { status: 'full' } }
    const before = {
      version: 1,
      settings: { onboarded: true, dayRolloverHour: 3, currentPhase: 1 },
      habits: [{ id: 'bed', name: 'Make the bed', phase: 1, frequency: { kind: 'daily' } }],
      logs,
      days: {},
    }
    const bedBefore = before.habits[0]
    const streakBefore = currentStreak(before, bedBefore, today)

    const after = migrate(before)
    const bedAfter = after.habits.find((h) => h.id === 'bed')

    expect(after.logs).toEqual(logs)                       // logs untouched
    expect(bedAfter.id).toBe('bed')                        // id untouched
    expect(bedAfter.stock).toBe(true)                      // recognized as stock
    expect(currentStreak(after, bedAfter, today)).toBe(streakBefore) // streak survives
    expect(streakBefore).toBe(5)
  })
})
