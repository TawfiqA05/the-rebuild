import { describe, it, expect } from 'vitest'
import { dayKeyFor, addDaysKey } from './time.js'
import {
  currentStreak, longestStreak, riskSignals,
  isMVDWin, daySurvives, salahSummary, dayScore,
} from './logic.js'

// These tests pin down the rules the whole app leans on. If someone changes the
// logic later and breaks "never miss twice" or the 3am rollover, CI should catch
// it instead of me finding out weeks later that a streak quietly reset.

const daily = (id) => ({ id, type: 'standard', frequency: { kind: 'daily' } })

// build a state from a { dayKey: { habitId: status } } map
function makeState(logMap, habits = [], days = {}) {
  const logs = {}
  for (const [day, entries] of Object.entries(logMap)) {
    logs[day] = {}
    for (const [hid, val] of Object.entries(entries)) {
      // salah gets its raw object; everything else gets a { status } entry
      logs[day][hid] = hid === 'salah' ? val : { status: val }
    }
  }
  return { settings: { dayRolloverHour: 3 }, habits, logs, days, votes: 0 }
}

const allFivePrayed = { fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'late', isha: 'late' }

describe('3am day rollover', () => {
  it('counts a 12:30am check-in as the day before', () => {
    expect(dayKeyFor(new Date(2026, 0, 15, 0, 30), 3)).toBe('2026-01-14')
  })
  it('still counts 2am as yesterday', () => {
    expect(dayKeyFor(new Date(2026, 0, 15, 2, 0), 3)).toBe('2026-01-14')
  })
  it('rolls to the new day exactly at 3am', () => {
    expect(dayKeyFor(new Date(2026, 0, 15, 3, 0), 3)).toBe('2026-01-15')
  })
  it('daytime is obviously the same day', () => {
    expect(dayKeyFor(new Date(2026, 0, 15, 14, 0), 3)).toBe('2026-01-15')
  })
  it('late evening stays on the same day', () => {
    expect(dayKeyFor(new Date(2026, 0, 15, 23, 30), 3)).toBe('2026-01-15')
  })
  it('addDaysKey crosses month boundaries', () => {
    expect(addDaysKey('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDaysKey('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('streaks', () => {
  const read = daily('read')

  it('counts back consecutive done days', () => {
    const s = makeState({
      '2026-01-11': { read: 'full' },
      '2026-01-12': { read: 'full' },
      '2026-01-13': { read: 'full' },
      '2026-01-14': { read: 'full' },
    }, [read])
    // today (the 15th) is still pending, so it shouldn't break anything
    expect(currentStreak(s, read, '2026-01-15')).toBe(4)
  })

  it('a pending today does not reset the streak, a done today extends it', () => {
    const base = {
      '2026-01-13': { read: 'full' },
      '2026-01-14': { read: 'full' },
    }
    expect(currentStreak(makeState(base, [read]), read, '2026-01-15')).toBe(2)
    expect(currentStreak(makeState({ ...base, '2026-01-15': { read: 'full' } }, [read]), read, '2026-01-15')).toBe(3)
  })

  it('a min rep still keeps the streak alive', () => {
    const s = makeState({
      '2026-01-13': { read: 'full' },
      '2026-01-14': { read: 'min' },
      '2026-01-15': { read: 'min' },
    }, [read])
    expect(currentStreak(s, read, '2026-01-15')).toBe(3)
  })

  it('a missed scheduled day breaks the current streak but longest remembers it', () => {
    // done 11,12, missed 13, done 14; today pending
    const s = makeState({
      '2026-01-11': { read: 'full' },
      '2026-01-12': { read: 'full' },
      '2026-01-14': { read: 'full' },
    }, [read])
    expect(currentStreak(s, read, '2026-01-15')).toBe(1)   // just the 14th
    expect(longestStreak(s, read, '2026-01-15')).toBe(2)   // the 11-12 run
  })
})

describe('never miss twice', () => {
  const read = daily('read')

  it('one missed day is at-risk, not failure', () => {
    // done the 13th, missed the 14th, today pending
    const s = makeState({ '2026-01-13': { read: 'full' } }, [read])
    const r = riskSignals(s, read, '2026-01-15')
    expect(r.missedYesterday).toBe(true)
    expect(r.missedTwice).toBe(false)
    expect(r.atRisk).toBe(true)
  })

  it('two missed scheduled days in a row is the failure state', () => {
    // done the 12th, missed 13 and 14
    const s = makeState({ '2026-01-12': { read: 'full' } }, [read])
    const r = riskSignals(s, read, '2026-01-15')
    expect(r.missedTwice).toBe(true)
  })

  it('doing it today clears the at-risk flag', () => {
    const s = makeState({
      '2026-01-13': { read: 'full' },
      '2026-01-15': { read: 'full' },
    }, [read])
    expect(riskSignals(s, read, '2026-01-15').atRisk).toBe(false)
  })
})

describe('minimum viable day', () => {
  const read = daily('read')
  const habits = [{ id: 'salah', type: 'salah', frequency: { kind: 'daily' } }, read]

  it('salah + bed + one other rep counts as a win', () => {
    const s = makeState({
      '2026-01-15': { salah: allFivePrayed, bed: 'full', read: 'min' },
    }, habits)
    expect(isMVDWin(s, '2026-01-15')).toBe(true)
  })

  it('missing the bed fails it', () => {
    const s = makeState({ '2026-01-15': { salah: allFivePrayed, read: 'min' } }, habits)
    expect(isMVDWin(s, '2026-01-15')).toBe(false)
  })

  it('salah and bed but no other rep is not enough', () => {
    const s = makeState({ '2026-01-15': { salah: allFivePrayed, bed: 'full' } }, habits)
    expect(isMVDWin(s, '2026-01-15')).toBe(false)
  })

  it('a partial salah (only 4 prayed) fails it', () => {
    const four = { fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'ontime' }
    const s = makeState({ '2026-01-15': { salah: four, bed: 'full', read: 'full' } }, habits)
    expect(isMVDWin(s, '2026-01-15')).toBe(false)
  })

  it('a flagged rough day survives once the MVD is met', () => {
    const s = makeState(
      { '2026-01-15': { salah: allFivePrayed, bed: 'full', read: 'min' } },
      habits,
      { '2026-01-15': { roughDay: true } },
    )
    expect(daySurvives(s, '2026-01-15')).toBe(true)
  })
})

describe('salahSummary', () => {
  it('all five on time is a full rep', () => {
    const sum = salahSummary({ fajr: 'ontime', dhuhr: 'ontime', asr: 'ontime', maghrib: 'ontime', isha: 'ontime' })
    expect(sum.done).toBe(true)
    expect(sum.rep).toBe('full')
  })
  it('all five prayed but some late is a min rep', () => {
    expect(salahSummary(allFivePrayed).rep).toBe('min')
  })
  it('four prayed is not done', () => {
    expect(salahSummary({ fajr: 'ontime', dhuhr: 'late', asr: 'ontime', maghrib: 'late' }).done).toBe(false)
  })
})

describe('daily score respects the active phase', () => {
  // two Phase 1 dailies and one Phase 3 daily that's still locked
  const habits = [
    { id: 'a', type: 'standard', phase: 1, frequency: { kind: 'daily' } },
    { id: 'b', type: 'standard', phase: 1, frequency: { kind: 'daily' } },
    { id: 'c', type: 'standard', phase: 3, frequency: { kind: 'daily' } },
  ]
  const day = '2026-01-15'
  const withPhase = (currentPhase) => ({
    settings: { dayRolloverHour: 3, currentPhase },
    habits,
    logs: { [day]: { a: { status: 'full' } } }, // only 'a' done
    days: {},
    votes: 0,
  })

  it('on Phase 1, the locked Phase 3 habit is not in the denominator', () => {
    const { done, total } = dayScore(withPhase(1), day)
    expect(total).toBe(2) // a and b, not c
    expect(done).toBe(1)  // a
  })

  it('once Phase 3 is unlocked, that habit counts', () => {
    const { total } = dayScore(withPhase(3), day)
    expect(total).toBe(3)
  })
})
