import { useState } from 'react'
import { useStore } from '../store.jsx'
import { phaseMeta } from '../lib/seed.js'
import { Screen, Card, SectionLabel, Button, ProgressBar } from '../components/ui.jsx'
import Heatmap from '../components/Heatmap.jsx'
import WinsCard from '../components/WinsCard.jsx'
import DayEditor from '../components/DayEditor.jsx'
import { lastNKeys } from '../lib/time.js'
import {
  activeHabits, habitStats, phaseProgress, shouldSuggestUnlock,
} from '../lib/logic.js'
import { weekdayInsight, overallWeekday, WEEKDAY_NAMES, WEEKDAY_SHORT } from '../lib/insights.js'
import { completedTaskCount } from '../lib/tasks.js'

export default function Stats({ navigate }) {
  const { state, today, unlockNextPhase, dismissUnlock } = useStore()
  const phase = phaseMeta(state.settings.currentPhase)
  const pp = phaseProgress(state, state.settings.currentPhase, today)
  const suggest = shouldSuggestUnlock(state, today)
  const habits = activeHabits(state)
  const [editDay, setEditDay] = useState(null)
  const recentDays = lastNKeys(today, 14).reverse() // most recent first
  const overall = overallWeekday(state, today)

  return (
    <Screen
      title="Stats"
      subtitle="Measured in months, not 21-day sprints."
      right={<Button variant="ghost" onClick={() => navigate('weekly')}>Weekly review →</Button>}
    >
      {/* Votes — the number that only goes up ------------------------------ */}
      <Card className="px-4 py-7 text-center">
        <div className="font-display text-[3.5rem] leading-none tnum text-[var(--color-accent-ink)]">
          {state.votes.toLocaleString()}
        </div>
        <div className="text-[13px] font-medium mt-2">votes for who I’m becoming</div>
        <div className="text-xs text-[var(--color-muted)] mt-1">
          Every completion, ever. This number only goes up.
        </div>
        {completedTaskCount(state.tasks) > 0 && (
          <div className="text-xs text-[var(--color-faint)] mt-3 pt-3 border-t border-[var(--color-line)]">
            <span className="tabular-nums text-[var(--color-muted)]">{completedTaskCount(state.tasks).toLocaleString()}</span> one-off tasks finished
          </div>
        )}
      </Card>

      {/* Wins — proud moments, surfaced on rough days ---------------------- */}
      <SectionLabel>Wins</SectionLabel>
      <WinsCard />

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

      {/* Insights ---------------------------------------------------------- */}
      <SectionLabel>Insights</SectionLabel>
      <Card className="px-4 py-4 text-sm">
        {overall && (
          <p className="text-[var(--color-muted)] leading-relaxed">
            You’re strongest on <b className="text-[var(--color-fg)]">{WEEKDAY_NAMES[overall.best.w]}s</b> ({overall.best.pct}%)
            and toughest on <b className="text-[var(--color-fg)]">{WEEKDAY_NAMES[overall.worst.w]}s</b> ({overall.worst.pct}%).
          </p>
        )}
        <div className={overall ? 'mt-3 pt-3 border-t border-[var(--color-line)]' : ''}>
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)] mb-2">Completion by phase · last 21 days</div>
          <div className="space-y-1.5">
            {Array.from({ length: state.settings.currentPhase }, (_, i) => i + 1).map((n) => {
              const pp = phaseProgress(state, n, today)
              return (
                <div key={n} className="flex items-center gap-3">
                  <span className="text-xs w-32 shrink-0 text-[var(--color-muted)] truncate">Phase {n} · {phaseMeta(n).name}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
                    <div className="h-full bg-[var(--color-accent)]" style={{ width: `${pp.pct}%` }} />
                  </div>
                  <span className="text-xs tabular-nums w-9 text-right">{pp.pct}%</span>
                </div>
              )
            })}
          </div>
        </div>
      </Card>

      {/* Fix a past day ---------------------------------------------------- */}
      <SectionLabel>Fix a past day</SectionLabel>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {recentDays.map((k) => (
          <button key={k} onClick={() => setEditDay(k)}
            className="shrink-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-center active:scale-95 transition">
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-faint)]">{dayName(k)}</div>
            <div className="text-sm font-medium tabular-nums">{k.slice(-2)}</div>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-[var(--color-faint)] mt-1.5">Tap a day to fix a forgotten check-in. Streaks recalculate from the corrected history.</p>

      {/* Per-habit ---------------------------------------------------------- */}
      <SectionLabel>Habits</SectionLabel>
      <div className="space-y-2.5">
        {habits.map((h) => <HabitStatRow key={h.id} habit={h} onPick={setEditDay} />)}
      </div>

      {editDay && <DayEditor dayKey={editDay} onClose={() => setEditDay(null)} />}
    </Screen>
  )
}

function dayName(key) {
  const [y, m, d] = key.split('-').map(Number)
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][new Date(y, m - 1, d).getDay()]
}

function HabitStatRow({ habit, onPick }) {
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
            <span className="text-[var(--color-accent-ink)]">🔥{s.current}</span>
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
          <Heatmap habit={habit} onPick={onPick} />
          <div className="flex gap-3 text-[10px] text-[var(--color-faint)] mt-2">
            <Legend cls="bg-[var(--color-accent)]" label="full" />
            <Legend cls="bg-[var(--color-accent)]/45" label="min" />
            <Legend cls="bg-[var(--color-surface-2)] ring-1 ring-inset ring-[var(--color-line-2)]/60" label="missed" />
          </div>
          {(() => {
            const wi = weekdayInsight(state, habit, today)
            return wi ? (
              <div className="text-[11px] text-[var(--color-muted)] mt-2">
                Strongest on {WEEKDAY_SHORT[wi.best.w]} · toughest on {WEEKDAY_SHORT[wi.worst.w]}
              </div>
            ) : null
          })()}
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
