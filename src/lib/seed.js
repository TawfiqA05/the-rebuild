// ---------------------------------------------------------------------------
// seed.js — the discipline system, encoded as data.
//
// All 5 phases and their habits ship pre-loaded. The user starts in Phase 1
// with only Phase 1 habits active; later phases unlock in order (manually, or
// when the app suggests it at >=80% trailing-21-day completion).
//
// Every habit carries a `minVersion` — the "2-minute version" that still counts
// as a completion. Shrink it, don't skip it.
//
// frequency shapes:
//   { kind: 'daily' }
//   { kind: 'perWeek', count: N }        -> shows week progress, e.g. 2/3
//   { kind: 'weekdays', days: [0..6] }   -> 0 = Sunday … 6 = Saturday
// ---------------------------------------------------------------------------

export const PHASES = [
  { n: 1, name: 'Anchors', blurb: 'The load-bearing walls. Nail these before anything else.' },
  { n: 2, name: 'Mind & Structure', blurb: 'Give your days a shape and your mind a plan.' },
  { n: 3, name: 'Body & Focus', blurb: 'Protect your attention and move your body.' },
  { n: 4, name: 'Money & Admin', blurb: 'Boring on purpose. Systems for the stuff you avoid.' },
  { n: 5, name: 'Character', blurb: 'Who you are when no one is watching.' },
]

export function phaseMeta(n) {
  return PHASES.find((p) => p.n === n) || PHASES[0]
}

// Anchor keys drive the score-bar emojis on the Today screen.
const daily = { kind: 'daily' }

export const SEED_HABITS = [
  // ---- Phase 1 · Anchors -------------------------------------------------
  {
    id: 'salah', name: 'Salah on time', emoji: '🕌', phase: 1, type: 'salah',
    frequency: daily, minVersion: 'Pray it — even late still counts as prayed',
    isAnchor: true, anchorKey: 'salah',
  },
  {
    id: 'sleep', name: 'Consistent sleep / wake', emoji: '😴', phase: 1, type: 'standard',
    frequency: daily, minVersion: 'In bed by target, lights off',
    isAnchor: true, anchorKey: 'sleep',
  },
  {
    id: 'gym', name: 'Gym', emoji: '🏋️', phase: 1, type: 'standard',
    frequency: { kind: 'perWeek', count: 3 }, minVersion: 'Drive there, 15 minutes',
    isAnchor: true, anchorKey: 'gym',
  },
  {
    id: 'bed', name: 'Make the bed', emoji: '🛏️', phase: 1, type: 'standard',
    frequency: daily, minVersion: 'Pull the covers straight',
    isAnchor: true, anchorKey: 'bed',
  },
  {
    id: 'phone-kitchen', name: 'Phone to kitchen by 10:30pm', emoji: '📵', phase: 1, type: 'standard',
    frequency: daily, minVersion: 'Plug it in outside the bedroom',
  },
  {
    id: 'clean-feed', name: 'Clean feed', emoji: '🧹', phase: 1, type: 'standard',
    frequency: daily, minVersion: 'Close the app, put the phone down',
  },

  // ---- Phase 2 · Mind & Structure ---------------------------------------
  {
    id: 'plan-tomorrow', name: 'Plan tomorrow tonight', emoji: '🗓️', phase: 2, type: 'standard',
    frequency: daily, minVersion: 'Write down tomorrow’s top 1 task',
  },
  {
    id: 'weekly-plan', name: 'Sunday weekly plan', emoji: '📋', phase: 2, type: 'standard',
    frequency: { kind: 'weekdays', days: [0] }, minVersion: 'List 3 priorities for the week',
  },
  {
    id: 'read', name: 'Read 10 pages', emoji: '📖', phase: 2, type: 'standard',
    frequency: daily, minVersion: 'Open the book, read 1 page',
  },
  {
    id: 'quran', name: 'Quran daily', emoji: '📗', phase: 2, type: 'standard',
    frequency: daily, minVersion: 'One ayah',
  },
  {
    id: 'no-snooze', name: 'No snooze', emoji: '⏰', phase: 2, type: 'standard',
    frequency: daily, minVersion: 'Feet on the floor within 1 minute',
  },

  // ---- Phase 3 · Body & Focus -------------------------------------------
  {
    id: 'no-phone-am', name: 'No phone first 30 min', emoji: '🌅', phase: 3, type: 'standard',
    frequency: daily, minVersion: 'No phone for the first 5 minutes',
  },
  {
    id: 'no-phone-bed', name: 'No phone in bed', emoji: '🔌', phase: 3, type: 'standard',
    frequency: daily, minVersion: 'Phone charges across the room',
  },
  {
    id: 'deep-work', name: 'Deep work block', emoji: '🎯', phase: 3, type: 'standard',
    frequency: daily, minVersion: '10 focused minutes, one tab',
  },
  {
    id: 'water', name: 'Water goal', emoji: '💧', phase: 3, type: 'standard',
    frequency: daily, minVersion: 'One full glass right now',
  },
  {
    id: 'protein', name: 'Protein', emoji: '🍗', phase: 3, type: 'standard',
    frequency: daily, minVersion: 'One protein serving',
  },
  {
    id: 'walk', name: 'Walk on rest days', emoji: '🚶', phase: 3, type: 'standard',
    frequency: { kind: 'perWeek', count: 3 }, minVersion: 'A 5-minute walk around the block',
  },
  {
    id: 'tidy', name: '10-minute tidy', emoji: '🧹', phase: 3, type: 'standard',
    frequency: daily, minVersion: 'Tidy one surface',
  },

  // ---- Phase 4 · Money & Admin ------------------------------------------
  {
    id: 'expenses', name: 'Expense tracking', emoji: '💳', phase: 4, type: 'standard',
    frequency: daily, minVersion: 'Log one expense',
  },
  {
    id: 'meal-prep', name: 'Meal prep Sunday', emoji: '🍱', phase: 4, type: 'standard',
    frequency: { kind: 'weekdays', days: [0] }, minVersion: 'Prep one meal for the week',
  },
  {
    id: 'chore-days', name: 'Set chore days', emoji: '🧺', phase: 4, type: 'standard',
    frequency: { kind: 'weekdays', days: [0] }, minVersion: 'Pick this week’s chore day',
  },
  {
    id: 'impulse-48h', name: '48h impulse rule', emoji: '🛒', phase: 4, type: 'standard',
    frequency: daily, minVersion: 'Add wants to a list, let them wait 48h',
  },

  // ---- Phase 5 · Character ----------------------------------------------
  {
    id: 'adhkar', name: 'Adhkar AM/PM', emoji: '📿', phase: 5, type: 'standard',
    frequency: daily, minVersion: 'One line of adhkar',
  },
  {
    id: 'gratitude', name: 'Gratitude ×3', emoji: '🙏', phase: 5, type: 'standard',
    frequency: daily, minVersion: 'Name one thing you’re grateful for',
  },
  {
    id: 'journal', name: '3-line journal', emoji: '✍️', phase: 5, type: 'standard',
    frequency: daily, minVersion: 'One line',
  },
  {
    id: 'friend-checkin', name: 'Weekly friend check-in', emoji: '💬', phase: 5, type: 'standard',
    frequency: { kind: 'perWeek', count: 1 }, minVersion: 'Send one text',
  },
  {
    id: 'fasting', name: 'Mon/Thu fasting', emoji: '🌙', phase: 5, type: 'standard',
    frequency: { kind: 'weekdays', days: [1, 4] }, minVersion: 'Intend it, skip one snack',
    optional: true,
  },
]

