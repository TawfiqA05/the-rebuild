import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { translate, loadCatalog, dirOf, en } from './lib/i18n/index.js'

// React glue for the i18n engine. Holds the active language + its lazily-loaded
// overlay catalog, exposes t()/dir/language, and keeps <html lang/dir> in sync
// so RTL languages flip the whole layout.

const I18nContext = createContext(null)

export function I18nProvider({ language = 'en', children }) {
  const [overlay, setOverlay] = useState(language === 'en' ? en : {})

  useEffect(() => {
    let alive = true
    loadCatalog(language).then((cat) => { if (alive) setOverlay(cat || {}) })
    return () => { alive = false }
  }, [language])

  const dir = dirOf(language)
  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('lang', language)
    root.setAttribute('dir', dir)
  }, [language, dir])

  const value = useMemo(() => ({
    language,
    dir,
    t: (key, vars) => translate(overlay, key, vars),
  }), [language, dir, overlay])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useT() {
  const ctx = useContext(I18nContext)
  // Safe default if used outside a provider (e.g. isolated tests).
  if (!ctx) return { t: (k, v) => translate(en, k, v), dir: 'ltr', language: 'en' }
  return ctx
}
