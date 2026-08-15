import { useMemo } from 'react'
import { useStore } from '../store.jsx'
import { prettyDate, weekKeyFor, isSunday } from '../lib/time.js'
import { phaseMeta } from '../lib/seed.js'
import {
  appearsOnDay, dayScore, habitStatusOn, isDone, activeHabits,
  riskSignals, missGapBeforeToday, isMVDWin, salahSummary,
} from '../lib/logic.js'
import HabitCard from '../components/HabitCard.jsx'
import SalahCard from '../components/SalahCard.jsx'
import TasksCard from '../components/TasksCard.jsx'
import FoodCard from '../components/FoodCard.jsx'
import AnchorCard from '../components/AnchorCard.jsx'

// The Phase-1 anchors, shown as a compact emoji row in the score header.
const ANCHORS = [
  { key: 'salah', emoji: '🕌' },
  { key: 'sleep', emoji: '😴' },
  { key: 'gym', emoji: '🏋️' },
  { key: 'bed', emoji: '🛏️' },
]

export default function Today({ navigate }) {
  const { state, today, setRoughDay } = useStore()
  const phase = phaseMeta(state.settings.currentPhase)

  const habits = useMemo(
    () => activeHabits(state).filter((h) => appearsOnDay(h, today)),
    [state, today],
  )
  const { done, total } = dayScore(state, today)

  // At-risk: any active habit missed yesterday and still pending today.
  const atRisk = useMemo(
    () => activeHabits(state).some((h) => riskSignals(state, h, today).atRisk),
    [state, today],
  )

  const gap = useMemo(() => missGapBeforeToday(state, today), [state, today])
  const roughDay = state.days[today]?.roughDay
  const mvdWin = isMVDWin(state, today)

  // On a rough day, or coming back from a gap, pull up one thing I was proud of.
  // Rotates by date so it isn't the same line every hard day.
  const wins = state.wins || []
  const showWin = (roughDay || gap >= 2) && wins.length > 0
  const winForToday = showWin ? wins[parseInt(today.slice(-2), 10) % wins.length] : null

  // The "one thing to improve" from Sunday's weekly review, shown all week.
  const focus = state.focusThisWeek && state.focusThisWeek.weekKey === weekKeyFor(today)
    ? state.focusThisWeek.text : null

  const todayRec = state.days[today] || {}
  const isEvening = new Date().getHours() >= 20
  const shutdownDone = !!todayRec.shutdownAt

  return (
    <div className="px-5 pt-5 pb-28 max-w-md mx-auto animate-rise">
      {/* Header ------------------------------------------------------------ */}
      <header className="mb-5">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.16em] text-[var(--color-accent-ink)]/90 mb-1.5">
          <span className="w-4 h-px bg-[var(--color-accent)]/50" />
          Phase {phase.n} · {phase.name}
        </div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-[2.5rem] leading-none">{prettyDate(today).split(',')[0]}</h1>
          <span className="text-[13px] text-[var(--color-muted)]">{prettyDate(today).split(', ')[1]}</span>
        </div>
      </header>

      {/* Score card -------------------------------------------------------- */}
      <ScoreCard state={state} today={today} done={done} total={total} />

      {/* Daily anchor — one quiet line, fixed for the day. On hard days it
          leans on my own wins and journal instead of strangers' quotes. */}
      <AnchorCard biasOwn={roughDay || gap >= 2} />

      {/* This week's focus (from the weekly review) ------------------------ */}
      {focus && (
        <div className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)]">This week’s focus</div>
          <div className="text-sm font-medium mt-0.5">{focus}</div>
        </div>
      )}

      {/* Sunday nudge to run the weekly review ----------------------------- */}
      {isSunday(today) && (
        <button onClick={() => navigate('weekly')}
          className="mt-3 w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-left active:scale-[0.99] transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">It’s Sunday — run your weekly review</div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5">Score the week, pick one thing to improve.</div>
            </div>
            <span className="text-[var(--color-accent-ink)]">→</span>
          </div>
        </button>
      )}

      {/* At-risk banner (supportive, only when missed yesterday) ----------- */}
      {atRisk && !roughDay && (
        <div className="mt-3 rounded-2xl border border-[var(--color-risk)]/50 bg-[var(--color-risk-soft)]/40 px-4 py-3 animate-fade">
          <div className="text-sm font-medium text-[var(--color-fg)]">Don’t miss twice.</div>
          <div className="text-xs text-[var(--color-muted)] mt-0.5">
            You slipped yesterday — that’s allowed. One rep today locks it back in.
          </div>
        </div>
      )}

      {/* Restart protocol (after a 2+ day gap) ----------------------------- */}
      {gap >= 2 && (
        <div className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5 animate-fade">
          <div className="text-sm font-medium">Welcome back. Restart protocol.</div>
          <div className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">
            No lecture. First day back = <span className="text-[var(--color-min)]">2-minute versions only</span>.
            Hold any habit to log its min rep. Momentum beats intensity.
          </div>
        </div>
      )}

      {/* Rough-day confirmation -------------------------------------------- */}
      {roughDay && (
        <div className={`mt-3 rounded-2xl border px-4 py-3 animate-fade ${
          mvdWin ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)]/30'
                 : 'border-[var(--color-min)]/50 bg-[var(--color-min-soft)]/30'}`}>
          <div className="text-sm font-medium">
            {mvdWin ? 'Rough day — logged as a WIN ✓' : 'Rough day — minimum viable day'}
          </div>
          <div className="text-xs text-[var(--color-muted)] mt-0.5">
            {mvdWin
              ? 'Salah + bed + one rep. Your streak survives. That counts.'
              : 'Salah, make your bed, and one 2-minute rep — and today still counts as a win.'}
          </div>
        </div>
      )}

      {/* A past win, brought back on hard days ----------------------------- */}
      {winForToday && (
        <div className="mt-3 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]/25 px-4 py-3.5 animate-fade">
          <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent-ink)]/90">You’ve done hard things</div>
          <div className="text-[15px] mt-1.5 leading-snug">{winForToday.text}</div>
        </div>
      )}

      {/* Habits ------------------------------------------------------------ */}
      <div className="mt-4 space-y-2.5">
        {habits.map((h) =>
          h.type === 'salah'
            ? <SalahCard key={h.id} dayKey={today} />
            : <HabitCard key={h.id} habit={h} dayKey={today} />,
        )}
      </div>

      {/* Tasks — one-off to-dos, alongside the routines but off the scoreboard */}
      <div className="mt-4">
        <TasksCard dayKey={today} />
      </div>

      {/* Food — a plain awareness log, no numbers and off the scoreboard too */}
      <div className="mt-3">
        <FoodCard dayKey={today} />
      </div>

      {/* Evening shutdown entry (emphasized after 8pm) --------------------- */}
      <button onClick={() => navigate('shutdown')}
        className={`mt-5 w-full rounded-2xl border py-3.5 text-sm font-medium transition active:scale-[0.99] ${
          isEvening && !shutdownDone
            ? 'border-[var(--color-risk)]/50 bg-[var(--color-risk-soft)]/40 text-[var(--color-fg)]'
            : 'border-[var(--color-line)] text-[var(--color-muted)]'}`}>
        {shutdownDone ? '☾ Shutdown complete — rest well' : '☾ Start evening shutdown'}
      </button>

      {/* Rough-day toggle -------------------------------------------------- */}
      <div className="mt-3">
        <RoughDayButton roughDay={roughDay} onToggle={() => setRoughDay(today, !roughDay)} />
      </div>

      <p className="text-center text-[11px] text-[var(--color-faint)] mt-6 leading-relaxed">
        Tap = full rep · Hold = 2-minute rep.<br />
        One missed day is fine. Never miss twice.
      </p>
    </div>
  )
}

