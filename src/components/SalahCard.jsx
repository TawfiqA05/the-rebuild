import { useStore } from '../store.jsx'
import { SALAH_PRAYERS, SALAH_LABELS, salahSummary } from '../lib/logic.js'
import { usePrayerTimes } from '../hooks/usePrayerTimes.js'
import { fmtDuration } from '../lib/prayerTimes.js'

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
  const { state, cycleSalah } = useStore()
  const log = state.logs[dayKey]?.['salah'] || {}
  const sum = salahSummary(log)

  const { times, source, status, current, next, minsToNext } = usePrayerTimes(dayKey)

  const border = sum.done
    ? sum.rep === 'full' ? 'border-[var(--color-accent)]' : 'border-[var(--color-min)]'
    : 'border-[var(--color-line)]'

  return (
    <div className={`rounded-2xl border ${border} bg-[var(--color-surface)] px-4 py-3.5`}>
      <div className="flex items-center gap-3 mb-1">
        <span className="text-2xl w-8 text-center">🕌</span>
        <div className="flex-1 min-w-0">
          <div className="font-medium">Salah on time</div>
          <div className="text-xs text-[var(--color-muted)]">
            {sum.done
              ? sum.rep === 'full' ? 'All five, on time ✓' : `Prayed all five (${5 - sum.onTime} late)`
              : `${sum.prayed}/5 prayed`}
          </div>
        </div>
        <NextBadge times={times} next={next} minsToNext={minsToNext} status={status} />
      </div>

      {/* source hint, only when it's worth saying */}
      {(source === 'manual' || source === 'none' || status === 'error') && (
        <div className="text-[10px] text-[var(--color-faint)] mb-2 pl-11">
          {source === 'manual' ? 'offline — using your manual times'
            : status === 'loading' ? 'loading prayer times…'
            : 'prayer times unavailable — set them in Settings'}
        </div>
      )}

      <div className="grid grid-cols-5 gap-1.5 mt-2">
        {SALAH_PRAYERS.map((p) => {
          const v = log[p]
          const isNow = current === p
          const cls =
            v === 'ontime' ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/50 text-[var(--color-accent)]'
            : v === 'late' ? 'border-[var(--color-min)] bg-[var(--color-min-soft)]/50 text-[var(--color-min)]'
            : isNow ? 'border-[var(--color-risk)]/70 text-[var(--color-fg)]'
            : 'border-[var(--color-line)] text-[var(--color-faint)]'
          return (
            <button
              key={p}
              onClick={() => cycleSalah(dayKey, p)}
              className={`no-callout relative rounded-xl border py-2 flex flex-col items-center gap-0.5 active:scale-95 transition ${cls}`}
            >
              {isNow && (
                <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 text-[8px] uppercase tracking-wide
                  bg-[var(--color-risk)] text-white rounded-full px-1.5 py-px leading-none">now</span>
              )}
              <span className="text-[11px] font-medium">{SALAH_LABELS[p]}</span>
              <span className="text-[10px] tabular-nums">{times?.[p] ? compact(times[p]) : '—'}</span>
              <span className="text-[9px] opacity-80">
                {v === 'ontime' ? 'on time' : v === 'late' ? 'late' : '·'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
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
