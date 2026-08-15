import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { useLongPress } from './useLongPress.js'
import { visibleTasks, carryOverLabel, upcomingTasks, groupByDueDay } from '../lib/tasks.js'
import { addDaysKey, prettyDate } from '../lib/time.js'

/**
 * The Tasks card on Today: one-off to-dos that live alongside the habits but
 * carry no discipline weight. Quick-add with Enter, tap the ring to complete
 * (same scroll-intent + undo-toast + toggle-back rules as habits), tap a task's
 * text to edit it, long-press or the × to delete. Unfinished tasks roll over
 * quietly with a soft "since Tue" tag; future-dated tasks wait in a collapsed
 * "Upcoming" list. No badges, no red, no guilt copy.
 */
export default function TasksCard({ dayKey }) {
  const { state, addTask, toggleTask, deleteTask, restoreTask, updateTask } = useStore()
  const toast = useToast()
  const { open, done } = useMemo(() => visibleTasks(state.tasks, dayKey), [state.tasks, dayKey])
  const upcoming = useMemo(() => upcomingTasks(state.tasks, dayKey), [state.tasks, dayKey])

  const [editingId, setEditingId] = useState(null)
  const [showUpcoming, setShowUpcoming] = useState(false)
  // Upcoming starts collapsed every day — reset whenever the logical day turns.
  useEffect(() => { setShowUpcoming(false) }, [dayKey])

  const moveToday = (t) => {
    updateTask(t.id, { dueDay: dayKey })
    toast(`Moved to today · ${t.text}`, () => updateTask(t.id, { dueDay: t.dueDay }))
  }

  // Render a task as either its inline editor or a normal row.
  const renderRow = (task, variant) =>
    editingId === task.id ? (
      <TaskEditor
        key={task.id}
        task={task}
        dayKey={dayKey}
        onSave={(fields) => { updateTask(task.id, fields); setEditingId(null) }}
        onCancel={() => setEditingId(null)}
      />
    ) : (
      <TaskRow
        key={task.id}
        task={task}
        dayKey={dayKey}
        variant={variant}
        onEdit={setEditingId}
        onToggle={toggleTask}
        onDelete={deleteTask}
        onRestore={restoreTask}
        onMoveToday={variant === 'upcoming' ? moveToday : undefined}
        toast={toast}
      />
    )

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">Tasks</div>
        <div className="text-[11px] text-[var(--color-faint)]">{open.length ? `${open.length} to do` : 'all clear'}</div>
      </div>

      <QuickAdd dayKey={dayKey} onAdd={addTask} />

      {(open.length > 0 || done.length > 0) && (
        <div className="mt-3 space-y-1">
          {open.map((t) => renderRow(t, 'today'))}
          {done.map((t) => renderRow(t, 'today'))}
        </div>
      )}

      {/* Upcoming — collapsed by default; expands to future-dated tasks by day. */}
      {upcoming.length > 0 && (
        <div className="mt-3 pt-3 border-t border-[var(--color-line)]">
          <button
            onClick={() => setShowUpcoming((v) => !v)}
            aria-expanded={showUpcoming}
            className="w-full flex items-center justify-between text-[12px] text-[var(--color-muted)]"
          >
            <span>{upcoming.length} upcoming</span>
            <span className="text-[var(--color-faint)] text-[13px] leading-none">{showUpcoming ? '⌄' : '›'}</span>
          </button>

          {showUpcoming && (
            <div className="mt-2 space-y-3 animate-fade">
              {groupByDueDay(upcoming).map((g) => (
                <div key={g.dueDay}>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)] mb-1">
                    {groupLabel(g.dueDay, dayKey)}
                  </div>
                  <div className="space-y-1">
                    {g.tasks.map((t) => renderRow(t, 'upcoming'))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function groupLabel(dueDay, dayKey) {
  if (dueDay === addDaysKey(dayKey, 1)) return 'Tomorrow'
  return prettyDate(dueDay)
}

function QuickAdd({ dayKey, onAdd }) {
  const [text, setText] = useState('')
  const [due, setDue] = useState(dayKey)

  const submit = () => {
    const t = onAdd({ text, dueDay: due })
    if (!t) return
    setText('')
    setDue(dayKey) // reset the due-day back to today for the next one
    if (navigator.vibrate) navigator.vibrate(6)
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-2 focus-within:border-[var(--color-accent)]/60 transition">
        <span className="text-[var(--color-faint)] text-sm shrink-0">＋</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
          placeholder="Add a task…"
          aria-label="Add a task"
          className="flex-1 min-w-0 bg-transparent text-[15px] text-[var(--color-fg)] placeholder:text-[var(--color-faint)] outline-none"
        />
        {text.trim() && (
          <button onClick={submit} aria-label="Add task"
            className="shrink-0 text-[13px] font-medium text-[var(--color-accent-ink)] px-1.5">Add</button>
        )}
      </div>

      {/* Due-day control — quiet, only shown while composing. Default is today. */}
      {text.trim() && (
        <div className="mt-2 animate-fade">
          <DueControl due={due} setDue={setDue} dayKey={dayKey} />
        </div>
      )}
    </div>
  )
}

/** Shared Today / Tomorrow / pick-a-date control, used by quick-add and editing. */
function DueControl({ due, setDue, dayKey }) {
  const tomorrow = addDaysKey(dayKey, 1)
  const custom = due !== dayKey && due !== tomorrow
  // Keep focus on whatever field owns it (the editor's text input) when a chip
  // is tapped, so tapping a chip doesn't blur-commit the editor.
  const keepFocus = (e) => e.preventDefault()
  return (
    <div className="flex items-center gap-1.5">
      <DueChip label="Today" active={due === dayKey} onDown={keepFocus} onClick={() => setDue(dayKey)} />
      <DueChip label="Tomorrow" active={due === tomorrow} onDown={keepFocus} onClick={() => setDue(tomorrow)} />
      <label
        className={`text-[11px] rounded-full border px-2 py-1 cursor-pointer transition ${
          custom
            ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)]/50 text-[var(--color-accent-ink)]'
            : 'border-[var(--color-line-2)] text-[var(--color-muted)]'}`}>
        📅 {custom ? due.slice(5) : 'Pick'}
        <input type="date" value={due} min={dayKey}
          onChange={(e) => e.target.value && setDue(e.target.value)}
          className="sr-only" />
      </label>
    </div>
  )
}

function DueChip({ label, active, onClick, onDown }) {
  return (
    <button onMouseDown={onDown} onClick={onClick}
      className={`text-[11px] rounded-full border px-2.5 py-1 transition ${
        active
          ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)]/50 text-[var(--color-accent-ink)]'
          : 'border-[var(--color-line-2)] text-[var(--color-muted)]'}`}>
      {label}
    </button>
  )
}

/**
 * Inline editor for a task: text + the same due-day control as quick-add.
 * Enter or tapping anywhere outside saves; Escape or emptying the text cancels
 * (it never deletes). Only text + due day change — id, source, and completion
 * are untouched by the store action this feeds.
 */
function TaskEditor({ task, dayKey, onSave, onCancel }) {
  const [text, setText] = useState(task.text)
  const [due, setDue] = useState(task.dueDay)
  const ref = useRef(null)
  // Read the latest values from the outside-tap handler without re-binding it.
  const latest = useRef({ text, due })
  latest.current = { text, due }

  const commit = () => {
    const t = latest.current.text.trim()
    if (!t) return onCancel()               // empty cancels, never deletes
    onSave({ text: t, dueDay: latest.current.due })
  }

  // Tapping away (anywhere outside this editor) saves.
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) commit() }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [])

  return (
    <div ref={ref} className="py-1.5">
      <div className="flex items-center gap-2">
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); commit() }
            else if (e.key === 'Escape') onCancel()
          }}
          aria-label="Edit task"
          className="flex-1 min-w-0 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-2 text-[15px]
            text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]/60 transition"
        />
        <button onClick={commit} aria-label="Save task"
          className="shrink-0 text-[13px] font-medium text-[var(--color-accent-ink)] px-1.5">Save</button>
      </div>
      <div className="mt-2">
        <DueControl due={due} setDue={setDue} dayKey={dayKey} />
      </div>
    </div>
  )
}

