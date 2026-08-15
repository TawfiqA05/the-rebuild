import { useState } from 'react'
import { StoreProvider } from './store.jsx'
import Today from './screens/Today.jsx'
import Stats from './screens/Stats.jsx'
import Shutdown from './screens/Shutdown.jsx'
import WeeklyReview from './screens/WeeklyReview.jsx'
import Private from './screens/Private.jsx'
import Settings from './screens/Settings.jsx'

// Five bottom-nav tabs. "weekly" is a screen reachable from Today/Stats but not
// a tab of its own.
const TABS = [
  { id: 'today', label: 'Today', icon: '◎' },
  { id: 'stats', label: 'Stats', icon: '▤' },
  { id: 'shutdown', label: 'Wind down', icon: '☾' },
  { id: 'private', label: 'Private', icon: '🔒' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
]

export default function App() {
  const [screen, setScreen] = useState('today')
  const navigate = setScreen

  return (
    <StoreProvider>
      <div className="min-h-[100dvh] bg-[var(--color-ink)]">
        <main>
          {screen === 'today' && <Today navigate={navigate} />}
          {screen === 'stats' && <Stats navigate={navigate} />}
          {screen === 'shutdown' && <Shutdown navigate={navigate} />}
          {screen === 'weekly' && <WeeklyReview navigate={navigate} />}
          {screen === 'private' && <Private navigate={navigate} />}
          {screen === 'settings' && <Settings navigate={navigate} />}
        </main>
        <BottomNav screen={screen} setScreen={setScreen} />
      </div>
    </StoreProvider>
  )
}

function BottomNav({ screen, setScreen }) {
  // "weekly" highlights the Stats tab since that's where it's launched from.
  const active = screen === 'weekly' ? 'stats' : screen
  return (
    <nav
      className="fixed bottom-0 inset-x-0 border-t border-[var(--color-line)] bg-[var(--color-ink)]/90 backdrop-blur-md"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-md mx-auto grid grid-cols-5">
        {TABS.map((t) => (
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
