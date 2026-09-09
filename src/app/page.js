import SituationBoard from '@/components/SituationBoard';
import { PageHead, Sheet, SheetHead, Field, StatusDot } from '@/components/ui';
import { buildZones, INCIDENT, DEPOTS, BRIDGES } from '@/lib/aegis/incident';
import { rankZones } from '@/lib/aegis/severity';
import { districtStock } from '@/lib/aegis/resources';

export const dynamic = 'force-dynamic';

export default function SituationPage() {
  const zones = rankZones(buildZones(INCIDENT.fileNo));
  const critical = zones.filter((z) => z.severity >= 80).length;
  const severe = zones.filter((z) => z.severity >= 60 && z.severity < 80).length;
  const stock = districtStock();
  const crossingsOut = BRIDGES.filter((b) => b.status !== 'open').length;

  const atRisk = zones
    .filter((z) => z.severity >= 60)
    .reduce((a, z) => a + Math.round((z.predicted.low + z.predicted.high) / 2), 0);

  const declared = new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Asia/Kolkata',
  }).format(new Date(INCIDENT.declaredAt));

  const kpis = [
    { label: 'Critical', value: critical, tone: 'var(--sev-critical)' },
    { label: 'Severe', value: severe, tone: 'var(--sev-severe)' },
    { label: 'At risk', value: atRisk.toLocaleString('en-IN'), tone: 'var(--warn)' },
    { label: 'Boats', value: stock.boats },
    { label: 'Ambulances', value: stock.ambulances },
    { label: 'Teams', value: stock.teams },
    { label: 'Crossings out', value: crossingsOut, tone: crossingsOut ? 'var(--halt)' : undefined },
  ];

  return (
    <div className="space-y-5">
      <PageHead
        title={INCIDENT.name}
        standfirst={`${INCIDENT.hazard} · ${INCIDENT.district}, ${INCIDENT.state} · ${INCIDENT.basin} basin`}
        fileNo={INCIDENT.fileNo}
        right={
          <span className="flex items-center gap-2.5">
            <StatusDot tone="halt" pulse label="Active" />
            <span className="rail">Declared {declared} IST</span>
          </span>
        }
      />

      {/* Status line — the numbers a duty officer is asked for out loud */}
      <div className="grid grid-cols-2 border border-[var(--rule)] bg-[var(--sheet)] sm:grid-cols-4 lg:grid-cols-7">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className="border-b border-r border-[var(--rule)] px-3 py-2 last:border-r-0 lg:border-b-0"
          >
            <span className="field-label block">{k.label}</span>
            <span
              className="mt-0.5 block font-[family-name:var(--font-mono)] text-[1.125rem] font-semibold tabular-nums"
              style={{ color: k.tone ?? 'var(--ink)' }}
            >
              {k.value}
            </span>
          </div>
        ))}
      </div>

      <SituationBoard zones={zones} />

      <div className="grid gap-4 md:grid-cols-3">
        <Sheet>
          <SheetHead title="Incident" />
          <Field label="File" value={INCIDENT.fileNo} />
          <Field label="District" value={`${INCIDENT.district}, ${INCIDENT.state}`} />
          <Field label="Basin" value={INCIDENT.basin} />
          <Field label="Control room" value={INCIDENT.eoc} mono={false} />
          <Field label="First responder" value={INCIDENT.sdrfBattalion} mono={false} />
          <Field label="Area of interest" value={`${INCIDENT.aoiKm} × ${INCIDENT.aoiKm} km`} />
        </Sheet>

        <Sheet>
          <SheetHead title="Depots" meta={`${DEPOTS.length} holding`} />
          {DEPOTS.map((d) => (
            <Field
              key={d.id}
              label={d.name}
              value={`${d.stock.boats}b · ${d.stock.ambulances}a · ${d.stock.teams}t`}
              title={`Zone ${d.zone}`}
            />
          ))}
          <Field label="District total" value={`${stock.boats}b · ${stock.ambulances}a · ${stock.teams}t`} />
        </Sheet>

        <Sheet>
          <SheetHead title="Crossings" meta={crossingsOut ? `${crossingsOut} out` : 'all open'} />
          {BRIDGES.map((b) => (
            <Field
              key={b.id}
              label={b.name}
              value={b.status}
              tone={
                b.status === 'open'
                  ? 'var(--seal)'
                  : b.status === 'restricted'
                    ? 'var(--warn)'
                    : 'var(--halt)'
              }
              title={b.note}
            />
          ))}
        </Sheet>
      </div>
    </div>
  );
}
