import { describe, it, expect } from 'vitest'
import {
  makeTask, visibleTasks, carryOverLabel, toggleTaskDone, completedTaskCount,
} from './tasks.js'
import { dayScore, currentStreak } from './logic.js'

// Tasks are supposed to sit *alongside* habits without ever touching the
// discipline machinery. These tests pin down the three things most likely to
// break quietly: carry-over across the 3am boundary, the fact that finishing a
// task can't move a habit streak or score, and that completion toggles cleanly
// both ways.

const t = (over) => makeTask({ text: 't', dueDay: '2026-01-14', id: 'x', now: 1000, ...over })

describe('carry-over across the 3am rollover', () => {
  it('an unfinished task from yesterday still shows today', () => {
    const task = t({ id: 'a', dueDay: '2026-01-14' })
    const { open } = visibleTasks([task], '2026-01-15')
    expect(open.map((x) => x.id)).toEqual(['a'])
  })

  it('tags a carried-over task with the day it was due', () => {
    const task = t({ dueDay: '2026-01-13' }) // a Tuesday
    expect(carryOverLabel(task, '2026-01-15')).toBe('since Tue')
  })

  it('no tag while the task is still due today', () => {
    const task = t({ dueDay: '2026-01-15' })
    expect(carryOverLabel(task, '2026-01-15')).toBe(null)
  })

  it('a future-dated task does not appear yet, then appears once its day arrives', () => {
    const task = t({ id: 'f', dueDay: '2026-01-16' })
    expect(visibleTasks([task], '2026-01-15').open).toEqual([])
    expect(visibleTasks([task], '2026-01-16').open.map((x) => x.id)).toEqual(['f'])
  })

  it('a task completed yesterday is gone from view after the rollover', () => {
    const task = { ...t({ id: 'd' }), doneDay: '2026-01-14', doneAt: 1000 }
    const { open, done } = visibleTasks([task], '2026-01-15')
    expect(open).toEqual([])
    expect(done).toEqual([]) // only *today's* completions show, crossed out
  })

  it('a task completed today still shows (crossed out) until the next rollover', () => {
    const task = { ...t({ id: 'd' }), doneDay: '2026-01-15', doneAt: 1000 }
    expect(visibleTasks([task], '2026-01-15').done.map((x) => x.id)).toEqual(['d'])
  })

  it('older carry-overs fall back to a dated tag', () => {
    const task = t({ dueDay: '2026-01-01' })
    expect(carryOverLabel(task, '2026-01-15')).toBe('since Jan 1')
  })
})

describe('tasks never touch habit scoring or streaks', () => {
  // A real-ish state: one daily habit done two days running, plus some tasks.
  const habit = { id: 'read', type: 'standard', phase: 1, frequency: { kind: 'daily' } }
  const baseState = {
    settings: { dayRolloverHour: 3, currentPhase: 1 },
    habits: [habit],
    logs: { '2026-01-14': { read: { status: 'full' } }, '2026-01-15': { read: { status: 'full' } } },
    days: {},
    votes: 0,
    tasks: [
      t({ id: 'open', dueDay: '2026-01-15' }),
      { ...t({ id: 'done' }), doneDay: '2026-01-15', doneAt: 1000 },
    ],
  }

  it('the daily score ignores tasks entirely', () => {
    const { done, total } = dayScore(baseState, '2026-01-15')
    expect(total).toBe(1) // just the one habit — never the tasks
    expect(done).toBe(1)
  })

  it('completing or clearing a task leaves the habit streak untouched', () => {
    const before = currentStreak(baseState, habit, '2026-01-15')
    const afterComplete = toggleTaskDone(baseState.tasks, 'open', '2026-01-15').tasks
    const afterClear = toggleTaskDone(afterComplete, 'done', '2026-01-15').tasks
    expect(currentStreak({ ...baseState, tasks: afterComplete }, habit, '2026-01-15')).toBe(before)
    expect(currentStreak({ ...baseState, tasks: afterClear }, habit, '2026-01-15')).toBe(before)
    expect(before).toBe(2)
  })
})

describe('completion toggles both ways', () => {
  it('open → done stamps the day and flags a fresh vote', () => {
    const r = toggleTaskDone([t({ id: 'a' })], 'a', '2026-01-15', 5000)
    expect(r.becameDone).toBe(true)
    expect(r.tasks[0].doneDay).toBe('2026-01-15')
    expect(r.tasks[0].doneAt).toBe(5000)
  })

  it('done → open clears the stamp and is not a new vote', () => {
    const doneTask = { ...t({ id: 'a' }), doneDay: '2026-01-15', doneAt: 5000 }
    const r = toggleTaskDone([doneTask], 'a', '2026-01-15')
    expect(r.becameDone).toBe(false)
    expect(r.tasks[0].doneDay).toBe(null)
    expect(r.tasks[0].doneAt).toBe(null)
  })

  it('re-completing counts as a vote again (votes only ever grow)', () => {
    let list = [t({ id: 'a' })]
    expect(toggleTaskDone(list, 'a', '2026-01-15').becameDone).toBe(true)
    list = toggleTaskDone(list, 'a', '2026-01-15').tasks // done
    list = toggleTaskDone(list, 'a', '2026-01-15').tasks // back to open
    expect(toggleTaskDone(list, 'a', '2026-01-15').becameDone).toBe(true)
  })

  it('completedTaskCount counts finished tasks only', () => {
    const list = [
      { ...t({ id: 'a' }), doneDay: '2026-01-15' },
      t({ id: 'b' }),
      { ...t({ id: 'c' }), doneDay: '2026-01-10' },
    ]
    expect(completedTaskCount(list)).toBe(2)
  })
})
