import { describe, it, expect } from 'vitest'
import { repair, UnreadableSave } from './repair.js'
import { habitStats, dayScore, appearsOnDay } from './logic.js'
import { migrate } from './migrate.js'

// repair() says what it changed, so the store can decide whether it needs a
// copy of the original and what to tell the person. Fixes change nothing a
// person logged; set-asides move a value out, so they need the copy.

const walk = { id: 'walk-x1', name: 'Evening walk', phase: 1, type: 'standard', frequency: { kind: 'daily' } }
const save = (patch) => ({ version: 2, settings: { onboarded: true }, habits: [walk], logs: { '2026-09-28': { 'walk-x1': { status: 'full', at: 1 } } }, days: {}, votes: 3, ...patch })

describe('repair()', () => {
  it('reports nothing for a healthy save and returns it unchanged', () => {
    const s = save()
    const r = repair(s)
    expect(r.state).toBe(s)
    expect(r.fixes).toEqual([])
    expect(r.setAside).toEqual([])
  })

  it('throws UnreadableSave for rule 1', () => {
    for (const bad of [null, 5, 'x', [], save({ settings: 'x' })]) expect(() => repair(bad)).toThrow(UnreadableSave)
  })

  it('rule 2: reports a list read out of an object as a fix', () => {
    const r = repair(save({ habits: { 'walk-x1': walk } }))
    expect(r.fixes).toEqual([{ type: 'readOut', field: 'habits' }])
    expect(r.setAside).toEqual([])
  })

  it('rule 3: reports a value it set aside', () => {
    const r = repair(save({ habits: 'oops', votes: 'many' }))
    expect(r.setAside.map((s) => s.field).sort()).toEqual(['habits', 'votes'])
    expect('habits' in r.state).toBe(false)
  })

  it('rule 4: reports habit entries it left out', () => {
    const r = repair(save({ habits: [null, walk] }))
    expect(r.setAside).toEqual([{ field: 'habits', entries: 1 }])
    expect(r.state.habits).toEqual([walk])
  })

  it('rule 5: names each habit it set to daily', () => {
    const r = repair(save({ habits: [{ ...walk, frequency: undefined }, { ...walk, id: 'gym-x', frequency: { kind: 'weekdays' } }] }))
    expect(r.fixes).toEqual([{ type: 'daily', habitId: 'walk-x1' }, { type: 'daily', habitId: 'gym-x' }])
  })

  it('does not change the object it was given', () => {
    const s = save({ habits: [{ ...walk, frequency: undefined }] })
    const copy = JSON.parse(JSON.stringify(s))
    repair(s)
    expect(s).toEqual(copy)
  })

  it('rule 6: what it leaves as it is still opens without a crash', () => {
    const cases = [
      save({ logs: { '2026-09-28': null, '2026-09-29': 'x', '2026-09-30': { 'walk-x1': 'full' } } }),
      save({ days: { '2026-09-28': null, '2026-09-29': 'x' } }),
      save({ habits: [{ ...walk, frequency: { kind: 'monthly' } }, { ...walk, id: 'g', frequency: { kind: 'perWeek' } }] }),
    ]
    for (const c of cases) {
      const m = migrate(c)
      expect(repair(m).fixes).toEqual([])
      for (const h of m.habits) { appearsOnDay(h, '2026-10-05'); habitStats(m, h, '2026-10-05') }
      expect(() => dayScore(m, '2026-10-05')).not.toThrow()
    }
  })
})
