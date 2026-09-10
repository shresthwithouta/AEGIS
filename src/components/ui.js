/**
 * Shared primitives for the dashboard.
 *
 * Every screen is built from these: a rounded card (Sheet), a card header, a
 * label/value row (Field), and a handful of small badges. Keeping them here
 * means a change to the look of a card changes every screen at once.
 */

import Icon from './Icon';

/* ------------------------------------------------------------------ */
/* Sheets and headings                                                 */
/* ------------------------------------------------------------------ */

export function Sheet({ children, className = '', active = false, raised = false, ...rest }) {
  return (
    <section
      className={`${raised ? 'sheet-raised' : 'sheet'} ${className}`}
      data-active={active ? 'true' : undefined}
      {...rest}
    >
      {children}
    </section>
  );
}

/** A card's header. */
export function SheetHead({ title, meta, action, sub }) {
  return (
    <header className="flex items-baseline gap-3 border-b border-[var(--rule)] px-4 py-3">
      <h2 className="font-[family-name:var(--font-narrow)] text-[0.8125rem] font-bold tracking-[0.01em] text-[var(--ink)]">
        {title}
      </h2>
      {sub ? <span className="text-[0.75rem] text-[var(--ink-3)]">{sub}</span> : null}
      <div className="ml-auto flex items-center gap-3">
        {meta ? <span className="rail">{meta}</span> : null}
        {action}
      </div>
    </header>
  );
}

/** Page title block. */
export function PageHead({ title, standfirst, fileNo, right }) {
  return (
    <div className="pb-1">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[62ch]">
          <h1 className="font-[family-name:var(--font-narrow)] text-[1.625rem] font-bold leading-[1.1] tracking-[-0.015em] text-[var(--ink)] sm:text-[1.875rem]">
            {title}
          </h1>
          {standfirst ? (
            <p className="mt-2 text-[0.8125rem] leading-[1.55] text-[var(--ink-2)]">{standfirst}</p>
          ) : null}
        </div>
        {right}
      </div>
      {fileNo ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="rail text-[var(--ink-4)]">File</span>
          <span className="font-[family-name:var(--font-mono)] text-[0.75rem] tracking-[0.02em] text-[var(--ink-3)]">
            {fileNo}
          </span>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Register rows                                                       */
/* ------------------------------------------------------------------ */

/** Label / value on one row. */
export function Field({ label, value, mono = true, tone, title }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--rule-soft)] px-4 py-2.5 last:border-b-0">
      <span className="field-label shrink-0">{label}</span>
      <span
        className={`${mono ? 'field-value' : 'text-[0.8125rem]'} text-right`}
        style={tone ? { color: tone } : undefined}
        title={title}
      >
        {value}
      </span>
    </div>
  );
}

export function BandChip({ band, label, children }) {
  return (
    <span className="band-chip" data-band={band}>
      {label ?? children ?? band}
    </span>
  );
}

export function StatusDot({ tone = 'live', pulse = false, label }) {
  const colour = {
    live: 'var(--live)',
    sim: 'var(--sim)',
    warn: 'var(--warn)',
    halt: 'var(--halt)',
    idle: 'var(--ink-3)',
  }[tone];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden="true"
        className={pulse ? 'pulse' : undefined}
        style={{ width: 7, height: 7, borderRadius: 999, background: colour, display: 'inline-block' }}
      />
      {label ? (
        <span
          className="font-[family-name:var(--font-narrow)] text-[0.6875rem] font-semibold tracking-[0.01em]"
          style={{ color: colour }}
        >
          {label}
        </span>
      ) : null}
    </span>
  );
}

/**
 * The provenance mark. Every figure produced by a model rather than by
 * arithmetic wears one, and every simulated subsystem says so — an accurate
 * scope holds up better under questioning than an implied claim.
 */
