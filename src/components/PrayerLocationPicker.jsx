import { useState } from 'react'
import { usePrayerLocation } from '../hooks/usePrayerLocation.js'
import { Button, TextInput } from './ui.jsx'
import { useT } from '../i18n.jsx'

/**
 * The shared prayer-location controls: a "use my location" button (browser
 * geolocation, often denied) and a manual city search fallback. Used in
 * Settings, onboarding, and the Salah-card prompt. `onSet` fires after a
 * location is chosen (e.g. to advance the onboarding step).
 */
export default function PrayerLocationPicker({ onSet, compact = false }) {
  const { busy, error, useMyLocation, setCity } = usePrayerLocation()
  const { t } = useT()
  const [city, setCityText] = useState('')

  const locate = async () => { const loc = await useMyLocation(); if (loc) onSet?.(loc) }
  const search = async () => { const loc = await setCity(city); if (loc) { setCityText(''); onSet?.(loc) } }

  return (
    <div className={compact ? 'space-y-2' : 'space-y-2.5'}>
      <Button variant="primary" className="w-full" onClick={locate} disabled={busy}>
        {busy ? t('loc.locating') : t('loc.useMyLocation')}
      </Button>

      <div className="flex items-center gap-2 text-[11px] text-[var(--color-faint)]">
        <span className="h-px flex-1 bg-[var(--color-line)]" />{t('loc.orSearch')}<span className="h-px flex-1 bg-[var(--color-line)]" />
      </div>

      <div className="flex gap-2">
        <TextInput
          value={city}
          onChange={setCityText}
          onKeyDown={(e) => { if (e.key === 'Enter') search() }}
          placeholder={t('loc.cityPlaceholder')}
          aria-label={t('loc.cityPlaceholder')}
        />
        <Button onClick={search} disabled={busy || !city.trim()}>{t('loc.set')}</Button>
      </div>

      {error && <div className="text-[12px] text-[var(--color-min)]">{error}</div>}
    </div>
  )
}
