/**
 * Zone records — read endpoint.
 *
 * Exists so the grid, the severity distribution and the requirement can be read
 * by anything outside this app: the planned Flutter field client, a district
 * GIS, or an operator checking the arithmetic without opening the console.
 */

import { buildZones, INCIDENT } from '@/lib/aegis/incident';
import { rankZones, BANDS } from '@/lib/aegis/severity';
import { buildRequirement } from '@/lib/aegis/resources';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const params = new URL(request.url).searchParams;
  const detail = params.get('detail') === 'full';

  const zones = rankZones(buildZones(INCIDENT.fileNo));
  const requirement = buildRequirement(zones, {}, 12);

  const distribution = Object.fromEntries(
    BANDS.map((b) => [b.id, zones.filter((z) => z.band === b.id).length])
  );

  return Response.json({
    incident: { fileNo: INCIDENT.fileNo, name: INCIDENT.name, district: INCIDENT.district },
    count: zones.length,
    distribution,
    severity: {
      max: zones[0]?.severity ?? 0,
      min: zones[zones.length - 1]?.severity ?? 0,
      median: zones[Math.floor(zones.length / 2)]?.severity ?? 0,
    },
    requirement: {
      demand: requirement.demand,
      stock: requirement.stock,
      shortfall: requirement.shortfall,
      constrained: requirement.constrained,
      totals: requirement.totals,
    },
    top: zones.slice(0, 12).map((z) => ({
      id: z.id,
      settlement: z.settlement,
      severity: z.severity,
      band: z.band,
      flood: z.flood,
      damage: z.damage,
      exposure: z.exposure,
      population: z.population,
      depthM: z.depthM,
      predicted: z.predicted,
    })),
    ...(detail ? { zones } : {}),
    synthetic: true,
  });
}
