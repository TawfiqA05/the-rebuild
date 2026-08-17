import { useMemo } from 'react'
import { useStore } from '../store.jsx'
import { fmtWeekday, fmtMonthDay, weekKeyFor, isSunday } from '../lib/time.js'
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
import { useT } from '../i18n.jsx'

// The Phase-1 anchors, shown as a compact emoji row in the score header.
const ANCHORS = [
  { key: 'salah', emoji: '🕌' },
  { key: 'sleep', emoji: '😴' },
  { key: 'gym', emoji: '🏋️' },
  { key: 'bed', emoji: '🛏️' },
]

export default function Today({ navigate }) {
  const { state, today, setRoughDay } = useStore()
  const { t, language } = useT()
  const phase = phaseMeta(state.settings.currentPhase)

  const habits = useMemo(
    () => activeHabits(state).filter((h) => appearsOnDay(h, today)),
    [state, today],
  )
  const { done, total } = dayScore(state, today)

  // A brand-new device has no history, so "missed yesterday" and "restart
  // protocol" shouldn't fire on day one — days before you installed aren't
  // misses. Only surface those once there's something logged.
  const hasHistory = Object.keys(state.logs).length > 0

  // At-risk: any active habit missed yesterday and still pending today.
  const atRisk = useMemo(
    () => hasHistory && activeHabits(state).some((h) => riskSignals(state, h, today).atRisk),
    [state, today, hasHistory],
  )

  const gap = useMemo(() => (hasHistory ? missGapBeforeToday(state, today) : 0), [state, today, hasHistory])
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
          {t('common.phase', { n: phase.n })} · {t(`phase.${phase.n}`)}
        </div>
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-[2.5rem] leading-none">{fmtWeekday(today, language)}</h1>
          <span className="text-[13px] text-[var(--color-muted)]">{fmtMonthDay(today, language)}</span>
        </div>
      </header>

      {/* Score card -------------------------------------------------------- */}
      <ScoreCard state={state} today={today} done={done} total={total} />

      {/* This week's focus (from the weekly review) ------------------------ */}
      {focus && (
        <div className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)]">{t('today.focus')}</div>
          <div className="text-sm font-medium mt-0.5">{focus}</div>
        </div>
      )}

      {/* Sunday nudge to run the weekly review ----------------------------- */}
      {isSunday(today) && (
        <button onClick={() => navigate('weekly')}
          className="mt-3 w-full rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 text-start active:scale-[0.99] transition">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">{t('today.sunday.title')}</div>
              <div className="text-xs text-[var(--color-muted)] mt-0.5">{t('today.sunday.sub')}</div>
            </div>
            <span className="text-[var(--color-accent-ink)] rtl:rotate-180">→</span>
          </div>
        </button>
      )}

      {/* At-risk banner (supportive, only when missed yesterday) ----------- */}
      {atRisk && !roughDay && (
        <div className="mt-3 rounded-2xl border border-[var(--color-risk)]/50 bg-[var(--color-risk-soft)]/40 px-4 py-3 animate-fade">
          <div className="text-sm font-medium text-[var(--color-fg)]">{t('today.atRisk.title')}</div>
          <div className="text-xs text-[var(--color-muted)] mt-0.5">{t('today.atRisk.sub')}</div>
        </div>
      )}

      {/* Restart protocol (after a 2+ day gap) ----------------------------- */}
      {gap >= 2 && (
        <div className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5 animate-fade">
          <div className="text-sm font-medium">{t('today.restart.title')}</div>
          <div className="text-xs text-[var(--color-muted)] mt-1 leading-relaxed">{t('today.restart.body')}</div>
        </div>
      )}

      {/* Rough-day confirmation -------------------------------------------- */}
      {roughDay && (
        <div className={`mt-3 rounded-2xl border px-4 py-3 animate-fade ${
          mvdWin ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent-soft)]/30'
                 : 'border-[var(--color-min)]/50 bg-[var(--color-min-soft)]/30'}`}>
          <div className="text-sm font-medium">
            {mvdWin ? t('today.roughWin.title') : t('today.roughMvd.title')}
          </div>
          <div className="text-xs text-[var(--color-muted)] mt-0.5">
            {mvdWin ? t('today.roughWin.sub') : t('today.roughMvd.sub')}
          </div>
        </div>
      )}

      {/* A past win, brought back on hard days ----------------------------- */}
      {winForToday && (
        <div className="mt-3 rounded-2xl border border-[var(--color-accent)]/30 bg-[var(--color-accent-soft)]/25 px-4 py-3.5 animate-fade">
          <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent-ink)]/90">{t('today.win.label')}</div>
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

      {/* Daily anchor — one quiet line, fixed for the day. Sits below the hero
          (score + salah + habits) so it stays a small grace note, not a banner. */}
      <div className="mt-4">
        <AnchorCard biasOwn={roughDay || gap >= 2} />
      </div>

      {/* Tasks — one-off to-dos, alongside the routines but off the scoreboard */}
      <div className="mt-3">
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
        {shutdownDone ? t('today.shutdown.done') : t('today.shutdown.start')}
      </button>

      {/* Rough-day toggle -------------------------------------------------- */}
      <div className="mt-3">
        <RoughDayButton roughDay={roughDay} onToggle={() => setRoughDay(today, !roughDay)} t={t} />
      </div>

      <p className="text-center text-[11px] text-[var(--color-faint)] mt-6 leading-relaxed">
        {t('today.hint1')}<br />
        {t('today.hint2')}
      </p>
    </div>
  )
}

function ScoreCard({ state, today, done, total }) {
  const { t } = useT()
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
            {complete ? t('today.score.complete') : t('today.score.pending')}
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

function RoughDayButton({ roughDay, onToggle, t }) {
  return (
    <button
      onClick={onToggle}
      className={`w-full rounded-2xl border py-3 text-sm font-medium transition active:scale-[0.99] ${
        roughDay
          ? 'border-[var(--color-min)]/50 bg-[var(--color-min-soft)]/30 text-[var(--color-min)]'
          : 'border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-fg)]'
      }`}
    >
      {roughDay ? t('today.rough.on') : t('today.rough.off')}
    </button>
  )
}
