import { useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { PHASES, phaseMeta } from '../lib/seed.js'
import { Screen, Card, SectionLabel, Button, TextInput } from '../components/ui.jsx'
import { usePrayerTimes } from '../hooks/usePrayerTimes.js'
import { downloadBackup } from '../lib/backup.js'
import { PRAYER_KEYS, fmt12 } from '../lib/prayerTimes.js'
import PrayerLocationPicker from '../components/PrayerLocationPicker.jsx'
import { THEMES } from '../lib/themes.js'

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

export default function Settings({ navigate, onRevealPrivate }) {
  const {
    state, updateSettings, unlockNextPhase, setPhase,
    exportJSON, importJSON, resetAll, setTourSeen,
  } = useStore()
  const s = state.settings
  const replayTour = () => { setTourSeen(false); navigate('today') }

  return (
    <Screen title="Settings" subtitle="Tune the system to fit your life.">
      {/* Phase ------------------------------------------------------------- */}
      <SectionLabel>Phase</SectionLabel>
      <Card className="px-4 py-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="font-medium">Phase {s.currentPhase} · {phaseMeta(s.currentPhase).name}</div>
            <div className="text-xs text-[var(--color-muted)]">{phaseMeta(s.currentPhase).blurb}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PHASES.map((p) => (
            <button key={p.n} onClick={() => setPhase(p.n)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                p.n === s.currentPhase ? 'border-[var(--color-accent)] text-[var(--color-accent-ink)]'
                  : p.n < s.currentPhase ? 'border-[var(--color-line)] text-[var(--color-fg)]'
                  : 'border-[var(--color-line)] text-[var(--color-faint)]'}`}>
              {p.n}. {p.name}
            </button>
          ))}
        </div>
        {s.currentPhase < 5 && (
          <Button variant="primary" className="w-full mt-3" onClick={unlockNextPhase}>
            Start Phase {s.currentPhase + 1}: {phaseMeta(s.currentPhase + 1).name}
          </Button>
        )}
        <p className="text-[11px] text-[var(--color-faint)] mt-2">
          Move up in order, when the current phase feels automatic. You can move back down too.
        </p>
      </Card>

      {/* Appearance -------------------------------------------------------- */}
      <SectionLabel>Appearance</SectionLabel>
      <Appearance />
      <button onClick={replayTour} className="text-[12px] text-[var(--color-accent-ink)] mt-2">Replay the quick tour</button>

      {/* Day rollover ------------------------------------------------------ */}
      <SectionLabel>Day rollover</SectionLabel>
      <Card className="px-4 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">New day starts at</div>
            <div className="text-xs text-[var(--color-muted)]">A late-night check-in counts as the day before.</div>
          </div>
          <select
            value={s.dayRolloverHour}
            onChange={(e) => updateSettings({ dayRolloverHour: Number(e.target.value) })}
            className="rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-sm">
            {[0, 1, 2, 3, 4, 5, 6].map((h) => (
              <option key={h} value={h}>{h}:00 am</option>
            ))}
          </select>
        </div>
      </Card>

      {/* Habits ------------------------------------------------------------ */}
      <SectionLabel>Habits</SectionLabel>
      <HabitManager />

      {/* My quotes --------------------------------------------------------- */}
      <SectionLabel>My quotes</SectionLabel>
      <MyQuotes />

      {/* Prayer location --------------------------------------------------- */}
      <SectionLabel>Prayer location</SectionLabel>
      <PrayerLocation />

      {/* Prayer times ------------------------------------------------------ */}
      <SectionLabel>Prayer times</SectionLabel>
      <PrayerTimes />

      {/* Backup ------------------------------------------------------------ */}
      <SectionLabel>Backup & data</SectionLabel>
      <BackupControls exportJSON={exportJSON} importJSON={importJSON} resetAll={resetAll} />

      {/* Version — tap 5× to reveal the owner-only Private tab -------------- */}
      <VersionTapper onReveal={onRevealPrivate} />
    </Screen>
  )
}

const APP_VERSION = '0.1.0'

/**
 * The app version, doubling as the hidden entry point to the Private tab.
 * Tap it 5 times (within a few seconds) to reveal the tab for this session.
 * No visible hint before then — the tab is meant to be discoverable only by
 * the owner who knows the gesture.
 */
function VersionTapper({ onReveal }) {
  const [count, setCount] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const timer = useRef(null)

  const tap = () => {
    if (revealed) return
    const n = count + 1
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setCount(0), 1500)
    if (n >= 5) {
      setRevealed(true)
      setCount(0)
      if (navigator.vibrate) navigator.vibrate([10, 40, 10])
      onReveal?.()
    } else {
      setCount(n)
    }
  }

  return (
    <button onClick={tap} className="w-full text-center mt-8 select-none">
      <div className="text-[11px] text-[var(--color-faint)]">
        The Rebuild · v{APP_VERSION} · everything stays on this device
      </div>
      {revealed && (
        <div className="text-[11px] text-[var(--color-accent-ink)] mt-1 animate-fade">Private tab revealed</div>
      )}
    </button>
  )
}

// --- My quotes --------------------------------------------------------------

/**
 * Add my own lines to the Daily anchor's curated pool. Kept deliberately
 * simple: a text box and a list. Everything here is device-local and rides
 * along in the JSON backup like the rest of the state.
 */
function MyQuotes() {
  const { state, addMyQuote, removeMyQuote } = useStore()
  const [text, setText] = useState('')
  const quotes = state.myQuotes || []

  const add = () => {
    if (!text.trim()) return
    addMyQuote(text)
    setText('')
  }

  return (
    <Card className="px-4 py-4 space-y-3">
      <div className="flex gap-2">
        <TextInput value={text} onChange={setText}
          placeholder="A line that keeps you going…"
          onKeyDown={(e) => { if (e.key === 'Enter') add() }} />
        <Button variant="primary" onClick={add}>Add</Button>
      </div>

      {quotes.length === 0 ? (
        <p className="text-[11px] text-[var(--color-faint)]">
          Your lines join the daily anchor’s rotation alongside the built-in ones.
        </p>
      ) : (
        <div className="space-y-1.5">
          {quotes.map((q) => (
            <div key={q.id} className="flex items-start gap-2 rounded-xl border border-[var(--color-line)] px-3 py-2">
              <span className="flex-1 text-sm leading-snug">{q.text}</span>
              <button onClick={() => removeMyQuote(q.id)}
                aria-label="Remove quote"
                className="text-[var(--color-faint)] hover:text-[var(--color-danger)] text-sm shrink-0 leading-none mt-0.5">✕</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

// --- Habit manager ----------------------------------------------------------

function HabitManager() {
  const { state } = useStore()
  const [editing, setEditing] = useState(null) // habit id, or 'new', or null
  const byPhase = PHASES.map((p) => ({
    phase: p,
    habits: state.habits.filter((h) => h.phase === p.n),
  }))

  return (
    <div className="space-y-4">
      {byPhase.map(({ phase, habits }) => (
        <div key={phase.n}>
          <div className="text-xs text-[var(--color-muted)] mb-1.5">Phase {phase.n} · {phase.name}</div>
          <div className="space-y-1.5">
            {habits.map((h) => (
              <div key={h.id}>
                <button onClick={() => setEditing(editing === h.id ? null : h.id)}
                  className={`w-full rounded-xl border px-3 py-2.5 flex items-center gap-3 text-left transition ${
                    h.archived ? 'border-[var(--color-line)] opacity-45' : 'border-[var(--color-line)]'}`}>
                  <span className="text-lg w-6 text-center">{h.emoji}</span>
                  <span className="flex-1 min-w-0 text-sm break-words">{h.name}</span>
                  <span className="shrink-0 text-[10px] text-[var(--color-faint)]">{freqLabel(h.frequency)}</span>
                  {h.archived && <span className="text-[10px] text-[var(--color-faint)]">archived</span>}
                </button>
                {editing === h.id && <HabitEditor habit={h} onClose={() => setEditing(null)} />}
              </div>
            ))}
          </div>
        </div>
      ))}

      {editing === 'new'
        ? <HabitEditor onClose={() => setEditing(null)} />
        : <Button className="w-full" onClick={() => setEditing('new')}>+ Add a habit</Button>}
    </div>
  )
}

function HabitEditor({ habit, onClose }) {
  const { upsertHabit, archiveHabit } = useStore()
  const isNew = !habit
  const [name, setName] = useState(habit?.name || '')
  const [emoji, setEmoji] = useState(habit?.emoji || '✅')
  const [phase, setPhaseN] = useState(habit?.phase || 1)
  const [minVersion, setMinVersion] = useState(habit?.minVersion || '')
  const [freqKind, setFreqKind] = useState(habit?.frequency?.kind || 'daily')
  const [perWeek, setPerWeek] = useState(habit?.frequency?.count || 3)
  const [weekdays, setWeekdays] = useState(habit?.frequency?.days || [1, 3, 5])
  const [optional, setOptional] = useState(!!habit?.optional)

  const buildFreq = () => {
    if (freqKind === 'perWeek') return { kind: 'perWeek', count: Math.max(1, Math.min(7, perWeek)) }
    if (freqKind === 'weekdays') return { kind: 'weekdays', days: weekdays.slice().sort() }
    return { kind: 'daily' }
  }

  const save = () => {
    if (!name.trim()) return
    const id = habit?.id || name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + Math.random().toString(36).slice(2, 6)
    upsertHabit({
      ...(habit || { type: 'standard' }),
      id, name: name.trim(), emoji: emoji.trim() || '✅',
      phase: Number(phase), minVersion: minVersion.trim(),
      frequency: buildFreq(), optional,
    })
    onClose()
  }

  const toggleDay = (d) => setWeekdays((w) => w.includes(d) ? w.filter((x) => x !== d) : [...w, d])

  return (
    <Card className="px-4 py-4 mt-1.5 space-y-3 animate-fade">
      <div className="flex gap-2">
        <TextInput value={emoji} onChange={setEmoji} className="w-16 text-center text-lg" maxLength={4} />
        <TextInput value={name} onChange={setName} placeholder="Habit name" />
      </div>

      <div>
        <div className="text-xs text-[var(--color-muted)] mb-1">2-minute version</div>
        <TextInput value={minVersion} onChange={setMinVersion} placeholder="The shrunk-down rep that still counts…" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <div className="text-xs text-[var(--color-muted)] mb-1">Phase</div>
          <select value={phase} onChange={(e) => setPhaseN(Number(e.target.value))}
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5 text-sm">
            {PHASES.map((p) => <option key={p.n} value={p.n}>Phase {p.n} · {p.name}</option>)}
          </select>
        </div>
        <div>
          <div className="text-xs text-[var(--color-muted)] mb-1">Frequency</div>
          <select value={freqKind} onChange={(e) => setFreqKind(e.target.value)}
            className="w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5 text-sm">
            <option value="daily">Daily</option>
            <option value="perWeek">X per week</option>
            <option value="weekdays">Specific days</option>
          </select>
        </div>
      </div>

      {freqKind === 'perWeek' && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-muted)]">Times per week</span>
          <input type="number" min={1} max={7} value={perWeek}
            onChange={(e) => setPerWeek(Number(e.target.value))}
            className="w-16 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2 text-sm text-center" />
        </div>
      )}
      {freqKind === 'weekdays' && (
        <div className="flex gap-1.5">
          {WEEKDAY_LABELS.map((lbl, d) => (
            <button key={d} onClick={() => toggleDay(d)}
              className={`w-9 h-9 rounded-lg border text-xs transition ${
                weekdays.includes(d) ? 'border-[var(--color-accent)] text-[var(--color-accent-ink)]'
                                     : 'border-[var(--color-line)] text-[var(--color-muted)]'}`}>
              {lbl}
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 text-sm text-[var(--color-muted)]">
        <input type="checkbox" checked={optional} onChange={(e) => setOptional(e.target.checked)} />
        Optional (won’t count against your daily score)
      </label>

      <div className="flex gap-2 pt-1">
        <Button variant="primary" className="flex-1" onClick={save}>{isNew ? 'Add habit' : 'Save'}</Button>
        {!isNew && (
          <Button variant="ghost" onClick={() => { archiveHabit(habit.id, !habit.archived); onClose() }}>
            {habit.archived ? 'Unarchive' : 'Archive'}
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
      </div>
    </Card>
  )
}

// --- Appearance (theme picker with live swatches) ----------------------------

function Appearance() {
  const { state, setTheme } = useStore()
  const choice = state.settings.theme || 'system'
  const options = [{ id: 'system', name: 'System' }, ...THEMES.map((t) => ({ id: t.id, name: t.name, palette: t.palette }))]
  return (
    <Card className="px-4 py-4">
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => {
          const on = choice === o.id
          return (
            <button key={o.id} onClick={() => setTheme(o.id)}
              className={`flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left transition ${
                on ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/40' : 'border-[var(--color-line)]'}`}>
              <Swatch palette={o.palette} />
              <span className="text-sm">{o.name}</span>
              {on && <span className="ml-auto text-[var(--color-accent-ink)] text-xs">✓</span>}
            </button>
          )
        })}
      </div>
      <p className="text-[11px] text-[var(--color-faint)] mt-2">
        System follows your device. Your pick stays on this device, and it’s in the backup.
      </p>
    </Card>
  )
}

