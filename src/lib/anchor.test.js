import { describe, it, expect } from 'vitest'
import { dailyAnchor } from './anchor.js'
import { addDaysKey } from './time.js'
import { CURATED } from './quotes.js'

describe('scripture carries its exact Arabic + citation', () => {
  // Every Qur'an/hadith entry must ship the original Arabic and an Arabic
  // citation, so Arabic readers never see a translation where scripture belongs.
  const scripture = CURATED.filter((q) => /Qur’an|Muhammad/.test(q.author))
  it('has at least the seven known scripture lines', () => {
    expect(scripture.length).toBeGreaterThanOrEqual(7)
  })
  for (const q of scripture) {
    it(`${q.author} has Arabic text + citation`, () => {
      expect(q.ar, 'ar text').toBeTruthy()
      expect(q.arAuthor, 'ar citation').toBeTruthy()
      // Arabic text should actually contain Arabic-script characters.
      expect(/[؀-ۿ]/.test(q.ar)).toBe(true)
    })
  }
})

// The two properties that make this "an anchor, not a feed": it is stable across
// a day (deterministic by date) and it rotates through the pools rather than
// leaning on one. We also check the rough-day bias toward the user's own words.

// A state with all three pools richly populated:
//   - curated is always available (the built-in list)
//   - 6 wins (>= 5, so the wins pool turns on)
//   - two full-win days with a "what went well" journal line
function fullState() {
  const win = (i) => ({ id: `w${i}`, at: Date.UTC(2026, 0, i + 1), text: `win ${i}` })
  const habit = { id: 'read', type: 'standard', phase: 1, frequency: { kind: 'daily' } }
  return {
    settings: { dayRolloverHour: 3, currentPhase: 1 },
    habits: [habit],
    // both days are a full win (the one required habit is done)
    logs: {
      '2026-02-01': { read: { status: 'full' } },
      '2026-02-02': { read: { status: 'full' } },
    },
    days: {
      '2026-02-01': { journal: { well: 'shipped the thing' } },
      '2026-02-02': { journal: { well: 'ran in the rain' } },
    },
    wins: [win(0), win(1), win(2), win(3), win(4), win(5)],
    myQuotes: [],
  }
}

describe('Arabic only surfaces quotes it can show in Arabic', () => {
  const bare = { settings: {}, habits: [], logs: {}, days: {}, wins: [], myQuotes: [] }
  it('over a month, every curated pick in Arabic carries Arabic text', () => {
    for (let i = 0; i < 40; i++) {
      const a = dailyAnchor(bare, addDaysKey('2026-03-01', i), { lang: 'ar' })
      if (a.pool === 'curated') expect(a.ar, `${a.text}`).toBeTruthy()
    }
  })
  it('English still shows the full pool (secular quotes included)', () => {
    const seen = new Set()
    for (let i = 0; i < 120; i++) seen.add(dailyAnchor(bare, addDaysKey('2026-03-01', i), { lang: 'en' }).text)
    // more than the 7 scripture lines → secular quotes are present in English
    expect(seen.size).toBeGreaterThan(7)
  })
})

describe('deterministic by date', () => {
  it('returns the same line for the same day, every call', () => {
    const s = fullState()
    const a = dailyAnchor(s, '2026-03-10')
    const b = dailyAnchor(s, '2026-03-10')
    expect(a).toEqual(b)
    expect(a.text).toBeTruthy()
  })

  it('the curated pool alone always yields something (never empty)', () => {
    const bare = { settings: {}, habits: [], logs: {}, days: {}, wins: [], myQuotes: [] }
    const a = dailyAnchor(bare, '2026-03-10')
    expect(a.pool).toBe('curated')
    expect(a.author).toBeTruthy()
  })

  it('different days can surface different lines', () => {
    const s = fullState()
    const week = Array.from({ length: 7 }, (_, i) => dailyAnchor(s, addDaysKey('2026-03-10', i)).text)
    expect(new Set(week).size).toBeGreaterThan(1)
  })
})

describe('pool rotation', () => {
  it('cycles curated → wins → journal across consecutive days', () => {
    const s = fullState()
    // find a day where the rotation starts at curated, then walk three days
    let start = '2026-03-01'
    for (let i = 0; i < 3; i++) {
      if (dailyAnchor(s, start).pool === 'curated') break
      start = addDaysKey(start, 1)
    }
    const seq = [0, 1, 2].map((i) => dailyAnchor(s, addDaysKey(start, i)).pool)
    expect(seq).toEqual(['curated', 'wins', 'journal'])
  })

  it('over two weeks it visits all three pools', () => {
    const s = fullState()
    const pools = new Set(
      Array.from({ length: 14 }, (_, i) => dailyAnchor(s, addDaysKey('2026-03-01', i)).pool),
    )
    expect(pools).toEqual(new Set(['curated', 'wins', 'journal']))
  })
})

describe('own-evidence bias on hard days', () => {
  it('rough/restart states only pull from the wins or journal pools', () => {
    const s = fullState()
    for (let i = 0; i < 10; i++) {
      const a = dailyAnchor(s, addDaysKey('2026-03-01', i), { biasOwn: true })
      expect(['wins', 'journal']).toContain(a.pool)
      expect(a.text.startsWith('You, ')).toBe(true)
    }
  })

  it('falls back to curated when there is no own evidence yet', () => {
    const bare = { settings: {}, habits: [], logs: {}, days: {}, wins: [], myQuotes: [] }
    expect(dailyAnchor(bare, '2026-03-01', { biasOwn: true }).pool).toBe('curated')
  })

  it('a wins list under 5 does not open the wins pool', () => {
    const s = fullState()
    s.wins = s.wins.slice(0, 4) // only 4 logged
    const pools = new Set(
      Array.from({ length: 14 }, (_, i) => dailyAnchor(s, addDaysKey('2026-03-01', i)).pool),
    )
    expect(pools.has('wins')).toBe(false)
  })
})
