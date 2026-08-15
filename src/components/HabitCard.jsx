import { useLongPress } from './useLongPress.js'
import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { nextOnTap, nextOnHold } from '../lib/gesture.js'
import { habitStatusOn, weekProgress, riskSignals } from '../lib/logic.js'

/**
 * The card body is not tappable. Only the marker on the right — a generous ~48px
 * zone — completes the habit, so you can scroll past a card without logging it.
 *   tap the marker   → full rep ✓ (cycles full → min → off)
 *   hold the marker  → minimum (2-minute) rep ◐
 * Both ignore the press if the finger was scrolling. Every completion drops a
 * 4-second "Undo" toast so an accident is one tap to reverse.
 */
export default function HabitCard({ habit, dayKey }) {
  const { state, setHabitStatus } = useStore()
  const toast = useToast()

  const status = habitStatusOn(state, habit, dayKey)
  const isWeekly = habit.frequency.kind === 'perWeek'
  const wp = isWeekly ? weekProgress(state, habit, dayKey) : null
  const risk = riskSignals(state, habit, dayKey)
  const done = status === 'full' || status === 'min'

  // Every change — including clearing one — drops an Undo toast, so a mistake in
  // either direction is one tap to reverse.
  const set = (next) => {
    const prev = status
    setHabitStatus(dayKey, habit.id, next)
    const label = next === 'full' ? 'full rep' : next === 'min' ? 'min rep' : 'cleared'
    toast(`${habit.name} · ${label}`, () => setHabitStatus(dayKey, habit.id, prev))
  }
  const onTap = () => set(nextOnTap(status))
  const onHold = () => set(nextOnHold(status))
  const press = useLongPress(onTap, onHold)

  const surface =
    status === 'full' ? 'border-[var(--color-accent)]/55 bg-[var(--color-accent-soft)]/60'
    : status === 'min' ? 'border-[var(--color-min)]/55 bg-[var(--color-min-soft)]/60'
    : risk.atRisk ? 'border-[var(--color-risk)]/45 bg-[var(--color-surface)]'
    : 'border-[var(--color-line)] bg-[var(--color-surface)]'

  return (
    <div
      className={`rounded-2xl border px-4 py-4 flex items-center gap-3.5 transition-[background-color,border-color] duration-300 ${surface}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <span className={`text-[26px] w-9 shrink-0 text-center ${done ? '' : 'opacity-90'}`}>{habit.emoji}</span>

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
                : 'Tap the ring · hold for the 2-minute version'}
        </span>
      </span>

      {/* The only tap target — a roomy pressable zone around the marker. */}
      <button
        {...press}
        aria-label={`Log ${habit.name}`}
        className="no-callout shrink-0 min-w-[48px] min-h-[48px] -mr-1.5 grid place-items-center rounded-xl active:scale-90 transition"
        style={{ touchAction: 'pan-y' }}
      >
        {isWeekly ? <WeekPips count={wp.count} target={wp.target} /> : <Marker status={status} />}
      </button>
    </div>
  )
}

/** Circular completion marker with a calm draw-in animation. */
function Marker({ status }) {
  const base = 'w-8 h-8 rounded-full grid place-items-center border transition-colors duration-300'
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
    <span className="flex items-center gap-1.5">
      {Array.from({ length: target }).map((_, i) => (
        <span key={i} className={`h-2 w-2 rounded-full transition-all duration-300 ${i < count ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line-2)]'}`} />
      ))}
      {met && <span className="text-[var(--color-accent-ink)] ml-0.5 text-sm animate-check">✓</span>}
    </span>
  )
}
