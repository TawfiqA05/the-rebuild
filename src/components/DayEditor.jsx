import { useStore } from '../store.jsx'
import { prettyDate } from '../lib/time.js'
import { activeHabits, appearsOnDay, dayScore } from '../lib/logic.js'
import { foodForDay, groupFoodByBand } from '../lib/food.js'
import HabitCard from './HabitCard.jsx'
import SalahCard from './SalahCard.jsx'

/**
 * A bottom-sheet for fixing a forgotten check-in on a past day. It reuses the
 * normal habit controls, just pointed at a different dayKey — so streaks, the
 * score, and never-miss-twice all recompute from the corrected history.
 */
export default function DayEditor({ dayKey, onClose }) {
  const { state } = useStore()
  const habits = activeHabits(state).filter((h) => appearsOnDay(h, dayKey))
  const { done, total } = dayScore(state, dayKey)
  const foodGroups = groupFoodByBand(foodForDay(state.food, dayKey))

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--color-ink)] rounded-t-3xl border-t border-[var(--color-line)] max-h-[85dvh] flex flex-col animate-rise"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[var(--color-line)]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">Fix a past day</div>
            <div className="font-display text-2xl leading-tight">{prettyDate(dayKey)}</div>
          </div>
          <div className="text-right">
            <div className="text-sm tabular-nums text-[var(--color-muted)]">{done}/{total}</div>
            <button onClick={onClose} className="text-[13px] text-[var(--color-accent-ink)] mt-1">Done</button>
          </div>
        </div>
        <div className="px-5 py-4 overflow-y-auto space-y-2.5">
          {habits.map((h) =>
            h.type === 'salah'
              ? <SalahCard key={h.id} dayKey={dayKey} />
              : <HabitCard key={h.id} habit={h} dayKey={dayKey} />,
          )}

          {/* Food is read-only history here — just the list with times. */}
          {foodGroups.length > 0 && (
            <div className="rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5">
              <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)] mb-2">Food</div>
              <div className="space-y-3">
                {foodGroups.map((g) => (
                  <div key={g.band + g.entries[0].id}>
                    <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)] mb-1">{g.label}</div>
                    <div className="space-y-0.5">
                      {g.entries.map((e) => (
                        <div key={e.id} className="flex items-baseline gap-3 py-0.5">
                          <span className="shrink-0 w-12 text-[12px] tabular-nums text-[var(--color-faint)]">{clock(e.at)}</span>
                          <span className="flex-1 text-[15px] leading-snug text-[var(--color-fg)]">{e.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Quiet 12h label like "7:42a" — matches the Food card's read-only history.
function clock(at) {
  const d = new Date(at)
  const h = d.getHours()
  return `${((h + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, '0')}${h < 12 ? 'a' : 'p'}`
}
