import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { useLongPress } from './useLongPress.js'
import { QuickAddInput, InlineEditText, useCommitOnOutside } from './entryInput.jsx'
import { visibleTasks, carryOverLabel, upcomingTasks, groupByDueDay } from '../lib/tasks.js'
import { addDaysKey, fmtFullDate } from '../lib/time.js'
import { useT } from '../i18n.jsx'

/**
 * The Tasks card on Today: one-off to-dos that live alongside the habits but
 * carry no discipline weight. Quick-add with Enter, tap the ring to complete
 * (same scroll-intent + undo-toast + toggle-back rules as habits), tap a task's
 * text to edit it, long-press or the × to delete. Unfinished tasks roll over
 * quietly with a soft "since Tue" tag; future-dated tasks wait in a collapsed
 * "Upcoming" list. No badges, no red, no guilt copy.
 */
export default function TasksCard({ dayKey }) {
  const { state, addTask, toggleTask, deleteTask, restoreTask, updateTask, setTasksCollapsed } = useStore()
  const { t, language } = useT()
  const toast = useToast()
  const collapsed = state.settings.tasksCollapsed
  const { open, done } = useMemo(() => visibleTasks(state.tasks, dayKey), [state.tasks, dayKey])
  const upcoming = useMemo(() => upcomingTasks(state.tasks, dayKey), [state.tasks, dayKey])

  const [editingId, setEditingId] = useState(null)
  const [showUpcoming, setShowUpcoming] = useState(false)
  // Upcoming starts collapsed every day — reset whenever the logical day turns.
  useEffect(() => { setShowUpcoming(false) }, [dayKey])

  const moveToday = (task) => {
    updateTask(task.id, { dueDay: dayKey })
    toast(t('tasks.movedToast', { text: task.text }), () => updateTask(task.id, { dueDay: task.dueDay }))
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
      <button
        onClick={() => setTasksCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between"
      >
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">{t('tasks.title')}</span>
        <span className="flex items-center gap-2 text-[11px] text-[var(--color-faint)]">
          <span>{open.length ? t('tasks.toDo', { n: open.length }) : t('tasks.allClear')}</span>
          <span className="text-[13px] leading-none rtl:rotate-180">{collapsed ? '›' : '⌄'}</span>
        </span>
      </button>

      {!collapsed && (<>
      <div className="mt-2.5">
      <QuickAdd dayKey={dayKey} onAdd={addTask} />
      </div>

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
            <span>{t('tasks.upcoming', { n: upcoming.length })}</span>
            <span className="text-[var(--color-faint)] text-[13px] leading-none rtl:rotate-180">{showUpcoming ? '⌄' : '›'}</span>
          </button>

          {showUpcoming && (
            <div className="mt-2 space-y-3 animate-fade">
              {groupByDueDay(upcoming).map((g) => (
                <div key={g.dueDay}>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)] mb-1">
                    {groupLabel(t, language, g.dueDay, dayKey)}
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
      </>)}
    </div>
  )
}

function groupLabel(t, language, dueDay, dayKey) {
  if (dueDay === addDaysKey(dayKey, 1)) return t('tasks.tomorrow')
  return fmtFullDate(dueDay, language)
}

function QuickAdd({ dayKey, onAdd }) {
  const { t } = useT()
  const [text, setText] = useState('')
  const [due, setDue] = useState(dayKey)

  const submit = () => {
    const added = onAdd({ text, dueDay: due })
    if (!added) return
    setText('')
    setDue(dayKey) // reset the due-day back to today for the next one
    if (navigator.vibrate) navigator.vibrate(6)
  }

  return (
    <QuickAddInput value={text} onChange={setText} onSubmit={submit}
      placeholder={t('tasks.addPlaceholder')} ariaLabel={t('tasks.addPlaceholder')}>
      {/* Due-day control — quiet, only shown while composing. Default is today. */}
      <DueControl due={due} setDue={setDue} dayKey={dayKey} />
    </QuickAddInput>
  )
}

/** Shared Today / Tomorrow / pick-a-date control, used by quick-add and editing. */
function DueControl({ due, setDue, dayKey }) {
  const { t } = useT()
  const tomorrow = addDaysKey(dayKey, 1)
  const custom = due !== dayKey && due !== tomorrow
  // Keep focus on whatever field owns it (the editor's text input) when a chip
  // is tapped, so tapping a chip doesn't blur-commit the editor.
  const keepFocus = (e) => e.preventDefault()
  return (
    <div className="flex items-center gap-1.5">
      <DueChip label={t('tasks.today')} active={due === dayKey} onDown={keepFocus} onClick={() => setDue(dayKey)} />
      <DueChip label={t('tasks.tomorrow')} active={due === tomorrow} onDown={keepFocus} onClick={() => setDue(tomorrow)} />
      <label
        className={`text-[11px] rounded-full border px-2 py-1 cursor-pointer transition ${
          custom
            ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent-soft)]/50 text-[var(--color-accent-ink)]'
            : 'border-[var(--color-line-2)] text-[var(--color-muted)]'}`}>
        📅 {custom ? due.slice(5) : t('tasks.pick')}
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
  const { t } = useT()
  const [text, setText] = useState(task.text)
  const [due, setDue] = useState(task.dueDay)
  const ref = useRef(null)
  // Read the latest values from the outside-tap handler without re-binding it.
  const latest = useRef({ text, due })
  latest.current = { text, due }

  const commit = () => {
    const clean = latest.current.text.trim()
    if (!clean) return onCancel()            // empty cancels, never deletes
    onSave({ text: clean, dueDay: latest.current.due })
  }
  useCommitOnOutside(ref, commit) // tapping away saves

  return (
    <div ref={ref} className="py-1.5">
      <InlineEditText value={text} onChange={setText} onCommit={commit} onCancel={onCancel} ariaLabel={t('tasks.editAria')} />
      <div className="mt-2">
        <DueControl due={due} setDue={setDue} dayKey={dayKey} />
      </div>
    </div>
  )
}

function TaskRow({ task, dayKey, variant, onEdit, onToggle, onDelete, onRestore, onMoveToday, toast }) {
  const { t } = useT()
  const done = !!task.doneDay
  const upcoming = variant === 'upcoming'
  const canEdit = !done
  const since = carryOverLabel(task, dayKey)

  // Ring: tap to complete/clear (today rows only), same scroll-intent as habits.
  const ring = useLongPress(() => {
    if (navigator.vibrate) navigator.vibrate(6)
    onToggle(task.id, dayKey)
    toast(t(done ? 'tasks.reopenedToast' : 'tasks.doneToast', { text: task.text }), () => onToggle(task.id, dayKey))
  })

  // Delete — the visible × is the obvious path; long-press stays as a shortcut.
  const remove = () => {
    if (navigator.vibrate) navigator.vibrate(15)
    onDelete(task.id)
    toast(t('tasks.deletedToast', { text: task.text }), () => onRestore(task))
  }
  // On the text body: tap edits (open/upcoming only), long-press deletes. The
  // gesture helper keeps tap / long-press / scroll apart, and `no-callout`
  // kills the iOS selection magnifier that would otherwise eat the long-press.
  const body = useLongPress(canEdit ? () => onEdit(task.id) : undefined, remove)

  return (
    // items-start: on a wrapped multi-line row the ring / × / move stay pinned to
    // the first line instead of floating in the vertical centre of a tall row.
    <div className="no-callout flex items-start gap-3 py-1.5">
      {upcoming ? (
        <span className="shrink-0 w-[40px] -ms-1.5 flex items-start justify-center text-[var(--color-line-2)]" aria-hidden="true">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-line-2)] mt-2" />
        </span>
      ) : (
        <button
          {...ring}
          aria-label={`${done ? t('tasks.reopen') : t('tasks.complete')} ${task.text}`}
          className="no-callout shrink-0 min-w-[40px] flex items-start justify-center rounded-lg active:scale-90 transition -ms-1.5"
          style={{ touchAction: 'pan-y' }}
        >
          {/* nudge up so the 32px marker centres on the ~20px first line */}
          <span className="-mt-1.5"><TaskMarker done={done} /></span>
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
        <span className={`block text-[15px] leading-snug break-words ${done ? 'line-through text-[var(--color-muted)]' : 'text-[var(--color-fg)]'}`}>
          {task.text}
        </span>
        {since && !done && (
          <span className="block text-[11px] text-[var(--color-faint)] mt-0.5">{since}</span>
        )}
      </span>

      {upcoming && onMoveToday && (
        <button
          onClick={() => onMoveToday(task)}
          aria-label={t('tasks.moveToday')}
          className="no-callout shrink-0 mt-0.5 text-[11px] text-[var(--color-muted)] hover:text-[var(--color-accent-ink)] border border-[var(--color-line-2)] rounded-full px-2 py-1 active:scale-95 transition"
        >
          <span className="rtl:hidden">→ {t('tasks.today')}</span>
          <span className="hidden rtl:inline">{t('tasks.today')} ←</span>
        </button>
      )}

      {/* Visible, always-on delete affordance — quiet muted ×, no red, no trash. */}
      <button
        onClick={remove}
        aria-label={t('tasks.deletedToast', { text: task.text })}
        className="no-callout shrink-0 -me-1 min-w-[36px] min-h-[26px] flex items-start justify-center pt-0.5 rounded-lg text-lg leading-none text-[var(--color-faint)] hover:text-[var(--color-muted)] active:scale-90 transition"
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
      <span key="done" className={`${base} border-transparent bg-[var(--color-accent)] text-[var(--color-on-accent)] animate-check`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 L9 17 L4 12" />
        </svg>
      </span>
    )
  }
  return <span className={`${base} border-[var(--color-line-2)]`}><span className="w-1.5 h-1.5 rounded-full bg-[var(--color-line-2)]" /></span>
}
