import { useState } from 'react'
import { useLongPress } from './useLongPress.js'
import { Marker } from './HabitCard.jsx'
import { useTutorial } from './Tutorial.jsx'
import { useT } from '../i18n.jsx'

/**
 * A throwaway habit card used only by the tutorial. It looks and feels like a
 * real HabitCard — tap the ring, hold for the 2-minute rep — but its state is
 * ENTIRELY LOCAL. It never calls a store action, so it leaves no votes, logs,
 * streaks, or backup trace; when the tutorial ends the card simply unmounts and
 * everything it touched is gone. Each step accepts only the gesture it's asking
 * for, so the card does exactly what the instruction says.
 */
export default function PracticeCard() {
  const { step, notifyGesture } = useTutorial()
  const { t } = useT()
  const [status, setStatus] = useState(null) // null | 'full' | 'min' — local only

  const onTap = () => {
    if (step === 0) { setStatus('full'); notifyGesture('full') }
    else if (step === 2) { setStatus(null); notifyGesture('clear') }
  }
  const onHold = () => {
    if (step === 1) { setStatus('min'); notifyGesture('min') }
  }
  const press = useLongPress(onTap, onHold)
  const done = status === 'full' || status === 'min'

  const surface =
    status === 'full' ? 'border-[var(--color-accent)]/55 bg-[var(--color-accent-soft)]/60'
    : status === 'min' ? 'border-[var(--color-min)]/55 bg-[var(--color-min-soft)]/60'
    : 'border-[var(--color-accent)]/40 bg-[var(--color-surface)]'

  return (
    <div
      data-testid="practice-card"
      className={`rounded-2xl border px-4 py-4 flex items-center gap-3.5 transition-[background-color,border-color] duration-300 ${surface}`}
      style={{ boxShadow: 'var(--shadow-card)' }}
    >
      <span className={`text-[26px] w-9 shrink-0 text-center ${done ? '' : 'opacity-90'}`}>⭐</span>

      <span className="flex-1 min-w-0">
        <span className="flex items-center gap-2">
          <span className="font-[500] text-[15.5px] break-words min-w-0">{t('tut.practiceName')}</span>
          <span className="text-[9px] uppercase tracking-wide text-[var(--color-accent-ink)] border border-[var(--color-accent)]/50 rounded px-1 py-px">
            {t('tut.badge')}
          </span>
        </span>
        <span className="block text-[12.5px] text-[var(--color-muted)] break-words mt-0.5">{t('tut.practiceHint')}</span>
      </span>

      <button
        {...press}
        aria-label={t('tut.practiceRing')}
        className="no-callout shrink-0 min-w-[48px] min-h-[48px] -mr-1.5 grid place-items-center rounded-xl active:scale-90 transition"
        style={{ touchAction: 'pan-y' }}
      >
        <Marker status={status} />
      </button>
    </div>
  )
}
