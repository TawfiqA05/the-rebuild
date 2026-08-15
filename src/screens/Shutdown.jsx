import { useState } from 'react'
import { useStore } from '../store.jsx'
import { addDaysKey, prettyDate } from '../lib/time.js'
import { appearsOnDay, activeHabits, dayScore } from '../lib/logic.js'
import { Screen, Card, Button, TextInput, TextArea } from '../components/ui.jsx'
import HabitCard from '../components/HabitCard.jsx'
import SalahCard from '../components/SalahCard.jsx'

/**
 * The evening shutdown: a 4-step wind-down meant to take under 3 minutes.
 *   1. Check off today
 *   2. Three gratitudes
 *   3. Three-line journal (went well / didn't / one fix)
 *   4. Tomorrow's top 3 tasks
 * All autosaves as you type — the "Done" button just closes the ritual.
 */
export default function Shutdown({ navigate }) {
  const { state, today, updateDay, syncShutdownTasks } = useStore()
  const [step, setStep] = useState(0)

  const tomorrow = addDaysKey(today, 1)
  const dayRec = state.days[today] || {}
  const gratitude = dayRec.gratitude || ['', '', '']
  const journal = dayRec.journal || { well: '', didnt: '', fix: '' }

  // Step 4 plans tomorrow's top 3 as *real tasks*. We hold the three lines in
  // local state (seeded from any still-open shutdown tasks already planned for
  // tomorrow) and commit them on "Done", so re-running shutdown never dupes.
  const [topTasks, setTopTasks] = useState(() => {
    const existing = (state.tasks || [])
      .filter((t) => t.source === 'shutdown' && t.dueDay === tomorrow && !t.doneDay)
      .map((t) => t.text)
    return [existing[0] || '', existing[1] || '', existing[2] || '']
  })

  const setGratitude = (i, v) => {
    const next = [...gratitude]; next[i] = v; updateDay(today, { gratitude: next })
  }
  const setJournal = (k, v) => updateDay(today, { journal: { ...journal, [k]: v } })
  const setTask = (i, v) => setTopTasks((prev) => { const next = [...prev]; next[i] = v; return next })

  const steps = [
    {
      title: 'Check off today',
      hint: 'Close the loops. Hold any habit for its 2-minute version.',
      body: <CheckOffStep dayKey={today} />,
    },
    {
      title: 'Three gratitudes',
      hint: 'Small and specific beats grand and vague.',
      body: (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <TextInput key={i} value={gratitude[i]} onChange={(v) => setGratitude(i, v)}
              placeholder={`Grateful for… (${i + 1})`} />
          ))}
        </div>
      ),
    },
    {
      title: 'Three-line journal',
      hint: 'One honest line each. Don’t overthink it.',
      body: (
        <div className="space-y-3">
          <Labeled label="What went well">
            <TextArea value={journal.well} onChange={(v) => setJournal('well', v)} placeholder="A win, however small…" />
          </Labeled>
          <Labeled label="What didn’t">
            <TextArea value={journal.didnt} onChange={(v) => setJournal('didnt', v)} placeholder="No shame — just noticing…" />
          </Labeled>
          <Labeled label="One fix for tomorrow">
            <TextArea value={journal.fix} onChange={(v) => setJournal('fix', v)} placeholder="The single lever…" />
          </Labeled>
        </div>
      ),
    },
    {
      title: `Plan ${prettyDate(tomorrow).split(',')[0]}`,
      hint: 'Only three. These become real tasks, waiting on tomorrow’s list.',
      body: (
        <div className="space-y-2.5">
          {[0, 1, 2].map((i) => (
            <TextInput key={i} value={topTasks[i]} onChange={(v) => setTask(i, v)}
              placeholder={`Top task ${i + 1}`} />
          ))}
        </div>
      ),
    },
  ]

  const cur = steps[step]
  const last = step === steps.length - 1

  const finish = () => {
    syncShutdownTasks(tomorrow, topTasks)
    updateDay(today, { shutdownAt: Date.now() })
    navigate('today')
  }

  return (
    <Screen title="Evening shutdown" subtitle="Under three minutes. Then you’re off the clock.">
      {/* progress dots */}
      <div className="flex gap-1.5 mb-4">
        {steps.map((_, i) => (
          <div key={i} className={`h-1 flex-1 rounded-full transition ${
            i <= step ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'}`} />
        ))}
      </div>

      <div className="mb-1 text-lg font-semibold">{cur.title}</div>
      <div className="mb-4 text-xs text-[var(--color-muted)]">{cur.hint}</div>

      <div className="animate-fade" key={step}>{cur.body}</div>

      <div className="flex gap-2 mt-6">
        {step > 0 && <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>Back</Button>}
        <div className="flex-1" />
        {!last
          ? <Button variant="primary" onClick={() => setStep((s) => s + 1)}>Next</Button>
          : <Button variant="primary" onClick={finish}>Done — lights out</Button>}
      </div>
    </Screen>
  )
}

function CheckOffStep({ dayKey }) {
  const { state } = useStore()
  const habits = activeHabits(state).filter((h) => appearsOnDay(h, dayKey))
  const { done, total } = dayScore(state, dayKey)
  return (
    <div>
      <Card className="px-4 py-2.5 mb-3 flex items-center justify-between">
        <span className="text-sm text-[var(--color-muted)]">Today’s score</span>
        <span className="tabular-nums font-semibold">{done}/{total}</span>
      </Card>
      <div className="space-y-2.5">
        {habits.map((h) =>
          h.type === 'salah'
            ? <SalahCard key={h.id} dayKey={dayKey} />
            : <HabitCard key={h.id} habit={h} dayKey={dayKey} />,
        )}
      </div>
    </div>
  )
}

function Labeled({ label, children }) {
  return (
    <div>
      <div className="text-xs text-[var(--color-muted)] mb-1">{label}</div>
      {children}
    </div>
  )
}
