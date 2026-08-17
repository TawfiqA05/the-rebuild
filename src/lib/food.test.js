import { describe, it, expect } from 'vitest'
import {
  makeFoodEntry, foodForDay, foodBand, groupFoodByBand, frequentFoods,
  daysLoggedCount, updateFoodText, setFoodEntryTime, deleteFoodById, insertFood,
  resolveEntryTime, quickAddResetTarget,
} from './food.js'
import { dayScore, currentStreak } from './logic.js'

// The food log is "awareness only": it must land on the right rollover day, and
// it must never leak into the discipline machinery. These tests pin both, plus
// the edit/delete/undo and frequent-chip behaviour shared with tasks.

// Make an entry on a specific local date/time, bucketed with the 3am rollover.
const mk = (text, y, mo, d, h = 12, min = 0, id) =>
  makeFoodEntry({ text, at: new Date(y, mo, d, h, min).getTime(), rolloverHour: 3, id })

describe('3am rollover bucketing', () => {
  it('a 1am snack belongs to the ending (previous) logical day', () => {
    const snack = mk('leftover pizza', 2026, 0, 15, 1) // 1:00am on the 15th
    expect(snack.day).toBe('2026-01-14')
    expect(foodForDay([snack], '2026-01-14').map((e) => e.text)).toEqual(['leftover pizza'])
    expect(foodForDay([snack], '2026-01-15')).toEqual([])
  })

  it('a 3am entry rolls into the new day', () => {
    expect(mk('early coffee', 2026, 0, 15, 3).day).toBe('2026-01-15')
  })

  it('lists a day chronologically', () => {
    const list = [mk('dinner', 2026, 0, 15, 19), mk('lunch', 2026, 0, 15, 12), mk('breakfast', 2026, 0, 15, 8)]
    expect(foodForDay(list, '2026-01-15').map((e) => e.text)).toEqual(['breakfast', 'lunch', 'dinner'])
  })
})

describe('time-of-day bands', () => {
  it('labels by the clock, not by choice', () => {
    const at = (h) => new Date(2026, 0, 15, h).getTime()
    expect(foodBand(at(8))).toBe('morning')
    expect(foodBand(at(13))).toBe('midday')
    expect(foodBand(at(19))).toBe('evening')
    expect(foodBand(at(23))).toBe('night')
    expect(foodBand(at(2))).toBe('night')
  })

  it('groups consecutive entries into band sections', () => {
    const list = foodForDay([
      mk('oatmeal', 2026, 0, 15, 8), mk('coffee', 2026, 0, 15, 9), mk('pasta', 2026, 0, 15, 20),
    ], '2026-01-15')
    const groups = groupFoodByBand(list)
    expect(groups.map((g) => g.label)).toEqual(['Morning', 'Evening'])
    expect(groups[0].entries).toHaveLength(2)
  })
})

describe('never touches score or streaks', () => {
  const habit = { id: 'read', type: 'standard', phase: 1, frequency: { kind: 'daily' } }
  const base = {
    settings: { dayRolloverHour: 3, currentPhase: 1 },
    habits: [habit],
    logs: { '2026-01-14': { read: { status: 'full' } }, '2026-01-15': { read: { status: 'full' } } },
    days: {}, votes: 0,
    food: [mk('eggs', 2026, 0, 15, 8)],
  }

  it('the daily score and streak ignore food entirely', () => {
    expect(dayScore(base, '2026-01-15')).toEqual({ done: 1, total: 1 })
    expect(currentStreak(base, habit, '2026-01-15')).toBe(2)
    // adding / editing / deleting food changes none of it
    const more = { ...base, food: [...base.food, mk('toast', 2026, 0, 15, 9)] }
    expect(dayScore(more, '2026-01-15')).toEqual({ done: 1, total: 1 })
    expect(currentStreak(more, habit, '2026-01-15')).toBe(2)
  })
})

describe('edit, backdate, delete + undo', () => {
  it('editing changes only the text — id, timestamp and day are preserved', () => {
    const e = mk('chiken', 2026, 0, 15, 19, 0, 'f1')
    const [edited] = updateFoodText([e], 'f1', '  chicken  ')
    expect(edited.id).toBe('f1')
    expect(edited.at).toBe(e.at)
    expect(edited.day).toBe(e.day)
    expect(edited.text).toBe('chicken') // trimmed
  })

  it('backdating adjusts the time within the same day bucket', () => {
    const e = mk('dinner', 2026, 0, 15, 21, 0, 'f1') // logged 9pm
    const [moved] = setFoodEntryTime([e], 'f1', '20:00') // I actually ate at 8
    expect(new Date(moved.at).getHours()).toBe(20)
    expect(moved.day).toBe('2026-01-15') // still the same logical day
  })

  it('delete removes by id and undo restores the exact entry', () => {
    const keep = mk('keep', 2026, 0, 15, 8, 0, 'k')
    const gone = mk('gone', 2026, 0, 15, 12, 0, 'g')
    const afterDelete = deleteFoodById([keep, gone], 'g')
    expect(afterDelete.map((e) => e.id)).toEqual(['k'])
    const restored = insertFood(afterDelete, gone).find((e) => e.id === 'g')
    expect(restored).toEqual(gone) // id, text, at, day all intact
  })
})

