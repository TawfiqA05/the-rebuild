// ---------------------------------------------------------------------------
// i18n engine. English is bundled as the base; other languages are lazy-loaded
// so we don't ship every catalog to every user. Missing keys fall back to
// English, so a partial translation never leaks a raw key into the UI.
//
// Adding a language = add an entry to LANGUAGES and a case in loadCatalog with
// its own file. RTL is a per-language flag.
// ---------------------------------------------------------------------------

import en from './en.js'

export const LANGUAGES = [
  { id: 'en', name: 'English', dir: 'ltr' },
  { id: 'ar', name: 'العربية', dir: 'rtl' },
]

export function languageMeta(id) {
  return LANGUAGES.find((l) => l.id === id) || LANGUAGES[0]
}
export function dirOf(id) {
  return languageMeta(id).dir
}
export function isRTL(id) {
  return dirOf(id) === 'rtl'
}

/** The best supported language for the device, or 'en'. */
export function detectLanguage() {
  const raw = (typeof navigator !== 'undefined' && (navigator.language || navigator.languages?.[0])) || 'en'
  const code = String(raw).slice(0, 2).toLowerCase()
  return LANGUAGES.some((l) => l.id === code) ? code : 'en'
}

/** Lazy-load a language's overlay catalog. English is already bundled. */
export async function loadCatalog(id) {
  if (id === 'en') return en
  try {
    switch (id) {
      case 'ar': return (await import('./ar.js')).default
      default: return {}
    }
  } catch {
    return {}
  }
}

/**
 * Resolve a key against an overlay catalog, falling back to English and then —
 * only if all else fails — the key itself. Interpolates {vars}.
 */
export function translate(overlay, key, vars) {
  let s = (overlay && overlay[key]) ?? en[key] ?? key
  if (vars) for (const k in vars) s = s.replaceAll(`{${k}}`, String(vars[k]))
  return s
}

export { en }
