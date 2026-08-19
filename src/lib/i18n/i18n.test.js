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

// English is the base and every other catalog is an overlay that falls back to
// it. That fallback is a feature (a partial translation never leaks a raw key)
// but it also hides rot: a new EN key with no Arabic entry silently shows English
// to Arabic users, and the existing "resolves to real text" test passes anyway.
// These assertions make Arabic parity explicit so it can't degrade unnoticed.
describe('Arabic catalog parity', () => {
  // Strings intentionally identical across languages — product name and proper
  // nouns that shouldn't be translated. Everything NOT listed here must differ
  // from English, so an untranslated copy-paste fails instead of shipping.
  const SHARED = new Set([
    'ob.brand', // the product name, kept in its original form
  ])

  it('has an Arabic entry for every English key (no silent English fallback)', () => {
    const missing = Object.keys(en).filter((k) => !(k in ar))
    expect(missing, `Arabic is missing: ${missing.join(', ')}`).toEqual([])
  })

  it('has no orphan Arabic keys that no longer exist in English (catches typos)', () => {
    const orphan = Object.keys(ar).filter((k) => !(k in en))
    expect(orphan, `Arabic has keys English doesn't: ${orphan.join(', ')}`).toEqual([])
  })

  it('every Arabic value is a real translation, not an English copy', () => {
    const untranslated = Object.keys(en).filter((k) => k in ar && ar[k] === en[k] && !SHARED.has(k))
    expect(untranslated, `still English in ar.js: ${untranslated.join(', ')}`).toEqual([])
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
