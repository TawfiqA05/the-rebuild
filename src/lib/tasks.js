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

/** Lifetime count of completed tasks — the simple number shown on Stats. */
export function completedTaskCount(tasks) {
  return (tasks || []).filter((t) => !!t.doneDay).length
}
