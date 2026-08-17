import { useEffect, useMemo, useRef, useState } from 'react'
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

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className="relative w-full max-w-md bg-[var(--color-ink)] rounded-t-3xl border-t border-[var(--color-line)] max-h-[90dvh] flex flex-col animate-rise"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[var(--color-line)]">
          <div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)]">{t('share.eyebrow')}</div>
            <div className="font-display text-2xl leading-tight">{t('share.title')}</div>
          </div>
          <button onClick={onClose} className="text-[13px] text-[var(--color-accent-ink)]">{t('common.close')}</button>
        </div>

        <div className="px-5 py-4 overflow-y-auto space-y-4">
          <div>
            <div className="text-xs text-[var(--color-muted)] mb-1.5">{t('share.addLine')}</div>
            <TextInput value={note} onChange={setNote} placeholder={t('share.linePh')} maxLength={140} />
          </div>

          {/* Live preview — this same canvas is what gets shared/saved. */}
          <div className="rounded-2xl overflow-hidden border border-[var(--color-line)]">
            <canvas ref={canvasRef} className="w-full h-auto block" />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <Button variant="primary" onClick={shareIt}>{t('share.share')}</Button>
            <Button onClick={copyText}>{t('share.copy')}</Button>
            <Button onClick={saveImage}>{t('share.saveImage')}</Button>
          </div>
          <p className="text-[11px] text-[var(--color-faint)] text-center">
            {t('share.note')}
          </p>
        </div>
      </div>
    </div>
  )
}
