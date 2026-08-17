import { useState } from 'react'
import { useStore } from '../store.jsx'
import { phaseMeta } from '../lib/seed.js'
import { Screen, Card, SectionLabel, Button, ProgressBar } from '../components/ui.jsx'
import Heatmap from '../components/Heatmap.jsx'
import WinsCard from '../components/WinsCard.jsx'
import DayEditor from '../components/DayEditor.jsx'
import ShareSheet from '../components/ShareSheet.jsx'
import { lastNKeys } from '../lib/time.js'
import {
  activeHabits, habitStats, phaseProgress, shouldSuggestUnlock,
} from '../lib/logic.js'
import { weekdayInsight, overallWeekday } from '../lib/insights.js'
import { completedTaskCount } from '../lib/tasks.js'
import { daysLoggedCount } from '../lib/food.js'
import { useT } from '../i18n.jsx'

export default function Stats({ navigate }) {
  const { state, today, unlockNextPhase, dismissUnlock } = useStore()
  const { t } = useT()
  const phase = phaseMeta(state.settings.currentPhase)
  const pp = phaseProgress(state, state.settings.currentPhase, today)
  const suggest = shouldSuggestUnlock(state, today)
  const habits = activeHabits(state)
  const [editDay, setEditDay] = useState(null)
  const [sharing, setSharing] = useState(false)
  const recentDays = lastNKeys(today, 14).reverse() // most recent first
  const overall = overallWeekday(state, today)

  return (
    <Screen
      title={t('stats.title')}
      subtitle={t('stats.subtitle')}
      right={<Button variant="ghost" data-testid="weekly-review-link" onClick={() => navigate('weekly')}>{t('stats.weeklyReview')}</Button>}
    >
      {/* Share progress ---------------------------------------------------- */}
      <Button variant="primary" data-testid="open-share" className="w-full mb-4" onClick={() => setSharing(true)}>
        {t('stats.shareWeek')}
      </Button>
      {/* Votes — the number that only goes up ------------------------------ */}
      <Card className="px-4 py-7 text-center">
        <div className="font-display text-[3.5rem] leading-none tnum text-[var(--color-accent-ink)]">
          {state.votes.toLocaleString()}
        </div>
        <div className="text-[13px] font-medium mt-2">{t('stats.votesLabel')}</div>
        <div className="text-xs text-[var(--color-muted)] mt-1">
          {t('stats.votesSub')}
        </div>
        {(completedTaskCount(state.tasks) > 0 || daysLoggedCount(state.food) > 0) && (
          <div className="text-xs text-[var(--color-faint)] mt-3 pt-3 border-t border-[var(--color-line)] space-y-0.5">
            {completedTaskCount(state.tasks) > 0 && (
              <div>{t('stats.tasksFinished', { n: completedTaskCount(state.tasks).toLocaleString() })}</div>
            )}
            {daysLoggedCount(state.food) > 0 && (
              <div>{t('stats.foodDays', { n: daysLoggedCount(state.food).toLocaleString() })}</div>
            )}
          </div>
        )}
      </Card>

      {/* Wins — proud moments, surfaced on rough days ---------------------- */}
      <SectionLabel>{t('stats.wins')}</SectionLabel>
      <WinsCard />

      {/* Phase progress ---------------------------------------------------- */}
      <SectionLabel>{t('common.phase', { n: phase.n })} · {t(`phase.${phase.n}`)}</SectionLabel>
      <Card className="px-4 py-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm text-[var(--color-muted)]">{t('stats.trailing21')}</span>
          <span className="text-lg font-semibold tabular-nums">{pp.pct}%</span>
        </div>
        <ProgressBar pct={pp.pct} threshold={80} />
        <div className="flex justify-between text-[11px] text-[var(--color-faint)] mt-1.5">
          <span>{t('stats.automaticity')}</span>
          <span>{t('stats.ready')}</span>
        </div>

        {suggest ? (
          <div className="mt-4 rounded-xl border border-[var(--color-accent)]/40 bg-[var(--color-accent-soft)]/30 px-3 py-3">
            <div className="text-sm font-medium">{t('stats.feelsAutomatic', { n: phase.n })}</div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5 mb-3">
              {t('stats.past80')}
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={unlockNextPhase} className="flex-1">
                {t('stats.startPhase', { n: phase.n + 1 })}
              </Button>
              <Button variant="ghost" onClick={() => dismissUnlock(phase.n)}>{t('stats.notYet')}</Button>
            </div>
          </div>
        ) : (
          state.settings.currentPhase < 5 && (
            <div className="text-xs text-[var(--color-faint)] mt-3">
              {t('stats.keepAbove')}
            </div>
          )
        )}
      </Card>

      {/* Insights ---------------------------------------------------------- */}
      <SectionLabel>{t('stats.insights')}</SectionLabel>
      <Card className="px-4 py-4 text-sm">
        {overall && (
          <p className="text-[var(--color-muted)] leading-relaxed">
            {t('stats.strongest', {
              best: t(`weekday.${overall.best.w}`), bestPct: overall.best.pct,
              worst: t(`weekday.${overall.worst.w}`), worstPct: overall.worst.pct,
            })}
          </p>
        )}
        <div className={overall ? 'mt-3 pt-3 border-t border-[var(--color-line)]' : ''}>
          <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)] mb-2">{t('stats.completionByPhase')}</div>
          <div className="space-y-1.5">
            {Array.from({ length: state.settings.currentPhase }, (_, i) => i + 1).map((n) => {
              const pp = phaseProgress(state, n, today)
              return (
                <div key={n} className="flex items-center gap-3">
                  <span className="text-xs w-32 shrink-0 text-[var(--color-muted)] leading-tight break-words">{t('common.phase', { n })} · {t(`phase.${n}`)}</span>
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
      <SectionLabel>{t('stats.fixPastDay')}</SectionLabel>
      <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
        {recentDays.map((k) => (
          <button key={k} onClick={() => setEditDay(k)}
            className="shrink-0 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-center active:scale-95 transition">
            <div className="text-[10px] uppercase tracking-wide text-[var(--color-faint)]">{t(`weekdayShort.${dow(k)}`)}</div>
            <div className="text-sm font-medium tabular-nums">{k.slice(-2)}</div>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-[var(--color-faint)] mt-1.5">{t('stats.fixHint')}</p>

      {/* Per-habit ---------------------------------------------------------- */}
      <SectionLabel>{t('stats.habits')}</SectionLabel>
      <div className="space-y-2.5">
        {habits.map((h) => <HabitStatRow key={h.id} habit={h} onPick={setEditDay} />)}
      </div>

      {editDay && <DayEditor dayKey={editDay} onClose={() => setEditDay(null)} />}
      {sharing && <ShareSheet onClose={() => setSharing(false)} />}
    </Screen>
  )
}

function dow(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getDay()
}

function HabitStatRow({ habit, onPick }) {
  const { state, today } = useStore()
  const { t } = useT()
  const s = habitStats(state, habit, today)
  const [open, setOpen] = useState(false)

  return (
    <Card className="px-4 py-3.5">
      <button className="w-full text-start" onClick={() => setOpen((o) => !o)}>
        <div className="flex items-center gap-3">
          <span className="text-xl w-7 text-center">{habit.emoji}</span>
          <span className="flex-1 min-w-0 font-medium break-words">{habit.name}</span>
          <span className="text-sm tabular-nums">
            <span className="text-[var(--color-accent-ink)]">🔥{s.current}</span>
          </span>
        </div>
        <div className="flex gap-4 text-[11px] text-[var(--color-muted)] mt-2 ps-10">
          <span>{t('stats.best')} <b className="text-[var(--color-fg)]">{s.longest}</b></span>
          <span>{t('stats.lifetime')} <b className="text-[var(--color-fg)]">{s.lifetime}</b></span>
          <span>{t('stats.30d')} <b className="text-[var(--color-fg)]">{s.pct30}%</b></span>
          {s.missedTwice && <span className="text-[var(--color-risk)]">{t('stats.missedTwice')}</span>}
        </div>
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-[var(--color-line)] animate-fade">
          <Heatmap habit={habit} onPick={onPick} />
          <div className="flex gap-3 text-[10px] text-[var(--color-faint)] mt-2">
            <Legend cls="bg-[var(--color-accent)]" label={t('heatmap.full')} />
            <Legend cls="bg-[var(--color-accent)]/45" label={t('heatmap.min')} />
            <Legend cls="bg-[var(--color-surface-2)] ring-1 ring-inset ring-[var(--color-line-2)]/60" label={t('heatmap.missed')} />
          </div>
          {(() => {
            const wi = weekdayInsight(state, habit, today)
            return wi ? (
              <div className="text-[11px] text-[var(--color-muted)] mt-2">
                {t('stats.strongestWeekday', { best: t(`weekdayShort.${wi.best.w}`), worst: t(`weekdayShort.${wi.worst.w}`) })}
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
