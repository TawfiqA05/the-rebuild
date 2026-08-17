import { useState } from 'react'
import { useStore } from '../store.jsx'
import { getPosition, reverseGeocode, geoErrorMessage } from '../lib/geo.js'
import { fetchMonth } from '../lib/prayerTimes.js'
import { todayKey } from '../lib/time.js'

/**
 * Shared "set my prayer location" logic for Settings, onboarding, and the Salah
 * card prompt. Two paths:
 *   useMyLocation() — browser geolocation → reverse-geocode → save + prime cache
 *   setCity(text)   — free-form city/address, validated against AlAdhan first
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
      const label = await reverseGeocode(lat, lng)
      const loc = { mode: 'coords', lat, lng, label, address: label }
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
