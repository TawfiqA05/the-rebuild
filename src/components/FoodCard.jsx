import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { useLongPress } from './useLongPress.js'
import { QuickAddInput, InlineEditText, useCommitOnOutside } from './entryInput.jsx'
import { foodForDay, groupFoodByBand, frequentFoods } from '../lib/food.js'

/**
 * The Food card on Today: a plain, awareness-only food log. Type + Enter to log
 * what you ate with an automatic timestamp; entries are listed chronologically
 * under quiet time-of-day headers you never pick yourself. Tap text to edit,
 * tap a time to backdate within the day, × to delete (with undo). No numbers,
 * no goals, no streaks — logging food never touches the score. Collapsible, and
 * it reopens itself each new day.
 */
export default function FoodCard({ dayKey }) {
  const { state, addFood, updateFood, setFoodTime, deleteFood, restoreFood, setFoodCollapsed } = useStore()
  const toast = useToast()

  // Collapsed state is remembered only for the current day; a new day reopens.
  const collapsed = state.settings.foodCollapsedDay === dayKey && state.settings.foodCollapsed

  const entries = useMemo(() => foodForDay(state.food, dayKey), [state.food, dayKey])
  const groups = useMemo(() => groupFoodByBand(entries), [entries])
  const chips = useMemo(() => frequentFoods(state.food, dayKey), [state.food, dayKey])

  const [editing, setEditing] = useState(null) // { id, mode: 'text' | 'time' }

  const renderEntry = (entry) =>
    editing?.id === entry.id && editing.mode === 'text' ? (
      <FoodTextEditor
        key={entry.id}
        entry={entry}
        onSave={(text) => { updateFood(entry.id, text); setEditing(null) }}
        onCancel={() => setEditing(null)}
      />
    ) : (
      <FoodRow
        key={entry.id}
        entry={entry}
        timeEditing={editing?.id === entry.id && editing.mode === 'time'}
        onEditText={(id) => setEditing({ id, mode: 'text' })}
        onEditTime={(id) => setEditing({ id, mode: 'time' })}
        onSetTime={(id, hhmm) => setFoodTime(id, hhmm)}
        onCloseTime={() => setEditing(null)}
        onDelete={deleteFood}
        onRestore={restoreFood}
        toast={toast}
      />
    )

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <button
        onClick={() => setFoodCollapsed(!collapsed, dayKey)}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between"
      >
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">Food</span>
        <span className="flex items-center gap-2 text-[11px] text-[var(--color-faint)]">
          {entries.length > 0 && <span>{entries.length} logged</span>}
          <span className="text-[13px] leading-none">{collapsed ? '›' : '⌄'}</span>
        </span>
      </button>

      {!collapsed && (
        <div className="mt-2.5 animate-fade">
          <FoodQuickAdd onAdd={addFood} />

          {/* Quick re-add — most frequent recent entries, one tap logs now. */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => { addFood(c); if (navigator.vibrate) navigator.vibrate(6) }}
                  className="no-callout text-[12px] rounded-full border border-[var(--color-line-2)] text-[var(--color-muted)] px-2.5 py-1 active:scale-95 transition"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          {entries.length === 0 ? (
            <div className="text-[12.5px] text-[var(--color-faint)] mt-3">Nothing logged.</div>
          ) : (
            <div className="mt-3 space-y-3">
              {groups.map((g) => (
                <div key={g.band + g.entries[0].id}>
                  <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)] mb-1">{g.label}</div>
                  <div className="space-y-0.5">{g.entries.map(renderEntry)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FoodQuickAdd({ onAdd }) {
  const [text, setText] = useState('')
  const submit = () => {
    const e = onAdd(text)
    if (!e) return
    setText('')
    if (navigator.vibrate) navigator.vibrate(6)
  }
  return (
    <QuickAddInput value={text} onChange={setText} onSubmit={submit}
      placeholder="What did you eat?" ariaLabel="Log food" />
  )
}

function FoodTextEditor({ entry, onSave, onCancel }) {
  const [text, setText] = useState(entry.text)
  const ref = useRef(null)
  const latest = useRef(text)
  latest.current = text
  const commit = () => {
    const t = latest.current.trim()
    if (!t) return onCancel() // empty cancels, never deletes
    onSave(t)
  }
  useCommitOnOutside(ref, commit)
  return (
    <div ref={ref} className="py-1">
      <InlineEditText value={text} onChange={setText} onCommit={commit} onCancel={onCancel} ariaLabel="Edit entry" />
    </div>
  )
}

function FoodRow({ entry, timeEditing, onEditText, onEditTime, onSetTime, onCloseTime, onDelete, onRestore, toast }) {
  const remove = () => {
    if (navigator.vibrate) navigator.vibrate(15)
    onDelete(entry.id)
    toast(`Deleted · ${entry.text}`, () => onRestore(entry))
  }
  // On the text body: tap edits, long-press deletes — same as tasks. `no-callout`
  // keeps the iOS selection magnifier from eating the long-press.
  const body = useLongPress(() => onEditText(entry.id), remove)

  return (
    <div className="no-callout flex items-center gap-3 py-1.5">
      {timeEditing ? (
        <input
          type="time"
          autoFocus
          value={toHHMM(entry.at)}
          onChange={(e) => e.target.value && onSetTime(entry.id, e.target.value)}
          onBlur={onCloseTime}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') onCloseTime() }}
          aria-label={`Adjust time for ${entry.text}`}
          className="shrink-0 rounded-md border border-[var(--color-line)] bg-[var(--color-ink-2)] px-1.5 py-1 text-[12px] tabular-nums text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]/60"
        />
      ) : (
        <button
          onClick={() => onEditTime(entry.id)}
          aria-label={`Adjust time for ${entry.text}`}
          className="no-callout shrink-0 w-12 text-left text-[12px] tabular-nums text-[var(--color-faint)] hover:text-[var(--color-muted)] transition"
        >
          {toClock(entry.at)}
        </button>
      )}

      <span
        {...body}
        className="no-callout flex-1 min-w-0"
        style={{ touchAction: 'pan-y' }}
      >
        <span className="block text-[15px] leading-snug truncate text-[var(--color-fg)]">{entry.text}</span>
      </span>

      <button
        onClick={remove}
        aria-label={`Delete ${entry.text}`}
        className="no-callout shrink-0 -mr-1 min-w-[36px] min-h-[36px] grid place-items-center rounded-lg text-lg leading-none text-[var(--color-faint)] hover:text-[var(--color-muted)] active:scale-90 transition"
      >
        ×
      </button>
    </div>
  )
}

// 24h "HH:MM" for the native time input.
function toHHMM(at) {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// A quiet 12h clock label like "7:42a" / "1:05p".
function toClock(at) {
  const d = new Date(at)
  const h = d.getHours()
  const h12 = ((h + 11) % 12) + 1
  return `${h12}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'a' : 'p'}`
}
