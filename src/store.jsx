// ---------------------------------------------------------------------------
// store.jsx — single source of truth.
//
// Everything lives in localStorage. There is no backend, no account, no sync.
// We keep the whole app state in one object, persist it on every change, and
// expose a small set of intent-named actions (toggleHabit, logSalah, …).
//
// The `votes` counter is the one piece of state that only ever grows: it ticks
// up on each new completion and is never decremented, honouring the
// "Votes for who I'm becoming" rule even if a log is later edited or removed.
// ---------------------------------------------------------------------------

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { freshState } from './lib/seed.js'
import { migrate } from './lib/migrate.js'
import { todayKey } from './lib/time.js'
import { habitStatusOn, isDone, salahSummary, isFaithHabit } from './lib/logic.js'
import {
  makeTask, toggleTaskDone, insertTask, planShutdownTasks, updateTaskFields,
  archiveTaskById, sweepArchivable, purgeArchive, reviveArchived, deleteArchivedById,
} from './lib/tasks.js'
import { makeFoodEntry, resolveEntryTime, updateFoodText, setFoodEntryTime, deleteFoodById, insertFood } from './lib/food.js'
import { serializeBackup, parseBackup, BackupError } from './lib/backup.js'
import { clearPrayerCache } from './lib/prayerTimes.js'
import { repair } from './lib/repair.js'
import { keepRescueCopy, clearRescueCopies, savedDataExport } from './lib/rescue.js'

export const STORAGE_KEY = 'the-rebuild:v1'

// Some browsers (private mode, storage disabled) throw on any localStorage
// access. Detect it once so the app can run in-memory and warn instead of
// white-screening.
export const storageAvailable = (() => {
  try {
    const t = '__rebuild_probe__'
    localStorage.setItem(t, '1')
    localStorage.removeItem(t)
    return true
  } catch {
    return false
  }
})()

// Ids for wins, quotes and entries. Same guard as tasks.js and food.js:
// crypto.randomUUID is missing on plain http and in older browsers.
const newId = () => globalThis.crypto?.randomUUID?.() || String(Date.now() + Math.random())

// Lockout policy.
const MAX_PIN_FAILS = 5
const PIN_LOCK_MS = 60 * 60 * 1000 // 1 hour

// --- persistence ------------------------------------------------------------

// Returns { state, rescue }. `rescue` is null for healthy data (loaded exactly
// as before), or says what happened to a save the app couldn't use as it was:
//   kept      it couldn't be read; a copy is kept and the app starts fresh
//   refused   it (or a part that had to be set aside) couldn't be read, and
//             storage wouldn't keep a copy, so nothing is saved until the
//             person taps Start fresh
//   repaired  it was repaired by the rules in lib/repair.js; `copy` is the
//             key of the original, or null when storage wouldn't keep one
//             and nothing had to be set aside
// The copy is written and read back here, before the first save can write
// over the original.
function loadState() {
  let raw
  try {
    raw = localStorage.getItem(STORAGE_KEY)
  } catch {
    return { state: freshState(), rescue: null }
  }
  if (!raw) return { state: freshState(), rescue: null }

  let report = null
  let state = null
  try {
    report = repair(JSON.parse(raw))
    state = migrate(report.state)
  } catch (err) {
    console.warn('Saved data could not be read:', err)
  }

  if (state && !report.fixes.length && !report.setAside.length) return { state, rescue: null }
  // Blocked storage: nothing can be kept or saved, and the banner says so.
  if (!storageAvailable) return { state: state || freshState(), rescue: null }

  const copy = keepRescueCopy(raw)
  if (!state) {
    return { state: freshState(), rescue: { kind: copy ? 'kept' : 'refused', copy } }
  }
  if (!copy && report.setAside.length) {
    return { state: freshState(), rescue: { kind: 'refused', copy: null } }
  }
  return { state, rescue: { kind: 'repaired', copy, fixes: report.fixes, setAside: report.setAside } }
}

