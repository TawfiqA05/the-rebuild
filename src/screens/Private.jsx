import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { generateSalt, hashPin, verifyPin } from '../lib/crypto.js'
import { URGE_PROMPTS } from '../lib/seed.js'
import { Screen, Card, SectionLabel, Button, TextInput, TextArea } from '../components/ui.jsx'

const MAX_PIN_FAILS = 5

/**
 * The private log is a single-owner space: exactly one PIN, set by the owner on
 * first use, stored as a salted SHA-256 hash on this device only (see
 * lib/crypto.js — the salt is random per install, never in the code). There is
 * no change-PIN and no reset; the only way to clear it is wiping all app data.
 * Five wrong attempts locks the tab for an hour (enforced in the store, and
 * persisted so a reload can't bypass it). Unlock state lives in component memory
 * only, so it re-locks on reload.
 */
export default function Private() {
  const { state } = useStore()
  const [unlocked, setUnlocked] = useState(false)

  if (!state.settings.pinHash) return <CreatePin onCreated={() => setUnlocked(true)} />
  if (!unlocked) return <UnlockPin onUnlock={() => setUnlocked(true)} />
  return <PrivateDashboard onLock={() => setUnlocked(false)} />
}

// --- PIN screens ------------------------------------------------------------

function CreatePin({ onCreated }) {
  const { setOwnerPin } = useStore()
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [err, setErr] = useState('')

  const submit = async () => {
    if (a.length < 4) return setErr('Use at least 4 digits.')
    if (a !== b) return setErr('The two entries don’t match.')
    const salt = generateSalt()
    setOwnerPin(await hashPin(a, salt), salt)
    onCreated()
  }

  return (
    <Screen title="Set your PIN" subtitle="This device is now the owner. Choose one PIN.">
      <Card className="px-4 py-4 space-y-3">
        <PinField label="Choose a PIN" value={a} onChange={setA} autoFocus />
        <PinField label="Confirm PIN" value={b} onChange={setB} />
        {err && <div className="text-xs text-[var(--color-min)]">{err}</div>}
        <Button variant="primary" className="w-full" onClick={submit}>Set PIN & open</Button>
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5">
          <p className="text-[11px] text-[var(--color-muted)] leading-relaxed">
            <b className="text-[var(--color-fg)]">This is the one and only PIN.</b> It’s stored as a
            salted hash on this device — never in plain text, never in the cloud. There is no
            change or reset: the only way to clear it is <b>Settings → Reset everything</b>, which
            wipes all app data. So pick something you won’t forget.
          </p>
        </div>
      </Card>
    </Screen>
  )
}

