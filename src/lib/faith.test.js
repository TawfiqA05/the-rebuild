import { describe, it, expect } from 'vitest'
import { freshState } from './seed.js'
import { activeHabits } from './logic.js'
import { isFaithHabit, isFaithQuote, promptIndices, FAITH_HABIT_IDS, FAITH_PROMPT_INDICES } from './faith.js'
import { PROMPT_COUNT } from './seed.js'
import en from './i18n/en.js'
import ar from './i18n/ar.js'
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

// The rotating prompts live only in the string tables, keyed 0..PROMPT_COUNT-1.
const PROMPT_KEY = /^priv\.urge\.(\d+)$/
const promptKeys = (table) => Object.keys(table).filter((k) => PROMPT_KEY.test(k))

describe('faith registry — rotating prompts', () => {
  it('drops the faith prompts (make wudu) when off, keeps all when on', () => {
    const on = promptIndices(PROMPT_COUNT, true)
    const off = promptIndices(PROMPT_COUNT, false)
    expect(on).toHaveLength(PROMPT_COUNT)
    for (const i of FAITH_PROMPT_INDICES) {
      expect(on).toContain(i)
      expect(off).not.toContain(i)
    }
    // the wudu line really is the one at the registered index
    expect(en['priv.urge.3'].toLowerCase()).toContain('wudu')
  })

  it('the count matches the prompt strings in en.js and in ar.js', () => {
    for (const table of [en, ar]) {
      const keys = promptKeys(table)
      expect(keys).toHaveLength(PROMPT_COUNT)
      const idx = keys.map((k) => Number(PROMPT_KEY.exec(k)[1])).sort((a, b) => a - b)
      expect(idx).toEqual(Array.from({ length: PROMPT_COUNT }, (_, i) => i))
    }
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
