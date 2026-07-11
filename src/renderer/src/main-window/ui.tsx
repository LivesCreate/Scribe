/**
 * Shared UI primitives for the main window — a small, consistent kit so every
 * screen reads as one product. Minimal, Wispr-inspired: serif headings, calm
 * greys, hairline-bordered surface cards, grouped label+description+control
 * rows, and a graphite (not colored) accent. Uses the tokens in styles.css
 * (bg-base / bg-surface / border-line / text-ink / …).
 */

/** Large serif page title with an optional subtitle. */
export function PageTitle({
  title,
  subtitle
}: {
  title: string
  subtitle?: React.ReactNode
}): React.JSX.Element {
  return (
    <div>
      <h1 className="font-serif text-[28px] font-medium leading-tight tracking-tight text-ink">
        {title}
      </h1>
      {subtitle !== undefined && <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p>}
    </div>
  )
}

/** Rounded surface panel with a hairline border. */
export function Card({
  className = '',
  children
}: {
  className?: string
  children: React.ReactNode
}): React.JSX.Element {
  return <div className={`rounded-2xl border border-line bg-surface ${className}`}>{children}</div>
}

/**
 * A titled group: a small serif heading over a card whose direct children are
 * SettingRows, separated by hairline dividers. The Wispr settings pattern.
 */
export function SettingGroup({
  title,
  intro,
  children
}: {
  title?: string
  intro?: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section>
      {title !== undefined && (
        <h2 className="mb-2 px-1 font-serif text-lg text-ink">{title}</h2>
      )}
      {intro !== undefined && (
        <p className="mb-2.5 max-w-xl px-1 text-[13px] leading-relaxed text-ink-muted">{intro}</p>
      )}
      <Card className="divide-y divide-line px-5">{children}</Card>
    </section>
  )
}

/** One settings row: label + one-line description on the left, control right. */
export function SettingRow({
  label,
  description,
  active,
  children
}: {
  label: React.ReactNode
  description?: React.ReactNode
  active?: boolean
  children?: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{label}</span>
          {active === true && (
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-muted">
              in use
            </span>
          )}
        </div>
        {description !== undefined && (
          <p className="mt-0.5 text-[13px] leading-snug text-ink-muted">{description}</p>
        )}
      </div>
      {children !== undefined && (
        // max-w + wrap so wide controls (segmented pickers, selects) reflow
        // instead of clipping against the row edge.
        <div className="flex max-w-[60%] flex-wrap items-center justify-end gap-2">{children}</div>
      )}
    </div>
  )
}

/**
 * Pill switch. On = system-blue track with the knob on the right; off = quiet
 * dark track with the knob anchored left. The knob is pinned with left-0 so it
 * can never drift to the wrong side (the bug behind the old white-blob render).
 */
export function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}): React.JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 shrink-0 overflow-hidden rounded-full border transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none ${
        checked ? 'border-transparent bg-accent' : 'border-line bg-surface-2'
      }`}
    >
      <span
        className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-[22px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

/** Quiet or primary button, matching the minimal palette. */
export function Button({
  variant = 'quiet',
  className = '',
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'quiet' | 'primary'
}): React.JSX.Element {
  const cls =
    variant === 'primary'
      ? 'bg-accent text-white hover:brightness-110'
      : 'border border-line bg-surface-2 text-ink hover:border-zinc-600'
  return (
    <button
      {...rest}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink-faint disabled:opacity-50 ${cls} ${className}`}
    />
  )
}

/** Shared className for native <select> controls. */
export const selectCls =
  'max-w-60 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-ink focus:border-zinc-500 focus:outline-none'

/** A keyboard-key chip. */
export function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <kbd className="rounded border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-ink">
      {children}
    </kbd>
  )
}

/** Segmented single-choice control (writing style, hotkey mode, …). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  labels
}: {
  options: readonly T[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  /** Optional pretty display names, e.g. { doubletap: 'Double-tap' }. */
  labels?: Partial<Record<T, string>>
}): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex max-w-full flex-wrap rounded-lg border border-line bg-surface-2 p-0.5"
    >
      {options.map((opt) => (
        <button
          key={opt}
          role="radio"
          aria-checked={value === opt}
          onClick={() => onChange(opt)}
          className={`whitespace-nowrap rounded-md px-3 py-1 text-[13px] font-medium capitalize transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink-faint ${
            value === opt ? 'bg-accent text-white' : 'text-ink-muted hover:text-ink'
          }`}
        >
          {labels?.[opt] ?? opt}
        </button>
      ))}
    </div>
  )
}

export type UiTheme = 'black' | 'blue' | 'white'

/**
 * Applies the chosen palette by swapping classes on <body>. The palettes are
 * CSS-variable overrides in styles.css, so every token-based utility follows.
 */
export function applyUiTheme(theme: UiTheme): void {
  document.body.classList.remove('theme-black', 'theme-blue', 'theme-white')
  document.body.classList.add(`theme-${theme}`)
}