function UnlockPin({ onUnlock }) {
  const { state, registerPinFailure, clearPinFailures } = useStore()
  const { pinHash, pinSalt, pinFails = 0, pinLockUntil = 0 } = state.settings
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [now, setNow] = useState(Date.now())

  const locked = now < pinLockUntil

  // Tick once a second while locked so the countdown updates and auto-clears.
  useEffect(() => {
    if (!locked) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [locked])

  const submit = async () => {
    if (locked) return
    if (await verifyPin(pin, pinSalt, pinHash)) {
      clearPinFailures()
      onUnlock()
    } else {
      registerPinFailure()
      setPin('')
      const left = MAX_PIN_FAILS - (pinFails + 1)
      setErr(left > 0
        ? `Incorrect. ${left} attempt${left === 1 ? '' : 's'} left.`
        : 'Too many attempts. Locked for 1 hour.')
    }
  }

  if (locked) {
    const mins = Math.ceil((pinLockUntil - now) / 60000)
    return (
      <Screen title="Private log" subtitle="Temporarily locked.">
        <Card className="px-4 py-8 text-center">
          <div className="text-4xl mb-3">⏳</div>
          <div className="font-medium">Too many attempts</div>
          <div className="text-sm text-[var(--color-muted)] mt-1">
            Locked for another <b className="text-[var(--color-fg)]">{mins} minute{mins === 1 ? '' : 's'}</b>.
          </div>
          <div className="text-[11px] text-[var(--color-faint)] mt-3">
            The only reset is wiping all app data in Settings.
          </div>
        </Card>
      </Screen>
    )
  }

  return (
    <Screen title="Private log" subtitle="Enter your PIN.">
      <Card className="px-4 py-4 space-y-3">
        <PinField label="PIN" value={pin} onChange={setPin} autoFocus onEnter={submit} />
        {err && <div className="text-xs text-[var(--color-min)]">{err}</div>}
        <Button variant="primary" className="w-full" onClick={submit}>Unlock</Button>
        {pinFails > 0 && (
          <p className="text-[11px] text-[var(--color-faint)] text-center">
            {MAX_PIN_FAILS - pinFails} attempt{MAX_PIN_FAILS - pinFails === 1 ? '' : 's'} left before a 1-hour lock.
          </p>
        )}
      </Card>
    </Screen>
  )
}

function PinField({ label, value, onChange, autoFocus, onEnter }) {
  return (
    <div>
      <div className="text-xs text-[var(--color-muted)] mb-1">{label}</div>
      <input
        type="password"
        inputMode="numeric"
        autoFocus={autoFocus}
        value={value}
        maxLength={8}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        onKeyDown={(e) => e.key === 'Enter' && onEnter?.()}
        className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-3 text-center text-2xl tracking-[0.5em]
          outline-none focus:border-[var(--color-accent)]"
      />
    </div>
  )
}

// --- Dashboard --------------------------------------------------------------

function PrivateDashboard({ onLock }) {
  const { state } = useStore()
  const [view, setView] = useState('timer') // 'timer' | 'log' | 'stats'

  return (
    <Screen
      title="Private log"
      subtitle="Neutral ground. Log it, ride it out, move on."
      right={<Button variant="ghost" onClick={onLock}>Lock 🔒</Button>}
    >
      <div className="flex gap-1.5 mb-4">
        {[['timer', 'Ride the wave'], ['log', 'Log a moment'], ['stats', 'Patterns']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            className={`flex-1 rounded-xl border py-2 text-xs transition ${
              view === id ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                          : 'border-[var(--color-line)] text-[var(--color-muted)]'}`}>
            {label}
          </button>
        ))}
      </div>

      {view === 'timer' && <UrgeTimer />}
      {view === 'log' && <LogMoment />}
      {view === 'stats' && <Patterns entries={state.privateLog.entries} waves={state.privateLog.waves} />}
    </Screen>
  )
}

// --- 20-minute urge timer ---------------------------------------------------

const URGE_SECONDS = 20 * 60

