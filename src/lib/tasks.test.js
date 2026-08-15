import { describe, it, expect } from 'vitest'
import {
  makeTask, visibleTasks, carryOverLabel, toggleTaskDone, completedTaskCount,
  deleteTaskById, insertTask, planShutdownTasks,
  upcomingTasks, groupByDueDay, updateTaskFields,
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

describe('explicit delete + undo', () => {
  it('the × removes only the targeted task and undo restores it exactly', () => {
    const keep = t({ id: 'keep', dueDay: '2026-01-12', source: 'manual' })
    const gone = t({ id: 'gone', dueDay: '2026-01-13', source: 'shutdown' })
    const list = [keep, gone]

    const afterDelete = deleteTaskById(list, 'gone')
    expect(afterDelete.map((x) => x.id)).toEqual(['keep'])

    // Undo re-inserts the very same object — id, dueDay, source all preserved.
    const afterUndo = insertTask(afterDelete, gone)
    const restored = afterUndo.find((x) => x.id === 'gone')
    expect(restored).toEqual(gone)
    expect(restored.dueDay).toBe('2026-01-13')
    expect(restored.source).toBe('shutdown')
  })

  it('deleting a completed task does not touch votes (mirrors the store)', () => {
    // The store's deleteTask only swaps `tasks`; votes ride through untouched.
    const doneTask = { ...t({ id: 'd' }), doneDay: '2026-01-15', doneAt: 1000 }
    const prev = { tasks: [doneTask, t({ id: 'o' })], votes: 7 }
    const next = { ...prev, tasks: deleteTaskById(prev.tasks, 'd') }
    expect(next.votes).toBe(7) // no claw-back — votes only ever grow
    expect(next.tasks.map((x) => x.id)).toEqual(['o'])
  })

  it('deleting a shutdown task keeps the next shutdown run idempotent', () => {
    const opts = { createdDay: '2026-01-14' }
    // Plan three tasks for tomorrow, then the user deletes one of them.
    const planned = planShutdownTasks([], '2026-01-15', ['a', 'b', 'c'], opts)
    expect(planned).toHaveLength(3)
    const afterDelete = deleteTaskById(planned, planned[1].id)
    expect(afterDelete).toHaveLength(2)

    // Re-running shutdown reconciles cleanly: the leftover open shutdown tasks
    // are dropped and the plan is rebuilt — exactly three, no duplicates.
    const rerun = planShutdownTasks(afterDelete, '2026-01-15', ['a', 'b', 'c'], opts)
    const shutdownForDay = rerun.filter((x) => x.source === 'shutdown' && x.dueDay === '2026-01-15')
    expect(shutdownForDay).toHaveLength(3)
    expect(shutdownForDay.map((x) => x.text).sort()).toEqual(['a', 'b', 'c'])
  })

  it('a completed shutdown task survives a re-run, so its vote is never lost', () => {
    const opts = { createdDay: '2026-01-14' }
    const planned = planShutdownTasks([], '2026-01-15', ['a', 'b'], opts)
    // Mark one done (as if it was finished the next day).
    const withDone = planned.map((x, i) => (i === 0 ? { ...x, doneDay: '2026-01-15', doneAt: 1 } : x))
    const rerun = planShutdownTasks(withDone, '2026-01-15', ['a', 'b'], opts)
    expect(rerun.filter((x) => x.doneDay)).toHaveLength(1)           // the finished one stayed
    expect(rerun.filter((x) => x.source === 'shutdown')).toHaveLength(3) // 1 done + 2 fresh
  })
})

describe('upcoming (future-dated) tasks', () => {
  it('hides future tasks from today but surfaces them in Upcoming', () => {
    const todayTask = t({ id: 'now', dueDay: '2026-01-15' })
    const soon = t({ id: 'soon', dueDay: '2026-01-16' })
    const later = t({ id: 'later', dueDay: '2026-01-20' })
    const list = [todayTask, soon, later]

    expect(visibleTasks(list, '2026-01-15').open.map((x) => x.id)).toEqual(['now'])
    expect(upcomingTasks(list, '2026-01-15').map((x) => x.id)).toEqual(['soon', 'later'])
  })

  it('a completed future task is neither on today nor in Upcoming', () => {
    const doneFuture = { ...t({ id: 'df', dueDay: '2026-01-18' }), doneDay: '2026-01-18', doneAt: 1 }
    expect(upcomingTasks([doneFuture], '2026-01-15')).toEqual([])
    expect(visibleTasks([doneFuture], '2026-01-15').open).toEqual([])
  })

  it('groups upcoming tasks by due day, in date order', () => {
    const list = [
      t({ id: 'b1', dueDay: '2026-01-16', now: 2 }),
      t({ id: 'a', dueDay: '2026-01-20' }),
      t({ id: 'b2', dueDay: '2026-01-16', now: 1 }),
    ]
    const groups = groupByDueDay(upcomingTasks(list, '2026-01-15'))
    expect(groups.map((g) => g.dueDay)).toEqual(['2026-01-16', '2026-01-20'])
    expect(groups[0].tasks.map((x) => x.id)).toEqual(['b2', 'b1']) // same day, by createdAt
  })

  it('move-to-today pulls a future task in; re-dating pushes one out', () => {
    const future = t({ id: 'f', dueDay: '2026-01-18' })

    // Move to today (dueDay -> today): leaves Upcoming, enters today's open list.
    const pulledIn = updateTaskFields([future], 'f', { dueDay: '2026-01-15' })
    expect(upcomingTasks(pulledIn, '2026-01-15')).toEqual([])
    expect(visibleTasks(pulledIn, '2026-01-15').open.map((x) => x.id)).toEqual(['f'])

    // The reverse: a today task re-dated to the future leaves today, joins Upcoming.
    const todayTask = t({ id: 'g', dueDay: '2026-01-15' })
    const pushedOut = updateTaskFields([todayTask], 'g', { dueDay: '2026-01-19' })
    expect(visibleTasks(pushedOut, '2026-01-15').open).toEqual([])
    expect(upcomingTasks(pushedOut, '2026-01-15').map((x) => x.id)).toEqual(['g'])
  })
})

describe('editing a task', () => {
  it('preserves id, source, and completion; only text/due change', () => {
    const original = { ...t({ id: 'e', dueDay: '2026-01-15', source: 'shutdown' }), doneDay: '2026-01-15', doneAt: 42 }
    const [edited] = updateTaskFields([original], 'e', { text: '  new text  ', dueDay: '2026-01-17' })
    expect(edited.id).toBe('e')
    expect(edited.source).toBe('shutdown')
    expect(edited.doneDay).toBe('2026-01-15') // completion untouched
    expect(edited.doneAt).toBe(42)
    expect(edited.text).toBe('new text')      // trimmed
    expect(edited.dueDay).toBe('2026-01-17')
  })

  it('editing a shutdown task is not clobbered or duplicated by the next shutdown run', () => {
    const opts = { createdDay: '2026-01-14' }
    const planned = planShutdownTasks([], '2026-01-16', ['a', 'b'], opts) // tomorrow = the 16th

    // The user edits one planned task: rename it AND push it two days out.
    const editedId = planned[0].id
    const edited = updateTaskFields(planned, editedId, { text: 'a-edited', dueDay: '2026-01-18' })

    // Re-running shutdown for the 16th only reconciles the 16th. The moved task
    // (now due the 18th) is left completely alone — not dropped, not duplicated.
    const rerun = planShutdownTasks(edited, '2026-01-16', ['b'], opts)
    const moved = rerun.filter((x) => x.id === editedId)
    expect(moved).toHaveLength(1)
    expect(moved[0].text).toBe('a-edited')
    expect(moved[0].dueDay).toBe('2026-01-18')
    // And no duplicate of it was created for the 16th.
    expect(rerun.filter((x) => x.text === 'a-edited')).toHaveLength(1)
  })

  it('an edited task still has zero effect on habit score or streaks', () => {
    const habit = { id: 'read', type: 'standard', phase: 1, frequency: { kind: 'daily' } }
    const base = {
      settings: { dayRolloverHour: 3, currentPhase: 1 },
      habits: [habit],
      logs: { '2026-01-14': { read: { status: 'full' } }, '2026-01-15': { read: { status: 'full' } } },
      days: {}, votes: 0,
      tasks: [t({ id: 'x', dueDay: '2026-01-15' })],
    }
    const before = { score: dayScore(base, '2026-01-15'), streak: currentStreak(base, habit, '2026-01-15') }
    const edited = { ...base, tasks: updateTaskFields(base.tasks, 'x', { text: 'changed', dueDay: '2026-01-20' }) }
    expect(dayScore(edited, '2026-01-15')).toEqual(before.score)
    expect(currentStreak(edited, habit, '2026-01-15')).toBe(before.streak)
    expect(before.streak).toBe(2)
  })
})