// Returns the JSON it wrote, or null when the save failed (storage full,
// blocked, or gone).
function saveState(state) {
  try {
    const raw = JSON.stringify(state)
    localStorage.setItem(STORAGE_KEY, raw)
    return raw
  } catch (err) {
    console.error('Failed to save state:', err)
    return null
  }
}

// --- context ----------------------------------------------------------------

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [boot] = useState(loadState)
  const [state, setState] = useState(boot.state)
  // What happened to a save that couldn't be used as it was (see loadState).
  // Not saved itself. While it's 'refused', nothing is written to storage.
  const [rescue, setRescue] = useState(boot.rescue)
  const refused = useRef(boot.rescue?.kind === 'refused')
  // True while the last save failed. Not saved itself; the next change tries
  // again and clears it once a save works.
  const [saveFailed, setSaveFailed] = useState(false)
  // The last JSON this tab wrote or took from another tab, and the state it
  // took, so a state that is already saved is never written back.
  const lastRaw = useRef(null)
  const adopted = useRef(null)

  // Persist on every change.
  useEffect(() => {
    if (refused.current || state === adopted.current) return
    const raw = saveState(state)
    if (raw !== null) lastRaw.current = raw
    setSaveFailed(raw === null)
  }, [state])

  // Another tab of the app saved: take its state so this tab doesn't write an
  // older copy over it on its next change. A cleared or unreadable value is
  // ignored, and this tab's next change saves as usual.
  useEffect(() => {
    const onStorage = (e) => {
      if (refused.current) return
      if (e.key !== STORAGE_KEY || e.newValue == null || e.newValue === lastRaw.current) return
      let next
      try {
        next = migrate(JSON.parse(e.newValue))
      } catch {
        return
      }
      lastRaw.current = e.newValue
      adopted.current = next
      setState(next)
      setSaveFailed(false)
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // The current logical day-key, refreshed periodically so the app rolls over
  // to a new day without a manual reload.
  const [today, setToday] = useState(() => todayKey(state.settings.dayRolloverHour))
  const rolloverHour = state.settings.dayRolloverHour
  useEffect(() => {
    const tick = () => setToday(todayKey(rolloverHour))
    tick()
    const id = setInterval(tick, 60 * 1000)
    const onVisible = () => document.visibilityState === 'visible' && tick()
    document.addEventListener('visibilitychange', onVisible)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVisible) }
  }, [rolloverHour])

  // Ref to read latest state inside stable action callbacks.
  const stateRef = useRef(state)
  stateRef.current = state

  const actions = useMemo(() => makeActions(setState, stateRef), [])

  const rescueActions = useMemo(() => ({
    // The saved data and every rescue copy, read from storage, as a file.
    exportSaved: () => savedDataExport(STORAGE_KEY),
    // Reset and import replace everything, so a report about the old save
    // (and the copies Reset removes) no longer holds.
    resetAll: () => {
      actions.resetAll()
      setRescue(null)
    },
    importJSON: (json) => {
      actions.importJSON(json)
      setRescue(null)
    },
    dismissRescue: () => setRescue(null),
    // Erase what couldn't be read and start saving again, from a fresh state.
    startFresh: () => {
      refused.current = false
      setRescue(null)
      setState(freshState())
    },
  }), [actions])

  // On load and at every 3am rollover, sweep finished tasks into the archive and
  // purge anything archived over 90 days ago. Idempotent, so it no-ops when
  // there's nothing to move.
  useEffect(() => { actions.reconcileTasks(today) }, [today, actions])

  const value = useMemo(
    () => ({ state, today, saveFailed, rescue, ...actions, ...rescueActions }),
    [state, today, saveFailed, rescue, actions, rescueActions],
  )
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within <StoreProvider>')
  return ctx
}

// --- actions ----------------------------------------------------------------

