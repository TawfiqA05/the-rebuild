// ---------------------------------------------------------------------------
// Tutorial.jsx — the interactive, learn-by-doing first run.
//
// Instead of a slideshow, the user performs the real gestures on a throwaway
// "practice" habit card (see PracticeCard.jsx), and the tutorial advances only
// once each gesture actually happens. A spotlight dims the rest of the screen
// and highlights the current target.
//
// The overlay is rendered through a portal to <body> on purpose: the screens
// keep a lingering `animate-rise` transform, and a transformed ancestor becomes
// the containing block for `position: fixed`, so an inline overlay would anchor
// to the (tall) page instead of the viewport. The portal escapes that.
//
// Nothing here writes to the store except `setTourSeen(true)` at the end — the
// practice card's state is entirely local, so it leaves no votes, logs, streaks,
// or backup trace.
// ---------------------------------------------------------------------------

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../store.jsx'
import { Button } from './ui.jsx'
import { useT } from '../i18n.jsx'

const TutorialContext = createContext({ active: false, step: 0, notifyGesture: () => {} })
export const useTutorial = () => useContext(TutorialContext)

// Each step: what it spotlights, which gesture (if any) advances it, and its
// instruction + optional praise line. Gesture steps advance on the gesture;
// pointer steps advance on a Next/Done tap.
const STEPS = [
  { selector: '[data-testid="practice-card"]', gesture: 'full',  instr: 'tut.tap.instr',   praise: 'tut.tap.done' },
  { selector: '[data-testid="practice-card"]', gesture: 'min',   instr: 'tut.hold.instr',  praise: 'tut.hold.done' },
  { selector: '[data-testid="practice-card"]', gesture: 'clear', instr: 'tut.undo.instr',  praise: 'tut.undo.done' },
  { selector: '[data-testid="score-card"]',    gesture: null,    instr: 'tut.score.instr' },
  { selector: 'nav',                           gesture: null,    instr: 'tut.nav.instr' },
]
export const TUTORIAL_STEP_COUNT = STEPS.length

export function TutorialProvider({ active, children }) {
  const { setTourSeen } = useStore()
  const [step, setStep] = useState(0)
  const [praise, setPraise] = useState(false)
  const praiseTimer = useRef(null)

  // Restart from the top whenever the tutorial (re)activates; clear on teardown.
  useEffect(() => {
    if (active) { setStep(0); setPraise(false) }
    return () => { if (praiseTimer.current) clearTimeout(praiseTimer.current) }
  }, [active])

  const finish = useCallback(() => { setTourSeen(true) }, [setTourSeen])

  const advance = useCallback(() => {
    setStep((s) => (s >= STEPS.length - 1 ? (finish(), s) : s + 1))
  }, [finish])

  // The practice card reports a gesture; advance only if it's the one this step
  // asked for. Flash a praise line first, then move on.
  const notifyGesture = useCallback((kind) => {
    if (STEPS[step]?.gesture !== kind) return
    setPraise(true)
    praiseTimer.current = setTimeout(() => { setPraise(false); advance() }, 900)
  }, [step, advance])

  return (
    <TutorialContext.Provider value={{ active, step, notifyGesture }}>
      {children}
      {active && <Spotlight step={step} praise={praise} onSkip={finish} onNext={advance} />}
    </TutorialContext.Provider>
  )
}

// Track the current target's on-screen rectangle every frame, so the spotlight
// follows it through scroll, layout settle, and the card's rise animation.
function useTargetRect(selector, step) {
  const [rect, setRect] = useState(null)
  useEffect(() => {
    document.querySelector(selector)?.scrollIntoView({ block: 'center', behavior: 'auto' })
  }, [selector, step])
  useEffect(() => {
    let raf
    const tick = () => {
      const el = document.querySelector(selector)
      if (el) {
        const r = el.getBoundingClientRect()
        setRect((p) => (p && p.top === r.top && p.left === r.left && p.width === r.width && p.height === r.height
          ? p : { top: r.top, left: r.left, width: r.width, height: r.height }))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [selector, step])
  return rect
}

function Spotlight({ step, praise, onSkip, onNext }) {
  const { t } = useT()
  const cfg = STEPS[step]
  const rect = useTargetRect(cfg.selector, step)
  if (!rect) return null

  const pad = 6
  const hole = {
    top: rect.top - pad, left: rect.left - pad,
    width: rect.width + pad * 2, height: rect.height + pad * 2,
  }
  const vh = window.innerHeight
  const vw = window.innerWidth
  const isGesture = cfg.gesture != null
  // Place the instruction below the target if there's room, else above it.
  const below = vh - (hole.top + hole.height) > 190
  const cardPos = below
    ? { top: Math.min(hole.top + hole.height + 14, vh - 150) }
    : { bottom: Math.min(vh - hole.top + 14, vh - 150) }

  const Shield = (style) => <div className="absolute bg-black/55 pointer-events-auto" style={style} />

  return createPortal(
    <div data-testid="tutorial-overlay" className="fixed inset-0 z-[60] pointer-events-none">
      {isGesture ? (
        <>
          {/* Cutout: four dimmed shields around the target, which stays tappable. */}
          {Shield({ top: 0, left: 0, width: vw, height: Math.max(0, hole.top) })}
          {Shield({ top: hole.top + hole.height, left: 0, width: vw, height: Math.max(0, vh - (hole.top + hole.height)) })}
          {Shield({ top: hole.top, left: 0, width: Math.max(0, hole.left), height: hole.height })}
          {Shield({ top: hole.top, left: hole.left + hole.width, width: Math.max(0, vw - (hole.left + hole.width)), height: hole.height })}
        </>
      ) : (
        // Pointer step: dim everything and only point — no click-through, so a
        // stray tap can't navigate away and lose the tutorial.
        <div className="absolute inset-0 bg-black/55 pointer-events-auto" />
      )}

      {/* Halo around the target (never intercepts taps). */}
      <div className="absolute rounded-2xl ring-2 ring-[var(--color-accent)] pointer-events-none"
        style={{ top: hole.top, left: hole.left, width: hole.width, height: hole.height }} />

      {/* Instruction card. */}
      <div
        data-testid="tutorial-instruction"
        className="pointer-events-auto absolute left-1/2 -translate-x-1/2 w-[min(92%,26rem)] rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5 animate-rise"
        style={{ ...cardPos, boxShadow: 'var(--shadow-card)' }}
      >
        <div className="flex gap-1.5 mb-2.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-line)]'}`} />
          ))}
        </div>
        <p className="text-[15px] leading-relaxed text-[var(--color-fg)]">
          {praise && cfg.praise ? t(cfg.praise) : t(cfg.instr)}
        </p>
        <div className="flex items-center justify-between mt-3">
          <button data-testid="tutorial-skip" onClick={onSkip} className="text-[13px] text-[var(--color-faint)]">{t('common.skip')}</button>
          {!isGesture && !praise && (
            <Button variant="primary" data-testid="tutorial-next" onClick={onNext}>
              {step === STEPS.length - 1 ? t('tut.finish') : t('common.next')}
            </Button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