describe('frequent quick-add chips', () => {
  it('ranks by count then recency, dedupes case-insensitively, ignores stale days', () => {
    const food = [
      mk('eggs', 2026, 0, 15, 8), mk('eggs', 2026, 0, 14, 8), mk('eggs', 2026, 0, 13, 8),
      mk('Eggs', 2026, 0, 12, 8),        // same item, different case → merges (count 4)
      mk('oats', 2026, 0, 14, 8), mk('oats', 2026, 0, 13, 8), // count 2
      mk('rice', 2026, 0, 15, 20),       // count 1
      mk('eggs', 2025, 11, 20, 8),       // >14 days old → not counted
    ]
    expect(frequentFoods(food, '2026-01-15')).toEqual(['eggs', 'oats', 'rice'])
  })

  it('caps at 6 chips', () => {
    const food = Array.from({ length: 9 }, (_, i) => mk(`item${i}`, 2026, 0, 15, 8 + i))
    expect(frequentFoods(food, '2026-01-15')).toHaveLength(6)
  })
})

describe('add to yesterday', () => {
  const today = '2026-01-15'
  const yesterday = '2026-01-14'

  // Mirror the store's add path: resolve the time, then build the entry.
  const addTo = (text, targetDay, now) => {
    const { at } = resolveEntryTime(targetDay, { today, now })
    return makeFoodEntry({ text, at, rolloverHour: 3, id: `${text}` })
  }

  it('lands on yesterday’s day-key, defaulting to the evening', () => {
    const e = addTo('late dinner', yesterday)
    expect(e.day).toBe(yesterday)
    expect(new Date(e.at).getHours()).toBe(19) // sensible evening default
    // shows in yesterday's detail list, not today's
    expect(foodForDay([e], yesterday).map((x) => x.text)).toEqual(['late dinner'])
    expect(foodForDay([e], today)).toEqual([])
  })

  it('is one-shot — the quick-add target snaps back to today after an add', () => {
    expect(quickAddResetTarget()).toBe('today')
  })

  it('can only adjust a yesterday entry within yesterday (day never changes)', () => {
    const e = addTo('dinner', yesterday)
    const [morning] = setFoodEntryTime([e], e.id, '07:30')
    expect(new Date(morning.at).getHours()).toBe(7)
    expect(morning.day).toBe(yesterday) // still yesterday, never crosses out
  })

  it('seals off day-before-yesterday and older — they resolve to today', () => {
    const now = new Date(2026, 0, 15, 10, 30).getTime()
    for (const older of ['2026-01-13', '2026-01-01', '2020-06-06']) {
      const r = resolveEntryTime(older, { today, now })
      expect(r.day).toBe(today)
      expect(r.at).toBe(now)
    }
  })

  it('a yesterday entry is a normal entry — in chips and day counts', () => {
    const list = [addTo('ramen', yesterday)]
    expect(frequentFoods(list, today)).toContain('ramen')
    expect(daysLoggedCount(list)).toBe(1)
  })

  it('an entry added to yesterday can be deleted (and undo restores it)', () => {
    // add to yesterday, exactly as the store does
    const { at } = resolveEntryTime(yesterday, { today })
    const entry = makeFoodEntry({ text: 'late night snack', at, rolloverHour: 3, id: 'y1' })
    let food = [entry]
    expect(foodForDay(food, yesterday).map((e) => e.id)).toEqual(['y1'])

    // delete it from the (past) day
    food = deleteFoodById(food, 'y1')
    expect(foodForDay(food, yesterday)).toEqual([])

    // undo puts it back exactly, still on yesterday
    food = insertFood(food, entry)
    const back = foodForDay(food, yesterday)
    expect(back).toHaveLength(1)
    expect(back[0]).toEqual(entry)
    expect(back[0].day).toBe(yesterday)
  })

  it('has zero effect on score or streaks, exactly like a today entry', () => {
    const habit = { id: 'read', type: 'standard', phase: 1, frequency: { kind: 'daily' } }
    const base = {
      settings: { dayRolloverHour: 3, currentPhase: 1 },
      habits: [habit],
      logs: { '2026-01-14': { read: { status: 'full' } }, '2026-01-15': { read: { status: 'full' } } },
      days: {}, votes: 0, food: [],
    }
    const withYesterdayFood = { ...base, food: [addTo('late dinner', yesterday)] }
    expect(dayScore(withYesterdayFood, today)).toEqual(dayScore(base, today))
    expect(currentStreak(withYesterdayFood, habit, today)).toBe(currentStreak(base, habit, today))
    expect(currentStreak(withYesterdayFood, habit, today)).toBe(2)
  })
})

describe('days-logged count (the one Stats number)', () => {
  it('counts distinct days with at least one entry', () => {
    const food = [
      mk('a', 2026, 0, 15, 8), mk('b', 2026, 0, 15, 12), // same day
      mk('c', 2026, 0, 14, 8),
      mk('d', 2026, 0, 10, 8),
    ]
    expect(daysLoggedCount(food)).toBe(3)
    expect(daysLoggedCount([])).toBe(0)
  })
})