// A small preview dot showing a theme's background + accent (or split for System).
function Swatch({ palette }) {
  if (!palette) {
    return (
      <span className="w-7 h-7 rounded-full border border-[var(--color-line-2)] overflow-hidden flex shrink-0">
        <span className="w-1/2 h-full" style={{ background: '#f5f0e6' }} />
        <span className="w-1/2 h-full" style={{ background: '#1b1917' }} />
      </span>
    )
  }
  return (
    <span className="w-7 h-7 rounded-full border border-[var(--color-line-2)] grid place-items-center shrink-0"
      style={{ background: palette.ink }}>
      <span className="w-3 h-3 rounded-full" style={{ background: palette.accent }} />
    </span>
  )
}

// --- Prayer location (per-device: geolocation or city search) ----------------

function PrayerLocation() {
  const { state } = useStore()
  const loc = state.settings.prayerLocation
  const [editing, setEditing] = useState(!loc)

  return (
    <Card className="px-4 py-4">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium truncate">{loc ? loc.label : 'No location set'}</div>
          <div className="text-[11px] text-[var(--color-faint)]">
            {loc ? 'Used for AlAdhan prayer times' : 'Set a location to see prayer times'}
          </div>
        </div>
        {loc && !editing && (
          <Button variant="ghost" onClick={() => setEditing(true)} className="!px-2 !py-1 text-xs shrink-0">Change</Button>
        )}
      </div>
      {editing && (
        <div className="mt-3">
          <PrayerLocationPicker onSet={() => setEditing(false)} />
          {loc && (
            <button onClick={() => setEditing(false)} className="text-[12px] text-[var(--color-faint)] mt-2">Cancel</button>
          )}
        </div>
      )}
    </Card>
  )
}

