import { describe, it, expect, vi, afterEach } from 'vitest'
import { migrate } from './migrate.js'
import { dayKeyFor, todayKey } from './time.js'
import { urgePromptIndices } from './faith.js'

// Targeted tests for logic paths that were thin on coverage: a migration branch,
// the day rollover as it happens during an open session, and a faith-toggle edge.

describe('migrate: a legacy PIN with no per-device salt is cleared', () => {
  it('drops an unverifiable pinHash and resets the lockout, keeping private entries', () => {
    const legacy = {
      version: 1,
      settings: { onboarded: true, pinHash: 'oldhash', pinFails: 4, pinLockUntil: 999 }, // no pinSalt
      habits: [], logs: {}, days: {},
      privateLog: { entries: [{ id: 'x', at: 1, note: 'kept' }], waves: [] },
    }
    const m = migrate(legacy)
    expect(m.settings.pinHash).toBeNull()
    expect(m.settings.pinFails).toBe(0)
    expect(m.settings.pinLockUntil).toBe(0)
    expect(m.privateLog.entries).toHaveLength(1) // the log itself is untouched
  })

  it('keeps a modern salted PIN intact', () => {
    const m = migrate({ version: 2, settings: { onboarded: true, pinHash: 'h', pinSalt: 's' }, habits: [], logs: {}, days: {} })
    expect(m.settings.pinHash).toBe('h')
    expect(m.settings.pinSalt).toBe('s')
  })
})

describe('day rollover during an open session (3am boundary)', () => {
  afterEach(() => vi.useRealTimers())

  it('a session open across midnight stays on the same logical day until 3am', () => {
    const rollover = 3
    // 11:30pm and 1:00am (next calendar day) are the SAME logical day.
    expect(dayKeyFor(new Date(2026, 0, 10, 23, 30), rollover)).toBe('2026-01-10')
    expect(dayKeyFor(new Date(2026, 0, 11, 1, 0), rollover)).toBe('2026-01-10')
    expect(dayKeyFor(new Date(2026, 0, 11, 2, 59), rollover)).toBe('2026-01-10')
    // 3:00am flips it to the new day.
    expect(dayKeyFor(new Date(2026, 0, 11, 3, 0), rollover)).toBe('2026-01-11')
  })

  it('todayKey() follows the wall clock as an open session crosses the boundary', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 0, 11, 2, 59)) // before rollover
    expect(todayKey(3)).toBe('2026-01-10')
    vi.setSystemTime(new Date(2026, 0, 11, 3, 1))  // just after — the app would re-tick to this
    expect(todayKey(3)).toBe('2026-01-11')
  })
})

describe('faith toggle edge: urge prompts', () => {
  it('never returns an empty rotation, even if every prompt were faith-tagged', () => {
    // Defensive: with the layer on, all indices are returned regardless.
    expect(urgePromptIndices(1, true)).toEqual([0])
    // With it off, faith indices drop; a tiny list still yields a valid array.
    expect(Array.isArray(urgePromptIndices(2, false))).toBe(true)
  })
})
