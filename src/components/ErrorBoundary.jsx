import { Component } from 'react'
import { STORAGE_KEY } from '../store.jsx'
import { savedDataExport } from '../lib/rescue.js'
import { downloadBackup } from '../lib/backup.js'
import { translate, loadCatalog, dirOf, detectLanguage, en } from '../lib/i18n/index.js'

// The top of the app. A crash while drawing shows a plain screen with Reload
// and Export my data instead of a blank page. It doesn't trust the app's state
// (that's what crashed): the language and the export both come from storage.

function savedLanguage() {
  try {
    const lang = JSON.parse(localStorage.getItem(STORAGE_KEY))?.settings?.language
    if (typeof lang === 'string') return lang
  } catch { /* unreadable or blocked: use the device's language */ }
  return detectLanguage()
}

export default class ErrorBoundary extends Component {
  state = { crashed: false, language: 'en', catalog: null }

  static getDerivedStateFromError() {
    return { crashed: true }
  }

  componentDidCatch(err) {
    console.error('The app crashed while drawing:', err)
    const language = savedLanguage()
    loadCatalog(language).then((catalog) => this.setState({ language, catalog: catalog || en }))
  }

  render() {
    if (!this.state.crashed) return this.props.children
    // Wait for the words, so the screen doesn't flash in the wrong language.
    if (!this.state.catalog) return null
    const t = (key) => translate(this.state.catalog, key)
    return (
      <div dir={dirOf(this.state.language)} lang={this.state.language} className="min-h-[100dvh] bg-[var(--color-ink)] text-[var(--color-fg)]">
        <div className="max-w-md mx-auto px-6 pt-16 pb-10 space-y-6">
          <p data-testid="crash-body" className="text-[15px] leading-relaxed">{t('crash.body')}</p>
          <div className="space-y-2.5">
            <button
              data-testid="crash-reload"
              onClick={() => location.reload()}
              className="press w-full rounded-xl border border-transparent bg-[var(--color-accent)] text-[var(--color-on-accent)] font-medium px-4 py-3.5 text-sm"
            >
              {t('crash.reload')}
            </button>
            <button
              data-testid="crash-export"
              onClick={() => downloadBackup(savedDataExport(STORAGE_KEY))}
              className="press w-full rounded-xl border border-[var(--color-line-2)] bg-[var(--color-surface)] px-4 py-3.5 text-sm"
            >
              {t('rescue.export')}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
