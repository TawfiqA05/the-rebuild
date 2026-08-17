import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { Button, TextInput } from './ui.jsx'
import { buildShareSummary, shareSummaryToText } from '../lib/share.js'
import { drawShareCard, themeColors } from '../lib/shareCard.js'

/**
 * A bottom sheet that turns the week into something you can send a friend:
 * a plain-text version for iMessage and an ivory/gold image card (drawn on a
 * canvas, no external services). You add one optional line yourself. It only
 * ever touches habits, never the private or food logs.
 */
export default function ShareSheet({ onClose }) {
  const { state, today } = useStore()
  const toast = useToast()
  const [note, setNote] = useState('')
  const canvasRef = useRef(null)

  const summary = useMemo(() => buildShareSummary(state, today, { note }), [state, today, note])
  const text = useMemo(() => shareSummaryToText(summary), [summary])

  // Redraw the card whenever the summary changes (and once fonts are ready).
  useEffect(() => {
    let alive = true
    const paint = () => { if (alive && canvasRef.current) drawShareCard(canvasRef.current, summary, themeColors()) }
    paint()
    if (document.fonts?.ready) document.fonts.ready.then(paint)
  }, [summary])

  const canvasBlob = () =>
    new Promise((resolve) => canvasRef.current.toBlob((b) => resolve(b), 'image/png'))

  const shareIt = async () => {
    try {
      const blob = await canvasBlob()
      const file = new File([blob], 'the-rebuild-week.png', { type: 'image/png' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text })
        return
      }
      if (navigator.share) { await navigator.share({ text }); return }
      await copyText()
    } catch {
      // user cancelled the share sheet, or it's unavailable. Nothing to do.
    }
  }

  const copyText = async () => {
    try {
      await navigator.clipboard.writeText(text)
      toast('Copied. Paste it wherever.')
    } catch {
      toast('Could not copy. Select the text and copy it.')
    }
  }

  const saveImage = async () => {
    const blob = await canvasBlob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `the-rebuild-${today}.png`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--color-ink)] rounded-t-3xl border-t border-[var(--color-line)] max-h-[90dvh] flex flex-col animate-rise"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[var(--color-line)]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">Share your week</div>
            <div className="font-display text-2xl leading-tight">Send it to someone</div>
          </div>
          <button onClick={onClose} className="text-[13px] text-[var(--color-accent-ink)]">Close</button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <div>
            <div className="text-xs text-[var(--color-muted)] mb-1.5">Add a line (optional)</div>
            <TextInput value={note} onChange={setNote} placeholder="Say something in your own words" maxLength={140} />
          </div>

          {/* Live preview — this same canvas is what gets shared/saved. */}
          <div className="rounded-2xl overflow-hidden border border-[var(--color-line)]">
            <canvas ref={canvasRef} className="w-full h-auto block" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="primary" onClick={shareIt}>Share</Button>
            <Button onClick={copyText}>Copy text</Button>
            <Button onClick={saveImage}>Save image</Button>
          </div>
          <p className="text-[11px] text-[var(--color-faint)] text-center">
            Only your habits and streaks. Nothing from the private log or food.
          </p>
        </div>
      </div>
    </div>
  )
}
