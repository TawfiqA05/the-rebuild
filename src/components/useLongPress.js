import { useRef, useCallback } from 'react'

/**
 * Distinguish a tap from a long-press on one element (big tap targets need
 * both: tap = full rep, long-press = min rep). Works for touch and mouse.
 *
 * onTap fires on a short press/click; onLongPress fires once the press is held
 * past `ms`. We swallow the following click after a long-press so it doesn't
 * also register as a tap.
 */
export function useLongPress(onTap, onLongPress, ms = 420) {
  const timer = useRef(null)
  const longFired = useRef(false)
  const startPos = useRef(null)

  const start = useCallback((e) => {
    longFired.current = false
    const point = e.touches ? e.touches[0] : e
    startPos.current = { x: point.clientX, y: point.clientY }
    timer.current = setTimeout(() => {
      longFired.current = true
      if (navigator.vibrate) navigator.vibrate(15)
      onLongPress?.()
    }, ms)
  }, [onLongPress, ms])

  const cancel = useCallback(() => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null }
  }, [])

  const move = useCallback((e) => {
    if (!startPos.current) return
    const point = e.touches ? e.touches[0] : e
    const dx = Math.abs(point.clientX - startPos.current.x)
    const dy = Math.abs(point.clientY - startPos.current.y)
    if (dx > 10 || dy > 10) cancel() // treat as a scroll, not a press
  }, [cancel])

  const end = useCallback(() => {
    cancel()
    if (!longFired.current) onTap?.()
  }, [cancel, onTap])

  return {
    onTouchStart: start,
    onTouchMove: move,
    onTouchEnd: end,
    onMouseDown: start,
    onMouseMove: move,
    onMouseUp: end,
    onMouseLeave: cancel,
    onContextMenu: (e) => e.preventDefault(),
  }
}