// Rotating supportive prompts for the 20-minute urge timer.
export const URGE_PROMPTS = [
  'Urges peak and pass. This one will too.',
  'Breathe. In for 4, hold for 4, out for 6.',
  '20 pushups. Right now. Move the energy.',
  'Make wudu. Reset the moment.',
  'Open the editor. Write one line instead.',
  'You are not the urge. You are the one watching it.',
  'Drink a full glass of water. Slowly.',
  'Step outside. Even for 60 seconds.',
  'The wave is cresting. Ride it — don’t fight it.',
  'Every minute you wait, it gets weaker.',
]

// The prayer location existing devices keep, so nothing changes for them.
// New installs start with `null` and are asked during onboarding.
export const FISHERS_LOCATION = {
  mode: 'address', label: 'Fishers, Indiana', address: 'Fishers, Indiana, USA', lat: null, lng: null,
}

// Default fresh-install state.
export function freshState() {
  const now = new Date().toISOString()
  return {
    version: 2,
    settings: {
      dayRolloverHour: 3,        // day rolls over at 3am
      currentPhase: 1,           // highest unlocked phase
      theme: 'system',           // 'system' | theme id (see lib/themes.js)
      // Per-device prayer location. null on a fresh install → onboarding asks,
      // and the Salah card prompts until it's set.
      prayerLocation: null,
      foodCollapsed: false,      // Food card collapsed? remembered per-day…
      foodCollapsedDay: null,    // …but only for this day; a new day reopens it
      // Single-owner private-log PIN. Salt is random per-device (never in code);
      // there's no reset except wiping all data. Fails/lock enforce a 1-hour
      // lockout after 5 wrong attempts, persisted so a reload can't bypass it.
      pinHash: null,
      pinSalt: null,
      pinFails: 0,
      pinLockUntil: 0,
      dismissedUnlock: {},       // { phaseN: true } — user dismissed the suggestion
      prayerAdjustMin: {},       // manual per-prayer minute offsets
      lastExportAt: null,        // timestamp of the last JSON backup
      onboarded: false,          // fresh installs see the welcome flow; existing data never does
    },
    habits: SEED_HABITS.map((h) => ({ ...h, archived: false, createdAt: now })),
    // logs[dayKey][habitId] = { status: 'full'|'min', at } | salah shape
    logs: {},
    // days[dayKey] = { roughDay, gratitude:[], journal:{}, tomorrow:[], shutdownAt }
    days: {},
    weeklyReviews: {},           // weeklyReviews[weekKey] = { focus, checklist, done }
    focusThisWeek: null,         // { text, weekKey }
    privateLog: { entries: [], waves: [] },
    votes: 0,                    // lifetime completions — only ever goes up
    wins: [],                    // proud moments, shown back on rough days
    tasks: [],                   // one-off to-dos — separate from habits, no streaks
    myQuotes: [],                // my own lines, merged into the Daily anchor pool
    food: [],                    // plain food log — awareness only, no scoring
  }
}
