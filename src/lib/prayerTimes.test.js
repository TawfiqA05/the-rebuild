import { describe, it, expect } from 'vitest'
import { locKey, computeTimes } from './prayerTimes.js'

// Location handling is the crux of the per-device rewrite: the cache/identity
// key must be stable per place, and computeTimes must degrade sensibly when
// there's no location or no cached month. (Cache reads go through localStorage,
// which is absent under vitest's node env → treated as empty, i.e. "no cache".)

describe('locKey', () => {
  it('is null-safe and distinguishes coords from addresses', () => {
    expect(locKey(null)).toBe('none')
    expect(locKey({ mode: 'coords', lat: 39.9568, lng: -86.0139 })).toBe('geo:39.957,-86.014')
    expect(locKey({ mode: 'address', address: 'Fishers, Indiana, USA' })).toBe('addr:fishers, indiana, usa')
  })

  it('rounds coordinates so tiny GPS jitter maps to the same cache key', () => {
    const a = locKey({ mode: 'coords', lat: 39.95681, lng: -86.01388 })
    const b = locKey({ mode: 'coords', lat: 39.95699, lng: -86.01402 })
    expect(a).toBe(b)
  })

  it('normalises address case', () => {
    expect(locKey({ mode: 'address', address: 'Cairo, EG' }))
      .toBe(locKey({ mode: 'address', address: 'cairo, eg' }))
  })
})

describe('computeTimes without a cached month', () => {
  it('reports "none" when there is no location set', () => {
    const r = computeTimes('2026-08-17', { prayerLocation: null })
    expect(r.source).toBe('none')
    expect(r.times).toBe(null)
  })

  it('falls back to manual times when offline with no cache', () => {
    const r = computeTimes('2026-08-17', {
      prayerLocation: { mode: 'address', address: 'Nowhere' },
      prayerTimes: { fajr: '05:30', dhuhr: '13:15', asr: '17:00', maghrib: '20:30', isha: '22:00' },
    })
    expect(r.source).toBe('manual')
    expect(r.times.fajr).toBe('05:30')
  })
})
