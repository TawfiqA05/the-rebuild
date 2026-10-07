import { useState } from 'react'
import { useStore } from '../store.jsx'
import { useT } from '../i18n.jsx'
import { Button } from './ui.jsx'
import { downloadBackup } from '../lib/backup.js'
import { habitDisplayName } from '../lib/i18n/seedHabits.js'

// What the person sees when saved data couldn't be used as it was (see
// loadState in store.jsx). None of these ever draws what a copy holds; Export
// hands the saved data and every copy over as a file, read from storage.

function ExportButton({ className = '' }) {
  const { exportSaved } = useStore()
  const { t } = useT()
  return (
    <Button data-testid="rescue-export" className={className} onClick={() => downloadBackup(exportSaved())}>
      {t('rescue.export')}
    </Button>
  )
}

function FullScreen({ testid, children }) {
  return (
    <div data-testid={testid} className="min-h-[100dvh] bg-[var(--color-ink)]">
      <div className="min-h-[100dvh] flex flex-col px-6 pt-16 pb-10 max-w-md mx-auto animate-rise">
        {children}
      </div>
    </div>
  )
}

/** The save couldn't be read, a copy is kept, and the app starts fresh. Shown before onboarding. */
export function RescueKept() {
  const { dismissRescue } = useStore()
  const { t } = useT()
  return (
    <FullScreen testid="rescue-kept">
      <h1 className="font-display text-[2rem] leading-tight">{t('rescue.title')}</h1>
      <p className="text-[14px] text-[var(--color-muted)] mt-3 leading-relaxed">{t('rescue.keptBody')}</p>
      <div className="flex-1" />
      <div className="space-y-2.5 mt-8">
        <ExportButton className="w-full py-3.5" />
        <Button data-testid="rescue-continue" variant="primary" className="w-full py-3.5" onClick={dismissRescue}>
          {t('rescue.continue')}
        </Button>
      </div>
    </FullScreen>
  )
}

/** The save couldn't be read and no copy could be kept: nothing saves until Start fresh. */
export function RescueRefused() {
  const { startFresh } = useStore()
  const { t } = useT()
  const [confirming, setConfirming] = useState(false)
  return (
    <FullScreen testid="rescue-refused">
      <h1 className="font-display text-[2rem] leading-tight">{t('rescue.title')}</h1>
      <p className="text-[14px] text-[var(--color-muted)] mt-3 leading-relaxed">{t('rescue.refusedBody')}</p>
      <div className="flex-1" />
      <div className="space-y-2.5 mt-8">
        <ExportButton className="w-full py-3.5" />
        {!confirming ? (
          <>
            <Button data-testid="rescue-start-fresh" variant="danger" className="w-full py-3.5" onClick={() => setConfirming(true)}>
              {t('rescue.startFresh')}
            </Button>
            <p className="text-[12.5px] text-[var(--color-faint)] text-center leading-snug">{t('rescue.freshNote')}</p>
          </>
        ) : (
          <div className="rounded-2xl border border-[var(--color-line-2)] px-4 py-4 space-y-3">
            <p className="text-[14px] leading-snug">{t('rescue.freshConfirm')}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button data-testid="rescue-fresh-cancel" onClick={() => setConfirming(false)}>{t('common.cancel')}</Button>
              <Button data-testid="rescue-fresh-yes" variant="danger" onClick={startFresh}>{t('rescue.freshYes')}</Button>
            </div>
          </div>
        )}
      </div>
    </FullScreen>
  )
}

/** A calm line after a repair on load: what was fixed or set aside, and whether a copy is kept. */
export function RescueNotice() {
  const { rescue, state, dismissRescue } = useStore()
  const { t, language } = useT()
  if (rescue?.kind !== 'repaired') return null
  const daily = rescue.fixes.filter((f) => f.type === 'daily').map((f) => {
    const h = state.habits.find((x) => x.id === f.habitId)
    return { id: f.habitId, name: (h && habitDisplayName(h, language)) || String(f.habitId ?? '') }
  })
  return (
    <div
      role="status"
      data-testid="rescue-notice"
      className="bg-[var(--color-min-soft)] text-[var(--color-min)] text-[12.5px] px-4 py-3 leading-snug"
    >
      <div className="max-w-md mx-auto space-y-1.5">
        <p>{t(rescue.setAside.length ? 'rescue.part' : 'rescue.fixed')}</p>
        {daily.map((d) => <p key={d.id} data-testid="rescue-daily">{t('rescue.daily', { name: d.name })}</p>)}
        {rescue.copy && <p>{t('rescue.copyKept')}</p>}
        <div className="flex gap-2 pt-1">
          {rescue.copy && <ExportButton className="py-1.5 text-[12.5px]" />}
          <Button data-testid="rescue-notice-ok" variant="ghost" className="py-1.5 text-[12.5px]" onClick={dismissRescue}>
            {t('common.gotIt')}
          </Button>
        </div>
      </div>
    </div>
  )
}
