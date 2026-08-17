import { useState } from 'react'
import { useStore } from '../store.jsx'
import { getPosition, geoErrorMessage } from '../lib/geo.js'
import { fetchMonth } from '../lib/prayerTimes.js'
import { todayKey } from '../lib/time.js'

/**
 * Shared "set my prayer location" logic for Settings, onboarding, and the Salah
 * card prompt. Two paths:
 *   useMyLocation() — browser geolocation → save coords → prime cache. The coords
 *                     go ONLY to AlAdhan (which takes lat/long natively); there's
 *                     no reverse-geocoding, so no third party ever sees them. The
 *                     display label defaults to "Current location" (localized at
 *                     display time); the user can type their own in Settings.
 *   setCity(text)   — free-form city/address, validated against AlAdhan first.
 * Returns { busy, error, useMyLocation, setCity, clearError }.
 */
export function usePrayerLocation() {
  const { state, setPrayerLocation } = useStore()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const day = todayKey(state.settings.dayRolloverHour)

  const useMyLocation = async () => {
    setBusy(true); setError(null)
    try {
      const { lat, lng } = await getPosition()
      // Coords only — no label baked in, so the display shows a localized
      // "Current location" until the user types their own. AlAdhan is queried by
      // lat/long directly (see monthUrl), so these never reach a geocoder.
      const loc = { mode: 'coords', lat, lng }
      setPrayerLocation(loc)
      // Prime this month's cache so times show immediately; ignore offline fail.
      fetchMonth(day, loc).catch(() => {})
      return loc
    } catch (err) {
      setError(geoErrorMessage(err))
      return null
    } finally {
      setBusy(false)
    }
  }

  const setCity = async (text) => {
    const address = String(text || '').trim()
    if (!address) return null
    setBusy(true); setError(null)
    const loc = { mode: 'address', label: address, address, lat: null, lng: null }
    try {
      // Validate the address resolves before committing to it.
      await fetchMonth(day, loc)
      setPrayerLocation(loc)
      return loc
    } catch {
      setError('Couldn’t find that place. Try “City, Country”.')
      return null
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, clearError: () => setError(null), useMyLocation, setCity }
}