function UrgeTimer() {
  const { addWaveSurvived, addPrivateEntry } = useStore()
  const [running, setRunning] = useState(false)
  const [left, setLeft] = useState(URGE_SECONDS)
  const [outcome, setOutcome] = useState(null) // 'survived' | 'slipped'
  const tick = useRef(null)

  useEffect(() => {
    if (!running) return
    tick.current = setInterval(() => {
      setLeft((l) => {
        if (l <= 1) { clearInterval(tick.current); complete('survived'); return 0 }
        return l - 1
      })
    }, 1000)
    return () => clearInterval(tick.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running])

  const elapsed = URGE_SECONDS - left
  const prompt = URGE_PROMPTS[Math.floor(elapsed / 20) % URGE_PROMPTS.length]
  const mm = String(Math.floor(left / 60)).padStart(2, '0')
  const ss = String(left % 60).padStart(2, '0')
  const pct = Math.round((elapsed / URGE_SECONDS) * 100)

  function start() { setLeft(URGE_SECONDS); setOutcome(null); setRunning(true); if (navigator.vibrate) navigator.vibrate(20) }
  function complete(kind) {
    setRunning(false); setOutcome(kind)
    if (kind === 'survived') addWaveSurvived({ seconds: elapsed })
    else addPrivateEntry({ trigger: 'urge', note: 'Logged from urge timer', rodeOut: false })
    if (navigator.vibrate) navigator.vibrate(kind === 'survived' ? [20, 60, 20] : 20)
  }

  if (outcome === 'survived') {
    return (
      <Card className="px-4 py-8 text-center">
        <div className="text-5xl mb-2">🌊</div>
        <div className="text-lg font-semibold text-[var(--color-accent)]">Wave survived.</div>
        <div className="text-sm text-[var(--color-muted)] mt-1">
          You outlasted it. That’s a rep for the person you’re becoming.
        </div>
        <Button variant="primary" className="mt-5" onClick={() => setOutcome(null)}>Done</Button>
      </Card>
    )
  }

  if (!running) {
    return (
      <div className="space-y-4">
        <Card className="px-4 py-8 text-center">
          <p className="text-sm text-[var(--color-muted)] mb-5 leading-relaxed">
            Urges peak and pass — usually within 20 minutes. Start the timer and let it crest.
          </p>
          <button onClick={start}
            className="mx-auto w-40 h-40 rounded-full border-2 border-[var(--color-accent)] text-[var(--color-accent)]
              grid place-items-center active:scale-95 transition">
            <span className="text-lg font-semibold leading-tight">🌊<br />Ride the<br />wave</span>
          </button>
          <p className="text-xs text-[var(--color-faint)] mt-5">20 minutes. One at a time.</p>
        </Card>
        {outcome === 'slipped' && (
          <p className="text-center text-xs text-[var(--color-muted)]">Logged. No shame — noticing is data. Come back anytime.</p>
        )}
      </div>
    )
  }

  return (
    <Card className="px-4 py-8 text-center">
      <div className="text-6xl font-semibold tabular-nums tracking-tight">{mm}:{ss}</div>
      <div className="mt-4 h-2 rounded-full bg-[var(--color-line)] overflow-hidden">
        <div className="h-full bg-[var(--color-accent)] transition-all duration-1000 ease-linear" style={{ width: `${pct}%` }} />
      </div>
      <div className="min-h-[3rem] mt-5 text-sm text-[var(--color-fg)] flex items-center justify-center px-2 animate-fade" key={prompt}>
        {prompt}
      </div>
      <div className="flex gap-2 mt-4">
        <Button variant="primary" className="flex-1" onClick={() => complete('survived')}>The urge passed</Button>
        <Button variant="ghost" onClick={() => complete('slipped')}>I slipped</Button>
      </div>
    </Card>
  )
}

// --- Log a moment -----------------------------------------------------------

const TRIGGERS = ['app', 'boredom', 'late night', 'mood', 'other']

function LogMoment() {
  const { addPrivateEntry } = useStore()
  const [when, setWhen] = useState(() => toLocalInput(new Date()))
  const [trigger, setTrigger] = useState('boredom')
  const [note, setNote] = useState('')
  const [rodeOut, setRodeOut] = useState(true)
  const [saved, setSaved] = useState(false)

  const save = () => {
    addPrivateEntry({ at: new Date(when).getTime(), trigger, note: note.trim(), rodeOut })
    setSaved(true); setNote('')
    setTimeout(() => setSaved(false), 1500)
  }

  return (
    <Card className="px-4 py-4 space-y-4">
      <Labeled label="When">
        <TextInput type="datetime-local" value={when} onChange={setWhen} />
      </Labeled>

      <Labeled label="Trigger">
        <div className="flex flex-wrap gap-1.5">
          {TRIGGERS.map((t) => (
            <button key={t} onClick={() => setTrigger(t)}
              className={`rounded-lg border px-3 py-1.5 text-xs capitalize transition ${
                trigger === t ? 'border-[var(--color-accent)] text-[var(--color-accent)]'
                              : 'border-[var(--color-line)] text-[var(--color-muted)]'}`}>
              {t}
            </button>
          ))}
        </div>
      </Labeled>

      <Labeled label="Notes (optional)">
        <TextArea value={note} onChange={setNote} placeholder="What was going on? Just the facts." />
      </Labeled>

      <Labeled label="Did you ride it out?">
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => setRodeOut(true)}
            className={`rounded-xl border py-2.5 text-sm transition ${
              rodeOut ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/30 text-[var(--color-accent)]'
                      : 'border-[var(--color-line)] text-[var(--color-muted)]'}`}>
            Yes — rode the wave
          </button>
          <button onClick={() => setRodeOut(false)}
            className={`rounded-xl border py-2.5 text-sm transition ${
              !rodeOut ? 'border-[var(--color-min)] bg-[var(--color-min-soft)]/30 text-[var(--color-min)]'
                       : 'border-[var(--color-line)] text-[var(--color-muted)]'}`}>
            No — slipped
          </button>
        </div>
      </Labeled>

      <Button variant="primary" className="w-full" onClick={save}>{saved ? 'Logged ✓' : 'Log it'}</Button>
    </Card>
  )
}

