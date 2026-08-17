import { useStore } from '../store.jsx'
import { fmtFullDate } from '../lib/time.js'
import { activeHabits, appearsOnDay, dayScore } from '../lib/logic.js'
import { foodForDay } from '../lib/food.js'
import HabitCard from './HabitCard.jsx'
import SalahCard from './SalahCard.jsx'
import FoodEntryList from './FoodEntryList.jsx'
import { useT } from '../i18n.jsx'

/**
 * A bottom-sheet for fixing a forgotten check-in on a past day. It reuses the
 * normal habit controls, just pointed at a different dayKey — so streaks, the
 * score, and never-miss-twice all recompute from the corrected history.
 */
export default function DayEditor({ dayKey, onClose }) {
  const { state } = useStore()
  const { t, language } = useT()
  // Show the habits scheduled that day PLUS any that already have a check-in
  // logged that day — even if since archived or off-schedule — so a past
  // completion can always be toggled back off, not just added.
  const scheduled = activeHabits(state).filter((h) => appearsOnDay(h, dayKey))
  const shownIds = new Set(scheduled.map((h) => h.id))
  const loggedExtra = state.habits.filter(
    (h) => h.type !== 'salah' && !shownIds.has(h.id) && state.logs[dayKey]?.[h.id],
  )
  const habits = [...scheduled, ...loggedExtra]
  const { done, total } = dayScore(state, dayKey)
  const hasFood = foodForDay(state.food, dayKey).length > 0

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--color-ink)] rounded-t-3xl border-t border-[var(--color-line)] max-h-[85dvh] flex flex-col animate-rise"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[var(--color-line)]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">{t('day.fixTitle')}</div>
            <div className="font-display text-2xl leading-tight">{fmtFullDate(dayKey, language)}</div>
          </div>
          <div className="text-end">
            <div className="text-sm tabular-nums text-[var(--color-muted)]">{done}/{total}</div>
            <button onClick={onClose} className="text-[13px] text-[var(--color-accent-ink)] mt-1">{t('common.done')}</button>
          </div>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-2.5">
          {habits.map((h) =>
            h.type === 'salah'
              ? <SalahCard key={h.id} dayKey={dayKey} />
              : <HabitCard key={h.id} habit={h} dayKey={dayKey} />,
          )}

          {/* Food — the same edit/time/delete controls as today, so a mistaken
              entry on this day can be fixed or removed here too. */}
          {hasFood && (
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)] mb-2">{t('day.food')}</div>
              <FoodEntryList dayKey={dayKey} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
