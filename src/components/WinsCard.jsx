import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Card, Button, TextInput } from './ui.jsx'

// A place to jot down proud moments. They get shown back to you on rough days,
// when it's easy to forget you've done hard things before.
export default function WinsCard() {
  const { state, addWin, removeWin } = useStore()
  const [text, setText] = useState('')
  const wins = state.wins || []

  const submit = () => {
    if (!text.trim()) return
    addWin(text)
    setText('')
  }

  return (
    <Card className="px-4 py-4">
      <div className="flex gap-2">
        <TextInput
          value={text}
          onChange={setText}
          placeholder="Something you're proud of…"
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <Button variant="primary" onClick={submit}>Log</Button>
      </div>

      {wins.length === 0 ? (
        <p className="text-[12.5px] text-[var(--color-muted)] mt-3 leading-relaxed">
          Nothing here yet. Add the small stuff — a hard workout you didn't skip, a
          call you were dreading. On a rough day one of these shows up on your Today screen.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {wins.map((w) => (
            <div key={w.id} className="flex items-start gap-2.5 group">
              <span className="text-[var(--color-accent)] mt-0.5 text-sm">•</span>
              <span className="flex-1 text-[14px] leading-snug">{w.text}</span>
              <span className="text-[11px] text-[var(--color-faint)] tnum shrink-0 mt-0.5">{fmtDate(w.at)}</span>
              <button
                onClick={() => removeWin(w.id)}
                className="text-[var(--color-faint)] hover:text-[var(--color-danger)] text-sm shrink-0 px-1"
                aria-label="remove"
              >×</button>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}

function fmtDate(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}`
}
