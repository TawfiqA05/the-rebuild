import { useState } from 'react'
import { useStore } from '../store.jsx'
import { phaseMeta } from '../lib/seed.js'
import { Screen, Card, SectionLabel, Button, ProgressBar } from '../components/ui.jsx'
import Heatmap from '../components/Heatmap.jsx'
import {
  activeHabits, habitStats, phaseProgress, shouldSuggestUnlock,
} from '../lib/logic.js'

export default function Stats({ navigate }) {
  const { state, today, unlockNextPhase, dismissUnlock } = useStore()
  const phase = phaseMeta(state.settings.currentPhase)
  const pp = phaseProgress(state, state.settings.currentPhase, today)
  const suggest = shouldSuggestUnlock(state, today)
  const habits = activeHabits(state)

  return (
    <Screen
      title="Stats"
      subtitle="Measured in months, not 21-day sprints."
      right={<Button variant="ghost" onClick={() => navigate('weekly')}>Weekly review →</Button>}
    >
      {/* Votes — the number that only goes up ------------------------------ */}
      <Card className="px-4 py-7 text-center">
        <div className="font-display text-[3.5rem] leading-none tnum text-[var(--color-accent)]">
          {state.votes.toLocaleString()}
        </div>
        <div className="text-[13px] font-medium mt-2">votes for who I’m becoming</div>
        <div className="text-xs text-[var(--color-muted)] mt-1">
          Every completion, ever. This number only goes up.
        </div>
      </Card>

      {/* Phase progress ---------------------------------------------------- */}
      <SectionLabel>Phase {phase.n} · {phase.name}</SectionLabel>
      <Card className="px-4 py-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm text-[var(--color-muted)]">Trailing 21 days</span>
          <span className="text-lg font-semibold tabular-nums">{pp.pct}%</span>
        </div>
        <ProgressBar pct={pp.pct} threshold={80} />
        <div className="flex justify-between text-[11px] text-[var(--color-faint)] mt-1.5">
          <span>automaticity</span>
          <span>80% = ready to unlock</span>
        </div>

        {suggest ? (
          <div className="mt-4 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)]/30 px-3 py-3">
            <div className="text-sm font-medium">Phase {phase.n} feels automatic.</div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5 mb-3">
              You’re past 80% for three weeks. Unlock the next phase when you’re ready — no rush.
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={unlockNextPhase} className="flex-1">
                Unlock Phase {phase.n + 1}
              </Button>
              <Button variant="ghost" onClick={() => dismissUnlock(phase.n)}>Not yet</Button>
            </div>
          </div>
        ) : (
          state.settings.currentPhase < 5 && (
            <div className="text-xs text-[var(--color-faint)] mt-3">
              Keep the current phase above 80% for 21 days and the next one unlocks.
            </div>
          )
        )}
      </Card>

      {/* Per-habit ---------------------------------------------------------- */}
      <SectionLabel>Habits</SectionLabel>
      <div className="space-y-2.5">
        {habits.map((h) => <HabitStatRow key={h.id} habit={h} />)}
      </div>
    </Screen>
  )
}

function HabitStatRow({ habit }) {
  const { state, today } = useStore()
  const s = habitStats(state, habit, today)
  const [open, setOpen] = useState(false)

  return (
    <Card className="px-4 py-3.5">
      <button className="w-full text-left" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3">
          <span className="text-xl w-7 text-center">{habit.emoji}</span>
          <span className="flex-1 font-medium truncate">{habit.name}</span>
          <span className="text-sm tabular-nums">
            <span className="text-[var(--color-accent)]">🔥{s.current}</span>
          </span>
        </div>
        <div className="flex gap-4 text-[11px] text-[var(--color-muted)] mt-2 pl-10">
          <span>best <b className="text-[var(--color-fg)]">{s.longest}</b></span>
          <span>lifetime <b className="text-[var(--color-fg)]">{s.lifetime}</b></span>
          <span>30d <b className="text-[var(--color-fg)]">{s.pct30}%</b></span>
          {s.missedTwice && <span className="text-[var(--color-risk)]">missed twice</span>}
        </div>
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-[var(--color-line)] animate-fade">
          <Heatmap habit={habit} />
          <div className="flex gap-3 text-[10px] text-[var(--color-faint)] mt-2">
            <Legend cls="bg-[var(--color-accent)]" label="full" />
            <Legend cls="bg-[var(--color-accent)]/45" label="min" />
            <Legend cls="bg-[var(--color-surface-2)] ring-1 ring-inset ring-[var(--color-line-2)]/60" label="missed" />
          </div>
        </div>
      )}
    </Card>
  )
}

function Legend({ cls, label }) {
  return (
    <span className="flex items-center gap-1">
      <span className={`w-2.5 h-2.5 rounded-[3px] ${cls}`} />{label}
    </span>
  )
}
