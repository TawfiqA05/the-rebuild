import { describe, it, expect } from 'vitest'
import { movedTooFar, shouldCountTap, MOVE_THRESHOLD } from './gesture.js'

describe('scroll vs tap', () => {
  const origin = { x: 100, y: 200 }

  it('a stationary finger is a tap', () => {
    expect(movedTooFar(origin, { x: 100, y: 200 })).toBe(false)
  })

  it('small wobble under the threshold still counts as a tap', () => {
    expect(movedTooFar(origin, { x: 108, y: 206 })).toBe(false)
  })

  it('exactly at the threshold is allowed', () => {
    expect(movedTooFar(origin, { x: 100 + MOVE_THRESHOLD, y: 200 })).toBe(false)
  })

  it('a vertical scroll past the threshold is not a tap', () => {
    expect(movedTooFar(origin, { x: 100, y: 200 + MOVE_THRESHOLD + 1 })).toBe(true)
  })

  it('a horizontal drag past the threshold is not a tap', () => {
    expect(movedTooFar(origin, { x: 140, y: 200 })).toBe(true)
  })

  it('missing points never register movement', () => {
    expect(movedTooFar(null, origin)).toBe(false)
  })

  it('only a clean, non-long press counts', () => {
    expect(shouldCountTap({ moved: false, longFired: false })).toBe(true)
    expect(shouldCountTap({ moved: true, longFired: false })).toBe(false)  // scrolled
    expect(shouldCountTap({ moved: false, longFired: true })).toBe(false)  // was a long-press
  })
})
