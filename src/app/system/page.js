import GraphView from '@/components/GraphView';
import { PageHead, Sheet, SheetHead, Register, Cell, Field, StatusDot } from '@/components/ui';
import { pipelineShape } from '@/lib/aegis/pipeline';
import { DOCUMENTS } from '@/lib/aegis/corpus';
import { reasoningConfigured, MODEL } from '@/lib/agent/llm';
import { probeVisionService, visionServiceConfigured } from '@/lib/aegis/visionService';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'System status — AEGIS',
  description: 'Subsystem status and deployment substitutions.',
};

const SUBSYSTEMS = [
  {
    stage: '1',
    label: 'Vision analysis',
    dynamic: 'vision',
    real: 'Zone gridding, cloud-degraded confidence, live segmentation when connected',
    swap: 'Train U-Net on FloodNet for the segmentation ceiling',
  },
  {
    stage: '2',
    label: 'Zone prioritisation',
    status: 'working',
    real: 'Weighted severity, live reweighting, per-zone arithmetic',
    swap: null,
  },
  {
    stage: '3',
    label: 'Drone intelligence',
    status: 'simulated',
    real: 'Tasking, flight envelope, wind, battery, link degradation',
    swap: 'MAVLink telemetry + RTSP video from a ground control station',
  },
  {
    stage: '4',
    label: 'Resource decision',
    dynamic: 'reasoning',
    real: 'Norms engine, shortfall computation, agentic loop, rule-engine fallback',
    swap: 'Depot stock from the district resource register',
  },
  {
    stage: '5',
    label: 'Safe routing',
    status: 'working',
    real: 'Dijkstra, impassable links removed, per-mode cost models',
    swap: 'OSM geometry via OSRM instead of the zone lattice',
  },
  {
    stage: '5',
    label: 'Dispatch',
    status: 'simulated',
    real: 'Order generation, waypoints, ETA, bilingual text, signature block',
    swap: 'State SMS gateway and a text-to-speech service',
  },
  {
    stage: '—',
    label: 'Doctrine assistant',
    status: 'working',
    real: 'Retrieval graph, citation verification, refusal on off-corpus questions',
    swap: 'Authoritative full text in place of paraphrased summaries',
  },
  {
    stage: '—',
    label: 'Audit register',
    status: 'working',
    real: 'Append-only, actor and timestamp, recommendation separate from decision',
    swap: 'District record system in place of process memory',
  },
];

const DATASETS = [
  ['xBD', 'Building damage, 19 events', 'xview2.org'],
  ['FloodNet', 'UAV flood segmentation', 'github.com/BinaLab'],
  ['RescueNet', 'UAV post-disaster segmentation', 'Nature Sci. Data 2023'],
  ['Sen1Floods11', 'Sentinel-1/2 flood extent', 'github.com/cloudtostreet'],
  ['Bhuvan', 'Indian satellite / flood layers', 'bhuvan.nrsc.gov.in'],
  ['Copernicus EMS', 'Rapid mapping', 'emergency.copernicus.eu'],
];

const TONE = { working: 'live', simulated: 'sim', fallback: 'warn' };

function resolve(s, live, vision) {
  if (s.dynamic === 'vision') return vision?.reachable ? 'working' : 'fallback';
  if (s.dynamic === 'reasoning') return live ? 'working' : 'fallback';
  return s.status;
}

export default async function SystemPage() {
  const live = reasoningConfigured();
  const vision = visionServiceConfigured() ? await probeVisionService() : null;
  const shape = await pipelineShape();

  return (
    <div className="space-y-5">
      <PageHead title="System status" standfirst="Subsystem status and deployment substitutions" />

      <div className="grid gap-4 md:grid-cols-3">
        <Sheet>
          <SheetHead title="Reasoning" />
          <Field label="Status" value={live ? 'Live' : 'Rule engine'} tone={live ? 'var(--seal)' : 'var(--warn)'} />
          <Field label="Model" value={live ? MODEL : '—'} />
          <Field label="Fallback" value="Deterministic engines, always present" mono={false} />
        </Sheet>

        <Sheet>
          <SheetHead title="Vision service" />
          <Field
            label="Status"
            value={vision?.reachable ? `Reachable · ${vision.device}` : visionServiceConfigured() ? 'Down' : 'Not configured'}
            tone={vision?.reachable ? 'var(--seal)' : 'var(--warn)'}
          />
          <Field label="Segmentation" value={vision?.segmentation?.model ?? '—'} />
          <Field
            label="Detection"
            value={vision?.detectionAvailable ? vision.detection?.model : 'unavailable'}
            tone={vision?.detectionAvailable ? 'var(--seal)' : 'var(--warn)'}
          />
        </Sheet>

        <Sheet>
          <SheetHead title="Corpus" />
          <Field label="Documents" value={String(DOCUMENTS.length)} />
          <Field label="Retrieval" value="BM25, in-process" />
          <Field label="Network required" value="No" tone="var(--seal)" />
        </Sheet>
      </div>

      <Sheet>
        <SheetHead title="Subsystems" meta={`${SUBSYSTEMS.length} components`} />
        <Register
          columns={[
            { key: 'st', label: 'Stage', width: '3.5rem' },
            { key: 'c', label: 'Component' },
            { key: 's', label: 'Status', width: '7rem' },
            { key: 'r', label: 'Working' },
            { key: 'sw', label: 'Deployment substitution' },
          ]}
        >
          {SUBSYSTEMS.map((s) => {
            const status = resolve(s, live, vision);
            return (
              <tr key={s.label} className="border-b border-rule-soft align-top">
                <Cell mono>
                  <span className="rail">{s.stage}</span>
                </Cell>
                <Cell>
                  <span className="font-narrow text-[0.75rem] font-semibold text-ink">{s.label}</span>
                </Cell>
                <Cell>
                  <StatusDot tone={TONE[status]} label={status} />
                </Cell>
                <Cell>
                  <span className="block max-w-[38ch] text-[0.6875rem] leading-[1.45] text-ink-2">{s.real}</span>
                </Cell>
                <Cell>
                  <span className="block max-w-[34ch] text-[0.6875rem] leading-[1.45] text-ink-3">{s.swap ?? '—'}</span>
                </Cell>
              </tr>
            );
          })}
        </Register>
      </Sheet>

      <Sheet>
        <SheetHead title="Execution graph" meta={`${shape.nodes.length} nodes · ${shape.edges.length} edges`} />
        <div className="px-3 py-3">
          <GraphView shape={shape} currentNode={null} visited={[]} takenEdges={[]} />
        </div>
      </Sheet>

      <Sheet>
        <SheetHead title="Datasets" sub="Training and benchmark sources" />
        <Register
          columns={[
            { key: 'd', label: 'Dataset', width: '11rem' },
            { key: 'u', label: 'Use' },
            { key: 'r', label: 'Reference' },
          ]}
        >
          {DATASETS.map(([name, use, ref]) => (
            <tr key={name} className="border-b border-rule-soft">
              <Cell>
                <span className="font-narrow text-[0.75rem] font-semibold text-ink">{name}</span>
              </Cell>
              <Cell>
                <span className="text-[0.6875rem] text-ink-2">{use}</span>
              </Cell>
              <Cell mono>
                <span className="text-[0.625rem] text-ink-3">{ref}</span>
              </Cell>
            </tr>
          ))}
        </Register>
      </Sheet>
    </div>
  );
}