function ScoreCard({ state, today, done, total }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  const complete = total > 0 && done === total

  return (
    <div className={`card px-5 py-5 ${complete ? 'day-complete' : ''}`}>
      <div className="flex items-end justify-between">
        <div>
          <div className="font-display text-[3.25rem] leading-[0.9] tnum">
            {done}<span className="text-[var(--color-faint)] text-[2.25rem]">/{total}</span>
          </div>
          <div className={`text-[12.5px] mt-1.5 transition-colors ${complete ? 'text-[var(--color-accent-ink)]' : 'text-[var(--color-muted)]'}`}>
            {complete ? 'Day complete — every anchor held.' : 'reps locked in today'}
          </div>
        </div>

        {/* Four anchors — the load-bearing walls, lit as they're completed. */}
        <div className="flex items-center gap-2">
          {ANCHORS.map((a) => {
            const h = state.habits.find((x) => x.id === a.key)
            const status = h?.type === 'salah'
              ? salahSummary(state.logs[today]?.['salah']).rep
              : habitStatusOn(state, h, today)
            const active = isDone(status)
            return (
              <span
                key={a.key}
                title={a.key}
                className={`w-9 h-9 grid place-items-center rounded-full text-lg transition-all duration-300 ${
                  active
                    ? 'bg-[var(--color-accent-soft)] ring-1 ring-[var(--color-accent)]/50'
                    : 'bg-[var(--color-ink-2)] grayscale opacity-35'
                }`}
              >
                {a.emoji}
              </span>
            )
          })}
        </div>
      </div>

      {/* progress bar */}
      <div className="mt-4 h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
        <div
          className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function RoughDayButton({ roughDay, onToggle }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full rounded-2xl border py-3 text-sm font-medium transition active:scale-[0.99] ${
        roughDay
          ? 'border-[var(--color-min)]/50 bg-[var(--color-min-soft)]/30 text-[var(--color-min)]'
          : 'border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
      }`}
    >
      {roughDay ? '✓ Marked as a rough day' : 'Rough day? → Minimum viable day'}
    </button>
  )
}