export function Provenance({ kind, detail }) {
  const map = {
    live: { tone: 'live', label: 'Reasoned', icon: 'node' },
    fallback: { tone: 'warn', label: 'Rule engine', icon: 'scales' },
    simulated: { tone: 'sim', label: 'Simulated', icon: 'drone' },
    computed: { tone: 'idle', label: 'Computed', icon: 'scales' },
    observed: { tone: 'live', label: 'Drone verified', icon: 'drone' },
    predicted: { tone: 'warn', label: 'Predicted', icon: 'forecast' },
  };
  const m = map[kind] ?? map.computed;
  const colour = {
    live: 'var(--live)',
    warn: 'var(--warn)',
    sim: 'var(--sim)',
    idle: 'var(--ink-3)',
  }[m.tone];

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-[0.1875rem] font-[family-name:var(--font-narrow)] text-[0.625rem] font-semibold tracking-[0.01em]"
      style={{ background: `color-mix(in srgb, ${colour} 14%, transparent)`, color: colour }}
      title={detail}
    >
      <Icon name={m.icon} size={10} />
      {m.label}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Tables                                                              */
/* ------------------------------------------------------------------ */

export function Register({ columns, children, className = '' }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full min-w-[38rem] border-collapse text-left">
        <thead>
          <tr className="border-b border-[var(--rule-strong)]">
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`colhead whitespace-nowrap px-3 py-2 ${c.align === 'right' ? 'text-right' : ''}`}
                style={c.width ? { width: c.width } : undefined}
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Cell({ children, align, mono = false, className = '', ...rest }) {
  return (
    <td
      className={`px-3 py-2 align-middle text-[0.75rem] ${
        mono ? 'font-[family-name:var(--font-mono)] tabular-nums' : ''
      } ${align === 'right' ? 'text-right' : ''} ${className}`}
      {...rest}
    >
      {children}
    </td>
  );
}

/* ------------------------------------------------------------------ */
/* Bars and meters                                                     */
/* ------------------------------------------------------------------ */

/** A proportion, drawn as a rounded pill track and fill. */
export function Bar({ value, max = 1, tone = 'var(--ink-2)', height = 6, label }) {
  const pct = Math.max(0, Math.min(1, value / (max || 1))) * 100;
  return (
    <span className="flex items-center gap-2">
      <span
        className="relative block flex-1 overflow-hidden rounded-full"
        style={{ height, background: 'var(--sheet-sunk)' }}
        role="img"
        aria-label={label ?? `${Math.round(pct)}%`}
      >
        {/* scaleX, not width — these bars re-render on every drag of the
            severity weights, and width would relayout the row each time. */}
        <span
          className="absolute inset-y-0 left-0 block w-full origin-left rounded-full"
          style={{
            background: tone,
            transform: `scaleX(${pct / 100})`,
            transition: 'transform 260ms cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      </span>
    </span>
  );
}

export function bandColour(band) {
  return {
    critical: 'var(--sev-critical)',
    severe: 'var(--sev-severe)',
    elevated: 'var(--sev-elevated)',
    monitor: 'var(--sev-monitor)',
    clear: 'var(--sev-clear)',
  }[band] ?? 'var(--ink-3)';
}

/* ------------------------------------------------------------------ */
/* Notices                                                             */
/* ------------------------------------------------------------------ */

/** A soft, tinted callout — reads clearly without shouting over live data. */
export function Note({ tone = 'info', children, icon = 'alert' }) {
  const colour = {
    info: 'var(--ink-3)',
    warn: 'var(--warn)',
    halt: 'var(--halt)',
    sim: 'var(--sim)',
    seal: 'var(--seal)',
  }[tone];
  return (
    <p
      className="flex items-start gap-2.5 rounded-(--radius) px-3.5 py-3 text-[0.75rem] leading-[1.55]"
      style={{ background: `color-mix(in srgb, ${colour} 9%, transparent)`, color: 'var(--ink-2)' }}
    >
      <Icon name={icon} size={13} className="mt-[0.1rem] shrink-0" style={{ color: colour }} />
      <span>{children}</span>
    </p>
  );
}

export function Empty({ title, children, icon = 'file' }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <span
        className="flex h-11 w-11 items-center justify-center rounded-full"
        style={{ background: 'var(--sheet-sunk)' }}
      >
        <Icon name={icon} size={20} style={{ color: 'var(--ink-3)' }} />
      </span>
      <p className="font-[family-name:var(--font-narrow)] text-[0.8125rem] font-semibold text-[var(--ink-2)]">
        {title}
      </p>
      {children ? <p className="max-w-[46ch] text-[0.75rem] leading-[1.5] text-[var(--ink-3)]">{children}</p> : null}
    </div>
  );
}

/** Loading state — a soft pulse, not a spinner. */
export function Working({ label = 'Working' }) {
  return (
    <div className="flex items-center gap-2.5 px-4 py-3">
      <span className="pulse block h-2 w-2 shrink-0 rounded-full" style={{ background: 'var(--stamp)' }} />
      <span className="font-[family-name:var(--font-narrow)] text-[0.75rem] font-semibold text-[var(--ink-3)]">
        {label}
      </span>
    </div>
  );
}
