import { describe, it, expect } from 'vitest'
import { freshState } from './seed.js'
import { activeHabits } from './logic.js'
import { isFaithHabit, isFaithQuote, urgePromptIndices, FAITH_HABIT_IDS, FAITH_URGE_INDICES } from './faith.js'
import { URGE_PROMPTS } from './seed.js'
import { CURATED } from './quotes.js'

// The registry is the single source of truth for what's Islamic. These lock in
// that the whole class is covered — not just Salah — so a leak like the adhkar
// habit can't come back.

describe('faith registry — habits', () => {
  it('tags Salah, Quran, Adhkar, and the Mon/Thu fast', () => {
    for (const id of ['salah', 'quran', 'adhkar', 'fasting']) {
      const h = freshState().habits.find((x) => x.id === id)
      expect(isFaithHabit(h), id).toBe(true)
    }
  })

  it('leaves neutral habits alone', () => {
    for (const id of ['bed', 'gym', 'sleep', 'gratitude', 'journal', 'read', 'water']) {
      const h = freshState().habits.find((x) => x.id === id)
      expect(isFaithHabit(h), id).toBe(false)
    }
  })

  it('hides every registered faith habit from the active list when off', () => {
    const off = freshState()
    off.settings.currentPhase = 5
    off.settings.includeIslamic = false
    const ids = new Set(activeHabits(off).map((h) => h.id))
    for (const id of FAITH_HABIT_IDS) expect(ids.has(id), id).toBe(false)
  })
})

describe('faith registry — urge prompts', () => {
  it('drops the faith prompts (make wudu) when off, keeps all when on', () => {
    const on = urgePromptIndices(URGE_PROMPTS.length, true)
    const off = urgePromptIndices(URGE_PROMPTS.length, false)
    expect(on).toHaveLength(URGE_PROMPTS.length)
    for (const i of FAITH_URGE_INDICES) {
      expect(on).toContain(i)
      expect(off).not.toContain(i)
    }
    // the wudu line really is the one at the registered index
    expect(URGE_PROMPTS[3].toLowerCase()).toContain('wudu')
  })
})

describe('faith registry — quotes', () => {
  it('recognizes exactly the tagged scripture/hadith', () => {
    const faith = CURATED.filter(isFaithQuote)
    expect(faith.length).toBeGreaterThan(0)
    for (const q of faith) expect(q.faith).toBe('islam')
    // a secular quote is not faith
    expect(isFaithQuote({ text: 'Discipline equals freedom.', author: 'Jocko Willink' })).toBe(false)
  })
})
