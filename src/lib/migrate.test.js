import { describe, it, expect } from 'vitest'
import { migrate } from './migrate.js'
import { freshState, FISHERS_LOCATION } from './seed.js'

// Migration has to be lossless: an older save (and the JSON backup that mirrors
// it) must come back with every field intact and any newly-shipped slots filled
// in. These pin the food addition specifically, plus the general guarantee.

describe('existing users migrate without loss', () => {
  // A pre-food ("v1") save with real user data and no `food` key.
  const legacy = {
    version: 1,
    settings: { dayRolloverHour: 3, currentPhase: 3, onboarded: true, city: 'Somewhere' },
    habits: [{ id: 'custom', name: 'My habit', phase: 1, type: 'standard', frequency: { kind: 'daily' } }],
    logs: { '2026-01-14': { custom: { status: 'full' } } },
    days: { '2026-01-14': { roughDay: true } },
    tasks: [{ id: 't1', text: 'ship it', dueDay: '2026-01-15', doneDay: null, source: 'manual', createdAt: 1, createdDay: '2026-01-14' }],
    wins: [{ id: 'w1', at: 1, text: 'a win' }],
    votes: 42,
  }

  it('adds an empty food log and bumps the version, keeping everything else', () => {
    const m = migrate(legacy)
    expect(m.food).toEqual([])                 // new slot, filled in
    expect(m.version).toBe(freshState().version)
    expect(m.settings.currentPhase).toBe(3)    // settings preserved…
    expect(m.settings.city).toBe('Somewhere')
    expect(m.logs).toEqual(legacy.logs)        // …logs…
    expect(m.days).toEqual(legacy.days)        // …days…
    expect(m.tasks).toEqual(legacy.tasks)      // …tasks…
    expect(m.wins).toEqual(legacy.wins)        // …wins…
    expect(m.votes).toBe(42)                   // …and the vote counter
    expect(m.habits.find((h) => h.id === 'custom')).toBeTruthy() // custom habit kept
  })

  it('keeps a pre-feature device on Fishers (no prayerLocation key → default)', () => {
    expect('prayerLocation' in legacy.settings).toBe(false)
    expect(migrate(legacy).settings.prayerLocation).toEqual(FISHERS_LOCATION)
  })

  it('respects an explicit prayerLocation, including a new user who skipped (null)', () => {
    const skipped = { ...legacy, settings: { ...legacy.settings, prayerLocation: null } }
    expect(migrate(skipped).settings.prayerLocation).toBe(null)
    const set = { mode: 'coords', label: 'Cairo', lat: 30.04, lng: 31.24 }
    const traveller = { ...legacy, settings: { ...legacy.settings, prayerLocation: set } }
    expect(migrate(traveller).settings.prayerLocation).toEqual(set)
  })

  it('is idempotent — migrating an already-migrated state changes nothing material', () => {
    const once = migrate(legacy)
    const twice = migrate(once)
    expect(twice.food).toEqual(once.food)
    expect(twice.tasks).toEqual(once.tasks)
    expect(twice.version).toBe(once.version)
  })
})

describe('first-run tour shows once', () => {
  it('a fresh install has not seen the tour; existing devices have', () => {
    expect(freshState().settings.tourSeen).toBe(false)
    // legacy state (no tourSeen key) → treated as already seen, so it never pops
    // up on someone who has been using the app.
    const legacy = { version: 1, settings: { onboarded: true }, habits: [], logs: {}, days: {} }
    expect(migrate(legacy).settings.tourSeen).toBe(true)
  })
  it('respects an explicit tourSeen (e.g. a replay that reset it to false)', () => {
    const s = { version: 2, settings: { onboarded: true, tourSeen: false }, habits: [], logs: {}, days: {} }
    expect(migrate(s).settings.tourSeen).toBe(false)
  })
})

describe('collapsed sections persist per device', () => {
  it('default the Today sections closed, and keep a saved choice', () => {
    expect(freshState().settings.tasksCollapsed).toBe(true)
    expect(freshState().settings.foodCollapsed).toBe(true)
    const opened = { version: 2, settings: { tasksCollapsed: false, foodCollapsed: false }, habits: [], logs: {}, days: {} }
    const m = migrate(opened)
    expect(m.settings.tasksCollapsed).toBe(false)
    expect(m.settings.foodCollapsed).toBe(false)
  })
})

describe('backup roundtrip preserves food', () => {
  it('food entries survive an export → import cycle', () => {
    const state = {
      ...freshState(),
      food: [
        { id: 'f1', text: 'eggs', at: 1700000000000, day: '2026-01-15' },
        { id: 'f2', text: 'rice', at: 1700003600000, day: '2026-01-15' },
        { id: 'f3', text: 'late dinner', at: 1699920000000, day: '2026-01-14' }, // an "add to yesterday" entry
      ],
    }
    // export = JSON.stringify(state); import = migrate(JSON.parse(...))
    const restored = migrate(JSON.parse(JSON.stringify(state)))
    expect(restored.food).toEqual(state.food)
  })
})
