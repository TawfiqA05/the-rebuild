import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { QuickAddInput } from './entryInput.jsx'
import FoodEntryList from './FoodEntryList.jsx'
import { foodForDay, frequentFoods, quickAddResetTarget } from '../lib/food.js'
import { addDaysKey } from '../lib/time.js'

/**
 * The Food card on Today: a plain, awareness-only food log. Type + Enter to log
 * what you ate with an automatic timestamp, listed chronologically under quiet
 * time-of-day headers. Tap text to edit, tap a time to backdate, × to delete
 * (with undo) — the same controls apply to today's list AND the "Yesterday"
 * section. No numbers, no goals, no streaks. Collapsible, reopens each new day.
 */
export default function FoodCard({ dayKey }) {
  const { state, addFood, deleteFood, setFoodCollapsed } = useStore()
  const toast = useToast()

  const collapsed = state.settings.foodCollapsed
  const entries = useMemo(() => foodForDay(state.food, dayKey), [state.food, dayKey])
  const chips = useMemo(() => frequentFoods(state.food, dayKey), [state.food, dayKey])

  const yesterday = addDaysKey(dayKey, -1)
  const yesterdayEntries = useMemo(() => foodForDay(state.food, yesterday), [state.food, yesterday])

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <button
        onClick={() => setFoodCollapsed(!collapsed)}
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
          <FoodQuickAdd
            dayKey={dayKey}
            onAdd={addFood}
            onYesterdayAdded={(e) => toast(`Added to yesterday · ${e.text}`, () => deleteFood(e.id))}
          />

          {/* Quick re-add — most frequent recent entries, one tap logs now. */}
          {chips.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {chips.map((c) => (
                <button
                  key={c}
                  onClick={() => { addFood(c); if (navigator.vibrate) navigator.vibrate(6) }}
                  className="no-callout text-[12px] rounded-2xl border border-[var(--color-line-2)] text-[var(--color-muted)] px-2.5 py-1 max-w-full text-left break-words active:scale-95 transition"
                >
                  {c}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3">
            <FoodEntryList dayKey={dayKey} emptyText="Nothing logged." />
          </div>

          {/* Yesterday — anything logged back a day, with the same edit/delete. */}
          {yesterdayEntries.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)] mb-1.5">Yesterday</div>
              <FoodEntryList dayKey={yesterday} showBandLabels={false} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FoodQuickAdd({ dayKey, onAdd, onYesterdayAdded }) {
  const [text, setText] = useState('')
  const [target, setTarget] = useState('today') // 'today' | 'yesterday'
  const yesterday = addDaysKey(dayKey, -1)
  const toYesterday = target === 'yesterday'

  const submit = () => {
    const e = onAdd(text, toYesterday ? yesterday : dayKey)
    if (!e) return
    setText('')
    setTarget(quickAddResetTarget()) // one-shot: snap back to today
    if (navigator.vibrate) navigator.vibrate(6)
    if (toYesterday) onYesterdayAdded(e)
  }

  return (
    <div>
      <QuickAddInput value={text} onChange={setText} onSubmit={submit}
        placeholder={toYesterday ? 'What did you eat yesterday?' : 'What did you eat?'}
        ariaLabel={toYesterday ? 'Log food to yesterday' : 'Log food'} />
      {/* Quiet, unbadged one-shot toggle. Clearly labelled while active. */}
      <div className="mt-1.5 text-[11px]">
        {toYesterday ? (
          <span className="text-[var(--color-muted)]">
            logging to yesterday ·{' '}
            <button onClick={() => setTarget('today')} className="underline decoration-dotted text-[var(--color-faint)]">back to today</button>
          </span>
        ) : (
          <button onClick={() => setTarget('yesterday')}
            className="text-[var(--color-faint)] hover:text-[var(--color-muted)] transition">
            + add to yesterday
          </button>
        )}
      </div>
    </div>
  )
}