function TaskRow({ task, dayKey, variant, onEdit, onToggle, onDelete, onRestore, onMoveToday, toast }) {
  const done = !!task.doneDay
  const upcoming = variant === 'upcoming'
  const canEdit = !done
  const since = carryOverLabel(task, dayKey)

  // Ring: tap to complete/clear (today rows only), same scroll-intent as habits.
  const ring = useLongPress(() => {
    if (navigator.vibrate) navigator.vibrate(6)
    onToggle(task.id, dayKey)
    toast(`${done ? 'Reopened' : 'Done'} · ${task.text}`, () => onToggle(task.id, dayKey))
  })

  // Delete — the visible × is the obvious path; long-press stays as a shortcut.
  const remove = () => {
    if (navigator.vibrate) navigator.vibrate(15)
    onDelete(task.id)
    toast(`Deleted · ${task.text}`, () => onRestore(task))
  }
  // On the text body: tap edits (open/upcoming only), long-press deletes. The
  // gesture helper keeps tap / long-press / scroll apart, and `no-callout`
  // kills the iOS selection magnifier that would otherwise eat the long-press.
  const body = useLongPress(canEdit ? () => onEdit(task.id) : undefined, remove)

  return (
    <div className="no-callout flex items-center gap-3 py-1.5">
      {upcoming ? (
        <span className="shrink-0 w-[40px] -ml-1.5 grid place-items-center text-[var(--color-line-2)]" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-line-2)]" />
        </span>
      ) : (
        <button
          {...ring}
          aria-label={`${done ? 'Reopen' : 'Complete'} ${task.text}`}
          className="no-callout shrink-0 min-w-[40px] min-h-[40px] grid place-items-center rounded-lg active:scale-90 transition -ml-1.5"
          style={{ touchAction: 'pan-y' }}
        >
          <TaskMarker done={done} />
        </button>
      )}

      {/* Long-press / tap-to-edit live on the text body only, so they can't
          collide with the ring, the × or the move action (siblings don't share
          bubbled touch events). */}
      <span
        {...body}
        className={`no-callout flex-1 min-w-0 transition ${done ? 'opacity-45' : ''}`}
        style={{ touchAction: 'pan-y' }}
      >
        <span className={`block text-[15px] leading-snug truncate ${done ? 'line-through text-[var(--color-muted)]' : 'text-[var(--color-fg)]'}`}>
          {task.text}
        </span>
        {since && !done && (
          <span className="block text-[11px] text-[var(--color-faint)] mt-0.5">{since}</span>
        )}
      </span>

      {upcoming && onMoveToday && (
        <button
          onClick={() => onMoveToday(task)}
          aria-label={`Move ${task.text} to today`}
          className="no-callout shrink-0 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-accent-ink)] border border-[var(--color-line-2)] rounded-full px-2 py-1 active:scale-95 transition"
        >
          → Today
        </button>
      )}

      {/* Visible, always-on delete affordance — quiet muted ×, no red, no trash. */}
      <button
        onClick={remove}
        aria-label={`Delete ${task.text}`}
        className="no-callout shrink-0 -mr-1 min-w-[36px] min-h-[36px] grid place-items-center rounded-lg text-lg leading-none text-[var(--color-faint)] hover:text-[var(--color-muted)] active:scale-90 transition"
      >
        ×
      </button>
    </div>
  )
}

function TaskMarker({ done }) {
  const base = 'w-6 h-6 rounded-full grid place-items-center border transition-colors duration-300'
  if (done) {
    return (
      <span key="done" className={`${base} border-transparent bg-[var(--color-accent)] text-[#231a09] animate-check`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 L9 17 L4 12" />
        </svg>
      </span>
    )
  }
  return <span className={`${base} border-[var(--color-line-2)]`}><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-line-2)]" /></span>
}
