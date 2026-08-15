import { describe, it, expect } from 'vitest'
import {
  movedTooFar, shouldCountTap, MOVE_THRESHOLD,
  nextOnTap, nextOnHold, nextSalah,
} from './gesture.js'

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

describe('completion cycles both ways', () => {
  it('tapping walks full → min → unchecked and wraps back', () => {
    expect(nextOnTap(null)).toBe('full')
    expect(nextOnTap('full')).toBe('min')
    expect(nextOnTap('min')).toBe(null)
    expect(nextOnTap(null)).toBe('full') // wraps
  })

  it('long-press sets min from pending, clears any completion in one go', () => {
    expect(nextOnHold(null)).toBe('min')
    expect(nextOnHold('full')).toBe(null)
    expect(nextOnHold('min')).toBe(null)
  })

  it('salah sub-checks cycle on time → late → unchecked', () => {
    expect(nextSalah(undefined)).toBe('ontime')
    expect(nextSalah('ontime')).toBe('late')
    expect(nextSalah('late')).toBe(null)
  })
})
