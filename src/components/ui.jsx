// Small shared UI primitives so the screens stay consistent and terse.

export function Screen({ title, subtitle, children, right }) {
  return (
    <div className="px-4 pt-3 pb-28 max-w-md mx-auto animate-fade">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs text-[var(--color-muted)] mt-0.5">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`rounded-2xl border border-[var(--color-line)] bg-[var(--color-surface)] ${className}`}>
      {children}
    </div>
  )
}

export function SectionLabel({ children }) {
  return (
    <div className="text-[11px] uppercase tracking-wide text-[var(--color-faint)] mb-2 mt-5 first:mt-0">
      {children}
    </div>
  )
}

export function Button({ children, onClick, variant = 'default', className = '', ...rest }) {
  const styles = {
    default: 'border-[var(--color-line)] text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]',
    primary: 'border-transparent bg-[var(--color-accent)] text-black font-medium',
    ghost: 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]',
    danger: 'border-[var(--color-line)] text-red-400 hover:bg-[var(--color-surface-2)]',
  }[variant]
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-4 py-2.5 text-sm transition active:scale-[0.98] ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function TextInput({ value, onChange, className = '', ...rest }) {
  return (
    <input
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5 text-sm
        outline-none focus:border-[var(--color-accent)] transition ${className}`}
      {...rest}
    />
  )
}

export function TextArea({ value, onChange, rows = 2, className = '', ...rest }) {
  return (
    <textarea
      value={value ?? ''}
      rows={rows}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-ink)] px-3 py-2.5 text-sm
        outline-none focus:border-[var(--color-accent)] transition resize-none ${className}`}
      {...rest}
    />
  )
}

/** A labelled progress bar with an optional threshold marker. */
export function ProgressBar({ pct, threshold, color = 'var(--color-accent)' }) {
  return (
    <div className="relative h-2.5 rounded-full bg-[var(--color-line)] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-500"
        style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      {threshold != null && (
        <div className="absolute top-0 bottom-0 w-px bg-[var(--color-fg)]/60"
          style={{ left: `${threshold}%` }} />
      )}
    </div>
  )
}
