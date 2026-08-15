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
 *
 * Completion is quiet and satisfying: the card fills with a whisper of gold and
 * the marker draws in. No confetti.
 */
export default function HabitCard({ habit, dayKey }) {
  const { state, toggleHabit } = useStore()
  const [pressed, setPressed] = useState(false)

  const status = habitStatusOn(state, habit, dayKey)
  const isWeekly = habit.frequency.kind === 'perWeek'
  const wp = isWeekly ? weekProgress(state, habit, dayKey) : null
  const risk = riskSignals(state, habit, dayKey)
  const done = status === 'full' || status === 'min'

  const press = useLongPress(
    () => toggleHabit(dayKey, habit.id),           // tap → cycle full/off
    () => toggleHabit(dayKey, habit.id, 'min'),    // long-press → min
  )

  const surface =
    status === 'full' ? 'border-[var(--color-accent)]/55 bg-[var(--color-accent-soft)]/60'
    : status === 'min' ? 'border-[var(--color-min)]/55 bg-[var(--color-min-soft)]/60'
    : risk.atRisk ? 'border-[var(--color-risk)]/45 bg-[var(--color-surface)]'
    : 'border-[var(--color-line)] bg-[var(--color-surface)]'

  return (
    <button
      {...press}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      className={`no-callout w-full text-left rounded-2xl border px-4 py-4 flex items-center gap-3.5
        transition-[background-color,border-color,transform] duration-300 ${surface}
        ${pressed ? 'scale-[0.985]' : 'scale-100'}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <span className={`text-[26px] w-9 shrink-0 text-center transition-opacity duration-300 ${done ? '' : 'opacity-90'}`}>
        {habit.emoji}
      </span>

      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-[500] text-[15.5px] truncate">{habit.name}</span>
          {habit.optional && (
            <span className="text-[9px] uppercase tracking-wide text-[var(--color-faint)] border border-[var(--color-line-2)] rounded px-1 py-px">
              optional
            </span>
          )}
        </span>
        <span className="block text-[12.5px] text-[var(--color-muted)] truncate mt-0.5">
          {status === 'min'
            ? `Min rep · ${habit.minVersion}`
            : isWeekly
              ? `${wp.count} of ${wp.target} this week`
              : risk.atRisk
                ? 'Missed yesterday — lock it in today'
                : 'Hold for the 2-minute version'}
        </span>
      </span>

      {isWeekly
        ? <WeekPips count={wp.count} target={wp.target} />
        : <Marker status={status} />}
    </button>
  )
}

/** Circular completion marker with a calm draw-in animation. */
function Marker({ status }) {
  const base = 'w-8 h-8 shrink-0 rounded-full grid place-items-center border transition-colors duration-300'
  if (status === 'full') {
    return (
      <span key="full" className={`${base} border-transparent bg-[var(--color-accent)] text-[#231a09] animate-check`}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 6 L9 17 L4 12" />
        </svg>
      </span>
    )
  }
  if (status === 'min') {
    return (
      <span key="min" className={`${base} border-[var(--color-min)] text-[var(--color-min)] animate-check`}>
        <span className="text-[15px] leading-none">◐</span>
      </span>
    )
  }
  return <span className={`${base} border-[var(--color-line-2)] text-[var(--color-faint)]`}><span className="w-2 h-2 rounded-full bg-[var(--color-line-2)]" /></span>
}

function WeekPips({ count, target }) {
  const met = count >= target
  return (
    <span className="flex items-center gap-1.5 shrink-0">
      {Array.from({ length: target }).map((_, i) => (
        <span
          key={i}
          className={`h-2 rounded-full transition-all duration-300 ${
            i < count ? 'w-2 bg-[var(--color-accent)]' : 'w-2 bg-[var(--color-line-2)]'
          }`}
        />
      ))}
      {met && <span className="text-[var(--color-accent)] ml-0.5 text-sm animate-check">✓</span>}
    </span>
  )
}
