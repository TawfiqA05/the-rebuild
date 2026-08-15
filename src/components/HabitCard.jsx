import { useState } from 'react'
import { useLongPress } from './useLongPress.js'
import { useStore } from '../store.jsx'
import { habitStatusOn, weekProgress, riskSignals } from '../lib/logic.js'

/**
 * A single large tap target.
 *   tap            → full rep ✓
 *   long-press     → minimum (2-minute) rep ◐
 *   tap again      → cycles off
 * perWeek habits show week progress (e.g. 2/3) and never nag daily.
 */
export default function HabitCard({ habit, dayKey }) {
  const { state, toggleHabit } = useStore()
  const [pop, setPop] = useState(false)

  const status = habitStatusOn(state, habit, dayKey)
  const isWeekly = habit.frequency.kind === 'perWeek'
  const wp = isWeekly ? weekProgress(state, habit, dayKey) : null
  const risk = riskSignals(state, habit, dayKey)

  const bump = () => { setPop(true); setTimeout(() => setPop(false), 260) }

  const press = useLongPress(
    () => { toggleHabit(dayKey, habit.id); bump() },              // tap → cycle full/off
    () => { toggleHabit(dayKey, habit.id, 'min'); bump() },       // long-press → min
  )

  // Visual state
  const done = status === 'full' || status === 'min'
  const ring =
    status === 'full' ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/40'
    : status === 'min' ? 'border-[var(--color-min)] bg-[var(--color-min-soft)]/40'
    : risk.atRisk ? 'border-[var(--color-risk)]/60'
    : 'border-[var(--color-line)]'

  const mark =
    status === 'full' ? <span className="text-[var(--color-accent)] text-2xl">✓</span>
    : status === 'min' ? <span className="text-[var(--color-min)] text-2xl">◐</span>
    : <span className="text-[var(--color-faint)] text-xl">○</span>

  return (
    <button
      {...press}
      className={`no-callout w-full text-left rounded-2xl border px-4 py-3.5 flex items-center gap-3
        transition-colors active:scale-[0.99] ${ring} ${pop ? 'animate-pop' : ''}`}
    >
      <span className="text-2xl w-8 shrink-0 text-center">{habit.emoji}</span>
      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className={`font-medium truncate ${done ? '' : 'text-[var(--color-fg)]'}`}>
            {habit.name}
          </span>
          {habit.optional && (
            <span className="text-[10px] uppercase tracking-wide text-[var(--color-faint)] border border-[var(--color-line)] rounded px-1 py-px">
              optional
            </span>
          )}
        </span>
        <span className="block text-xs text-[var(--color-muted)] truncate">
          {status === 'min'
            ? `Min rep · ${habit.minVersion}`
            : isWeekly
              ? `${wp.count}/${wp.target} this week`
              : risk.atRisk
                ? 'Missed yesterday — lock it in today'
                : `Hold for 2-min version`}
        </span>
      </span>

      {isWeekly ? (
        <WeekPips count={wp.count} target={wp.target} done={done} />
      ) : (
        <span className="w-8 h-8 shrink-0 grid place-items-center">{mark}</span>
      )}
    </button>
  )
}

function WeekPips({ count, target, done }) {
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      {Array.from({ length: target }).map((_, i) => (
        <span
          key={i}
          className={`w-2.5 h-2.5 rounded-full ${
            i < count ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'
          }`}
        />
      ))}
      {done && count >= target && <span className="text-[var(--color-accent)] ml-0.5">✓</span>}
    </span>
  )
}
