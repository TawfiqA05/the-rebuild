import { createContext, useCallback, useContext, useRef, useState } from 'react'

// A quiet, one-line toast with an Undo button. Used to make accidental habit
// completions a single tap to reverse. Auto-dismisses after 4 seconds.
const ToastContext = createContext(() => {})

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null) // { msg, onUndo, key }
  const timer = useRef(null)

  const show = useCallback((msg, onUndo) => {
    if (timer.current) clearTimeout(timer.current)
    setToast({ msg, onUndo, key: Date.now() })
    timer.current = setTimeout(() => setToast(null), 4000)
  }, [])

  const dismiss = () => { if (timer.current) clearTimeout(timer.current); setToast(null) }

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toast && (
        <div
          key={toast.key}
          className="fixed left-1/2 -translate-x-1/2 z-50 animate-rise"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 74px)' }}
        >
          <div className="flex items-center gap-4 rounded-full border border-[var(--color-line)] bg-[var(--color-surface-2)] pl-4 pr-2 py-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.6)]">
            <span className="text-[13px] text-[var(--color-muted)] whitespace-nowrap">{toast.msg}</span>
            <button
              onClick={() => { toast.onUndo?.(); dismiss() }}
              className="text-[13px] font-medium text-[var(--color-accent)] px-3 py-1 rounded-full"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
