import { useState } from 'react'
import { StoreProvider, useStore } from './store.jsx'
import { ToastProvider } from './components/Toast.jsx'
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
      <main>
        {activeScreen === 'today' && <Today navigate={navigate} />}
        {activeScreen === 'stats' && <Stats navigate={navigate} />}
        {activeScreen === 'shutdown' && <Shutdown navigate={navigate} />}
        {activeScreen === 'weekly' && <WeeklyReview navigate={navigate} />}
        {activeScreen === 'private' && <Private navigate={navigate} />}
        {activeScreen === 'settings' && <Settings navigate={navigate} onRevealPrivate={revealPrivate} />}
      </main>
      <BottomNav screen={activeScreen} setScreen={setScreen} privateRevealed={privateRevealed} />
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
