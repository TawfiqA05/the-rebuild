import { describe, it, expect } from 'vitest'
import { serializeBackup, parseBackup, backupCounts, BACKUP_SCHEMA } from './backup.js'
import { migrate } from './migrate.js'
import { freshState } from './seed.js'

// The backup envelope must round-trip today's state AND keep restoring backups
// written in older formats after the format or data model changes later.

describe('backup envelope', () => {
  it('serializes state into a versioned envelope', () => {
    const env = JSON.parse(serializeBackup(freshState()))
    expect(env.schemaVersion).toBe(BACKUP_SCHEMA)
    expect(env.app).toBe('the-rebuild')
    expect(typeof env.exportedAt).toBe('string')
    expect(env.state.settings).toBeTruthy()
  })

  it('round-trips: serialize → parse returns the same state', () => {
    const state = freshState()
    state.votes = 42
    expect(parseBackup(serializeBackup(state))).toEqual(state)
  })

  it('accepts a legacy bare-state export (no schemaVersion — today\'s format)', () => {
    // Exactly what the app wrote before the envelope: the raw state, stringified.
    const legacy = JSON.stringify({ version: 2, settings: { onboarded: true, votes: 1 }, habits: [], logs: {}, days: {} })
    const state = parseBackup(legacy)
    expect(state.settings.onboarded).toBe(true)
  })

  it('a synthetic OLD-format file still restores cleanly through migrate()', () => {
    // A minimal v1 bare-state backup with real data, as an old device would have.
    const oldFile = JSON.stringify({
      version: 1,
      settings: { onboarded: true, language: 'ar' },
      habits: [{ id: 'bed', name: 'Make the bed', phase: 1, frequency: { kind: 'daily' } }],
      logs: { '2026-01-01': { bed: { status: 'full' } } },
      days: {},
      votes: 3,
    })
    const restored = migrate(parseBackup(oldFile))
    expect(restored.settings.onboarded).toBe(true)     // stays an existing user
    expect(restored.settings.language).toBe('ar')      // preference survives
    expect(restored.logs['2026-01-01'].bed.status).toBe('full') // history survives
    expect(restored.votes).toBe(3)
    expect(restored.habits.find((h) => h.id === 'bed')).toBeTruthy()
  })

  it('the task archive rides in the backup and survives a round-trip', () => {
    const state = freshState()
    state.taskArchive = [
      { id: 'a', text: 'done thing', createdAt: 1, createdDay: '2026-08-10', dueDay: '2026-08-10',
        doneDay: '2026-08-10', doneAt: 1, source: 'manual',
        reason: 'completed', archivedAt: 1, archivedDay: '2026-08-10' },
      { id: 'b', text: 'ditched thing', createdAt: 2, createdDay: '2026-08-11', dueDay: '2026-08-12',
        doneDay: null, doneAt: null, source: 'manual',
        reason: 'deleted', archivedAt: 2, archivedDay: '2026-08-11' },
    ]
    // Round-trips exactly (no migrate), and a legacy save with no archive key
    // gets an empty one back from migrate — never undefined.
    expect(parseBackup(serializeBackup(state)).taskArchive).toEqual(state.taskArchive)
    const restored = migrate(parseBackup(serializeBackup(state)))
    expect(restored.taskArchive).toEqual(state.taskArchive)
    const legacy = migrate(parseBackup(JSON.stringify({ version: 2, settings: { onboarded: true }, habits: [] })))
    expect(legacy.taskArchive).toEqual([])
  })

  it('passes a future/unknown envelope version through (forward-compatible)', () => {
    const future = JSON.stringify({ schemaVersion: 99, app: 'the-rebuild', state: { settings: { onboarded: true }, habits: [] } })
    expect(parseBackup(future).settings.onboarded).toBe(true)
  })

  it('throws on something that is not a backup', () => {
    expect(() => parseBackup('"just a string"')).toThrow()
    expect(() => parseBackup('42')).toThrow()
  })
})

// A wrong file must be refused before it can touch anything, with a reason the
// screen can turn into a plain message.
describe('refusing a file that is not a backup', () => {
  const reasonOf = (json) => {
    try { parseBackup(json) } catch (err) { return err.reason }
    return 'accepted'
  }

  it('refuses an empty object', () => {
    expect(reasonOf('{}')).toBe('not-backup')
  })

  it('refuses a list', () => {
    expect(reasonOf('[]')).toBe('not-backup')
    expect(reasonOf('[{"settings":{},"habits":[]}]')).toBe('not-backup')
  })

  it('refuses an envelope with an empty state', () => {
    expect(reasonOf(JSON.stringify({ schemaVersion: 1, app: 'the-rebuild', state: {} }))).toBe('not-backup')
    expect(reasonOf(JSON.stringify({ schemaVersion: 1, app: 'the-rebuild' }))).toBe('not-backup')
  })

  it('refuses a state whose settings or habits have the wrong shape', () => {
    expect(reasonOf(JSON.stringify({ settings: {}, habits: {} }))).toBe('not-backup')
    expect(reasonOf(JSON.stringify({ settings: [], habits: [] }))).toBe('not-backup')
    expect(reasonOf(JSON.stringify({ settings: null, habits: [] }))).toBe('not-backup')
    expect(reasonOf(JSON.stringify({ habits: [] }))).toBe('not-backup')
  })

  it('refuses a file from another app, even when its state looks right', () => {
    const state = { settings: { onboarded: true }, habits: [] }
    expect(reasonOf(JSON.stringify({ schemaVersion: 1, app: 'some-other-app', state }))).toBe('other-app')
    expect(reasonOf(JSON.stringify({ schemaVersion: 3, app: 'notes', exportedAt: '2026-01-01', items: [] }))).toBe('other-app')
  })

  it('refuses a file that was cut off partway', () => {
    const whole = serializeBackup(freshState())
    expect(reasonOf(whole.slice(0, Math.floor(whole.length / 2)))).toBe('unreadable')
    expect(reasonOf('')).toBe('unreadable')
  })

  it('accepts an envelope with no app name when the state inside passes', () => {
    const env = { schemaVersion: 1, state: { settings: { onboarded: true }, habits: [] } }
    expect(parseBackup(JSON.stringify(env)).settings.onboarded).toBe(true)
  })

  it('accepts a real export from this app', () => {
    const state = freshState()
    expect(reasonOf(serializeBackup(state))).toBe('accepted')
  })
})

describe('backupCounts', () => {
  it('counts the habits on screen and the days with something logged', () => {
    const state = migrate({
      settings: { onboarded: true, currentPhase: 1, includeIslamic: true },
      habits: [],
      logs: { '2026-09-01': { bed: { status: 'full' } }, '2026-09-02': {}, '2026-09-03': { salah: { fajr: 'ontime' } } },
    })
    const counts = backupCounts(state)
    expect(counts.days).toBe(2)
    expect(counts.habits).toBe(state.habits.filter((h) => !h.archived && h.phase <= 1).length)
  })
})
