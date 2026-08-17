import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Button } from './ui.jsx'
import { useT } from '../i18n.jsx'

const STEP_KEYS = ['tour.1', 'tour.2', 'tour.3', 'tour.4']

export default function Tour() {
  const { setTourSeen } = useStore()
  const { t } = useT()
  const [step, setStep] = useState(0)
  const last = step === STEP_KEYS.length - 1
  const done = () => setTourSeen(true)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={done}>
      <div
        className="relative w-full max-w-md m-4 mb-24 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] p-5 animate-rise"
        style={{ boxShadow: 'var(--shadow-card)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex gap-1.5 mb-3">
          {STEP_KEYS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'}`} />
          ))}
        </div>
        <p className="text-[15.5px] leading-relaxed text-[var(--color-fg)]">{t(STEP_KEYS[step])}</p>
        <div className="flex items-center justify-between mt-4">
          <button onClick={done} className="text-[13px] text-[var(--color-faint)]">{t('common.skip')}</button>
          <Button variant="primary" onClick={() => (last ? done() : setStep(step + 1))}>
            {last ? t('common.gotIt') : t('common.next')}
          </Button>
        </div>
      </div>
    </div>
  )
}
