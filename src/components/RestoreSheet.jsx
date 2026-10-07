import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './ui.jsx'
import { useT } from '../i18n.jsx'

/**
 * The bottom sheet for importing a backup. Either it asks before replacing,
 * with what's on the device now next to what's in the file, or it says the
 * file was refused and nothing changed. Portaled to <body> like DayEditor, so
 * the `fixed` panel anchors to the screen and not to a transformed screen.
 */
export default function RestoreSheet({ pending, onReplace, onClose }) {
  const { t } = useT()
  const panelRef = useRef(null)
  const refused = Boolean(pending.reason)

  // Move focus into the sheet on open and close it on Escape.
  useEffect(() => {
    panelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const title = refused ? t('bk.refusedTitle') : t('bk.replaceTitle')
  const message = {
    unreadable: t('bk.cutOff'),
    'other-app': t('bk.otherApp'),
  }[pending.reason] || t('bk.badFile')

  return createPortal(
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div
        ref={panelRef}
        data-testid="restore-sheet"
        data-state={refused ? 'refused' : 'confirm'}
        role={refused ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className="relative w-full max-w-md bg-[var(--color-ink)] rounded-t-3xl border-t border-[var(--color-line)] px-5 pt-5 pb-5 animate-rise outline-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.25rem)' }}
      >
        <div className="font-display text-2xl leading-tight">{title}</div>

        {refused ? (
          <>
            <p className="text-[14px] text-[var(--color-muted)] mt-2 leading-snug">{message}</p>
            <Button data-testid="restore-close" variant="primary" className="w-full mt-5" onClick={onClose}>
              {t('common.gotIt')}
            </Button>
          </>
        ) : (
          <>
            <div className="mt-4 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 grid grid-cols-[minmax(0,1fr)_auto_auto] gap-x-5 gap-y-2 items-baseline">
              <span />
              <span className="text-end text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)] whitespace-nowrap">{t('bk.replaceNow')}</span>
              <span className="text-end text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)] whitespace-nowrap">{t('bk.replaceFile')}</span>
              <CountRow label={t('bk.habits')} now={pending.now.habits} file={pending.file.habits} testid="restore-habits" />
              <CountRow label={t('bk.daysLogged')} now={pending.now.days} file={pending.file.days} testid="restore-days" />
            </div>
            <p className="text-[13px] text-[var(--color-muted)] mt-3 leading-snug">{t('bk.replaceNote')}</p>
            <div className="grid grid-cols-2 gap-2 mt-5">
              <Button data-testid="restore-cancel" onClick={onClose}>{t('common.cancel')}</Button>
              <Button data-testid="restore-replace" variant="primary" onClick={onReplace}>{t('bk.replace')}</Button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}

// One row of the counts grid. `contents` lets its three cells sit in the
// parent's columns, so the numbers line up under their headings.
function CountRow({ label, now, file, testid }) {
  return (
    <div data-testid={testid} className="contents text-[14px]">
      <span className="text-[14px] text-[var(--color-muted)]">{label}</span>
      <span data-count="now" className="text-[14px] text-end tabular-nums">{now}</span>
      <span data-count="file" className="text-[14px] text-end tabular-nums text-[var(--color-fg)] font-medium">{file}</span>
    </div>
  )
}
