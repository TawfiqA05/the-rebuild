// ---------------------------------------------------------------------------
// crypto.js — owner PIN hashing for the private log.
//
// Single-owner model: there is exactly one PIN, chosen by the owner on first
// use. We NEVER store it in plain text and we NEVER bake a secret into the code.
//
//   • A random 16-byte SALT is generated on THIS device the first time the PIN
//     is set, and stored on-device alongside the hash. Because the salt is
//     random per install, the stored hash can't be precomputed from the source,
//     the repo, or any server — it only means anything on this one device.
//   • We store SHA-256(appTag : salt : pin). Verifying re-hashes an attempt
//     with the stored salt and compares.
//
// There is no change-PIN and no reset: the only way to clear the PIN is wiping
// all app data (Settings → Reset everything), which discards both hash and salt.
// ---------------------------------------------------------------------------

const APP_TAG = 'the-rebuild::owner-pin::v2' // namespacing only — not the secret

/** A fresh random salt (hex) for this device. */
export function generateSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** SHA-256(appTag : salt : pin) as lowercase hex. */
export async function hashPin(pin, salt) {
  const data = new TextEncoder().encode(`${APP_TAG}:${salt}:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPin(pin, salt, hash) {
  if (!hash || !salt) return false
  return (await hashPin(pin, salt)) === hash
}
