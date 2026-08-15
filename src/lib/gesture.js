// Scroll-vs-tap decision, kept pure so it can be unit tested without a DOM.
//
// The rule: a press only counts as a tap if the finger stayed put (moved <=
// ~10px) and a long-press didn't already fire. Anything that drifts past the
// threshold is treated as a scroll, not a tap.

export const MOVE_THRESHOLD = 10 // px

export function movedTooFar(start, current, threshold = MOVE_THRESHOLD) {
  if (!start || !current) return false
  return Math.abs(current.x - start.x) > threshold || Math.abs(current.y - start.y) > threshold
}

// Given what happened during the press, should the release count as a tap?
export function shouldCountTap({ moved, longFired }) {
  return !moved && !longFired
}

// --- habit completion cycles (pure, so the toggling is testable) ------------

// Tapping the marker walks forward and wraps: pending → full → min → pending.
export function nextOnTap(status) {
  return status === null ? 'full' : status === 'full' ? 'min' : null
}

// Long-press: set the 2-minute rep from pending, or clear a completed habit
// entirely in one go.
export function nextOnHold(status) {
  return status === 'full' || status === 'min' ? null : 'min'
}

// A salah sub-check cycles: pending → on time → late → pending.
export function nextSalah(value) {
  return value === 'ontime' ? 'late' : value === 'late' ? null : 'ontime'
}
