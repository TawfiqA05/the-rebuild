import { useMemo } from 'react'
import { useStore } from '../store.jsx'
import { dailyAnchor } from '../lib/anchor.js'
import { useT } from '../i18n.jsx'

/**
 * The Daily anchor — one quiet line of motivation, fixed for the whole day.
 * No refresh, no share, no links: it's an anchor, not a feed. On hard days
 * (`biasOwn`) it leans on the user's own wins and journal instead of strangers'
 * quotes.
 */
export default function AnchorCard({ biasOwn = false }) {
  const { state, today } = useStore()
  const { t, language } = useT()
  const includeIslamic = state.settings.includeIslamic !== false
  const anchor = useMemo(
    () => dailyAnchor(state, today, { biasOwn, lang: language, includeIslamic }),
    [state, today, biasOwn, language, includeIslamic],
  )
  if (!anchor) return null

  const own = anchor.pool === 'wins' || anchor.pool === 'journal'
  // In Arabic, scripture shows the original Arabic ayah/hadith + its citation.
  const useAr = language === 'ar' && anchor.ar
  const quote = useAr ? anchor.ar : anchor.text
  const cite = useAr ? anchor.arAuthor : anchor.author

  return (
    <div className="mt-3 rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5">
      {own ? (
        <>
          <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-accent-ink)]/80">{t('anchor.own')}</div>
          <p className="text-[14.5px] leading-snug mt-1.5 text-[var(--color-fg)]">{anchor.text}</p>
        </>
      ) : (
        <>
          <p className={`leading-snug text-[var(--color-fg)] ${useAr ? 'text-[17px]' : 'text-[14.5px]'}`}>
            <span className="text-[var(--color-accent-ink)]/60">“</span>{quote}<span className="text-[var(--color-accent-ink)]/60">”</span>
          </p>
          {cite && (
            <div className="text-[11px] text-[var(--color-faint)] mt-1.5">— {cite}</div>
          )}
        </>
      )}
    </div>
  )
}
