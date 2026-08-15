// ---------------------------------------------------------------------------
// crypto.js — PIN hashing for the private log.
//
// We NEVER store the PIN in plain text. We store a SHA-256 hash (with a static
// app salt) and compare hashes on unlock. This is not bank-grade security — a
// 4-digit space is small — but it means the raw PIN never touches localStorage,
// which is the point: no plaintext secret sitting on disk.
// ---------------------------------------------------------------------------

const SALT = 'the-rebuild::pin::v1'

/** SHA-256(salt:pin) as a lowercase hex string. */
export async function hashPin(pin) {
  const data = new TextEncoder().encode(`${SALT}:${pin}`)
  const buf = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function verifyPin(pin, hash) {
  if (!hash) return false
  return (await hashPin(pin)) === hash
}
