// ---------------------------------------------------------------------------
// backup.js — the JSON export/import format.
//
// Exports are wrapped in a small envelope with its own `schemaVersion`, separate
// from the app's data-model `version`. The envelope shape is upgraded forward on
// import here; the data inside is then upgraded by migrate(). Two layers means a
// backup taken today keeps restoring cleanly even after future changes to either
// the file format or the data model.
// ---------------------------------------------------------------------------

import { activeHabits } from './logic.js'

// Bump when the ENVELOPE shape changes (not when the app data model changes —
// that's `state.version`, handled by migrate.js). Add a case to upgradeEnvelope.
export const BACKUP_SCHEMA = 1

// Every export names its app, so a file from another app can be told apart.
export const APP_NAME = 'the-rebuild'

/** Wrap the app state in the current backup envelope, as pretty JSON. */
export function serializeBackup(state) {
  return JSON.stringify({
    schemaVersion: BACKUP_SCHEMA,
    app: APP_NAME,
    exportedAt: new Date().toISOString(),
    state,
  }, null, 2)
}

// Why a file was refused. The screen turns `reason` into a plain message.
export class BackupError extends Error {
  constructor(reason, message) {
    super(message)
    this.name = 'BackupError'
    this.reason = reason // 'unreadable' | 'other-app' | 'not-backup'
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/**
 * Normalize any backup — the current envelope, a future/older envelope, or a
 * legacy bare-state export (pre-schemaVersion) — into a plain state object.
 * Throws a BackupError on anything that isn't one of ours: a file that won't
 * parse (cut off, not JSON), a file that names another app, or a state with no
 * settings object and habits list. The data-model migration (migrate.js) runs
 * on the result afterward, in the store, still before anything is replaced.
 */
export function parseBackup(json) {
  let parsed = json
  if (typeof json === 'string') {
    try {
      parsed = JSON.parse(json)
    } catch {
      throw new BackupError('unreadable', 'the file is not complete JSON')
    }
  }
  if (!isPlainObject(parsed)) throw new BackupError('not-backup', 'not a valid backup file')
  // An export names its app. A file with no name is fine if the state passes.
  if (typeof parsed.app === 'string' && parsed.app !== APP_NAME) {
    throw new BackupError('other-app', 'the file is from another app')
  }

  // A bare state export from before the envelope existed: it has the state
  // fields directly (settings/habits) and no schemaVersion. Treat it as v0.
  const envelope = ('schemaVersion' in parsed)
    ? parsed
    : { schemaVersion: 0, state: parsed }

  const { state } = upgradeEnvelope(envelope)
  if (!isPlainObject(state) || !isPlainObject(state.settings) || !Array.isArray(state.habits)) {
    throw new BackupError('not-backup', 'backup has no settings and habits')
  }
  return state
}

/**
 * What a state holds, in the terms the restore sheet uses: the habits that
 * show on Today and the days with anything logged.
 */
export function backupCounts(state) {
  const days = Object.values(state.logs || {})
    .filter((day) => isPlainObject(day) && Object.keys(day).length > 0).length
  return { habits: activeHabits(state).length, days }
}

/** Forward-migrate the envelope shape across schema versions. */
function upgradeEnvelope(env) {
  let e = env
  // v0 (bare state) → v1 (wrapped). Nothing to move; the state is already under
  // `state`, so just stamp the version. Future bumps add their step here.
  if (e.schemaVersion < 1) e = { ...e, schemaVersion: 1 }
  return e
}

// Trigger a download of the given JSON string as a dated backup file.
// Shared by Settings and the Sunday review nudge so both do it the same way.
export function downloadBackup(json) {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `the-rebuild-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}
