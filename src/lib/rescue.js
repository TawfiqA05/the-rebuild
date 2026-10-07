// ---------------------------------------------------------------------------
// rescue.js — copies of saved data the app couldn't use as it was.
//
// Before the app writes over a save it couldn't read (or one it had to
// repair), it keeps the original, byte for byte, under a key of its own:
// `the-rebuild:rescue:<time saved>`. A copy is never written over. A new one
// always gets a new key, and Reset everything removes them all.
//
// A copy is only counted as kept once it reads back exactly as written.
// ---------------------------------------------------------------------------

import { BACKUP_SCHEMA, APP_NAME } from './backup.js'

export const RESCUE_PREFIX = 'the-rebuild:rescue:'

/** Every rescue key in storage, oldest first. */
export function rescueKeys(storage = localStorage) {
  const keys = []
  for (let i = 0; i < storage.length; i++) {
    const k = storage.key(i)
    if (k && k.startsWith(RESCUE_PREFIX)) keys.push(k)
  }
  return keys.sort()
}

/**
 * Keep `raw` under a new rescue key and read it back. Returns the key, or null
 * when storage refused the write or it read back different (that copy is
 * removed again). If a copy with exactly the same text is already kept, that
 * key is returned and nothing is written.
 */
export function keepRescueCopy(raw, { storage = localStorage, now = Date.now() } = {}) {
  try {
    for (const k of rescueKeys(storage)) if (storage.getItem(k) === raw) return k
    const base = RESCUE_PREFIX + new Date(now).toISOString()
    let key = base
    for (let n = 2; storage.getItem(key) !== null; n++) key = `${base}-${n}`
    storage.setItem(key, raw)
    if (storage.getItem(key) === raw) return key
    try { storage.removeItem(key) } catch { /* nothing more to do */ }
    return null
  } catch (err) {
    console.warn('Could not keep a copy of the saved data:', err)
    return null
  }
}

/** Remove every rescue copy (Reset everything). */
export function clearRescueCopies(storage = localStorage) {
  try {
    for (const k of rescueKeys(storage)) storage.removeItem(k)
  } catch { /* storage blocked */ }
}

/**
 * A file of what is saved on this device, read from storage and never from
 * the app's state: the save itself (as `state` when it reads as an object,
 * otherwise as `savedText`) and every rescue copy as it was kept.
 */
export function savedDataExport(storageKey, storage = localStorage) {
  const file = { schemaVersion: BACKUP_SCHEMA, app: APP_NAME, exportedAt: new Date().toISOString() }
  let raw = null
  try { raw = storage.getItem(storageKey) } catch { /* storage blocked */ }
  if (raw !== null) {
    let parsed
    try { parsed = JSON.parse(raw) } catch { parsed = undefined }
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) file.state = parsed
    else file.savedText = raw
  }
  try {
    file.rescueCopies = rescueKeys(storage).map((key) => ({ key, text: storage.getItem(key) }))
  } catch {
    file.rescueCopies = []
  }
  return JSON.stringify(file, null, 2)
}
