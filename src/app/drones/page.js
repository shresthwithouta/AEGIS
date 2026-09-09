import DroneConsole from '@/components/DroneConsole';
import { PageHead } from '@/components/ui';
import { buildZones, INCIDENT } from '@/lib/aegis/incident';
import { rankZones } from '@/lib/aegis/severity';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Drone console — AEGIS',
  description:
    'Task the UAV fleet to the highest-severity unverified zones and watch the survey run: position, wind, battery, C2 link and detections, on a real flight model.',
};

export default function DronesPage() {
  const zones = rankZones(buildZones(INCIDENT.fileNo));

  return (
    <div className="space-y-5">
      <PageHead
        title="Drone console"
        standfirst="Fleet status, survey tasking and sensor feed"
        fileNo={`${INCIDENT.fileNo} · UAV tasking`}
      />
      <DroneConsole zones={zones} />
    </div>
  );
}
