import { useState } from 'react'
import { useStore } from '../store.jsx'
import { Button } from '../components/ui.jsx'
import PrayerLocationPicker from '../components/PrayerLocationPicker.jsx'
import { LANGUAGES } from '../lib/i18n/index.js'
import { habitDisplayName } from '../lib/i18n/seedHabits.js'
import { isFaithHabit } from '../lib/logic.js'
import { useT } from '../i18n.jsx'

/**
 * Shown only on a brand-new install (settings.onboarded === false). Steps:
 * language, "include Islamic practices?" (Yes/No), a short pitch, pick Phase 1
 * anchors, then — only if they said yes — a skippable prayer location. Existing
 * devices never reach here. The Islamic-practices answer decides whether the
 * Salah card, the fast, scripture, and prayer setup are part of the experience;
 * it's changeable anytime in Settings, so neither choice is a dead end.
 */
export default function Welcome() {
  const { state, finishOnboarding, setLanguage } = useStore()
  const { t, language } = useT()
  const [step, setStep] = useState(0)
  const [includeIslamic, setIncludeIslamic] = useState(state.settings.includeIslamic !== false)

  // The anchors picker is for the general Phase 1 habits. Faith habits (Salah)
  // are governed by the question above, not toggled here.
  const phase1 = state.habits.filter((h) => h.phase === 1 && !isFaithHabit(h))
  const [chosen, setChosen] = useState(() => new Set(phase1.map((h) => h.id)))
  const toggle = (id) => setChosen((s) => {
    const n = new Set(s)
    n.has(id) ? n.delete(id) : n.add(id)
    return n
  })

  const finish = () => finishOnboarding([...chosen], { includeIslamic })
  const startLabel = chosen.size === 0
    ? t('ob.startClean')
    : t('ob.startN', { n: chosen.size, unit: t(chosen.size === 1 ? 'ob.anchor' : 'ob.anchors') })

  // The anchors step is the end of the flow when Islamic practices are off (no
  // prayer-location step to run). Its button either finishes or moves on.
  const afterAnchors = () => (includeIslamic ? setStep(4) : finish())

  const pickFaith = (on) => { setIncludeIslamic(on); setStep(2) }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 pt-16 pb-10 max-w-md mx-auto animate-rise">
      {step === 0 && (
        <div className="flex-1 flex flex-col">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-ink)] mb-3">{t('ob.brand')}</div>
          <h1 className="font-display text-[2rem] leading-tight">{t('ob.langTitle')}</h1>
          <p className="text-[14px] text-[var(--color-muted)] mt-2 leading-relaxed">{t('ob.langIntro')}</p>
          <div className="mt-6 space-y-2.5">
            {LANGUAGES.map((l) => {
              const on = (state.settings.language || 'en') === l.id
              return (
                <button key={l.id} dir={l.dir} onClick={() => setLanguage(l.id)}
                  className={`w-full rounded-2xl border px-4 py-3.5 flex items-center justify-between text-start transition ${
                    on ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/50' : 'border-[var(--color-line)] bg-[var(--color-surface)]'}`}>
                  <span className="font-medium text-[15px]">{l.name}</span>
                  {on && <span className="text-[var(--color-accent-ink)]">✓</span>}
                </button>
              )
            })}
          </div>
          <div className="flex-1" />
          <Button variant="primary" className="w-full mt-8 py-3.5" onClick={() => setStep(1)}>{t('ob.confirm')}</Button>
        </div>
      )}

      {step === 1 && (
        <div className="flex-1 flex flex-col">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-ink)] mb-3">{t('ob.brand')}</div>
          <h1 className="font-display text-[2rem] leading-tight">{t('ob.faithTitle')}</h1>
          <p className="text-[14px] text-[var(--color-muted)] mt-3 leading-relaxed">{t('ob.faithIntro')}</p>
          <div className="mt-6 space-y-2.5">
            <Button variant="primary" className="w-full py-3.5" onClick={() => pickFaith(true)}>{t('ob.faithYes')}</Button>
            <Button className="w-full py-3.5" onClick={() => pickFaith(false)}>{t('ob.faithNo')}</Button>
          </div>
          <div className="flex-1" />
          <button onClick={() => setStep(0)} className="text-[13px] text-[var(--color-faint)] mt-8">{t('common.back')}</button>
        </div>
      )}

      {step === 2 && (
        <div className="flex-1 flex flex-col">
          <div className="text-[11px] uppercase tracking-[0.18em] text-[var(--color-accent-ink)] mb-3">{t('ob.brand')}</div>
          <h1 className="font-display text-[2.6rem] leading-[1.05]">{t('ob.pitchTitle')}</h1>
          <p className="text-[15px] text-[var(--color-muted)] mt-5 leading-relaxed">{t('ob.pitch1')}</p>
          <p className="text-[15px] text-[var(--color-muted)] mt-3 leading-relaxed">{t('ob.pitch2')}</p>
          <p className="text-[15px] text-[var(--color-muted)] mt-3 leading-relaxed">{t('ob.pitch3')}</p>
          <div className="flex-1" />
          <Button variant="primary" className="w-full mt-8 py-3.5" onClick={() => setStep(3)}>{t('ob.getStarted')}</Button>
          <button onClick={() => setStep(1)} className="text-[13px] text-[var(--color-faint)] mt-4">{t('common.back')}</button>
        </div>
      )}

      {step === 3 && (
        <div className="flex-1 flex flex-col">
          <h1 className="font-display text-[2rem] leading-tight">{t('ob.anchorsTitle')}</h1>
          <p className="text-[14px] text-[var(--color-muted)] mt-2 leading-relaxed">{t('ob.anchorsIntro')}</p>

          <div className="mt-6 space-y-2.5">
            {phase1.map((h) => {
              const on = chosen.has(h.id)
              return (
                <button
                  key={h.id}
                  onClick={() => toggle(h.id)}
                  className={`w-full rounded-2xl border px-4 py-3.5 flex items-center gap-3 text-start transition ${
                    on ? 'border-[var(--color-accent)] bg-[var(--color-accent-soft)]/50' : 'border-[var(--color-line)] bg-[var(--color-surface)]'
                  }`}
                >
                  <span className="text-2xl w-8 text-center">{h.emoji}</span>
                  <span className="flex-1 font-medium text-[15px]">{habitDisplayName(h, language)}</span>
                  <span className={`w-6 h-6 rounded-full grid place-items-center border ${
                    on ? 'bg-[var(--color-accent)] border-transparent text-[var(--color-on-accent)]' : 'border-[var(--color-line-2)] text-transparent'
                  }`}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 L9 17 L4 12" /></svg>
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex-1" />
          <Button variant="primary" className="w-full mt-8 py-3.5" onClick={afterAnchors}>{startLabel}</Button>
          <button onClick={() => setStep(2)} className="text-[13px] text-[var(--color-faint)] mt-4">{t('common.back')}</button>
        </div>
      )}

      {step === 4 && (
        <div className="flex-1 flex flex-col">
          <h1 className="font-display text-[2rem] leading-tight">{t('ob.prayerTitle')}</h1>
          <p className="text-[14px] text-[var(--color-muted)] mt-2 leading-relaxed">{t('ob.prayerIntro')}</p>

          <div className="mt-6">
            <PrayerLocationPicker onSet={finish} />
          </div>

          <div className="flex-1" />
          <button onClick={finish} className="text-[13px] text-[var(--color-faint)] mt-8 py-2">{t('ob.skipForNow')}</button>
          <button onClick={() => setStep(3)} className="text-[13px] text-[var(--color-faint)] mt-1">{t('common.back')}</button>
        </div>
      )}
    </div>
  )
}
