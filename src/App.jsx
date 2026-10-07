import { useEffect, useState } from 'react'
import { StoreProvider, useStore, storageAvailable } from './store.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { applyTheme } from './lib/themes.js'
import { I18nProvider, useT } from './i18n.jsx'
import { TutorialProvider } from './components/Tutorial.jsx'
import Welcome from './screens/Welcome.jsx'
import Today from './screens/Today.jsx'
import Stats from './screens/Stats.jsx'
import Shutdown from './screens/Shutdown.jsx'
import WeeklyReview from './screens/WeeklyReview.jsx'
import Extra from './screens/Extra.jsx'
import Settings from './screens/Settings.jsx'

// Bottom-nav tabs. "weekly" is a screen reachable from Today/Stats but not a tab
// of its own. Tabs marked hidden stay out of the nav until revealed for the
// session, and re-hide on reload.
const TABS = [
  { id: 'today', tkey: 'nav.today', icon: '◎' },
  { id: 'stats', tkey: 'nav.stats', icon: '▤' },
  { id: 'shutdown', tkey: 'nav.windDown', icon: '☾' },
  { id: 'extra', tkey: 'nav.private', icon: '🔒', hidden: true },
  { id: 'settings', tkey: 'nav.settings', icon: '⚙' },
]

export default function App() {
  return (
    <StoreProvider>
      <I18nBridge>
        <ToastProvider>
          <AppShell />
        </ToastProvider>
      </I18nBridge>
    </StoreProvider>
  )
}

// Reads the chosen language from the store and feeds the i18n provider.
function I18nBridge({ children }) {
  const { state } = useStore()
  return <I18nProvider language={state.settings.language || 'en'}>{children}</I18nProvider>
}

function AppShell() {
  const { state } = useStore()
  const themeChoice = state.settings.theme || 'system'

  // Apply the theme whenever the choice changes, and — when on System — follow
  // the device's light/dark switch live.
  useEffect(() => {
    applyTheme(themeChoice)
    if (themeChoice !== 'system' || typeof matchMedia === 'undefined') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [themeChoice])

  const [screen, setScreen] = useState('today')
  // Reveal is intentionally ephemeral (not persisted): a hidden tab stays hidden
  // on every fresh launch until it's revealed again.
  const [extraRevealed, setExtraRevealed] = useState(false)
  const navigate = setScreen

  const revealExtra = () => { setExtraRevealed(true); setScreen('extra') }

  // First run only. Existing devices are marked onboarded by migrate().
  if (!state.settings.onboarded) return <Welcome />

  // Guard: if the tab isn't revealed, never render its screen.
  const activeScreen = screen === 'extra' && !extraRevealed ? 'today' : screen

  // The learn-by-doing tutorial runs on first launch (existing devices are marked
  // tourSeen by migrate, so they never see it), and only on the Today screen
  // where the practice card and score live.
  const tutorialActive = activeScreen === 'today' && !state.settings.tourSeen

  return (
    <TutorialProvider active={tutorialActive}>
      <div className="min-h-[100dvh] bg-[var(--color-ink)]">
        {!storageAvailable && (
          <div className="bg-[var(--color-min-soft)] text-[var(--color-min)] text-[12.5px] text-center px-4 py-2 leading-snug">
            Storage is blocked in this browser, so nothing you log will be saved. Try leaving private mode.
          </div>
        )}
        <main>
          {activeScreen === 'today' && <Today navigate={navigate} />}
          {activeScreen === 'stats' && <Stats navigate={navigate} />}
          {activeScreen === 'shutdown' && <Shutdown navigate={navigate} />}
          {activeScreen === 'weekly' && <WeeklyReview navigate={navigate} />}
          {activeScreen === 'extra' && <Extra navigate={navigate} />}
          {activeScreen === 'settings' && <Settings navigate={navigate} onReveal={revealExtra} />}
        </main>
        <BottomNav screen={activeScreen} setScreen={setScreen} extraRevealed={extraRevealed} />
      </div>
    </TutorialProvider>
  )
}

function BottomNav({ screen, setScreen, extraRevealed }) {
  const { t: T } = useT()
  // "weekly" highlights the Stats tab since that's where it's launched from.
  const active = screen === 'weekly' ? 'stats' : screen
  const tabs = TABS.filter((t) => !t.hidden || (t.id === 'extra' && extraRevealed))
  return (
    <nav
      className="fixed bottom-0 inset-x-0 border-t border-[var(--color-line)] bg-[var(--color-ink)]/90 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div
        className="max-w-md mx-auto grid"
        style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            data-testid={`nav-${t.id}`}
            onClick={() => setScreen(t.id)}
            className={`press py-2.5 flex flex-col items-center gap-1 text-[10px] whitespace-nowrap transition ${
              active === t.id ? 'text-[var(--color-accent-ink)]' : 'text-[var(--color-faint)]'
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {T(t.tkey)}
          </button>
        ))}
      </div>
    </nav>
  )
}
