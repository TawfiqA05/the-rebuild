// ---------------------------------------------------------------------------
// geo.js — a thin wrapper over the browser geolocation API.
//
// Used to turn a "use my location" tap into { lat, lng }, which we feed straight
// to the prayer-times API (AlAdhan takes coordinates natively). We deliberately
// do NOT reverse-geocode: the coordinates only ever go to the one request the
// prayer feature already needs, never to a separate geocoding service. The
// display label is a local, human string ("Current location", or one the user
// types) — see usePrayerLocation.
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

/** Turn a geolocation error into a short, friendly message. */
export function geoErrorMessage(err) {
  if (err && err.code === 1) return 'Location permission denied — search for a city instead.'
  if (err && err.code === 3) return 'Location timed out — search for a city instead.'
  if (err && err.message === 'unsupported') return 'This device can’t share location — search for a city.'
  return 'Couldn’t get your location — search for a city instead.'
}
