import { useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import { addDaysKey, weekKeyFor, prettyDate } from '../lib/time.js'
import { activeHabits, habitStatusOn, isRequiredOnDay, isDone } from '../lib/logic.js'
import { Screen, Card, SectionLabel, Button, TextInput } from '../components/ui.jsx'
import { downloadBackup } from '../lib/backup.js'
import ShareSheet from '../components/ShareSheet.jsx'
import { useT } from '../i18n.jsx'

// Completion for one habit across a specific week → { done, total, pct }.
function weekHabitScore(state, habit, weekStart) {
  if (habit.frequency.kind === 'perWeek') {
    const target = habit.frequency.count || 1
    let count = 0
    for (let i = 0; i < 7; i++) {
      if (isDone(habitStatusOn(state, habit, addDaysKey(weekStart, i)))) count++
    }
    const done = Math.min(count, target)
    return { done: count, total: target, pct: Math.round((done / target) * 100) }
  }
  let done = 0
  let total = 0
  for (let i = 0; i < 7; i++) {
    const k = addDaysKey(weekStart, i)
    if (!isRequiredOnDay(habit, k)) continue
    total++
    if (isDone(habitStatusOn(state, habit, k))) done++
  }
  return { done, total, pct: total ? Math.round((done / total) * 100) : null }
}

function weekOverall(state, habits, weekStart) {
  let done = 0
  let total = 0
  for (const h of habits) {
    if (h.optional) continue
    const s = weekHabitScore(state, h, weekStart)
    if (h.frequency.kind === 'perWeek') { done += Math.min(s.done, s.total); total += s.total }
    else { done += s.done; total += s.total }
  }
  return total ? Math.round((done / total) * 100) : 0
}

export default function WeeklyReview({ navigate }) {
  const { state, today, saveWeeklyReview, exportJSON, markExported } = useStore()
  const { t } = useT()
  const habits = activeHabits(state)

  // Nudge a backup once a week. Show it if it's been more than 6 days, or never.
  const lastExport = state.settings.lastExportAt
  const needsBackup = !lastExport || (Date.now() - lastExport) > 6 * 86400000
  const backupNow = () => { downloadBackup(exportJSON()); markExported() }

  const thisWeek = weekKeyFor(today)          // the week you're planning
  const lastWeek = addDaysKey(thisWeek, -7)   // the week you're reviewing
  const weekBefore = addDaysKey(thisWeek, -14)

  const lastScore = useMemo(() => weekOverall(state, habits, lastWeek), [state, habits, lastWeek])
  const prevScore = useMemo(() => weekOverall(state, habits, weekBefore), [state, habits, weekBefore])
  const trend = lastScore - prevScore

  const existing = state.weeklyReviews[thisWeek] || {}
  const [focus, setFocus] = useState(existing.focus || '')
  const [checklist, setChecklist] = useState(existing.checklist || ['', '', ''])
  const [saved, setSaved] = useState(false)
  const [sharing, setSharing] = useState(false)

  const setItem = (i, v) => { const n = [...checklist]; n[i] = v; setChecklist(n) }

  const save = () => {
    saveWeeklyReview(thisWeek, { focus: focus.trim(), checklist })
    setSaved(true)
    setTimeout(() => navigate('today'), 700)
  }

  return (
    <Screen
      title={t('weekly.title')}
      subtitle={t('weekly.subtitle', { last: prettyDate(lastWeek).split(',')[1], this: prettyDate(thisWeek).split(',')[1] })}
      right={<Button variant="ghost" onClick={() => navigate('today')}>{t('common.close')}</Button>}
    >
      {/* Trend ------------------------------------------------------------- */}
      <Card className="px-4 py-4 flex items-center justify-between">
        <div>
          <div className="text-3xl font-semibold tabular-nums">{lastScore}%</div>
          <div className="text-xs text-[var(--color-muted)]">{t('weekly.lastWeek')}</div>
        </div>
        <div className={`text-sm font-medium ${
          trend > 0 ? 'text-[var(--color-accent-ink)]' : trend < 0 ? 'text-[var(--color-min)]' : 'text-[var(--color-muted)]'
        }`}>
          {trend > 0 ? '▲' : trend < 0 ? '▼' : '—'} {Math.abs(trend)}% <span className="text-[var(--color-faint)]">{t('weekly.vsPrior')}</span>
        </div>
      </Card>

      {/* Weekly backup nudge ---------------------------------------------- */}
      {needsBackup && (
        <div className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5 flex items-center gap-3">
          <div className="flex-1">
            <div className="text-sm font-medium">{t('weekly.backupTitle')}</div>
            <div className="text-xs text-[var(--color-muted)] mt-0.5">
              {lastExport ? t('weekly.backupOver') : t('weekly.backupNever')}
            </div>
          </div>
          <Button variant="primary" onClick={backupNow}>{t('weekly.export')}</Button>
        </div>
      )}

      {/* Per-habit last week ---------------------------------------------- */}
      <SectionLabel>{t('weekly.howItWent')}</SectionLabel>
      <div className="space-y-1.5">
        {habits.map((h) => {
          const s = weekHabitScore(state, h, lastWeek)
          return (
            <div key={h.id} className="flex items-center gap-3 px-1">
              <span className="w-6 text-center">{h.emoji}</span>
              <span className="flex-1 min-w-0 text-sm break-words">{h.name}</span>
              <div className="w-24 h-1.5 rounded-full bg-[var(--color-line)] overflow-hidden">
                <div className="h-full bg-[var(--color-accent)]" style={{ width: `${s.pct ?? 0}%` }} />
              </div>
              <span className="text-xs tabular-nums text-[var(--color-muted)] w-12 text-end">
                {h.frequency.kind === 'perWeek' ? `${s.done}/${s.total}` : `${s.pct ?? 0}%`}
              </span>
            </div>
          )
        })}
      </div>

      {/* One thing to improve --------------------------------------------- */}
      <SectionLabel>{t('weekly.pickOne')}</SectionLabel>
      <TextInput value={focus} onChange={setFocus} placeholder={t('weekly.pickOnePh')} />
      <p className="text-[11px] text-[var(--color-faint)] mt-1.5">
        {t('weekly.pickOneNote')}
      </p>

      {/* Plan the week ----------------------------------------------------- */}
      <SectionLabel>{t('weekly.plan')}</SectionLabel>
      <div className="space-y-2">
        {checklist.map((c, i) => (
          <TextInput key={i} value={c} onChange={(v) => setItem(i, v)} placeholder={t('weekly.planPh', { n: i + 1 })} />
        ))}
      </div>

      <Button variant="primary" className="w-full mt-6" onClick={save}>
        {saved ? t('weekly.saved') : t('weekly.saveSet')}
      </Button>

      <Button className="w-full mt-2" onClick={() => setSharing(true)}>
        {t('stats.shareWeek')}
      </Button>

      {sharing && <ShareSheet onClose={() => setSharing(false)} />}
    </Screen>
  )
}
