// ---------------------------------------------------------------------------
// migrate.js — forward-migrate a saved state into the current shape.
//
// The whole app is one localStorage object. As new features ship (new seed
// habits, tasks, food, …) older saves need their missing pieces filled in
// without ever losing what the user already has. `migrate()` is pure and
// idempotent: give it any past state and it returns a complete current one.
//
// Kept out of store.jsx (and free of React) so the migration guarantees can be
// unit-tested directly.
// ---------------------------------------------------------------------------

import { freshState, SEED_HABITS, FISHERS_LOCATION } from './seed.js'

/** Merge any newly-shipped seed habits / settings into an older saved state. */
export function migrate(state) {
  const base = freshState()
  const merged = { ...base, ...state }
  merged.settings = { ...base.settings, ...(state.settings || {}) }
  // Any state we're migrating already belongs to a real user — never show them
  // onboarding. Only a truly fresh install (which skips migrate) starts false.
  merged.settings.onboarded = state.settings?.onboarded ?? true
  // A PIN from the old static-salt scheme has no per-device salt and can't be
  // verified anymore. Clear it (private-log entries are kept) so the owner is
  // re-prompted to set a fresh PIN instead of being locked out with no reset.
  if (merged.settings.pinHash && !merged.settings.pinSalt) {
    merged.settings.pinHash = null
    merged.settings.pinFails = 0
    merged.settings.pinLockUntil = 0
  }
  // Prayer location is per-device now. A save from before this feature has no
  // `prayerLocation` key at all → keep those users on Fishers so nothing changes
  // under them. A key that's present (even explicit null from a new user who
  // skipped onboarding) is respected as-is.
  merged.settings.prayerLocation = ('prayerLocation' in (state.settings || {}))
    ? state.settings.prayerLocation
    : FISHERS_LOCATION
  // Theme choice is per-device and rides along in the backup. Default to System.
  merged.settings.theme = state.settings?.theme || 'system'
  // Tasks/Food collapse is remembered per device. New installs (freshState)
  // start collapsed for a calm screen. But anyone with a saved state is an
  // existing daily user, so the first time we see them we open both sections —
  // once — then respect whatever they toggle afterwards.
  if (state.settings?.collapseDefaultsApplied) {
    merged.settings.tasksCollapsed = state.settings.tasksCollapsed ?? true
    merged.settings.foodCollapsed = state.settings.foodCollapsed ?? true
    merged.settings.collapseDefaultsApplied = true
  } else {
    merged.settings.tasksCollapsed = false
    merged.settings.foodCollapsed = false
    merged.settings.collapseDefaultsApplied = true
  }
  // The first-run tour only shows on a truly fresh install — anyone with a saved
  // state has used the app already, so mark them as having seen it.
  merged.settings.tourSeen = state.settings?.tourSeen ?? true
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
  merged.wins = Array.isArray(state.wins) ? state.wins : []
  merged.tasks = Array.isArray(state.tasks) ? state.tasks : []
  merged.myQuotes = Array.isArray(state.myQuotes) ? state.myQuotes : []
  merged.food = Array.isArray(state.food) ? state.food : []
  merged.version = base.version
  return merged
}
