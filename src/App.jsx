import { useState } from 'react'
import { StoreProvider } from './store.jsx'
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
  const [screen, setScreen] = useState('today')
  // Reveal is intentionally ephemeral (not persisted): the Private tab is hidden
  // on every fresh launch until the owner performs the reveal gesture again.
  const [privateRevealed, setPrivateRevealed] = useState(false)
  const navigate = setScreen

  const revealPrivate = () => { setPrivateRevealed(true); setScreen('private') }

  // Guard: if the tab isn't revealed, never render the Private screen.
  const activeScreen = screen === 'private' && !privateRevealed ? 'today' : screen

  return (
    <StoreProvider>
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
    </StoreProvider>
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
            className={`py-2.5 flex flex-col items-center gap-0.5 text-[10px] transition ${
              active === t.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-faint)]'
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
