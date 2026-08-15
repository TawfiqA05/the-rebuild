import { useEffect } from 'react'

// ---------------------------------------------------------------------------
// entryInput.jsx — the quick-add and inline-edit primitives shared by the
// Tasks and Food cards. Both cards want the exact same feel: a framed "＋"
// quick-add that submits on Enter, and an inline text editor that saves on
// Enter or on tapping away, cancels on Escape or when emptied, and is safe
// against the iOS selection magnifier. This is that logic in one place.
// ---------------------------------------------------------------------------

/** Commit when a pointer goes down anywhere outside `ref` ("tap away saves"). */
export function useCommitOnOutside(ref, commit) {
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) commit() }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
    // commit reads latest values via a ref at the call site, so bind once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

const FRAME =
  'flex items-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-2 focus-within:border-[var(--color-accent)]/60 transition'

/**
 * A framed quick-add input: "＋", a text field that submits on Enter, and an
 * "Add" button once there's text. `children` (e.g. a due-day control) render
 * below the field only while composing.
 */
export function QuickAddInput({ value, onChange, onSubmit, placeholder, ariaLabel, children }) {
  const has = value.trim().length > 0
  return (
    <div>
      <div className={FRAME}>
        <span className="text-[var(--color-faint)] text-sm shrink-0">＋</span>
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit() }}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="flex-1 min-w-0 bg-transparent text-[15px] text-[var(--color-fg)] placeholder:text-[var(--color-faint)] outline-none"
        />
        {has && (
          <button onClick={onSubmit} aria-label={ariaLabel}
            className="shrink-0 text-[13px] font-medium text-[var(--color-accent-ink)] px-1.5">Add</button>
        )}
      </div>
      {has && children && <div className="mt-2 animate-fade">{children}</div>}
    </div>
  )
}

/**
 * The text field of an inline editor: autofocuses, saves on Enter, cancels on
 * Escape, with a quiet "Save" button. The outside-tap-to-save and empty-cancel
 * plumbing lives at the call site via {@link useCommitOnOutside}, so this stays
 * a dumb controlled input.
 */
export function InlineEditText({ value, onChange, onCommit, onCancel, ariaLabel = 'Edit' }) {
  return (
    <div className="flex items-center gap-2">
      <input
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); onCommit() }
          else if (e.key === 'Escape') onCancel()
        }}
        aria-label={ariaLabel}
        className="flex-1 min-w-0 rounded-lg border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3 py-2 text-[15px]
          text-[var(--color-fg)] outline-none focus:border-[var(--color-accent)]/60 transition"
      />
      <button onClick={onCommit} aria-label="Save"
        className="shrink-0 text-[13px] font-medium text-[var(--color-accent-ink)] px-1.5">Save</button>
    </div>
  )
}
