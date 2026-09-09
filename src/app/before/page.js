import Link from 'next/link';
import Hydrograph from '@/components/Hydrograph';
import VulnerabilityBoard from '@/components/VulnerabilityBoard';
import { PageHead, Sheet, SheetHead, Register, Cell, Field, Note } from '@/components/ui';
import Icon from '@/components/Icon';
import { buildForecast, INCIDENT } from '@/lib/aegis/incident';
import { buildVulnerability, prePositioning, HISTORY } from '@/lib/aegis/phases';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Preparedness — AEGIS',
  description:
    'Pre-monsoon vulnerability ranking, CWC/IMD forecast triggers and pre-positioning proposals for the district.',
};

export default function BeforePage() {
  const vulnerability = buildVulnerability(INCIDENT.fileNo);
  const forecast = buildForecast(INCIDENT.fileNo);
  const pre = prePositioning(vulnerability, forecast);

  return (
    <div className="space-y-7">
      <PageHead
        title="Preparedness"
        standfirst="Vulnerability index, CWC gauge forecast and pre-positioning"
        fileNo={`${INCIDENT.fileNo} · pre-monsoon planning`}
        right={
          <Link href="/before/assistant" className="btn">
            <Icon name="search" size={12} />
            Ask the doctrine assistant
          </Link>
        }
      />

      {/* The trigger, stated before anything else — it is the actionable fact */}
      <Sheet raised active={Boolean(pre.crossingForecast)} className="border-[var(--halt)]">
        <div className="flex flex-wrap items-start gap-3 border-b-2 px-3 py-2.5" style={{ borderBottomColor: pre.crossingForecast ? 'var(--halt)' : 'var(--rule)' }}>
          <Icon
            name="alert"
            size={16}
            style={{ color: pre.crossingForecast ? 'var(--halt)' : 'var(--ink-3)', marginTop: 2 }}
          />
          <div className="min-w-0 flex-1">
            <h2 className="font-[family-name:var(--font-narrow)] text-[0.875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink)]">
              {pre.crossingForecast ? 'Pre-positioning trigger met' : 'No trigger met'}
            </h2>
            <p className="mt-1 max-w-[76ch] text-[0.8125rem] leading-[1.55] text-[var(--ink-2)]">{pre.trigger}</p>
          </div>
          <div className="flex shrink-0 gap-4">
            <span className="flex flex-col">
              <span className="field-label">Forecast peak</span>
              <span className="font-[family-name:var(--font-mono)] text-[1.125rem] font-semibold tabular-nums text-[var(--ink)]">
                {pre.peak.gaugeM} m
              </span>
            </span>
            <span className="flex flex-col">
              <span className="field-label">Danger level</span>
              <span
                className="font-[family-name:var(--font-mono)] text-[1.125rem] font-semibold tabular-nums"
                style={{ color: 'var(--halt)' }}
              >
                {pre.dangerLevelM} m
              </span>
            </span>
            {pre.crossingForecast ? (
              <span className="flex flex-col">
                <span className="field-label">Lead time</span>
                <span className="font-[family-name:var(--font-mono)] text-[1.125rem] font-semibold tabular-nums text-[var(--ink)]">
                  H+{pre.crossingForecast.atHour}
                </span>
              </span>
            ) : null}
          </div>
        </div>
      </Sheet>

      <Hydrograph forecast={forecast} />

      <VulnerabilityBoard vulnerability={vulnerability} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(18rem,0.7fr)]">
        <Sheet>
          <SheetHead
            title="Proposed pre-positioning"
            sub="Staged before the peak, against the ranking — not after it, against the damage"
            meta={`${pre.moves.length} movements`}
          />
          <Register
            columns={[
              { key: 'sl', label: 'Sl.', width: '2.6rem' },
              { key: 'z', label: 'Zone' },
              { key: 'from', label: 'From' },
              { key: 'b', label: 'Boats', align: 'right' },
              { key: 'k', label: 'Relief kits', align: 'right' },
              { key: 'sd', label: 'Shelter short', align: 'right' },
            ]}
          >
            {pre.moves.map((m, i) => (
              <tr key={m.zoneId} className="border-b border-[var(--rule-soft)]">
                <Cell mono className="rail !text-[0.625rem]">
                  {String(i + 1).padStart(2, '0')}
                </Cell>
                <Cell>
                  <span className="font-[family-name:var(--font-mono)] text-[0.75rem] font-semibold">{m.zoneId}</span>
                  {m.settlement ? (
                    <span className="ml-1.5 text-[0.6875rem] text-[var(--ink-3)]">{m.settlement}</span>
                  ) : null}
                </Cell>
                <Cell>
                  <span className="text-[0.6875rem] text-[var(--ink-2)]">{m.fromDepot}</span>
                </Cell>
                <Cell mono align="right">
                  {m.boats}
                </Cell>
                <Cell mono align="right">
                  {m.reliefKits.toLocaleString('en-IN')}
                </Cell>
                <Cell mono align="right">
                  <span style={{ color: m.shelterDeficit > 0 ? 'var(--warn)' : 'var(--ink-3)' }}>
                    {m.shelterDeficit.toLocaleString('en-IN')}
                  </span>
                </Cell>
              </tr>
            ))}
          </Register>
          <div className="border-t border-[var(--rule)] px-3 py-2">
            <p className="rail">Quarter of eventual boat requirement staged early — peak location is uncertain.</p>
          </div>
        </Sheet>

        <Sheet>
          <SheetHead title="District flood record" meta="last five events" />
          <Register
            columns={[
              { key: 'y', label: 'Year' },
              { key: 'p', label: 'Peak', align: 'right' },
              { key: 'z', label: 'Zones', align: 'right' },
              { key: 'd', label: 'Displaced', align: 'right' },
            ]}
          >
            {HISTORY.map((h) => (
              <tr key={h.year} className="border-b border-[var(--rule-soft)]">
                <Cell mono className="!font-semibold">
                  {h.year}
                  <span className="mt-0.5 block max-w-[16ch] text-[0.625rem] font-normal leading-[1.35] text-[var(--ink-3)]">
                    {h.event}
                  </span>
                </Cell>
                <Cell mono align="right">
                  {h.peakM}
                </Cell>
                <Cell mono align="right">
                  {h.zonesAffected}
                </Cell>
                <Cell mono align="right">
                  {h.displaced.toLocaleString('en-IN')}
                </Cell>
              </tr>
            ))}
          </Register>
          <div className="border-t border-[var(--rule)]">
            <Field label="Warning level" value={`${forecast.warningLevelM} m`} tone="var(--warn)" />
            <Field label="Danger level" value={`${forecast.dangerLevelM} m`} tone="var(--halt)" />
            <Field label="Highest on record" value={`${Math.max(...HISTORY.map((h) => h.peakM))} m (2017)`} />
          </div>
        </Sheet>
      </div>
    </div>
  );
}
