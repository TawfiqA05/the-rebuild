import { useEffect, useState } from 'react'
import { StoreProvider, useStore, storageAvailable } from './store.jsx'
import { ToastProvider } from './components/Toast.jsx'
import { applyTheme } from './lib/themes.js'
import Tour from './components/Tour.jsx'
import Welcome from './screens/Welcome.jsx'
import Today from './screens/Today.jsx'
import Stats from './screens/Stats.jsx'
import Shutdown from './screens/Shutdown.jsx'
import WeeklyReview from './screens/WeeklyReview.jsx'
import Private from './screens/Private.jsx'
import Settings from './screens/Settings.jsx'

// Bottom-nav tabs. "weekly" is a screen reachable from Today/Stats but not a tab
// of its own. "private" is hidden by default — it only appears after the owner
// reveals it (tap the version number in Settings 5×), and re-hides on reload.
const TABS = [
  { id: 'today', label: 'Today', icon: '◎' },
  { id: 'stats', label: 'Stats', icon: '▤' },
  { id: 'shutdown', label: 'Wind down', icon: '☾' },
  { id: 'private', label: 'Private', icon: '🔒', hidden: true },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export default function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </StoreProvider>
  )
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
  // Reveal is intentionally ephemeral (not persisted): the Private tab is hidden
  // on every fresh launch until the owner performs the reveal gesture again.
  const [privateRevealed, setPrivateRevealed] = useState(false)
  const navigate = setScreen

  const revealPrivate = () => { setPrivateRevealed(true); setScreen('private') }

  // First run only. Existing devices are marked onboarded by migrate().
  if (!state.settings.onboarded) return <Welcome />

  // Guard: if the tab isn't revealed, never render the Private screen.
  const activeScreen = screen === 'private' && !privateRevealed ? 'today' : screen

  return (
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
        {activeScreen === 'private' && <Private navigate={navigate} />}
        {activeScreen === 'settings' && <Settings navigate={navigate} onRevealPrivate={revealPrivate} />}
      </main>
      <BottomNav screen={activeScreen} setScreen={setScreen} privateRevealed={privateRevealed} />
      {!state.settings.tourSeen && activeScreen === 'today' && <Tour />}
    </div>
  )
}

function BottomNav({ screen, setScreen, privateRevealed }) {
  // "weekly" highlights the Stats tab since that's where it's launched from.
  const active = screen === 'weekly' ? 'stats' : screen
  const tabs = TABS.filter((t) => !t.hidden || (t.id === 'private' && privateRevealed))
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
            onClick={() => setScreen(t.id)}
            className={`press py-2.5 flex flex-col items-center gap-1 text-[10px] whitespace-nowrap transition ${
              active === t.id ? 'text-[var(--color-accent-ink)]' : 'text-[var(--color-faint)]'
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
