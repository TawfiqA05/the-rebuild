import { describe, it, expect } from 'vitest'
import en from './en.js'
import ar from './ar.js'
import { translate, dirOf, isRTL, detectLanguage, LANGUAGES } from './index.js'
import { migrate } from '../migrate.js'

describe('translation + fallback', () => {
  it('returns the overlay string when present', () => {
    expect(translate(ar, 'nav.today')).toBe('اليوم')
  })

  it('falls back to English for a key the overlay is missing', () => {
    const partial = { 'nav.today': 'X' } // no other keys
    expect(translate(partial, 'nav.settings')).toBe(en['nav.settings'])
  })

  it('never leaks a raw key: every en key resolves to real text in every language', () => {
    for (const key of Object.keys(en)) {
      for (const overlay of [en, ar]) {
        const out = translate(overlay, key)
        expect(out, `${key}`).toBeTruthy()
        expect(out, `${key} leaked as a raw key`).not.toBe(key)
      }
    }
  })

  it('interpolates vars', () => {
    expect(translate(en, 'ob.startN', { n: 3, unit: 'anchors' })).toBe('Continue with 3 anchors')
  })
})

describe('RTL flags', () => {
  it('marks Arabic RTL and English LTR', () => {
    expect(dirOf('ar')).toBe('rtl')
    expect(isRTL('ar')).toBe(true)
    expect(dirOf('en')).toBe('ltr')
    expect(isRTL('en')).toBe(false)
  })
  it('every listed language declares a direction', () => {
    for (const l of LANGUAGES) expect(['ltr', 'rtl']).toContain(l.dir)
  })
})

describe('detection + persistence', () => {
  it('detectLanguage returns a supported id (falls back to en)', () => {
    expect(LANGUAGES.some((l) => l.id === detectLanguage())).toBe(true)
  })
  it('the language choice survives migrate (rides in the backup)', () => {
    const s = { version: 2, settings: { onboarded: true, language: 'ar' }, habits: [], logs: {}, days: {} }
    expect(migrate(s).settings.language).toBe('ar')
    // a legacy state with no language key defaults to English
    const legacy = { version: 1, settings: { onboarded: true }, habits: [], logs: {}, days: {} }
    expect(migrate(legacy).settings.language).toBe('en')
  })
})
