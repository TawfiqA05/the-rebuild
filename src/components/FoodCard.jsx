import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { QuickAddInput } from './entryInput.jsx'
import FoodEntryList from './FoodEntryList.jsx'
import { foodForDay, frequentFoods, quickAddResetTarget } from '../lib/food.js'
import { addDaysKey } from '../lib/time.js'
import { useT } from '../i18n.jsx'

/**
 * The Food card on Today: a plain, awareness-only food log. Type + Enter to log
 * what you ate with an automatic timestamp, listed chronologically under quiet
 * time-of-day headers. Tap text to edit, tap a time to backdate, × to delete
 * (with undo) — the same controls apply to today's list AND the "Yesterday"
 * section. No numbers, no goals, no streaks. Collapsible, reopens each new day.
 */
export default function FoodCard({ dayKey }) {
  const { state, addFood, deleteFood, setFoodCollapsed } = useStore()
  const { t } = useT()
  const toast = useToast()

  const collapsed = state.settings.foodCollapsed
  const entries = useMemo(() => foodForDay(state.food, dayKey), [state.food, dayKey])
  // Pull more than we'll show at once — the expanded list scrolls if there are
  // more than a handful, so a long history never stacks up on screen.
  const suggestions = useMemo(() => frequentFoods(state.food, dayKey, { cap: 15 }), [state.food, dayKey])
  const [showSuggestions, setShowSuggestions] = useState(false)

  const pickSuggestion = (c) => {
    addFood(c)
    if (navigator.vibrate) navigator.vibrate(6)
    setShowSuggestions(false) // collapse again after a pick
  }

  const yesterday = addDaysKey(dayKey, -1)
  const yesterdayEntries = useMemo(() => foodForDay(state.food, yesterday), [state.food, yesterday])

  return (
    <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5" style={{ boxShadow: 'var(--shadow-card)' }}>
      <button
        onClick={() => setFoodCollapsed(!collapsed)}
        aria-expanded={!collapsed}
        className="w-full flex items-center justify-between"
      >
        <span className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">{t('food.title')}</span>
        <span className="flex items-center gap-2 text-[11px] text-[var(--color-faint)]">
          {entries.length > 0 && <span>{t('food.logged', { n: entries.length })}</span>}
          <span className="text-[13px] leading-none rtl:rotate-180">{collapsed ? '›' : '⌄'}</span>
        </span>
      </button>

      {!collapsed && (
        <div className="mt-2.5 animate-fade">
          <FoodQuickAdd
            dayKey={dayKey}
            onAdd={addFood}
            onYesterdayAdded={(e) => toast(t('food.addedYesterdayToast', { text: e.text }), () => deleteFood(e.id))}
          />

          {/* Suggestions — most frequent recent foods, tucked behind one quiet
              collapsed row. A long history used to wrap into a wall of chips that
              pushed the log down; now it opens a short, self-scrolling list, and
              picking one logs it and closes the list again. */}
          {suggestions.length > 0 && (
            <div data-testid="food-suggestions" className="mt-2.5">
              <button
                onClick={() => setShowSuggestions((v) => !v)}
                aria-expanded={showSuggestions}
                className="w-full flex items-center justify-between text-[12px] text-[var(--color-muted)]"
              >
                <span>{t('food.suggestions')}</span>
                <span className="text-[var(--color-faint)] text-[13px] leading-none rtl:rotate-180">{showSuggestions ? '⌄' : '›'}</span>
              </button>

              {showSuggestions && (
                <div
                  data-testid="food-suggestions-list"
                  className="mt-1.5 max-h-44 overflow-y-auto rounded-xl border border-[var(--color-line)] bg-[var(--color-surface-2)]/40 p-1 space-y-0.5 animate-fade"
                >
                  {suggestions.map((c) => (
                    <button
                      key={c}
                      onClick={() => pickSuggestion(c)}
                      className="no-callout w-full flex items-center gap-2 text-start text-[13px] text-[var(--color-muted)] hover:text-[var(--color-fg)] hover:bg-[var(--color-ink-2)] rounded-lg px-2.5 py-2 active:scale-[0.99] transition"
                    >
                      <span className="text-[var(--color-faint)] shrink-0" aria-hidden="true">+</span>
                      <span className="min-w-0 break-words">{c}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            <FoodEntryList dayKey={dayKey} emptyText={t('food.nothing')} />
          </div>

          {/* Yesterday — anything logged back a day, with the same edit/delete. */}
          {yesterdayEntries.length > 0 && (
            <div className="mt-4 pt-3 border-t border-[var(--color-line)]">
              <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)] mb-1.5">{t('food.yesterday')}</div>
              <FoodEntryList dayKey={yesterday} showBandLabels={false} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function FoodQuickAdd({ dayKey, onAdd, onYesterdayAdded }) {
  const { t } = useT()
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
        placeholder={toYesterday ? t('food.addYesterdayPlaceholder') : t('food.addPlaceholder')}
        ariaLabel={toYesterday ? t('food.addYesterdayPlaceholder') : t('food.addPlaceholder')} />
      {/* Quiet, unbadged one-shot toggle. Clearly labelled while active. */}
      <div className="mt-1.5 text-[11px]">
        {toYesterday ? (
          <span className="text-[var(--color-muted)]">
            {t('food.loggingYesterday')} ·{' '}
            <button onClick={() => setTarget('today')} className="underline decoration-dotted text-[var(--color-faint)]">{t('food.backToToday')}</button>
          </span>
        ) : (
          <button onClick={() => setTarget('yesterday')}
            className="text-[var(--color-faint)] hover:text-[var(--color-muted)] transition">
            {t('food.toggleYesterday')}
          </button>
        )}
      </div>
    </div>
  )
}
