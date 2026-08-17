import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Button } from './ui.jsx'

// Four one-sentence steps, in the app's voice. Shown once, on the real Today
// screen, right after onboarding. Skippable at any point.
const STEPS = [
  'Tap a habit’s ring to log it.',
  'Rough day? Hold the ring for the 2-minute version. It still counts.',
  'Your score is today’s reps. Miss a day, that’s fine. Just don’t miss twice.',
  'Stats and Wind down are in the bar at the bottom.',
]

export default function Tour() {
  const { setTourSeen } = useStore()
  const [step, setStep] = useState(0)
  const last = step === STEPS.length - 1
  const done = () => setTourSeen(true)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={done}>
      <div
        className="relative w-full max-w-md m-4 mb-24 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 animate-rise"
        style={{ boxShadow: 'var(--shadow-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-1.5 mb-3">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'}`} />
          ))}
        </div>
        <p className="text-[15.5px] leading-relaxed text-[var(--color-fg)]">{STEPS[step]}</p>
        <div className="flex items-center justify-between mt-4">
          <button onClick={done} className="text-[13px] text-[var(--color-faint)]">Skip</button>
          <Button variant="primary" onClick={() => (last ? done() : setStep(step + 1))}>
            {last ? 'Got it' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
