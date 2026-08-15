import { useCallback, useRef } from 'react'
import { movedTooFar, shouldCountTap } from '../lib/gesture.js'

/**
 * Distinguish a real tap from a scroll or a long-press on one element.
 *   tap        → onTap, but only if the finger stayed put (moved <= ~10px)
 *   long-press → onLongPress, after `ms`, and only if it hasn't moved
 * If the touch drifts past the threshold it's a scroll: neither fires. The
 * long-press timer only arms when an onLongPress handler is given, so plain
 * tap targets don't lose a slow, stationary tap.
 */
export function useLongPress(onTap, onLongPress, ms = 420) {
  const timer = useRef(null)
  const longFired = useRef(false)
  const moved = useRef(false)
  const start = useRef(null)

  const clear = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null } }

  const onStart = useCallback((e) => {
    longFired.current = false
    moved.current = false
    const p = e.touches ? e.touches[0] : e
    start.current = { x: p.clientX, y: p.clientY }
    clear()
    if (onLongPress) {
      timer.current = setTimeout(() => {
        if (moved.current) return
        longFired.current = true
        if (navigator.vibrate) navigator.vibrate(15)
        onLongPress()
      }, ms)
    }
  }, [onLongPress, ms])

  const onMove = useCallback((e) => {
    if (!start.current) return
    const p = e.touches ? e.touches[0] : e
    if (movedTooFar(start.current, { x: p.clientX, y: p.clientY })) {
      moved.current = true
      clear()
    }
  }, [])

  const onEnd = useCallback(() => {
    clear()
    if (shouldCountTap({ moved: moved.current, longFired: longFired.current })) onTap?.()
    start.current = null
  }, [onTap])

  const onCancel = useCallback(() => {
    moved.current = true
    clear()
    start.current = null
  }, [])

  return {
    onTouchStart: onStart,
    onTouchMove: onMove,
    onTouchEnd: onEnd,
    onTouchCancel: onCancel,
    onMouseDown: onStart,
    onMouseMove: onMove,
    onMouseUp: onEnd,
    onMouseLeave: onCancel,
    onContextMenu: (e) => e.preventDefault(),
  }
}
