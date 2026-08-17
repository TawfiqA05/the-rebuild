import { describe, it, expect } from 'vitest'
import { buildShareSummary, shareSummaryToText, scoreLabel } from './share.js'

// The one rule that matters for a share you send someone: nothing private gets
// in. These build a state stuffed with private-log entries and food, then prove
// none of it reaches the summary or its text.

const habit = (id, over = {}) => ({ id, name: id, emoji: '📖', phase: 1, type: 'standard', frequency: { kind: 'daily' }, ...over })

function makeState() {
  return {
    settings: { dayRolloverHour: 3, currentPhase: 1 },
    habits: [
      habit('read', { name: 'Read 10 pages', emoji: '📖' }),
      habit('gym', { name: 'Gym', emoji: '🏋️', frequency: { kind: 'perWeek', count: 3 } }),
    ],
    logs: {
      '2026-08-13': { read: { status: 'full' } },
      '2026-08-14': { read: { status: 'full' } },
      '2026-08-15': { read: { status: 'min' } },
    },
    days: {}, votes: 99,
    // sensitive stuff that must NEVER surface:
    privateLog: {
      entries: [{ id: 'p1', at: 1, trigger: 'stress', note: 'SECRET_PRIVATE_NOTE' }],
      waves: [{ id: 'w1', at: 1 }],
    },
    food: [
      { id: 'f1', text: 'SECRET_BURRITO', at: 1, day: '2026-08-15' },
      { id: 'f2', text: 'SECRET_COFFEE', at: 2, day: '2026-08-15' },
    ],
  }
}

describe('accountability summary', () => {
  it('includes habit scores, streaks, overall, and the optional note', () => {
    const s = buildShareSummary(makeState(), '2026-08-15', { note: 'holding the line' })
    expect(s.rows.map((r) => r.name)).toEqual(['Read 10 pages', 'Gym'])
    expect(s.rows[0].streak).toBe(3)          // read done 3 days running
    expect(scoreLabel(s.rows[1])).toBe('0/3') // gym per-week
    expect(typeof s.overallPct).toBe('number')
    expect(s.note).toBe('holding the line')
  })

  it('never leaks anything from the private log or the food log', () => {
    const summary = buildShareSummary(makeState(), '2026-08-15', { note: 'week done' })
    const blob = JSON.stringify(summary) + '\n' + shareSummaryToText(summary)
    for (const secret of ['SECRET_PRIVATE_NOTE', 'stress', 'SECRET_BURRITO', 'SECRET_COFFEE']) {
      expect(blob).not.toContain(secret)
    }
  })

  it('caps a long note and trims whitespace', () => {
    const long = 'x'.repeat(300)
    const s = buildShareSummary(makeState(), '2026-08-15', { note: `   ${long}   ` })
    expect(s.note.length).toBe(140)
  })

  it('text output stays plain and human', () => {
    const text = shareSummaryToText(buildShareSummary(makeState(), '2026-08-15', {}))
    expect(text).toContain('The Rebuild · week of Aug')
    expect(text).toContain('Never miss twice.')
  })
})
