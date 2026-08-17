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
import { makeTask, toggleTaskDone, deleteTaskById, insertTask, planShutdownTasks, updateTaskFields } from './lib/tasks.js'
import { makeFoodEntry, resolveEntryTime, updateFoodText, setFoodEntryTime, deleteFoodById, insertFood } from './lib/food.js'

const STORAGE_KEY = 'the-rebuild:v1'

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

// Private-log lockout policy.
const MAX_PIN_FAILS = 5
const PIN_LOCK_MS = 60 * 60 * 1000 // 1 hour

// --- persistence ------------------------------------------------------------

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return freshState()
    const parsed = JSON.parse(raw)
    return migrate(parsed)
  } catch (err) {
    console.warn('Failed to load state, starting fresh:', err)
    return freshState()
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (err) {
    console.error('Failed to save state:', err)
  }
}

// --- context ----------------------------------------------------------------

const StoreContext = createContext(null)

export function StoreProvider({ children }) {
  const [state, setState] = useState(loadState)

  // Persist on every change.
  useEffect(() => { saveState(state) }, [state])

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

  const value = useMemo(() => ({ state, today, ...actions }), [state, today, actions])
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
        wins: [{ id: crypto.randomUUID(), at: Date.now(), text: t }, ...prev.wins],
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

    // Delete never touches `votes` — undo is the only safety net, and votes
    // (once earned) only ever grow, so removing a done task doesn't claw one back.
    deleteTask(id) {
      setState((prev) => ({ ...prev, tasks: deleteTaskById(prev.tasks, id) }))
    },
    /** Re-insert a task object exactly as it was (used to undo a delete). */
    restoreTask(task) {
      if (!task) return
      setState((prev) => ({ ...prev, tasks: insertTask(prev.tasks, task) }))
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
        myQuotes: [{ id: crypto.randomUUID(), at: Date.now(), text: t }, ...(prev.myQuotes || [])],
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

    // -- private log --
    addPrivateEntry(entry) {
      setState((prev) => ({
        ...prev,
        privateLog: {
          ...prev.privateLog,
          entries: [{ id: crypto.randomUUID(), at: Date.now(), ...entry }, ...prev.privateLog.entries],
        },
      }))
    },
    addWaveSurvived(meta = {}) {
      setState((prev) => ({
        ...prev,
        privateLog: {
          ...prev.privateLog,
          waves: [{ id: crypto.randomUUID(), at: Date.now(), ...meta }, ...prev.privateLog.waves],
        },
      }))
    },
    /** Set the one-and-only owner PIN (hash + per-device salt). Clears lockout. */
    setOwnerPin(pinHash, pinSalt) {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, pinHash, pinSalt, pinFails: 0, pinLockUntil: 0 },
      }))
    },
    /**
     * Record a wrong PIN attempt. After MAX_PIN_FAILS in a row, lock the tab for
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
    exportJSON() {
      return JSON.stringify(stateRef.current, null, 2)
    },
    importJSON(json) {
      const parsed = typeof json === 'string' ? JSON.parse(json) : json
      setState(() => migrate(parsed))
    },
    resetAll() {
      setState(() => freshState())
    },
  }
}