// --- Prayer times (AlAdhan live + cache + per-prayer adjust) -----------------

function PrayerTimes() {
  const { state, today, updateSettings } = useStore()
  const { times, source, fetchedAt, status, refresh } = usePrayerTimes(today)
  const adjust = state.settings.prayerAdjustMin || {}
  const [showManual, setShowManual] = useState(false)

  const bump = (p, delta) =>
    updateSettings({ prayerAdjustMin: { ...adjust, [p]: (adjust[p] || 0) + delta } })

  const badge = {
    live: ['Live', 'text-[var(--color-accent-ink)]'],
    cache: ['Cached (offline-ready)', 'text-[var(--color-accent-ink)]'],
    loading: ['Loading…', 'text-[var(--color-muted)]'],
    manual: ['Manual', 'text-[var(--color-min)]'],
    error: ['Unavailable', 'text-[var(--color-min)]'],
    none: ['Not set', 'text-[var(--color-faint)]'],
  }[status === 'loading' ? 'loading' : source === 'manual' ? 'manual' : status] || ['—', 'text-[var(--color-faint)]']

  return (
    <Card className="px-4 py-4">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm font-medium truncate min-w-0">{state.settings.prayerLocation?.label || 'No location set'}</div>
        <span className={`text-[11px] shrink-0 ${badge[1]}`}>● {badge[0]}</span>
      </div>
      <div className="flex items-center justify-between mb-3">
        <span className="text-[11px] text-[var(--color-faint)]">
          {fetchedAt ? `Updated ${agoLabel(fetchedAt)} · ISNA method` : 'AlAdhan API · ISNA method'}
        </span>
        <Button variant="ghost" onClick={refresh} className="!px-2 !py-1 text-xs">↻ Refresh</Button>
      </div>

      {/* Today's times with per-prayer nudge */}
      <div className="space-y-1">
        {PRAYER_KEYS.map((p) => {
          const off = adjust[p] || 0
          return (
            <div key={p} className="flex items-center gap-2">
              <span className="text-xs capitalize w-16 text-[var(--color-muted)]">{p}</span>
              <span className="text-sm tabular-nums flex-1">{times ? fmt12(times[p]) : '—'}</span>
              {off !== 0 && (
                <span className="text-[10px] text-[var(--color-min)] tabular-nums w-10 text-right">
                  {off > 0 ? `+${off}` : off}m
                </span>
              )}
              <button onClick={() => bump(p, -1)} className="w-7 h-7 rounded-lg border border-[var(--color-line)] text-[var(--color-muted)]">−</button>
              <button onClick={() => bump(p, +1)} className="w-7 h-7 rounded-lg border border-[var(--color-line)] text-[var(--color-muted)]">＋</button>
            </div>
          )
        })}
      </div>
      <p className="text-[11px] text-[var(--color-faint)] mt-2">
        Nudge any time ±minutes to match your masjid’s iqamah. Times are cached, so they work
        offline once loaded.
      </p>

      {/* Manual fallback (used only when offline and nothing is cached) */}
      <button onClick={() => setShowManual((v) => !v)}
        className="text-xs text-[var(--color-muted)] mt-3 underline decoration-dotted">
        {showManual ? 'Hide manual fallback' : 'Set manual fallback times'}
      </button>
      {showManual && <ManualPrayerTimes />}
    </Card>
  )
}

