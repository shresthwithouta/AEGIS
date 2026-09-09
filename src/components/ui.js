/**
 * Shared primitives in the file grammar.
 *
 * There is no Card here on purpose. Structure is carried by ruled columns,
 * hairlines and a numbered margin rail — the way a register carries it — so a
 * screen full of these reads as one document rather than a tray of tiles.
 */

import Icon from './Icon';

/* ------------------------------------------------------------------ */
/* Sheets and headings                                                 */
/* ------------------------------------------------------------------ */

export function Sheet({ children, className = '', active = false, raised = false, ...rest }) {
  return (
    <section
      className={`ticked ${raised ? 'sheet-raised' : 'sheet'} ${className}`}
      data-active={active ? 'true' : undefined}
      {...rest}
    >
      {children}
    </section>
  );
}

/**
 * A sheet's head. The label sits on the rule, the way a form's caption sits on
 * the ruled line above its field block.
 */
export function SheetHead({ title, meta, action, sub }) {
  return (
    <header className="flex items-baseline gap-3 border-b border-[var(--rule)] px-3 py-2">
      <h2 className="font-[family-name:var(--font-narrow)] text-[0.6875rem] font-bold uppercase tracking-[0.14em] text-[var(--ink)]">
        {title}
      </h2>
      {sub ? <span className="text-[0.6875rem] text-[var(--ink-3)]">{sub}</span> : null}
      <div className="ml-auto flex items-center gap-3">
        {meta ? <span className="rail">{meta}</span> : null}
        {action}
      </div>
    </header>
  );
}

/** Page title block. No eyebrow above it — the heading carries its own weight. */
export function PageHead({ title, standfirst, fileNo, right }) {
  return (
    <div className="border-b border-[var(--rule-strong)] pb-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-[62ch]">
          <h1 className="font-[family-name:var(--font-narrow)] text-[1.75rem] font-bold uppercase leading-[1.05] tracking-[-0.01em] text-[var(--ink)] sm:text-[2.125rem]">
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
          <span className="rail">F.No.</span>
          <span className="font-[family-name:var(--font-mono)] text-[0.6875rem] tracking-[0.06em] text-[var(--ink-2)]">
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

/** Label / value on one ruled line — the atom of a government form. */
export function Field({ label, value, mono = true, tone, title }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--rule-soft)] px-3 py-[0.4375rem] last:border-b-0">
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
        style={{ width: 6, height: 6, background: colour, display: 'inline-block' }}
      />
      {label ? (
        <span
          className="font-[family-name:var(--font-narrow)] text-[0.5625rem] font-semibold uppercase tracking-[0.11em]"
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
 * arithmetic wears one, and every simulated subsystem says so, because the
 * dossier's own action list says an accurate scope holds up better under
 * questioning than an implied claim.
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
      className="inline-flex items-center gap-1 border px-1.5 py-[0.0625rem] font-[family-name:var(--font-narrow)] text-[0.5625rem] font-semibold uppercase tracking-[0.1em]"
      style={{ borderColor: colour, color: colour }}
      title={detail}
    >
      <Icon name={m.icon} size={9} />
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
                className={`colhead whitespace-nowrap px-2.5 py-1.5 ${c.align === 'right' ? 'text-right' : ''}`}
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
      className={`px-2.5 py-[0.4375rem] align-middle text-[0.75rem] ${
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

/**
 * A proportion, drawn as a ruled bar rather than a rounded pill.
 * Colour sits in the fill and the baseline rule only — never behind a number.
 */
export function Bar({ value, max = 1, tone = 'var(--ink-2)', height = 4, label }) {
  const pct = Math.max(0, Math.min(1, value / (max || 1))) * 100;
  return (
    <span className="flex items-center gap-2">
      <span
        className="relative block flex-1 border-b border-[var(--rule)]"
        style={{ height }}
        role="img"
        aria-label={label ?? `${Math.round(pct)}%`}
      >
        {/* scaleX, not width — these bars re-render on every drag of the
            severity weights, and width would relayout the row each time. */}
        <span
          className="absolute inset-y-0 left-0 block w-full origin-left"
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

/**
 * A marginal note, in the register's own voice. Uses a 1px rule and a drawn
 * mark rather than a coloured slab, so it does not shout over live data.
 */
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
      className="flex items-start gap-2 border-l px-3 py-2 text-[0.75rem] leading-[1.5]"
      style={{ borderLeftColor: colour, color: 'var(--ink-2)' }}
    >
      <Icon name={icon} size={12} className="mt-[0.15rem] shrink-0" style={{ color: colour }} />
      <span>{children}</span>
    </p>
  );
}

export function Empty({ title, children, icon = 'file' }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
      <Icon name={icon} size={22} style={{ color: 'var(--ink-3)' }} />
      <p className="font-[family-name:var(--font-narrow)] text-[0.75rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-2)]">
        {title}
      </p>
      {children ? <p className="max-w-[46ch] text-[0.75rem] leading-[1.5] text-[var(--ink-3)]">{children}</p> : null}
    </div>
  );
}

/** Loading, in the register's voice — a drawn rule, not a spinner. */
export function Working({ label = 'Working' }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="rule-draw block h-px w-8" style={{ background: 'var(--stamp)' }} />
      <span className="font-[family-name:var(--font-narrow)] text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-[var(--ink-3)]">
        {label}
      </span>
    </div>
  );
}
