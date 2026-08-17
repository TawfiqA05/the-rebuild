// ---------------------------------------------------------------------------
// backup.js — the JSON export/import format.
//
// Exports are wrapped in a small envelope with its own `schemaVersion`, separate
// from the app's data-model `version`. The envelope shape is upgraded forward on
// import here; the data inside is then upgraded by migrate(). Two layers means a
// backup taken today keeps restoring cleanly even after future changes to either
// the file format or the data model.
// ---------------------------------------------------------------------------

// Bump when the ENVELOPE shape changes (not when the app data model changes —
// that's `state.version`, handled by migrate.js). Add a case to upgradeEnvelope.
export const BACKUP_SCHEMA = 1

/** Wrap the app state in the current backup envelope, as pretty JSON. */
export function serializeBackup(state) {
  return JSON.stringify({
    schemaVersion: BACKUP_SCHEMA,
    app: 'the-rebuild',
    exportedAt: new Date().toISOString(),
    state,
  }, null, 2)
}

/**
 * Normalize any backup — the current envelope, a future/older envelope, or a
 * legacy bare-state export (pre-schemaVersion) — into a plain state object.
 * Throws on something that isn't a recognizable backup. The data-model
 * migration (migrate.js) runs on the result afterward, in the store.
 */
export function parseBackup(json) {
  const parsed = typeof json === 'string' ? JSON.parse(json) : json
  if (!parsed || typeof parsed !== 'object') throw new Error('not a valid backup file')

  // A bare state export from before the envelope existed: it has the state
  // fields directly (settings/habits) and no schemaVersion. Treat it as v0.
  const envelope = ('schemaVersion' in parsed)
    ? parsed
    : { schemaVersion: 0, state: parsed }

  const upgraded = upgradeEnvelope(envelope)
  if (!upgraded.state || typeof upgraded.state !== 'object') throw new Error('backup has no state')
  return upgraded.state
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
