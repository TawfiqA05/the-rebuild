// ---------------------------------------------------------------------------
// tasks.js — one-off to-dos, kept deliberately separate from habits.
//
// A task is a single thing to do on a day. Unlike habits, tasks carry NO
// discipline weight: completing one never touches the daily score, streaks, or
// never-miss-twice. There is no shame mechanic here — an unfinished task just
// rolls quietly to the next day. The only crossover is `votes`: finishing a
// task still counts as one small vote for who you're becoming (handled in the
// store, which owns the votes counter).
//
// Task shape:
//   {
//     id, text,
//     createdAt,          // ms timestamp
//     createdDay,         // logical day-key it was added on
//     dueDay,             // logical day-key it's planned for (default: today)
//     doneDay | null,     // logical day-key it was completed on (null = open)
//     doneAt  | null,     // ms timestamp of completion
//     source,             // 'manual' | 'shutdown'
//   }
//
// These are pure functions over a `tasks` array so the rules can be unit-tested
// without React or localStorage.
// ---------------------------------------------------------------------------

import { keyToDate, weekdayOf } from './time.js'

const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Build a fresh task. `id`/`now` are injectable so callers (and tests) stay pure. */
export function makeTask({ text, dueDay, createdDay, source = 'manual', id, now }) {
  const at = now ?? Date.now()
  return {
    id: id ?? (globalThis.crypto?.randomUUID?.() || String(at + Math.random())),
    text: String(text).trim(),
    createdAt: at,
    createdDay: createdDay ?? dueDay,
    dueDay,
    doneDay: null,
    doneAt: null,
    source,
  }
}

export function isOpen(task) {
  return !task.doneDay
}

/**
 * What shows in the Tasks card on a given logical day:
 *   open — not done, and due on or before today (so unfinished tasks carry over)
 *   done — completed *today* (crossed out, fading; gone after the 3am rollover)
 * A task completed on an earlier day drops out of view entirely.
 */
export function visibleTasks(tasks, dayKey) {
  const list = tasks || []
  const open = list
    .filter((t) => isOpen(t) && t.dueDay <= dayKey)
    // carried-over first (older due date), then by creation order
    .sort((a, b) => (a.dueDay < b.dueDay ? -1 : a.dueDay > b.dueDay ? 1 : a.createdAt - b.createdAt))
  const done = list
    .filter((t) => t.doneDay === dayKey)
    .sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0))
  return { open, done }
}

/**
 * A subtle "since Tue" tag for a task that has rolled past its due day.
 * Returns null when the task is due today (or in the future) — no guilt badge
 * for something that isn't even late yet. Uses a weekday name within the last
 * week, falling back to "Aug 3" for older carry-overs.
 */
export function carryOverLabel(task, dayKey) {
  if (!isOpen(task) || task.dueDay >= dayKey) return null
  const due = keyToDate(task.dueDay)
  const today = keyToDate(dayKey)
  const days = Math.round((today - due) / 86_400_000)
  if (days <= 6) return `since ${SHORT_DAYS[weekdayOf(task.dueDay)]}`
  return `since ${SHORT_MONTHS[due.getMonth()]} ${due.getDate()}`
}

/**
 * Toggle a task's completion for `dayKey`. Completing stamps doneDay/doneAt;
 * un-completing clears them. Returns the new list plus `becameDone` so the
 * store knows when to tick the votes counter (votes only ever grow).
 */
export function toggleTaskDone(tasks, id, dayKey, now = Date.now()) {
  let becameDone = false
  const next = (tasks || []).map((t) => {
    if (t.id !== id) return t
    if (isOpen(t)) {
      becameDone = true
      return { ...t, doneDay: dayKey, doneAt: now }
    }
    return { ...t, doneDay: null, doneAt: null }
  })
  return { tasks: next, becameDone }
}

/**
 * Future-dated open tasks — the "Upcoming" list. These are deliberately hidden
 * from the Today list until their day arrives (or they're pulled in), sorted by
 * due day then creation order so grouping stays stable.
 */
export function upcomingTasks(tasks, dayKey) {
  return (tasks || [])
    .filter((t) => isOpen(t) && t.dueDay > dayKey)
    .sort((a, b) => (a.dueDay < b.dueDay ? -1 : a.dueDay > b.dueDay ? 1 : a.createdAt - b.createdAt))
}

/** Group an already-sorted task list into [{ dueDay, tasks }] preserving order. */
export function groupByDueDay(tasks) {
  const groups = []
  const at = new Map()
  for (const t of tasks || []) {
    if (!at.has(t.dueDay)) { at.set(t.dueDay, groups.length); groups.push({ dueDay: t.dueDay, tasks: [] }) }
    groups[at.get(t.dueDay)].tasks.push(t)
  }
  return groups
}

/**
 * Edit a task's text and/or due day, in place. Only those two fields ever
 * change — id, source, createdAt, and completion (doneDay/doneAt) are preserved
 * exactly, so editing can't resurrect or clobber a finished task.
 */
export function updateTaskFields(tasks, id, patch) {
  return (tasks || []).map((t) => {
    if (t.id !== id) return t
    const next = { ...t }
    if (typeof patch.text === 'string') next.text = patch.text.trim()
    if (typeof patch.dueDay === 'string') next.dueDay = patch.dueDay
    return next
  })
}

/** Remove a task by id. Pure — never touches votes or any other state. */
export function deleteTaskById(tasks, id) {
  return (tasks || []).filter((t) => t.id !== id)
}

