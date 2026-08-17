import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store.jsx'
import { useToast } from './Toast.jsx'
import { Button, TextInput } from './ui.jsx'
import { buildShareSummary, shareSummaryToText } from '../lib/share.js'
import { drawShareCard, themeColors } from '../lib/shareCard.js'
import { fmtMonthDay } from '../lib/time.js'
import { useT } from '../i18n.jsx'

/**
 * A bottom sheet that turns the week into something you can send a friend:
 * a plain-text version for iMessage and an ivory/gold image card (drawn on a
 * canvas, no external services). You add one optional line yourself. It only
 * ever touches habits, never the private or food logs.
 */
export default function ShareSheet({ onClose }) {
  const { state, today } = useStore()
  const { t, language, dir } = useT()
  const toast = useToast()
  const [note, setNote] = useState('')
  const canvasRef = useRef(null)

  const summary = useMemo(() => buildShareSummary(state, today, { note }), [state, today, note])
  const text = useMemo(() => shareSummaryToText(summary), [summary])

  // Redraw the card whenever the summary or language changes (and once fonts
  // are ready). In Arabic the card mirrors and its labels translate.
  useEffect(() => {
    let alive = true
    const labels = {
      brand: 'THE REBUILD',
      thisWeek: t('share.card.thisWeek', { date: fmtMonthDay(summary.weekStart, language) }),
      votes: t('share.card.votes', { votes: summary.votes.toLocaleString(language) }),
      footer: t('share.card.footer'),
    }
    const paint = () => { if (alive && canvasRef.current) drawShareCard(canvasRef.current, summary, themeColors(), { dir, labels }) }
    paint()
    if (document.fonts?.ready) document.fonts.ready.then(paint)
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary, language, dir])

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
      toast(t('share.copied'))
    } catch {
      toast(t('share.copyFail'))
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

  // The sheet is a fixed-height column so it always fits the screen: a pinned
  // header and add-a-line up top, the preview taking whatever height is left in
  // the middle (scaled to fit, never scrolled), and the share/copy/save row
  // pinned at the bottom, above the home bar. Nothing here scrolls — the preview
  // is a preview, so it shrinks to fit rather than pushing the buttons off-screen.
  //
  // Rendered through a portal to <body> on purpose: the screens animate in with
  // `animate-rise`, which leaves a lingering `transform` on their container. A
  // transformed ancestor becomes the containing block for `position: fixed`, so
  // an inline sheet would anchor to the (tall) page instead of the viewport and
  // land below the fold. The portal escapes that so `inset-0` means the screen.
  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div
        data-testid="share-sheet"
        className="relative w-full max-w-md bg-[var(--color-ink)] rounded-t-3xl border-t border-[var(--color-line)] h-[92dvh] max-h-[92dvh] flex flex-col animate-rise"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[var(--color-line)] shrink-0">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">{t('share.eyebrow')}</div>
            <div className="font-display text-2xl leading-tight">{t('share.title')}</div>
          </div>
          <button onClick={onClose} className="text-[13px] text-[var(--color-accent-ink)]">{t('common.close')}</button>
        </div>

        <div className="px-5 pt-4 shrink-0">
          <div className="text-xs text-[var(--color-muted)] mb-1.5">{t('share.addLine')}</div>
          <TextInput value={note} onChange={setNote} placeholder={t('share.linePh')} maxLength={140} />
        </div>

        {/* Live preview — this same canvas is what gets shared/saved. It scales
            to fit whatever height is left, keeping its aspect ratio, so the
            whole card stays visible without scrolling. */}
        <div className="flex-1 min-h-0 px-5 py-4 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="block max-h-full max-w-full w-auto h-auto rounded-2xl border border-[var(--color-line)]"
          />
        </div>

        <div className="px-5 pt-3 pb-4 border-t border-[var(--color-line)] shrink-0 space-y-2">
          <div className="grid grid-cols-3 gap-2">
            <Button variant="primary" data-testid="share-action" onClick={shareIt}>{t('share.share')}</Button>
            <Button data-testid="share-action" onClick={copyText}>{t('share.copy')}</Button>
            <Button data-testid="share-action" onClick={saveImage}>{t('share.saveImage')}</Button>
          </div>
          <p className="text-[11px] text-[var(--color-faint)] text-center">
            {t('share.note')}
          </p>
        </div>
      </div>
    </div>,
    document.body,
  )
}
