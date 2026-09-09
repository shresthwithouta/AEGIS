import { PageHead, Sheet, SheetHead, Register, Cell, Field, Note, BandChip, Provenance, bandColour } from '@/components/ui';
import Icon from '@/components/Icon';
import { buildZones, INCIDENT, BRIDGES } from '@/lib/aegis/incident';
import { rankZones } from '@/lib/aegis/severity';
import { buildDamageRecord, rebuildPriority, afterAction, DAMAGE_GRADES, INDICATIVE_RATES, RATES_WARNING } from '@/lib/aegis/phases';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Recovery — AEGIS',
  description:
    'Graded damage documentation for relief claims, rebuild priority led by connectivity, and after-action findings that feed back into pre-monsoon planning.',
};

/** Indian numbering — a claim total is read in lakh and crore, not in millions. */
function inr(n) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} lakh`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function AfterPage() {
  const zones = rankZones(buildZones(INCIDENT.fileNo));
  const damage = buildDamageRecord(zones);
  const rebuild = rebuildPriority(zones, damage);
  const findings = afterAction(zones, [], null);

  return (
    <div className="space-y-7">
      <PageHead
        title="Recovery"
        standfirst="Damage assessment, entitlement estimate and rebuild priority"
        fileNo={`${INCIDENT.fileNo} · post-event`}
        right={
          <div className="flex items-baseline gap-2 border-b border-[var(--rule-strong)] pb-1">
            <span className="field-label">Indicative claim value</span>
            <span className="font-[family-name:var(--font-mono)] text-[1.0625rem] font-semibold tabular-nums text-[var(--ink)]">
              {inr(damage.totals.entitlement)}
            </span>
          </div>
        }
      />

      <Note tone="warn" icon="alert">
        {RATES_WARNING}
      </Note>

      {/* ---- Totals, as a ruled summary line ------------------------- */}
      <Sheet>
        <SheetHead title="Assessment summary" meta={`${damage.rows.length} zones assessed`} />
        {/* A ruled assessment line, wrapping rather than scrolling. A table
            would hold six no-wrap column heads on one row and force a phone to
            scroll sideways — and the Incident Commander reads this in ten
            seconds, standing up. Ruled dividers keep the register grammar. */}
        <dl className="flex flex-wrap">
          {[
            ['Fully damaged', damage.totals.fully, 'var(--sev-critical)'],
            ['Severely damaged', damage.totals.severely, 'var(--sev-severe)'],
            ['Partially damaged', damage.totals.partially, 'var(--sev-elevated)'],
            ['Crop area (ha)', damage.totals.cropHa, null],
            ['Livestock lost', damage.totals.livestock, null],
            ['Displaced', damage.totals.displaced, null],
          ].map(([label, value, tone]) => (
            <div
              key={label}
              className="min-w-[8.5rem] flex-1 border-t border-r border-[var(--rule)] px-3 py-2.5 last:border-r-0"
            >
              <dt className="field-label block">{label}</dt>
              <dd className="mt-1 flex items-baseline gap-1.5">
                {tone ? (
                  <span aria-hidden="true" style={{ width: 10, height: 2, background: tone, display: 'inline-block' }} />
                ) : null}
                <span className="font-[family-name:var(--font-mono)] text-[1.0625rem] font-semibold tabular-nums text-[var(--ink)]">
                  {typeof value === 'number' ? value.toLocaleString('en-IN') : value}
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-[var(--rule)] px-3 py-2">
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {DAMAGE_GRADES.map((g) => (
              <span key={g.key} className="max-w-[30ch]">
                <span className="field-label block">{g.label}</span>
                <span className="text-[0.6875rem] leading-[1.4] text-[var(--ink-3)]">{g.note}</span>
              </span>
            ))}
          </div>
        </div>
      </Sheet>

      {/* ---- Damage register ---------------------------------------- */}
      <Sheet>
        <SheetHead
          title="Damage register"
          sub="Graded by zone — the grade drives the norm, so a count alone is not claimable"
          action={<Provenance kind="computed" detail="Derived from the incident model's structure counts and inundation." />}
        />
        <Register
          columns={[
            { key: 'sl', label: 'Sl.', width: '2.6rem' },
            { key: 'z', label: 'Zone' },
            { key: 'f', label: 'Fully', align: 'right' },
            { key: 's', label: 'Severely', align: 'right' },
            { key: 'p', label: 'Partially', align: 'right' },
            { key: 'c', label: 'Crop ha', align: 'right' },
            { key: 'd', label: 'Displaced', align: 'right' },
            { key: 'e', label: 'Indicative', align: 'right' },
            { key: 'ev', label: 'Evidence' },
          ]}
        >
          {damage.rows.slice(0, 20).map((r, i) => (
            <tr key={r.zoneId} className="border-b border-[var(--rule-soft)]">
              <Cell mono className="rail !text-[0.625rem]">
                {String(i + 1).padStart(3, '0')}
              </Cell>
              <Cell>
                <span className="band-edge -ml-2.5 block pl-2.5" data-band={r.band}>
                  <span className="font-[family-name:var(--font-mono)] text-[0.75rem] font-semibold">{r.zoneId}</span>
                  {r.settlement ? (
                    <span className="ml-1.5 text-[0.6875rem] text-[var(--ink-3)]">{r.settlement}</span>
                  ) : null}
                </span>
              </Cell>
              <Cell mono align="right" className="!font-semibold" style={{ color: 'var(--sev-critical)' }}>
                {r.houses.fully}
              </Cell>
              <Cell mono align="right">
                {r.houses.severely}
              </Cell>
              <Cell mono align="right">
                {r.houses.partially}
              </Cell>
              <Cell mono align="right">
                {r.cropHa}
              </Cell>
              <Cell mono align="right">
                {r.displaced.toLocaleString('en-IN')}
              </Cell>
              <Cell mono align="right">
                {inr(r.entitlement)}
              </Cell>
              <Cell>
                <span className="flex items-center gap-1.5">
                  <Icon name="layers" size={10} style={{ color: 'var(--seal)' }} title="Imagery on record" />
                  <Icon
                    name="drone"
                    size={10}
                    style={{ color: r.evidence.droneMosaic ? 'var(--sim)' : 'var(--ink-3)' }}
                    title={r.evidence.droneMosaic ? 'Drone mosaic on record' : 'No drone mosaic'}
                  />
                  <Icon
                    name="stamp"
                    size={10}
                    style={{ color: r.evidence.fieldCountersigned ? 'var(--seal)' : 'var(--halt)' }}
                    title={
                      r.evidence.fieldCountersigned
                        ? 'Field assessment countersigned'
                        : 'NOT countersigned — cannot be claimed until a joint field team signs'
                    }
                  />
                </span>
              </Cell>
            </tr>
          ))}
        </Register>
        <div className="border-t border-[var(--rule)] px-3 py-2">
          <Note tone="halt" icon="stamp">
            Not countersigned. A claim requires a detailed assessment countersigned by revenue, agriculture and engineering staff.
          </Note>
        </div>
      </Sheet>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(20rem,0.85fr)]">
        {/* ---- Rebuild priority ------------------------------------- */}
        <Sheet>
          <SheetHead
            title="Rebuild priority"
            sub="A different order from rescue — connectivity leads"
            meta={`${rebuild.length} ranked`}
          />
          <ol className="divide-y divide-[var(--rule-soft)]">
            {rebuild.slice(0, 8).map((r) => (
              <li key={r.zoneId} className="flex items-start gap-3 px-3 py-2.5">
                <span className="rail w-6 shrink-0 pt-0.5">{String(r.rank).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="font-[family-name:var(--font-mono)] text-[0.8125rem] font-semibold text-[var(--ink)]">
                      {r.zoneId}
                    </span>
                    {r.settlement ? (
                      <span className="text-[0.75rem] text-[var(--ink-2)]">{r.settlement}</span>
                    ) : null}
                    {r.connectivity ? (
                      <span
                        className="band-chip"
                        style={{ borderColor: 'var(--halt)', color: 'var(--halt)' }}
                      >
                        <Icon name="bridge" size={9} />
                        Crossing out
                      </span>
                    ) : null}
                  </span>
                  <ul className="mt-1 space-y-0.5">
                    {r.reasons.map((reason, k) => (
                      <li key={k} className="text-[0.6875rem] leading-[1.45] text-[var(--ink-3)]">
                        {reason}
                      </li>
                    ))}
                  </ul>
                </span>
                <span
                  className="shrink-0 font-[family-name:var(--font-mono)] text-[1.0625rem] font-semibold tabular-nums text-[var(--ink)]"
                  style={{ borderBottom: `3px solid ${bandColour(r.score >= 60 ? 'critical' : r.score >= 40 ? 'severe' : 'elevated')}` }}
                >
                  {r.score}
                </span>
              </li>
            ))}
          </ol>
        </Sheet>

        {/* ---- Norms ------------------------------------------------- */}
        <Sheet>
          <SheetHead title="Norms applied" sub="Indicative rates" />
          {Object.entries(INDICATIVE_RATES).map(([k, v]) => (
            <Field
              key={k}
              label={
                {
                  fully: 'House — fully damaged',
                  severely: 'House — severely damaged',
                  partially: 'House — partially damaged',
                  cropHa: 'Crop loss',
                  livestockLarge: 'Livestock — large milch',
                  gratuitous: 'Gratuitous relief',
                }[k] ?? k
              }
              value={`₹${v.amount.toLocaleString('en-IN')} ${v.unit}`}
            />
          ))}
          <div className="px-3 py-2">
          </div>
        </Sheet>
      </div>

      {/* ---- After-action ------------------------------------------- */}
      <Sheet>
        <SheetHead
          title="After-action findings"
          sub="What this event should change about the next one"
          meta={`${findings.length} findings`}
        />
        <ol className="divide-y divide-[var(--rule)]">
          {findings.map((f, i) => (
            <li key={i} className="px-3 py-3">
              <div className="flex flex-wrap items-baseline gap-2.5">
                <span className="rail">{String(i + 1).padStart(2, '0')}</span>
                <span
                  className="band-chip"
                  style={{ borderColor: findingTone(f.kind), color: findingTone(f.kind) }}
                >
                  {f.kind}
                </span>
                <h3 className="font-[family-name:var(--font-narrow)] text-[0.875rem] font-semibold text-[var(--ink)]">
                  {f.title}
                </h3>
              </div>
              <p className="mt-1.5 max-w-[80ch] text-[0.8125rem] leading-[1.55] text-[var(--ink-2)]">{f.detail}</p>
              <p className="mt-1.5 flex items-center gap-1.5 text-[0.6875rem] text-[var(--ink-3)]">
                <Icon name="chevron" size={10} style={{ color: 'var(--stamp)' }} />
                Feeds into: {f.feedsInto}
              </p>
            </li>
          ))}
        </ol>
      </Sheet>
    </div>
  );
}

function findingTone(kind) {
  return (
    {
      access: 'var(--sev-severe)',
      infrastructure: 'var(--halt)',
      resources: 'var(--warn)',
      intelligence: 'var(--sim)',
      process: 'var(--ink-3)',
    }[kind] ?? 'var(--ink-3)'
  );
}
