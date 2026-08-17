// ---------------------------------------------------------------------------
// faith.js — the single registry of every Islamic-practice surface in the app.
//
// The "Include Islamic practices?" toggle reads ONLY from here. Nothing is
// gated by guessing at names or scanning text at runtime: a thing is Islamic
// because it's listed in this file, full stop. When you add a new Islamic
// feature — a habit, a prompt, a card, a quote pool — register it here or the
// no-leak test (see includeIslamic-noleak in the E2E) will fail CI.
//
// The rule everywhere is visibility-only: registered content is hidden when the
// toggle is off and shown when it's on, and is NEVER deleted — so flipping the
// switch back on restores everything, history intact.
// ---------------------------------------------------------------------------

// Built-in habits that are Islamic practices, by seed id. `salah` is also caught
// by its `type`, but listing it keeps this the one place to look.
export const FAITH_HABIT_IDS = new Set(['salah', 'quran', 'adhkar', 'fasting'])

/** Is this habit an Islamic practice? (type for Salah, id for the rest.) */
export function isFaithHabit(habit) {
  return !!habit && (habit.type === 'salah' || FAITH_HABIT_IDS.has(habit.id))
}

/** Is this curated quote Islamic scripture/hadith? (tagged in quotes.js) */
export function isFaithQuote(quote) {
  return !!quote && quote.faith === 'islam'
}

// Indices into the urge-timer prompt list (priv.urge.N / seed.URGE_PROMPTS) that
// are Islamic — currently just "Make wudu. Reset the moment." at index 3.
export const FAITH_URGE_INDICES = new Set([3])

/**
 * The urge-prompt indices to rotate through, given the toggle. With the Islamic
 * layer off, the faith prompts drop out so the timer never says "make wudu".
 */
export function urgePromptIndices(count, includeIslamic = true) {
  const all = Array.from({ length: count }, (_, i) => i)
  return includeIslamic ? all : all.filter((i) => !FAITH_URGE_INDICES.has(i))
}
