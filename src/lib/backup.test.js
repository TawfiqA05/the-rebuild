import { describe, it, expect } from 'vitest'
import { serializeBackup, parseBackup, BACKUP_SCHEMA } from './backup.js'
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

  it('passes a future/unknown envelope version through (forward-compatible)', () => {
    const future = JSON.stringify({ schemaVersion: 99, app: 'the-rebuild', state: { settings: { onboarded: true }, habits: [] } })
    expect(parseBackup(future).settings.onboarded).toBe(true)
  })

  it('throws on something that is not a backup', () => {
    expect(() => parseBackup('"just a string"')).toThrow()
    expect(() => parseBackup('42')).toThrow()
  })
})
