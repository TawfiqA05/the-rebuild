// ---------------------------------------------------------------------------
// repair.js — fix the shapes a saved state can't be used in, before migrate()
// fills in what's missing.
//
// The rules (each one is tested in repair.test.js and migrate.test.js):
//   1. A save that isn't an object, or whose settings aren't an object, can't
//      be read at all: repair throws UnreadableSave and the store keeps a copy
//      before starting fresh.
//   2. A list saved as an object whose values are all objects is read back
//      into a list, in key order. A habit with no id takes its key. (a fix)
//   3. Any other value in the wrong shape is set aside: it's left out here and
//      treated as missing, and the store must keep a copy of the original
//      first. A null or missing value is just missing, as before.
//   4. Entries that aren't objects in habits, wins, tasks, food and myQuotes
//      are set aside the same way. Every entry that is an object is kept.
//   5. A habit with no usable schedule becomes daily, and is named in the
//      report so the person can see it was a guess. (a fix)
//   6. Anything else is kept as it is.
//
// Nothing here drops a habit, a log or a day. Pure, and never changes the
// object it was given.
// ---------------------------------------------------------------------------

export class UnreadableSave extends Error {
  constructor(message) {
    super(message)
    this.name = 'UnreadableSave'
  }
}

const isPlainObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const isMissing = (v) => v === undefined || v === null

const LISTS = ['habits', 'wins', 'tasks', 'taskArchive', 'myQuotes', 'food']
// Lists whose entries are drawn one by one, so a single null in them crashes
// the screen (rule 4).
const ENTRY_LISTS = ['habits', 'wins', 'tasks', 'myQuotes', 'food']
const MAPS = ['logs', 'days']

/**
 * Repair a parsed save. Returns { state, fixes, setAside }:
 *   fixes:    [{ type: 'readOut', field }, { type: 'daily', habitId }]
 *   setAside: [{ field }, { field, entries: n }]
 * A healthy save comes back as the same object with both lists empty.
 */
export function repair(input) {
  if (!isPlainObject(input)) throw new UnreadableSave('the save is not an object')
  if (!isMissing(input.settings) && !isPlainObject(input.settings)) {
    throw new UnreadableSave('the saved settings are not an object')
  }

  const fixes = []
  const setAside = []
  const out = { ...input }
  let changed = false
  const drop = (field) => { delete out[field]; setAside.push({ field }); changed = true }

  for (const field of LISTS) {
    const v = input[field]
    if (isMissing(v) || Array.isArray(v)) continue
    if (isPlainObject(v) && Object.values(v).every(isPlainObject)) {
      out[field] = Object.entries(v).map(([key, item]) =>
        (field === 'habits' && isMissing(item.id) ? { ...item, id: key } : item))
      fixes.push({ type: 'readOut', field })
      changed = true
    } else {
      drop(field)
    }
  }

  for (const field of MAPS) {
    const v = input[field]
    if (!isMissing(v) && !isPlainObject(v)) drop(field)
  }

  // The hidden tab's entries: an object whose two lists are lists (or missing).
  const p = input.privateLog
  if (!isMissing(p) && !(isPlainObject(p) && [p.entries, p.waves].every((l) => isMissing(l) || Array.isArray(l)))) {
    drop('privateLog')
  }

  if (!isMissing(input.votes) && typeof input.votes !== 'number') drop('votes')

  for (const field of ENTRY_LISTS) {
    if (!Array.isArray(out[field])) continue
    const kept = out[field].filter(isPlainObject)
    if (kept.length === out[field].length) continue
    setAside.push({ field, entries: out[field].length - kept.length })
    out[field] = kept
    changed = true
  }

  if (Array.isArray(out.habits)) {
    out.habits = out.habits.map((h) => {
      if (hasSchedule(h.frequency)) return h
      fixes.push({ type: 'daily', habitId: h.id })
      changed = true
      return { ...h, frequency: { kind: 'daily' } }
    })
  }

  return { state: changed ? out : input, fixes, setAside }
}

// A schedule the rest of the app can read without crashing. Unknown kinds are
// left alone (rule 6): the app already treats them as shown every day.
function hasSchedule(f) {
  if (!isPlainObject(f)) return false
  if (f.kind === 'weekdays') return Array.isArray(f.days)
  return true
}