/** Re-insert a whole task object (used to undo a delete), preserving it exactly. */
export function insertTask(tasks, task) {
  return task ? [...(tasks || []), task] : (tasks || [])
}

/**
 * Reconcile the evening-shutdown plan into `dueDay`'s tasks: drop the
 * previously-planned *still-open* shutdown tasks for that day and recreate from
 * `texts`. Already-completed shutdown tasks are left untouched, so re-running
 * shutdown is idempotent and never duplicates. Kept pure so the idempotency is
 * unit-testable; the store just supplies `createdDay`.
 */
export function planShutdownTasks(tasks, dueDay, texts, { createdDay } = {}) {
  const kept = (tasks || []).filter(
    (t) => !(t.source === 'shutdown' && t.dueDay === dueDay && !t.doneDay),
  )
  const added = (texts || [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .map((text) => makeTask({ text, dueDay, createdDay, source: 'shutdown' }))
  return [...kept, ...added]
}

/**
 * Lifetime count of completed tasks — the simple number shown on Stats. Counts
 * anything with a `doneDay` across BOTH the live list and the archive, so the
 * number never drops when a finished task ages into the archive (or is later
 * deleted). Archive is optional so existing callers/tests keep working.
 */
export function completedTaskCount(tasks, archive) {
  const done = (list) => (list || []).filter((t) => !!t.doneDay).length
  return done(tasks) + done(archive)
}

// ---------------------------------------------------------------------------
// Archive — completed and deleted tasks stop vanishing forever.
//
// A finished task stays crossed out on its day, then (after the 3am rollover)
// moves out of the live list into `taskArchive`. Deleting a task moves it there
// too. Nothing here ever touches the score, streaks, or votes — an archive entry
// is just a task with two extra fields:
//   reason       — 'completed' | 'deleted'
//   archivedAt   — ms timestamp, used for newest-first order + the 90-day purge
//   archivedDay  — logical day-key it landed in the archive (for the date label)
// The archive is pure data, so all of this is unit-testable without React.
// ---------------------------------------------------------------------------

export const ARCHIVE_TTL_DAYS = 90

/** Wrap a task as an archive entry, preserving every original field. */
export function makeArchiveEntry(task, reason, { archivedAt, archivedDay }) {
  return { ...task, reason, archivedAt, archivedDay }
}

/**
 * Move one live task into the archive by id (used for an explicit delete).
 * Returns the new `{ tasks, archive }`. A no-op (same refs) if the id is gone.
 */
export function archiveTaskById(tasks, archive, id, { reason = 'deleted', archivedAt, archivedDay }) {
  const list = tasks || []
  const task = list.find((t) => t.id === id)
  if (!task) return { tasks: list, archive: archive || [] }
  const entry = makeArchiveEntry(task, reason, { archivedAt, archivedDay })
  return { tasks: list.filter((t) => t.id !== id), archive: [entry, ...(archive || [])] }
}

/**
 * Sweep finished tasks whose day has already rolled over (`doneDay < todayKey`)
 * out of the live list and into the archive as 'completed'. Keeps the entry's
 * own completion date (doneAt/doneDay) as the archived date. Returns the same
 * refs untouched when there's nothing to move, so callers can bail cheaply.
 */
export function sweepArchivable(tasks, archive, todayKey, now = Date.now()) {
  const list = tasks || []
  const stay = []
  const moved = []
  for (const t of list) {
    if (t.doneDay && t.doneDay < todayKey) {
      moved.push(makeArchiveEntry(t, 'completed', { archivedAt: t.doneAt ?? now, archivedDay: t.doneDay }))
    } else {
      stay.push(t)
    }
  }
  if (!moved.length) return { tasks: list, archive: archive || [] }
  return { tasks: stay, archive: [...moved, ...(archive || [])] }
}

/**
 * Drop archive entries older than `ttlDays` (by archivedAt). Returns the same
 * ref when nothing is purged, so a reconcile pass can no-op cleanly.
 */
export function purgeArchive(archive, now = Date.now(), ttlDays = ARCHIVE_TTL_DAYS) {
  const list = archive || []
  const cutoff = now - ttlDays * 86_400_000
  const kept = list.filter((e) => (e.archivedAt ?? 0) >= cutoff)
  return kept.length === list.length ? list : kept
}

/** Archive, sorted newest-first and optionally filtered by a text query. */
export function searchArchive(archive, query = '') {
  const sorted = [...(archive || [])].sort((a, b) => (b.archivedAt ?? 0) - (a.archivedAt ?? 0))
  const q = String(query || '').trim().toLowerCase()
  return q ? sorted.filter((e) => (e.text || '').toLowerCase().includes(q)) : sorted
}

/**
 * "Bring back" an archived task to today's open list: strip the archive fields,
 * clear its completion, and re-due it for `todayKey`. Returns the new archive
 * (without that id) plus the revived open task (null if the id was gone).
 */
export function reviveArchived(archive, id, todayKey) {
  const list = archive || []
  const entry = list.find((e) => e.id === id)
  const nextArchive = list.filter((e) => e.id !== id)
  if (!entry) return { archive: nextArchive, task: null }
  const { reason, archivedAt, archivedDay, ...task } = entry
  return { archive: nextArchive, task: { ...task, dueDay: todayKey, doneDay: null, doneAt: null } }
}

/** Remove an archive entry for good ("Delete forever"). */
export function deleteArchivedById(archive, id) {
  return (archive || []).filter((e) => e.id !== id)
}
