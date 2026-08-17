import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { useLongPress } from './useLongPress.js'
import { nextSalah } from '../lib/gesture.js'
import { SALAH_PRAYERS, salahSummary } from '../lib/logic.js'
import { usePrayerTimes } from '../hooks/usePrayerTimes.js'
import { fmtDuration } from '../lib/prayerTimes.js'
import PrayerLocationPicker from './PrayerLocationPicker.jsx'
import { useT } from '../i18n.jsx'

/**
 * Salah is special: five sub-checkboxes, each cycling
 *   pending → on time → late → pending.
 * The card completes when all five are prayed; it's a "full" rep only when all
 * five were on time (late prayers still count as prayed — shrink it, don't skip).
 *
 * We also overlay real prayer times (AlAdhan, cached offline) under each prayer
 * and highlight the window we're currently in.
 */
export default function SalahCard({ dayKey }) {
  const { state } = useStore()
  const { t } = useT()
  const log = state.logs[dayKey]?.['salah'] || {}
  const sum = salahSummary(log)
  const location = state.settings.prayerLocation

  const { times, source, status, current, next, minsToNext } = usePrayerTimes(dayKey)

  const border = sum.done
    ? sum.rep === 'full' ? 'border-[var(--color-accent)]' : 'border-[var(--color-min)]'
    : 'border-[var(--color-line)]'

  return (
    <div className={`rounded-2xl border ${border} bg-[var(--color-surface)] px-4 py-3.5`}>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xl w-8 text-center">🕌</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium">{t('salah.title')}</div>
          <div className="text-xs text-[var(--color-muted)]">
            {sum.done
              ? sum.rep === 'full' ? 'All five, on time ✓' : `Prayed all five (${5 - sum.onTime} late)`
              : `${sum.prayed}/5 prayed`}
          </div>
        </div>
        <NextBadge times={times} next={next} minsToNext={minsToNext} status={status} />
      </div>

      {/* Current city, so you can tell at a glance the times are for where you are. */}
      {location && (
        <div className="text-[10px] text-[var(--color-faint)] mb-2 pl-11 truncate">📍 {location.label}</div>
      )}

      {/* No location yet → prompt to set one right here (first Salah-card view). */}
      {!location ? (
        <div className="mt-1 pl-1">
          <div className="text-[12px] text-[var(--color-muted)] mb-2">
            Set your location to see prayer times. It stays on this device.
          </div>
          <PrayerLocationPicker compact />
        </div>
      ) : (
        <>
          {/* source hint, only when it's worth saying */}
          {(source === 'manual' || source === 'none' || status === 'error') && (
            <div className="text-[10px] text-[var(--color-faint)] mb-2 pl-11">
              {source === 'manual' ? 'offline, using your manual times'
                : status === 'loading' ? 'loading prayer times…'
                : 'no prayer times yet. Set a location in Settings'}
            </div>
          )}

          <div className="grid grid-cols-5 gap-1.5 mt-2">
            {SALAH_PRAYERS.map((p) => (
              <PrayerCell key={p} dayKey={dayKey} p={p} value={log[p]} isNow={current === p} time={times?.[p]} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// One prayer sub-check. Cycles pending → on time → late → pending, but only on a
// clean stationary tap (scrolling over it does nothing), and each change drops
// an Undo toast.
function PrayerCell({ dayKey, p, value, isNow, time }) {
  const { setSalah } = useStore()
  const { t } = useT()
  const toast = useToast()
  const name = t(`salah.${p}`)

  const onTap = () => {
    const next = nextSalah(value)
    if (navigator.vibrate) navigator.vibrate(6)
    setSalah(dayKey, p, next)
    const label = next === 'ontime' ? 'on time' : next === 'late' ? 'late' : 'cleared'
    toast(`${name} · ${label}`, () => setSalah(dayKey, p, value ?? null))
  }
  const press = useLongPress(onTap)

  const cls =
    value === 'ontime' ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/60 text-[var(--color-accent-ink)]'
    : value === 'late' ? 'border-[var(--color-min)] bg-[var(--color-min-soft)]/60 text-[var(--color-min)]'
    : isNow ? 'border-[var(--color-accent)]/45 text-[var(--color-fg)]'
    : 'border-[var(--color-line)] text-[var(--color-faint)]'

  return (
    <button
      {...press}
      aria-label={`${name}: ${value === 'ontime' ? 'on time' : value === 'late' ? 'late' : 'not prayed'}`}
      className={`press no-callout relative rounded-xl border py-2.5 flex flex-col items-center gap-0.5 ${cls}`}
      style={{ touchAction: 'pan-y' }}
    >
      {isNow && (
        <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-wide
          bg-[var(--color-accent)] text-[var(--color-on-accent)] rounded-full px-1.5 py-px leading-none">now</span>
      )}
      <span className="text-[11px] font-medium">{name}</span>
      <span className="text-[10px] tabular-nums">{time ? compact(time) : '—'}</span>
      <span className="text-[9px] opacity-80">
        {value === 'ontime' ? 'on time' : value === 'late' ? 'late' : '·'}
      </span>
    </button>
  )
}

function NextBadge({ times, next, minsToNext, status }) {
  if (status === 'loading' && !times) {
    return <span className="text-[10px] text-[var(--color-faint)]">loading…</span>
  }
  if (!times || !next || minsToNext == null) return null
  return (
    <div className="text-right shrink-0">
      <div className="text-[10px] text-[var(--color-faint)] uppercase tracking-wide">next</div>
      <div className="text-xs font-medium capitalize">{next}</div>
      <div className="text-[10px] text-[var(--color-muted)] tabular-nums">in {fmtDuration(minsToNext)}</div>
    </div>
  )
}

// Compact 12h time for the tight 5-column grid, e.g. "5:23a".
function compact(hm) {
  const [h, m] = hm.split(':').map(Number)
  const ampm = h < 12 ? 'a' : 'p'
  const hr = h % 12 === 0 ? 12 : h % 12
  return `${hr}:${String(m).padStart(2, '0')}${ampm}`
}