// --- Patterns / stats -------------------------------------------------------

function Patterns({ entries, waves }) {
  const stats = useMemo(() => computePatterns(entries), [entries])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Stat big={waves.length} label="waves survived 🌊" accent />
        <Stat big={stats.cleanDays == null ? '—' : stats.cleanDays} label="days since last slip" />
      </div>

      <Card className="px-4 py-4">
        <SectionLabel>Trigger patterns</SectionLabel>
        {stats.total === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">Nothing logged yet. Insights show up as you record moments — no judgment, just data.</p>
        ) : (
          <div className="space-y-2 text-sm">
            {stats.peakWindow && (
              <Insight label="Most slips happen" value={stats.peakWindow} />
            )}
            {stats.topTrigger && (
              <Insight label="Most common trigger" value={stats.topTrigger} />
            )}
            <Insight label="Rode it out" value={`${stats.rodeOutPct}% of the time`} />
          </div>
        )}
      </Card>

      {entries.length > 0 && (
        <Card className="px-4 py-3">
          <SectionLabel>Recent</SectionLabel>
          <div className="space-y-2">
            {entries.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs">
                <span className={e.rodeOut ? 'text-[var(--color-accent)]' : 'text-[var(--color-min)]'}>
                  {e.rodeOut ? '🌊' : '•'}
                </span>
                <span className="text-[var(--color-muted)] w-28 shrink-0">{fmtWhen(e.at)}</span>
                <span className="capitalize flex-1 truncate">{e.trigger}{e.note ? ` — ${e.note}` : ''}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function computePatterns(entries) {
  const total = entries.length
  if (total === 0) return { total: 0, cleanDays: null }
  const slips = entries.filter((e) => !e.rodeOut)
  const lastSlip = slips[0]?.at
  const cleanDays = lastSlip == null ? null : Math.floor((Date.now() - lastSlip) / 86400000)

  // hour histogram over slips → find peak 2-hour window
  const hours = new Array(24).fill(0)
  for (const s of slips) hours[new Date(s.at).getHours()]++
  let peakWindow = null
  if (slips.length) {
    let bestH = 0
    let best = -1
    for (let h = 0; h < 24; h++) {
      const w = hours[h] + hours[(h + 1) % 24]
      if (w > best) { best = w; bestH = h }
    }
    if (best > 0) peakWindow = `${fmtHour(bestH)}–${fmtHour((bestH + 2) % 24)}`
  }

  // most common trigger
  const counts = {}
  for (const e of entries) counts[e.trigger] = (counts[e.trigger] || 0) + 1
  const topTrigger = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null

  const rodeOut = entries.filter((e) => e.rodeOut).length
  const rodeOutPct = Math.round((rodeOut / total) * 100)

  return { total, cleanDays, peakWindow, topTrigger, rodeOutPct }
}

// --- little bits ------------------------------------------------------------

function Stat({ big, label, accent }) {
  return (
    <Card className="px-4 py-4 text-center">
      <div className={`text-3xl font-semibold tabular-nums ${accent ? 'text-[var(--color-accent)]' : ''}`}>{big}</div>
      <div className="text-xs text-[var(--color-muted)] mt-1">{label}</div>
    </Card>
  )
}

function Insight({ label, value }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--color-muted)]">{label}</span>
      <span className="font-medium capitalize">{value}</span>
    </div>
  )
}

function Labeled({ label, children }) {
  return (
    <div>
      <div className="text-xs text-[var(--color-muted)] mb-1.5">{label}</div>
      {children}
    </div>
  )
}

function toLocalInput(d) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
function fmtHour(h) {
  const ampm = h < 12 ? 'am' : 'pm'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}${ampm}`
}
function fmtWhen(ts) {
  const d = new Date(ts)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`
}
