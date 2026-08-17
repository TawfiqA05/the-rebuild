// ---------------------------------------------------------------------------
// geo.js — thin wrappers over the browser geolocation + a free reverse geocoder.
//
// Used to turn a "use my location" tap into a { lat, lng, label } we can feed to
// the prayer-times API. Everything degrades gracefully: geolocation is often
// denied, and reverse geocoding is best-effort (we fall back to raw coords).
// ---------------------------------------------------------------------------

/** Promise wrapper around navigator.geolocation.getCurrentPosition. */
export function getPosition(opts = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('unsupported')); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(err),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60 * 1000, ...opts },
    )
  })
}

/** A human-readable "City, Region" for coords. Best-effort; never throws. */
export async function reverseGeocode(lat, lng) {
  const fallback = `${Number(lat).toFixed(2)}, ${Number(lng).toFixed(2)}`
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
    )
    if (!res.ok) return fallback
    const j = await res.json()
    const city = j.city || j.locality || j.principalSubdivision || ''
    const region = j.principalSubdivision && j.principalSubdivision !== city
      ? j.principalSubdivision : j.countryName || ''
    const label = [city, region].filter(Boolean).join(', ')
    return label || fallback
  } catch {
    return fallback
  }
}

/** Turn a geolocation error into a short, friendly message. */
export function geoErrorMessage(err) {
  if (err && err.code === 1) return 'Location permission denied — search for a city instead.'
  if (err && err.code === 3) return 'Location timed out — search for a city instead.'
  if (err && err.message === 'unsupported') return 'This device can’t share location — search for a city.'
  return 'Couldn’t get your location — search for a city instead.'
}
