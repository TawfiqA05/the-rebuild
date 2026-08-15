// Small shared UI primitives so the screens stay consistent and terse.

export function Screen({ title, subtitle, children, right }) {
  return (
    <div className="px-5 pt-5 pb-28 max-w-md mx-auto animate-rise">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-[2rem] leading-none text-[var(--color-fg)]">{title}</h1>
          {subtitle && <p className="text-[13px] text-[var(--color-muted)] mt-2">{subtitle}</p>}
        </div>
        {right}
      </header>
      {children}
    </div>
  )
}

export function Card({ children, className = '' }) {
  return <div className={`card ${className}`}>{children}</div>
}

export function SectionLabel({ children }) {
  return (
    <div className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-faint)] mb-2.5 mt-7 first:mt-0">
      {children}
    </div>
  )
}

export function Button({ children, onClick, variant = 'default', className = '', ...rest }) {
  const styles = {
    default: 'border-[var(--color-line-2)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]',
    primary: 'border-transparent bg-[var(--color-accent)] text-[#231a09] font-medium hover:bg-[var(--color-accent-strong)]',
    ghost: 'border-transparent text-[var(--color-muted)] hover:text-[var(--color-fg)]',
    danger: 'border-[var(--color-line-2)] bg-transparent text-[var(--color-danger)] hover:bg-[var(--color-surface-2)]',
  }[variant]
  return (
    <button
      onClick={onClick}
      className={`press no-callout rounded-xl border px-4 py-2.5 text-sm ${styles} ${className}`}
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
      className={`w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3.5 py-3 text-[15px]
        text-[var(--color-fg)] placeholder:text-[var(--color-faint)] outline-none
        focus:border-[var(--color-accent)]/60 transition ${className}`}
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
      className={`w-full rounded-xl border border-[var(--color-line)] bg-[var(--color-ink-2)] px-3.5 py-3 text-[15px]
        text-[var(--color-fg)] placeholder:text-[var(--color-faint)] outline-none
        focus:border-[var(--color-accent)]/60 transition resize-none ${className}`}
      {...rest}
    />
  )
}

/** A labelled progress bar with an optional threshold marker. */
export function ProgressBar({ pct, threshold, color = 'var(--color-accent)' }) {
  return (
    <div className="relative h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700 ease-out"
        style={{ width: `${Math.min(100, pct)}%`, background: color }} />
      {threshold != null && (
        <div className="absolute top-0 bottom-0 w-px bg-[var(--color-fg)]/50"
          style={{ left: `${threshold}%` }} />
      )}
    </div>
  )
}