function ManualPrayerTimes() {
  const { state, updateSettings } = useStore()
  const times = state.settings.prayerTimes || {}
  const set = (p, v) => updateSettings({ prayerTimes: { ...times, [p]: v } })
  return (
    <div className="mt-3 pt-3 border-t border-[var(--color-line)]">
      <p className="text-[11px] text-[var(--color-faint)] mb-2">
        Only used if you’re offline before any month has been cached.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {PRAYER_KEYS.map((p) => (
          <div key={p} className="flex items-center gap-2">
            <span className="text-xs capitalize w-14 text-[var(--color-muted)]">{p}</span>
            <input type="time" value={times[p] || ''} onChange={(e) => set(p, e.target.value)}
              className="flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] px-2 py-1.5 text-sm" />
          </div>
        ))}
      </div>
    </div>
  )
}

function agoLabel(ts) {
  const mins = Math.floor((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

// --- Backup controls --------------------------------------------------------

function BackupControls({ exportJSON, importJSON, resetAll }) {
  const { markExported, state } = useStore()
  const fileRef = useRef(null)
  const lastExport = state.settings.lastExportAt

  const doExport = () => {
    downloadBackup(exportJSON())
    markExported()
  }

  const doImport = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        importJSON(String(reader.result))
        alert('Backup restored.')
      } catch {
        alert('That file didn’t look like a valid backup.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <Card className="px-4 py-4 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={doExport}>Export JSON</Button>
        <Button onClick={() => fileRef.current?.click()}>Import JSON</Button>
      </div>
      <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={doImport} />
      <div className="text-[11px] text-[var(--color-faint)] text-center">
        {lastExport ? `Last export: ${fmtExport(lastExport)}` : 'No backup exported yet'}
      </div>
      <Button variant="danger" className="w-full"
        onClick={() => { if (confirm('Erase ALL data and start over? Export a backup first.')) resetAll() }}>
        Reset everything
      </Button>
    </Card>
  )
}

function fmtExport(ts) {
  const d = new Date(ts)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const days = Math.floor((Date.now() - ts) / 86400000)
  const ago = days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
  return `${months[d.getMonth()]} ${d.getDate()} (${ago})`
}

// --- helpers ----------------------------------------------------------------

function freqLabel(f) {
  if (f.kind === 'daily') return 'daily'
  if (f.kind === 'perWeek') return `${f.count}×/wk`
  if (f.kind === 'weekdays') return f.days.map((d) => WEEKDAY_LABELS[d]).join('')
  return ''
}
