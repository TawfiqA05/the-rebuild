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
import { freshState, SEED_HABITS } from './lib/seed.js'
import { todayKey } from './lib/time.js'
import { habitStatusOn, isDone, salahSummary } from './lib/logic.js'

const STORAGE_KEY = 'the-rebuild:v1'

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

/** Merge any newly-shipped seed habits / settings into an older saved state. */
function migrate(state) {
  const base = freshState()
  const merged = { ...base, ...state }
  merged.settings = { ...base.settings, ...(state.settings || {}) }
  // Add habits that exist in seed but not yet in the saved state (new phases,
  // etc.) without clobbering the user's edits to existing ones.
  const existingIds = new Set((state.habits || []).map((h) => h.id))
  const addl = SEED_HABITS
    .filter((h) => !existingIds.has(h.id))
    .map((h) => ({ ...h, archived: false, createdAt: new Date().toISOString() }))
  merged.habits = [...(state.habits || []), ...addl]
  merged.logs = state.logs || {}
  merged.days = state.days || {}
  merged.privateLog = state.privateLog || { entries: [], waves: [] }
  merged.votes = typeof state.votes === 'number' ? state.votes : 0
  return merged
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
    setPinHash(pinHash) {
      setState((prev) => ({ ...prev, settings: { ...prev.settings, pinHash } }))
    },
    /** Clear the PIN and wipe the private log (used by "Reset PIN"). */
    resetPrivateLog() {
      setState((prev) => ({
        ...prev,
        settings: { ...prev.settings, pinHash: null },
        privateLog: { entries: [], waves: [] },
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
