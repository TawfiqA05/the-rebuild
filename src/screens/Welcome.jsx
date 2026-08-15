import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Button } from '../components/ui.jsx'

/**
 * Shown only on a brand-new install (settings.onboarded === false). Two steps:
 * a short pitch, then pick which Phase 1 anchors to start with. Whatever you
 * turn off is archived, not deleted, so it's easy to add back later. Existing
 * devices never reach here — migrate() marks them onboarded.
 */
export default function Welcome() {
  const { state, finishOnboarding } = useStore()
  const [step, setStep] = useState(0)

  const phase1 = state.habits.filter((h) => h.phase === 1)
  const [chosen, setChosen] = useState(() => new Set(phase1.map((h) => h.id)))
  const toggle = (id) => setChosen((s) => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const start = () => finishOnboarding([...chosen])

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-16 pb-10 max-w-md mx-auto animate-rise">
      {step === 0 ? (
        <div className="flex-1 flex flex-col">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-ink)] mb-3">The Rebuild</div>
          <h1 className="font-display text-[2.6rem] leading-[1.05]">
            Build the person you’re becoming, one rep at a time.
          </h1>
          <p className="text-[15px] text-[var(--color-muted)] mt-5 leading-relaxed">
            It’s a habit tracker with one rule that matters: never miss twice. Miss a day,
            fine. Just don’t miss the next one. Every habit has a two-minute version, so on a
            bad day you shrink it instead of skipping it.
          </p>
          <p className="text-[15px] text-[var(--color-muted)] mt-3 leading-relaxed">
            Add one-off tasks alongside your habits, and jot down what you eat — both sit off to the
            side and never affect your streaks.
          </p>
          <p className="text-[15px] text-[var(--color-muted)] mt-3 leading-relaxed">
            Everything stays on your device. No account, nothing to sign up for.
          </p>
          <div className="flex-1" />
          <Button variant="primary" className="w-full mt-8 py-3.5" onClick={() => setStep(1)}>
            Get started
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex flex-col">
          <h1 className="font-display text-[2rem] leading-tight">Pick your anchors</h1>
          <p className="text-[14px] text-[var(--color-muted)] mt-2 leading-relaxed">
            These are the Phase 1 defaults. Keep them, or switch off what doesn’t fit — you
            can add your own later in Settings.
          </p>

          <div className="mt-6 space-y-2.5">
            {phase1.map((h) => {
              const on = chosen.has(h.id)
              return (
                <button
                  key={h.id}
                  onClick={() => toggle(h.id)}
                  className={`w-full rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-left transition ${
                    on ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/50' : 'border-[var(--color-line)] bg-[var(--color-surface)]'
                  }`}
                >
                  <span className="text-2xl w-8 text-center">{h.emoji}</span>
                  <span className="flex-1 font-medium text-[15px]">{h.name}</span>
                  <span className={`w-6 h-6 rounded-full grid place-items-center border ${
                    on ? 'bg-[var(--color-accent)] border-transparent text-[#231a09]' : 'border-[var(--color-line-2)] text-transparent'
                  }`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 L9 17 L4 12" /></svg>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex-1" />
          <Button
            variant="primary"
            className="w-full mt-8 py-3.5"
            onClick={start}
          >
            {chosen.size === 0 ? 'Start with a clean slate' : `Start with ${chosen.size} ${chosen.size === 1 ? 'anchor' : 'anchors'}`}
          </Button>
          <button onClick={() => setStep(0)} className="text-[13px] text-[var(--color-faint)] mt-4">Back</button>
        </div>
      )}
    </div>
  )
}
