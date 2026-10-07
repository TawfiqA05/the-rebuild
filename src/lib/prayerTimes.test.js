import { describe, it, expect, afterEach } from 'vitest'
import { locKey, computeTimes, monthUrl, clearPrayerCache } from './prayerTimes.js'

// Location handling is the crux of the per-device rewrite: the cache/identity
// key must be stable per place, and computeTimes must degrade sensibly when
// there's no location or no cached month. (Cache reads go through localStorage,
// which is absent under vitest's node env → treated as empty, i.e. "no cache".)

describe('locKey', () => {
  it('is null-safe and distinguishes coords from addresses', () => {
    expect(locKey(null)).toBe('none')
    expect(locKey({ mode: 'coords', lat: 41.8781, lng: -87.6298 })).toBe('geo:41.878,-87.630')
    expect(locKey({ mode: 'address', address: 'Chicago, Illinois, USA' })).toBe('addr:chicago, illinois, usa')
  })

  it('rounds coordinates so tiny GPS jitter maps to the same cache key', () => {
    const a = locKey({ mode: 'coords', lat: 41.87811, lng: -87.62988 })
    const b = locKey({ mode: 'coords', lat: 41.87829, lng: -87.63002 })
    expect(a).toBe(b)
  })

  it('normalises address case', () => {
    expect(locKey({ mode: 'address', address: 'Cairo, EG' }))
      .toBe(locKey({ mode: 'address', address: 'cairo, eg' }))
  })
})

describe('monthUrl', () => {
  it('sends coordinates rounded to two decimals, nothing finer', () => {
    const url = monthUrl('2026', 10, { mode: 'coords', lat: 41.878113, lng: -87.629799 })
    const q = new URL(url).searchParams
    expect(q.get('latitude')).toBe('41.88')
    expect(q.get('longitude')).toBe('-87.63')
    expect(url).not.toContain('41.878')
    expect(url).not.toContain('87.629')
  })

  it('leaves the cache key at three decimals', () => {
    expect(locKey({ mode: 'coords', lat: 41.878113, lng: -87.629799 })).toBe('geo:41.878,-87.630')
  })

  it('sends a typed place as typed', () => {
    const url = monthUrl('2026', 10, { mode: 'address', address: 'Chicago, IL' })
    expect(new URL(url).searchParams.get('address')).toBe('Chicago, IL')
    expect(url).toContain('/v1/calendarByAddress/2026/10')
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

describe('clearPrayerCache', () => {
  afterEach(() => { delete globalThis.localStorage })

  it('removes the saved months and leaves every other key alone', () => {
    const store = new Map([['rebuild:prayer-cache:v2', '{"addr:x":{}}'], ['the-rebuild:v1', '{}']])
    globalThis.localStorage = {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
    }
    clearPrayerCache()
    expect(store.has('rebuild:prayer-cache:v2')).toBe(false)
    expect(store.get('the-rebuild:v1')).toBe('{}')
  })

  it('does not throw when storage is blocked', () => {
    expect(() => clearPrayerCache()).not.toThrow()
  })
})
