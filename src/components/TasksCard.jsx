import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { useLongPress } from './useLongPress.js'
import { visibleTasks, carryOverLabel } from '../lib/tasks.js'
import { addDaysKey } from '../lib/time.js'

/**
 * The Tasks card on Today: one-off to-dos that live alongside the habits but
 * carry no discipline weight. Quick-add with Enter, tap the ring to complete
 * (same scroll-intent + undo-toast + toggle-back rules as habits), long-press a
 * row to delete. Unfinished tasks roll over quietly with a soft "since Tue"
 * tag — no red badges, no guilt copy.
 */
export default function TasksCard({ dayKey }) {
  const { state, addTask, toggleTask, deleteTask, restoreTask } = useStore()
  const toast = useToast()
  const { open, done } = useMemo(() => visibleTasks(state.tasks, dayKey), [state.tasks, dayKey])

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <div className="flex items-baseline justify-between mb-2.5">
        <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">Tasks</div>
        <div className="text-[11px] text-[var(--color-faint)]">{open.length ? `${open.length} to do` : 'all clear'}</div>
      </div>

      <QuickAdd dayKey={dayKey} onAdd={addTask} toast={toast} onDelete={deleteTask} />

      {(open.length > 0 || done.length > 0) && (
        <div className="mt-3 space-y-1">
          {open.map((t) => (
            <TaskRow key={t.id} task={t} dayKey={dayKey}
              onToggle={toggleTask} onDelete={deleteTask} onRestore={restoreTask} toast={toast} />
          ))}
          {done.map((t) => (
            <TaskRow key={t.id} task={t} dayKey={dayKey}
              onToggle={toggleTask} onDelete={deleteTask} onRestore={restoreTask} toast={toast} />
          ))}
        </div>
      )}
    </div>
  )
}

function QuickAdd({ dayKey, onAdd, toast }) {
  const [text, setText] = useState('')
  const [due, setDue] = useState(dayKey)
  const tomorrow = addDaysKey(dayKey, 1)

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
        <div className="flex items-center gap-1.5 mt-2 animate-fade">
          <DueChip label="Today" active={due === dayKey} onClick={() => setDue(dayKey)} />
          <DueChip label="Tomorrow" active={due === tomorrow} onClick={() => setDue(tomorrow)} />
          <label className={`text-[11px] rounded-full border px-2 py-1 cursor-pointer transition ${
            due !== dayKey && due !== tomorrow
              ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)]/50 text-[var(--color-accent-ink)]'
              : 'border-[var(--color-line-2)] text-[var(--color-muted)]'}`}>
            📅 {due !== dayKey && due !== tomorrow ? due.slice(5) : 'Pick'}
            <input type="date" value={due} min={dayKey}
              onChange={(e) => e.target.value && setDue(e.target.value)}
              className="sr-only" />
          </label>
        </div>
      )}
    </div>
  )
}

function DueChip({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={`text-[11px] rounded-full border px-2.5 py-1 transition ${
        active
          ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)]/50 text-[var(--color-accent-ink)]'
          : 'border-[var(--color-line-2)] text-[var(--color-muted)]'}`}>
      {label}
    </button>
  )
}

function TaskRow({ task, dayKey, onToggle, onDelete, onRestore, toast }) {
  const done = !!task.doneDay
  const since = carryOverLabel(task, dayKey)

  // Ring: tap to complete/clear, with the same scroll-intent guard as habits.
  const ring = useLongPress(() => {
    if (navigator.vibrate) navigator.vibrate(6)
    onToggle(task.id, dayKey)
    toast(`${done ? 'Reopened' : 'Done'} · ${task.text}`, () => onToggle(task.id, dayKey))
  })

  // Row body: long-press to delete (undoable). Not tappable otherwise.
  const remove = () => {
    if (navigator.vibrate) navigator.vibrate(15)
    onDelete(task.id)
    toast(`Deleted · ${task.text}`, () => onRestore(task))
  }
  const body = useLongPress(undefined, remove)

  return (
    <div className="flex items-center gap-3 py-1.5">
      <button
        {...ring}
        aria-label={`${done ? 'Reopen' : 'Complete'} ${task.text}`}
        className="no-callout shrink-0 min-w-[40px] min-h-[40px] grid place-items-center rounded-lg active:scale-90 transition -ml-1.5"
        style={{ touchAction: 'pan-y' }}
      >
        <TaskMarker done={done} />
      </button>

      <span
        {...body}
        className={`flex-1 min-w-0 select-none transition ${done ? 'opacity-45' : ''}`}
        style={{ touchAction: 'pan-y' }}
      >
        <span className={`block text-[15px] leading-snug truncate ${done ? 'line-through text-[var(--color-muted)]' : 'text-[var(--color-fg)]'}`}>
          {task.text}
        </span>
        {since && !done && (
          <span className="block text-[11px] text-[var(--color-faint)] mt-0.5">{since}</span>
        )}
      </span>
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