function makeActions(setState, stateRef) {
  // Helper: immutably set one habit's log entry for a day, adjusting `votes`.
  function writeLog(prev, dayKey, habitId, nextEntry) {
    const wasDone = isDone(prev.logs[dayKey]?.[habitId]?.status)
    const nowDone = isDone(nextEntry?.status)
    const dayLog = { ...(prev.logs[dayKey] || {}) }
    if (nextEntry == null) delete dayLog[habitId]
    else dayLog[habitId] = nextEntry
    const logs = { ...prev.logs, [dayKey]: dayLog }
    // votes only ever grow: +1 on a fresh completion, never subtracted.
    const votes = !wasDone && nowDone ? prev.votes + 1 : prev.votes
    return { ...prev, logs, votes }
  }

  /**
   * Parse, check and migrate a backup without touching anything. Throws a
   * BackupError for a file that isn't one of ours.
   */
  function readBackup(json) {
    const parsed = parseBackup(json)
    try {
      return migrate(parsed)
    } catch {
      throw new BackupError('not-backup', 'backup could not be read')
    }
  }

  return {
    /**
     * Cycle a standard habit: pending → full ✓ → min ◐ → pending.
     * `direct` optionally forces a target status (used by long-press = min).
     */
    toggleHabit(dayKey, habitId, direct) {
      setState((prev) => {
        const cur = prev.logs[dayKey]?.[habitId]?.status || null
        let next
        if (direct) {
          next = cur === direct ? null : direct
        } else {
          next = cur === null ? 'full' : cur === 'full' ? 'min' : null
        }
        const entry = next ? { status: next, at: Date.now() } : null
        return writeLog(prev, dayKey, habitId, entry)
      })
    },

    setHabitStatus(dayKey, habitId, status) {
      setState((prev) => writeLog(prev, dayKey, habitId,
        status ? { status, at: Date.now() } : null))
    },

    /** Set one prayer's state: 'ontime' | 'late' | null (cycles on repeat tap). */
    cycleSalah(dayKey, prayer) {
      setState((prev) => {
        const cur = { ...(prev.logs[dayKey]?.['salah'] || {}) }
        const order = { null: 'ontime', ontime: 'late', late: null }
        const nextVal = order[cur[prayer] ?? 'null']
        const beforeDone = salahSummary(prev.logs[dayKey]?.['salah']).done
        if (nextVal) cur[prayer] = nextVal
        else delete cur[prayer]
        const afterDone = salahSummary(cur).done
        const dayLog = { ...(prev.logs[dayKey] || {}), salah: cur }
        const logs = { ...prev.logs, [dayKey]: dayLog }
        const votes = !beforeDone && afterDone ? prev.votes + 1 : prev.votes
        return { ...prev, logs, votes }
      })
    },

    setSalah(dayKey, prayer, value) {
      setState((prev) => {
        const cur = { ...(prev.logs[dayKey]?.['salah'] || {}) }
        const beforeDone = salahSummary(cur).done
        if (value) cur[prayer] = value
        else delete cur[prayer]
        const afterDone = salahSummary(cur).done
        const dayLog = { ...(prev.logs[dayKey] || {}), salah: cur }
        const logs = { ...prev.logs, [dayKey]: dayLog }
        const votes = !beforeDone && afterDone ? prev.votes + 1 : prev.votes
        return { ...prev, logs, votes }
      })
    },

    /** Mark today a "Rough day" (Minimum Viable Day). */
    setRoughDay(dayKey, on = true) {
      setState((prev) => ({
        ...prev,
        days: { ...prev.days, [dayKey]: { ...(prev.days[dayKey] || {}), roughDay: on } },
      }))
    },

    /** Merge fields into a day record (gratitude, journal, tomorrow tasks…). */
    updateDay(dayKey, patch) {
      setState((prev) => ({
        ...prev,
        days: { ...prev.days, [dayKey]: { ...(prev.days[dayKey] || {}), ...patch } },
      }))
    },

    // -- settings & phases --
    unlockNextPhase() {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, currentPhase: Math.min(5, prev.settings.currentPhase + 1) },
      }))
    },
    setPhase(phase) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, currentPhase: phase } }))
    },
    dismissUnlock(phase) {
      setState((prev) => ({
        ...prev,
        settings: {
          ...prev.settings,
          dismissedUnlock: { ...prev.settings.dismissedUnlock, [phase]: true },
        },
      }))
    },
    updateSettings(patch) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, ...patch } }))
    },
    /** Set the per-device prayer location ({mode,label,address?,lat?,lng?} or null). */
    setPrayerLocation(loc) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, prayerLocation: loc } }))
    },
    /** Set the theme choice ('system' | theme id). */
    setTheme(theme) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, theme } }))
    },
    /** Set the UI language ('en' | 'ar' | …). */
    setLanguage(language) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, language } }))
    },

    // -- habit CRUD --
    upsertHabit(habit) {
      setState((prev) => {
        const idx = prev.habits.findIndex((h) => h.id === habit.id)
        const habits = [...prev.habits]
        if (idx >= 0) habits[idx] = { ...habits[idx], ...habit }
        else habits.push({ archived: false, createdAt: new Date().toISOString(), ...habit })
        return { ...prev, habits }
      })
    },
    archiveHabit(id, archived = true) {
      setState((prev) => ({
        ...prev,
        habits: prev.habits.map((h) => (h.id === id ? { ...h, archived } : h)),
      }))
    },

    // -- onboarding (first run only) --
    // Keep the Phase 1 habits whose ids are in `activeIds`, archive the rest,
    // and mark the device onboarded so the welcome flow never shows again. If the
    // user picked a non-English language, name the seed habits in that language
    // now (a new Arabic user shouldn't get English habit names). Existing devices
    // never run this, so their names are untouched.
    finishOnboarding(activeIds, opts = {}) {
      setState((prev) => {
        // Seed habits are already `stock: true`, so their names render in the
        // chosen language (and follow a later switch) — no literal renaming here.
        // Faith habits (Salah, the fast) are governed by the includeIslamic
        // setting, never archived, so the choice stays reversible. Other Phase 1
        // habits archive based on what the user kept in the picker.
        const habits = prev.habits.map((h) =>
          (h.phase === 1 && !isFaithHabit(h))
            ? { ...h, archived: !activeIds.includes(h.id) }
            : h)
        const includeIslamic = opts.includeIslamic ?? prev.settings.includeIslamic ?? true
        return { ...prev, habits, settings: { ...prev.settings, onboarded: true, includeIslamic } }
      })
    },

    // -- wins (proud moments, surfaced on rough days) --
    addWin(text) {
      const t = text.trim()
      if (!t) return
      setState((prev) => ({
        ...prev,
        wins: [{ id: newId(), at: Date.now(), text: t }, ...prev.wins],
      }))
    },
    removeWin(id) {
      setState((prev) => ({ ...prev, wins: prev.wins.filter((w) => w.id !== id) }))
    },

    // -- tasks (one-off to-dos; separate from habits, no streak/score weight) --
    // Returns the created task so callers can offer an undo.
    addTask({ text, dueDay, source = 'manual' }) {
      const clean = String(text || '').trim()
      if (!clean) return null
      const s = stateRef.current
      const task = makeTask({
        text: clean, dueDay, source,
        createdDay: todayKey(s.settings.dayRolloverHour),
      })
      setState((prev) => ({ ...prev, tasks: [...(prev.tasks || []), task] }))
      return task
    },
    /**
     * Complete / un-complete a task for `dayKey`. Same toggle-both-ways feel as
     * habits. A fresh completion ticks `votes` up by one — the one place tasks
     * touch the shared counter — and votes never come back down on un-complete.
     */
    toggleTask(id, dayKey) {
      setState((prev) => {
        const { tasks, becameDone } = toggleTaskDone(prev.tasks || [], id, dayKey)
        return { ...prev, tasks, votes: becameDone ? prev.votes + 1 : prev.votes }
      })
    },
    /**
     * Edit a task's text and/or due day. Never changes its id, source, or
     * completion state. Changing the due day is also how a task moves between
     * Today and Upcoming (the lists are derived from dueDay). An empty text is
     * treated as a cancel by the caller, so we don't blank a task here.
     */
    updateTask(id, patch) {
      setState((prev) => ({ ...prev, tasks: updateTaskFields(prev.tasks, id, patch) }))
    },

    // Delete moves the task into the archive (reason: deleted) instead of erasing
    // it — the undo toast is still the instant path. Never touches `votes`: votes
    // (once earned) only ever grow, so removing a done task doesn't claw one back.
    deleteTask(id) {
      setState((prev) => {
        const now = Date.now()
        const { tasks, archive } = archiveTaskById(prev.tasks, prev.taskArchive, id, {
          reason: 'deleted', archivedAt: now, archivedDay: todayKey(prev.settings.dayRolloverHour),
        })
        return { ...prev, tasks, taskArchive: archive }
      })
    },
    // Undo a delete: pull the task back out of the archive and re-insert it
    // exactly as it was (its original due day, open/done state, everything).
    restoreTask(task) {
      if (!task) return
      setState((prev) => ({
        ...prev,
        tasks: insertTask(prev.tasks, task),
        taskArchive: deleteArchivedById(prev.taskArchive, task.id),
      }))
    },
    // "Bring back" from the Archive screen: revive the entry as a fresh OPEN task
    // due today (not the exact-restore that undo does). Never re-counts a vote.
    reviveArchivedTask(id) {
      setState((prev) => {
        const { archive, task } = reviveArchived(prev.taskArchive, id, todayKey(prev.settings.dayRolloverHour))
        if (!task) return prev
        return { ...prev, tasks: insertTask(prev.tasks, task), taskArchive: archive }
      })
    },
    /** "Delete forever" — drop an archive entry permanently. */
    deleteArchivedTask(id) {
      setState((prev) => ({ ...prev, taskArchive: deleteArchivedById(prev.taskArchive, id) }))
    },
    // Undo a "Delete forever": put the exact archive entry back. Its archivedAt
    // is preserved, so it sorts straight back to where it was in the list.
    restoreArchivedEntry(entry) {
      if (!entry) return
      setState((prev) => ({
        ...prev,
        taskArchive: [entry, ...deleteArchivedById(prev.taskArchive, entry.id)],
      }))
    },
    /**
     * Roll the archive forward: sweep finished tasks whose day has passed into
     * the archive, and drop anything archived over 90 days ago. Idempotent — a
     * no-op returns `prev` untouched, so it's safe to run on every day-change.
     */
    reconcileTasks(dayKey, now = Date.now()) {
      setState((prev) => {
        const swept = sweepArchivable(prev.tasks || [], prev.taskArchive || [], dayKey, now)
        const purged = purgeArchive(swept.archive, now)
        if (swept.tasks === (prev.tasks || []) && purged === (prev.taskArchive || [])) return prev
        return { ...prev, tasks: swept.tasks, taskArchive: purged }
      })
    },
    /**
     * Reconcile the evening-shutdown plan into real tasks for `dueDay`: drop the
     * previously-planned (still-open) shutdown tasks for that day and recreate
     * from `texts`, so re-running shutdown is idempotent and never duplicates.
     * Already-completed shutdown tasks are left alone.
     */
    syncShutdownTasks(dueDay, texts) {
      setState((prev) => ({
        ...prev,
        tasks: planShutdownTasks(prev.tasks, dueDay, texts, {
          createdDay: todayKey(prev.settings.dayRolloverHour),
        }),
      }))
    },
    // -- food log (awareness only; never touches score/streaks/votes) --
    // `targetDay` optionally logs to yesterday (evening default); resolveEntryTime
    // seals off anything older. Returns the created entry so the caller can undo.
    addFood(text, targetDay) {
      const clean = String(text || '').trim()
      if (!clean) return null
      const s = stateRef.current
      const rolloverHour = s.settings.dayRolloverHour
      const today = todayKey(rolloverHour)
      const { at } = resolveEntryTime(targetDay ?? today, { today })
      const entry = makeFoodEntry({ text: clean, at, rolloverHour })
      setState((prev) => ({ ...prev, food: [...(prev.food || []), entry] }))
      return entry
    },
    /** Edit an entry's text only — id, timestamp, and day are preserved. */
    updateFood(id, text) {
      setState((prev) => ({ ...prev, food: updateFoodText(prev.food, id, text) }))
    },
    /** Backdate an entry within its day by setting its "HH:MM". */
    setFoodTime(id, hhmm) {
      setState((prev) => ({ ...prev, food: setFoodEntryTime(prev.food, id, hhmm) }))
    },
    deleteFood(id) {
      setState((prev) => ({ ...prev, food: deleteFoodById(prev.food, id) }))
    },
    /** Re-insert a food entry exactly as it was (used to undo a delete). */
    restoreFood(entry) {
      if (!entry) return
      setState((prev) => ({ ...prev, food: insertFood(prev.food, entry) }))
    },
    /** Remember whether the Today Tasks / Food sections are collapsed (per device). */
    setTasksCollapsed(collapsed) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, tasksCollapsed: collapsed } }))
    },
    setFoodCollapsed(collapsed) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, foodCollapsed: collapsed } }))
    },
    /** Mark the first-run tour as seen (or reset it to replay). */
    setTourSeen(seen) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, tourSeen: seen } }))
    },

    // -- my quotes (added to the Daily anchor's curated pool) --
    addMyQuote(text) {
      const t = String(text || '').trim()
      if (!t) return
      setState((prev) => ({
        ...prev,
        myQuotes: [{ id: newId(), at: Date.now(), text: t }, ...(prev.myQuotes || [])],
      }))
    },
    removeMyQuote(id) {
      setState((prev) => ({ ...prev, myQuotes: (prev.myQuotes || []).filter((q) => q.id !== id) }))
    },

    // record that a JSON backup was taken (for the "last export" line + nudge)
    markExported() {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, lastExportAt: Date.now() },
      }))
    },

    addPrivateEntry(entry) {
      setState((prev) => ({
        ...prev,
        privateLog: {
          ...prev.privateLog,
          entries: [{ id: newId(), at: Date.now(), ...entry }, ...prev.privateLog.entries],
        },
      }))
    },
    addWaveSurvived(meta = {}) {
      setState((prev) => ({
        ...prev,
        privateLog: {
          ...prev.privateLog,
          waves: [{ id: newId(), at: Date.now(), ...meta }, ...prev.privateLog.waves],
        },
      }))
    },
    /** Set the hash and per-device salt. Clears lockout. */
    setOwnerPin(pinHash, pinSalt) {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, pinHash, pinSalt, pinFails: 0, pinLockUntil: 0 },
      }))
    },
    /**
     * Record a wrong attempt. After MAX_PIN_FAILS in a row, lock for
     * PIN_LOCK_MS. The count/lock live in persisted settings so reloading the app
     * can't reset the strike count or skip the lockout.
     */
    registerPinFailure() {
      setState((prev) => {
        const fails = (prev.settings.pinFails || 0) + 1
        const locked = fails >= MAX_PIN_FAILS
        return {
          ...prev,
          settings: {
            ...prev.settings,
            pinFails: locked ? 0 : fails,
            pinLockUntil: locked ? Date.now() + PIN_LOCK_MS : (prev.settings.pinLockUntil || 0),
          },
        }
      })
    },
    /** Reset strikes + lockout (called on a successful unlock). */
    clearPinFailures() {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, pinFails: 0, pinLockUntil: 0 },
      }))
    },

    // -- weekly review --
    saveWeeklyReview(weekKey, review) {
      setState((prev) => ({
        ...prev,
        weeklyReviews: { ...prev.weeklyReviews, [weekKey]: review },
        focusThisWeek: review.focus ? { text: review.focus, weekKey } : prev.focusThisWeek,
      }))
    },

    // -- backup --
    // Export wraps the state in a versioned envelope; import unwraps any
    // envelope (or a legacy bare-state export) and then runs the data-model
    // migration, so old backups keep restoring cleanly.
    exportJSON() {
      return serializeBackup(stateRef.current)
    },
    readBackup,
    /** Replace everything with a backup. A bad file throws here, before any change. */
    importJSON(json) {
      const next = readBackup(json)
      setState(() => next)
    },
    resetAll() {
      // The prayer cache lives under its own key and holds the place, so it
      // goes too, and so does every rescue copy. Done here, not inside the
      // state update.
      clearPrayerCache()
      clearRescueCopies()
      setState(() => freshState())
    },
  }
}
