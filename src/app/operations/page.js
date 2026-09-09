import PipelineConsole from '@/components/PipelineConsole';
import VisionIngest from '@/components/VisionIngest';
import { PageHead } from '@/components/ui';
import { buildZones, INCIDENT } from '@/lib/aegis/incident';
import { rankZones } from '@/lib/aegis/severity';
import { pipelineShape } from '@/lib/aegis/pipeline';
import { reasoningConfigured } from '@/lib/agent/llm';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Response pipeline — AEGIS',
  description:
    'Execute the five-stage response pipeline: vision analysis, zone prioritisation, drone verification, resource decision and safe dispatch, halting at two human approval gates.',
};

export default async function OperationsPage() {
  const zones = rankZones(buildZones(INCIDENT.fileNo));
  const live = reasoningConfigured();
  const shape = await pipelineShape();

  return (
    <div className="space-y-5">
      <PageHead
        title="Response pipeline"
        standfirst="Vision, prioritisation, survey, allocation, dispatch"
        fileNo={`${INCIDENT.fileNo} · ${INCIDENT.name}`}
      />

      <VisionIngest />

      <PipelineConsole zones={zones} shape={shape} reasoningLive={live} />
    </div>
  );
}
