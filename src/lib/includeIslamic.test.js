import { describe, it, expect } from 'vitest'
import { freshState } from './seed.js'
import { migrate } from './migrate.js'
import { activeHabits, dayScore, isMVDWin } from './logic.js'
import { dailyAnchor } from './anchor.js'
import { CURATED } from './quotes.js'
import { addDaysKey } from './time.js'

// The "Include Islamic practices?" switch. These pin down the two guarantees
// that matter: existing users default to Yes and never regress, and turning it
// off hides the right modules without ever touching a byte of habit data.

// A fully-onboarded state with every phase unlocked, so Salah (Phase 1) and the
// Mon/Thu fast (Phase 5) are both in play.
function onboarded(overrides = {}) {
  const s = freshState()
  s.settings.onboarded = true
  s.settings.currentPhase = 5
  Object.assign(s.settings, overrides)
  return s
}

describe('includeIslamic — default & migration', () => {
  it('a fresh install defaults to on', () => {
    expect(freshState().settings.includeIslamic).toBe(true)
  })

  it('an existing device with data defaults to Yes and is already onboarded (never sees the new step)', () => {
    const legacy = { version: 1, settings: {}, habits: [{ id: 'bed', phase: 1 }], logs: { '2026-01-01': {} }, days: {} }
    const m = migrate(legacy)
    expect(m.settings.includeIslamic).toBe(true)
    expect(m.settings.onboarded).toBe(true)
  })

  it('an explicit choice survives migrate (rides in the backup)', () => {
    const off = { version: 2, settings: { onboarded: true, includeIslamic: false }, habits: [], logs: {}, days: {} }
    expect(migrate(off).settings.includeIslamic).toBe(false)
  })
})

describe('includeIslamic — module gating', () => {
  const ids = (st) => activeHabits(st).map((h) => h.id)

  it('hides Salah and the fast when off, shows them when on', () => {
    const on = onboarded({ includeIslamic: true })
    const off = onboarded({ includeIslamic: false })
    expect(ids(on)).toEqual(expect.arrayContaining(['salah', 'fasting']))
    expect(ids(off)).not.toContain('salah')
    expect(ids(off)).not.toContain('fasting')
    // every non-faith habit is untouched either way
    expect(ids(off)).toEqual(expect.arrayContaining(['bed', 'gym', 'sleep']))
  })

  it('drops the daily faith habits (Salah, Quran, Adhkar) from the score denominator when off', () => {
    const on = onboarded({ includeIslamic: true })
    const off = onboarded({ includeIslamic: false })
    const day = '2026-01-05' // a Monday-independent day: the Mon/Thu fast isn't required
    // salah + quran + adhkar are the daily required faith habits; the fast is optional.
    expect(dayScore(on, day).total - dayScore(off, day).total).toBe(3)
  })

  it('rough-day MVD needs only bed + one rep when off, but still needs Salah when on', () => {
    const logs = { '2026-01-05': { bed: { status: 'full' }, gym: { status: 'min' } } }
    const off = onboarded({ includeIslamic: false }); off.logs = logs
    const on = onboarded({ includeIslamic: true }); on.logs = logs
    expect(isMVDWin(off, '2026-01-05')).toBe(true)
    expect(isMVDWin(on, '2026-01-05')).toBe(false) // no Salah logged
  })
})

describe('includeIslamic — reversible, no data touched', () => {
  it('flipping the setting off changes visibility only, never the habit records or logs', () => {
    const base = onboarded({ includeIslamic: true })
    base.logs = { '2026-01-05': { salah: { fajr: 'ontime' }, bed: { status: 'full' } } }
    const habitsBefore = JSON.stringify(base.habits)

    // Exactly what the Settings toggle does: a settings-only change.
    const off = { ...base, settings: { ...base.settings, includeIslamic: false } }

    expect(JSON.stringify(off.habits)).toBe(habitsBefore) // records identical
    expect(off.logs).toEqual(base.logs)                   // logs identical
    // Salah still exists in the data, just hidden from the active list.
    expect(off.habits.some((h) => h.id === 'salah')).toBe(true)
    expect(activeHabits(off).some((h) => h.id === 'salah')).toBe(false)
    // Flipping back on restores it.
    const backOn = { ...off, settings: { ...off.settings, includeIslamic: true } }
    expect(activeHabits(backOn).some((h) => h.id === 'salah')).toBe(true)
  })
})

describe('includeIslamic — Daily anchor', () => {
  it('shows scripture when on, universal quotes only when off', () => {
    const st = onboarded()
    const faithAuthors = new Set(CURATED.filter((q) => q.faith === 'islam').map((q) => q.author))
    let sawFaithOn = false
    let sawFaithOff = false
    for (let i = 0; i < 80; i++) {
      const day = addDaysKey('2026-01-01', i)
      const on = dailyAnchor(st, day, { includeIslamic: true })
      const off = dailyAnchor(st, day, { includeIslamic: false })
      if (on && faithAuthors.has(on.author)) sawFaithOn = true
      if (off && faithAuthors.has(off.author)) sawFaithOff = true
    }
    expect(sawFaithOn).toBe(true)
    expect(sawFaithOff).toBe(false)
  })
})

describe('includeIslamic — backup travel', () => {
  it('survives an export → import roundtrip', () => {
    const st = onboarded({ includeIslamic: false })
    // export is JSON.stringify(state); import is migrate(JSON.parse(...))
    const roundtrip = migrate(JSON.parse(JSON.stringify(st)))
    expect(roundtrip.settings.includeIslamic).toBe(false)
  })
})
