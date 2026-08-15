import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from '../store.jsx'
import {
  computeTimes, currentPrayer, fetchMonth, getRawTimes,
} from '../lib/prayerTimes.js'

/**
 * React glue for prayer times. On mount it makes sure the current month is
 * cached (fetching in the background if not), recomputes the "current window"
 * every minute, and re-derives times when your Settings offsets change.
 *
 * Returns: { times, source, status, current, next, nextAt, minsToNext, refresh }
 *   status: 'loading' | 'cache' | 'live' | 'error' | 'none'
 */
export function usePrayerTimes(dateKey) {
  const { state } = useStore()
  const [status, setStatus] = useState('loading')
  const [tick, setTick] = useState(0) // bumps to force recompute (fetch done / minute passed)

  const bump = useCallback(() => setTick((t) => t + 1), [])

  // Ensure the month is available; fetch if missing.
  useEffect(() => {
    let cancelled = false
    if (getRawTimes(dateKey)) {
      setStatus('cache')
      return
    }
    setStatus('loading')
    fetchMonth(dateKey)
      .then(() => { if (!cancelled) { setStatus('live'); bump() } })
      .catch(() => { if (!cancelled) { setStatus(computeTimes(dateKey, state.settings).times ? 'cache' : 'error'); bump() } })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey])

  // Re-evaluate the current window each minute.
  useEffect(() => {
    const id = setInterval(bump, 60 * 1000)
    return () => clearInterval(id)
  }, [bump])

  const { times, source, fetchedAt } = useMemo(
    () => computeTimes(dateKey, state.settings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateKey, state.settings.prayerAdjustMin, state.settings.prayerTimes, tick],
  )

  const window = useMemo(
    () => currentPrayer(times),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [times, tick],
  )

  const refresh = useCallback(() => {
    setStatus('loading')
    fetchMonth(dateKey)
      .then(() => { setStatus('live'); bump() })
      .catch(() => { setStatus('error'); bump() })
  }, [dateKey, bump])

  return { times, source, fetchedAt, status, ...window, refresh }
}
