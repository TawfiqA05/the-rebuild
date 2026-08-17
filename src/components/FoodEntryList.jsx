import { useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { useLongPress } from './useLongPress.js'
import { InlineEditText, useCommitOnOutside } from './entryInput.jsx'
import { foodForDay, groupFoodByBand } from '../lib/food.js'
import { useT } from '../i18n.jsx'

/**
 * The interactive food list for a single day, grouped by time-of-day band.
 * Every entry gets the SAME controls no matter which day it's on: tap the time
 * to adjust it, tap the text to edit it, × (or long-press) to delete with an
 * undo toast. Used for today's list, the "Yesterday" section, and past days in
 * the day-detail sheet — so a food entry is editable and removable everywhere.
 */
export default function FoodEntryList({ dayKey, emptyText, showBandLabels = true }) {
  const { state, updateFood, setFoodTime, deleteFood, restoreFood } = useStore()
  const { t } = useT()
  const toast = useToast()
  const entries = useMemo(() => foodForDay(state.food, dayKey), [state.food, dayKey])
  const groups = useMemo(() => groupFoodByBand(entries), [entries])
  const [editing, setEditing] = useState(null) // { id, mode: 'text' | 'time' }

  if (entries.length === 0) {
    return emptyText ? <div className="text-[12.5px] text-[var(--color-faint)]">{emptyText}</div> : null
  }

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
    <div className="space-y-3">
      {groups.map((g) => (
        <div key={g.band + g.entries[0].id}>
          {showBandLabels && (
            <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)] mb-1">{t(`food.${g.band}`)}</div>
          )}
          <div className="space-y-0.5">{g.entries.map(renderEntry)}</div>
        </div>
      ))}
    </div>
  )
}

function FoodTextEditor({ entry, onSave, onCancel }) {
  const { t } = useT()
  const [text, setText] = useState(entry.text)
  const ref = useRef(null)
  const latest = useRef(text)
  latest.current = text
  const commit = () => {
    const clean = latest.current.trim()
    if (!clean) return onCancel() // empty cancels, never deletes
    onSave(clean)
  }
  useCommitOnOutside(ref, commit)
  return (
    <div ref={ref} className="py-1">
      <InlineEditText value={text} onChange={setText} onCommit={commit} onCancel={onCancel} ariaLabel={t('food.editAria')} />
    </div>
  )
}

function FoodRow({ entry, timeEditing, onEditText, onEditTime, onSetTime, onCloseTime, onDelete, onRestore, toast }) {
  const { t } = useT()
  const timeAria = t('food.editAria')
  const remove = () => {
    if (navigator.vibrate) navigator.vibrate(15)
    onDelete(entry.id)
    toast(t('food.deletedToast', { text: entry.text }), () => onRestore(entry))
  }
  // Tap the text to edit, long-press to delete — same as tasks.
  const body = useLongPress(() => onEditText(entry.id), remove)

  return (
    <div className="no-callout flex items-start gap-3 py-1.5">
      {timeEditing ? (
        <input
          type="time"
          autoFocus
          value={toHHMM(entry.at)}
          onChange={(e) => e.target.value && onSetTime(entry.id, e.target.value)}
          onBlur={onCloseTime}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') onCloseTime() }}
          aria-label={timeAria}
          className="shrink-0 rounded-md border border-[var(--color-line)] bg-[var(--color-ink-2)] px-1.5 py-1 text-[12px] tabular-nums text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]/60"
        />
      ) : (
        <button
          onClick={() => onEditTime(entry.id)}
          aria-label={timeAria}
          className="no-callout shrink-0 w-12 pt-0.5 text-start text-[12px] leading-snug tabular-nums text-[var(--color-faint)] hover:text-[var(--color-muted)] transition"
        >
          {toClock(entry.at)}
        </button>
      )}

      <span {...body} className="no-callout flex-1 min-w-0" style={{ touchAction: 'pan-y' }}>
        <span className="block text-[15px] leading-snug break-words text-[var(--color-fg)]">{entry.text}</span>
      </span>

      <button
        onClick={remove}
        aria-label={t('food.deletedToast', { text: entry.text })}
        className="no-callout shrink-0 -me-1 min-w-[36px] min-h-[26px] flex items-start justify-center pt-0.5 rounded-lg text-lg leading-none text-[var(--color-faint)] hover:text-[var(--color-muted)] active:scale-90 transition"
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
  return `${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'a' : 'p'}`
}
