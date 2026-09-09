/**
 * The BEFORE and AFTER phases.
 *
 * PS 26206 asks for risk mitigation, planning and management before, during or
 * after a disaster. AEGIS covers all three off one spine: the same zone-severity
 * record that drives live response is a historical vulnerability layer before an
 * event and a damage record after it. Nothing here is a separate product — it is
 * the same data read at a different point in the cycle.
 */

import { rngFrom, clamp01 } from './rng';
import { buildZones, DEPOTS, ROADS, BRIDGES, INCIDENT } from './incident';
import { bandFor } from './severity';
import { groundTruth } from './drones';

/* ================================================================== */
/* BEFORE — vulnerability and pre-positioning                          */
/* ================================================================== */

/**
 * Historical events on record for the district. SYNTHETIC, but shaped like a
 * real district register: north Bihar floods on a roughly biennial cycle.
 */
export const HISTORY = Object.freeze([
  { year: 2024, event: 'Kosi–Bagmati high stage', peakM: 49.9, zonesAffected: 38, displaced: 21400 },
  { year: 2022, event: 'Kamla Balan spill', peakM: 49.4, zonesAffected: 27, displaced: 12800 },
  { year: 2021, event: 'Cloudburst, upper catchment', peakM: 50.2, zonesAffected: 44, displaced: 31200 },
  { year: 2019, event: 'Prolonged monsoon surplus', peakM: 49.1, zonesAffected: 22, displaced: 9600 },
  { year: 2017, event: 'Embankment breach, Jhanjharpur reach', peakM: 50.6, zonesAffected: 51, displaced: 40300 },
]);

/**
 * Vulnerability index — the BEFORE-phase product.
 *
 * Composite of the factors a District Disaster Management Plan's hazard,
 * vulnerability and capacity analysis is expected to carry. Deliberately
 * separate from live severity: severity says what is happening now,
 * vulnerability says what will happen next time, and pre-monsoon money is
 * spent against the second.
 */
export const VULNERABILITY_FACTORS = Object.freeze([
  { key: 'frequency', label: 'Inundation frequency', weight: 0.3, basis: 'Share of the last five recorded events in which this zone was inundated.' },
  { key: 'exposure', label: 'Population exposure', weight: 0.25, basis: 'Resident population normalised across the area of interest.' },
  { key: 'isolation', label: 'Access isolation', weight: 0.2, basis: 'Distance to the nearest all-weather road that stays open at danger level.' },
  { key: 'shelter', label: 'Shelter deficit', weight: 0.15, basis: 'Shortfall between population and identified raised shelter capacity.' },
  { key: 'fragility', label: 'Structural fragility', weight: 0.1, basis: 'Share of kutcha and semi-pucca housing stock.' },
]);

function nearestRoadDistance(zone) {
  const onRoad = new Set(ROADS.flatMap((r) => r.path));
  let best = 9;
  for (const id of onRoad) {
    const col = 'ABCDEFGHIJ'.indexOf(id[0]);
    const row = parseInt(id.slice(2), 10) - 1;
    best = Math.min(best, Math.hypot(zone.centre.x - (col + 0.5), zone.centre.y - (row + 0.5)));
  }
  return best;
}

export function buildVulnerability(seedRef = INCIDENT.fileNo) {
  const zones = buildZones(seedRef);
  const maxPop = Math.max(...zones.map((z) => z.population));

  const rows = zones.map((z) => {
    const rng = rngFrom(`vuln:${z.id}`);
    // Zones close to the river flooded in more of the recorded events.
    const frequency = clamp01(1 - z.distanceToRiverKm / 4.2 + (rng() - 0.5) * 0.18);
    const eventsInundated = Math.round(frequency * HISTORY.length);
    const exposure = clamp01(z.population / maxPop);
    const roadKm = nearestRoadDistance(z);
    const isolation = clamp01(roadKm / 3.2);
    const shelterCapacity = Math.round(z.population * (0.18 + rng() * 0.4));
    const shelter = clamp01(1 - shelterCapacity / Math.max(1, z.population));
    const fragility = clamp01(0.3 + (1 - z.population / maxPop) * 0.5 + (rng() - 0.5) * 0.2);

    const factors = { frequency, exposure, isolation, shelter, fragility };
    const index = Math.round(
      VULNERABILITY_FACTORS.reduce((a, f) => a + f.weight * factors[f.key], 0) * 100
    );

    return {
      id: z.id,
      col: z.col,
      row: z.row,
      settlement: z.settlement,
      terrainLabel: z.terrainLabel,
      population: z.population,
      distanceToRiverKm: z.distanceToRiverKm,
      roadKm: +roadKm.toFixed(2),
      eventsInundated,
      shelterCapacity,
      shelterDeficit: Math.max(0, z.population - shelterCapacity),
      factors: Object.fromEntries(Object.entries(factors).map(([k, v]) => [k, +v.toFixed(3)])),
      index,
      band: bandFor(index).id,
    };
  });

  return rows.sort((a, b) => b.index - a.index || a.id.localeCompare(b.id)).map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * Pre-positioning recommendation.
 * Reads the forecast, and if a danger-level crossing is forecast inside the
 * horizon, proposes where stock should move before it happens.
 */
export function prePositioning(vulnerability, forecast) {
  const crossing = forecast.hours.find((h) => h.forecast && h.gaugeM >= forecast.dangerLevelM);
  const peak = forecast.hours.reduce((a, h) => (h.gaugeM > a.gaugeM ? h : a), forecast.hours[0]);

  const top = vulnerability.slice(0, 10);
  const moves = top.map((v) => {
    const boats = Math.max(1, Math.ceil((v.population * 0.34) / 8 / 4)); // a quarter of the eventual need, staged early
    const nearest = DEPOTS.map((d) => {
      const col = 'ABCDEFGHIJ'.indexOf(d.zone[0]);
      const row = parseInt(d.zone.slice(2), 10) - 1;
      return { depot: d, dist: Math.hypot(v.col + 0.5 - (col + 0.5), v.row + 0.5 - (row + 0.5)) };
    }).sort((a, b) => a.dist - b.dist)[0];
    return {
      zoneId: v.id,
      settlement: v.settlement,
      index: v.index,
      fromDepot: nearest.depot.name,
      boats,
      reliefKits: Math.ceil(v.population / 5),
      shelterDeficit: v.shelterDeficit,
      leadHours: crossing ? Math.max(0, crossing.offsetH) : null,
    };
  });

  return {
    crossingForecast: crossing
      ? { atHour: crossing.offsetH, gaugeM: crossing.gaugeM, iso: crossing.t }
      : null,
    peak: { gaugeM: peak.gaugeM, atHour: peak.offsetH },
    dangerLevelM: forecast.dangerLevelM,
    warningLevelM: forecast.warningLevelM,
    moves,
    trigger: crossing
      ? `CWC forecast crosses danger level ${forecast.dangerLevelM} m at H+${crossing.offsetH}. District plan trigger is the forecast crossing, not the observed crossing — pre-positioning should begin now.`
      : `Forecast peaks at ${peak.gaugeM} m, below danger level ${forecast.dangerLevelM} m. Monitor; no pre-positioning trigger met.`,
  };
}

/* ================================================================== */
/* AFTER — damage documentation, entitlement, rebuild priority          */
/* ================================================================== */

/**
 * House damage grades. The norms of assistance differ by grade, so the
 * assessment must grade rather than count — this is the single most common
 * reason a district's relief claim is returned.
 */
export const DAMAGE_GRADES = Object.freeze([
  { key: 'fully', label: 'Fully damaged', note: 'Pucca or kutcha house rendered wholly uninhabitable.' },
  { key: 'severely', label: 'Severely damaged', note: 'Structurally unsafe; requires major repair before reoccupation.' },
  { key: 'partially', label: 'Partially damaged', note: 'Habitable after repair; roof, wall or floor damage.' },
]);

/**
 * Indicative relief rates.
 * RATES ARE INDICATIVE ONLY and must be replaced with the norms in force for
 * the current award period before any claim is raised. They are shown so the
 * shape of the claim is visible, not so the amount is trusted.
 */
export const INDICATIVE_RATES = Object.freeze({
  fully: { amount: 120000, unit: 'per house', note: 'Plains rate, indicative' },
  severely: { amount: 65000, unit: 'per house', note: 'Indicative' },
  partially: { amount: 6500, unit: 'per house', note: 'Indicative' },
  cropHa: { amount: 8500, unit: 'per hectare', note: 'Rainfed, indicative' },
  livestockLarge: { amount: 37500, unit: 'per animal', note: 'Milch, indicative' },
  gratuitous: { amount: 60, unit: 'per person per day', note: 'Indicative' },
});

export const RATES_WARNING =
  'Indicative rates only. Verify against the Ministry of Home Affairs norms of assistance in force for the current award period before raising any claim.';

export function buildDamageRecord(zones, observations = {}) {
  const rows = zones
    .filter((z) => z.severity >= 20)
    .map((z) => {
      const rng = rngFrom(`damage:${z.id}`);
      const truth = groundTruth(z);
      const obs = observations[z.id];
      const damaged = z.damagedStructures;

      const fully = Math.round(damaged * (0.18 + z.flood * 0.22));
      const severely = Math.round(damaged * (0.24 + z.flood * 0.12));
      const partially = Math.max(0, damaged - fully - severely);

      const cropHa = +(z.terrain === 'agri' ? 74 * clamp01(z.flood) * (0.7 + rng() * 0.6) : 12 * clamp01(z.flood)).toFixed(1);
      const livestock = Math.round(z.population * 0.02 * clamp01(z.flood) * (0.5 + rng()));
      const displaced = obs?.complete ? obs.persons : truth.persons;

      const entitlement =
        fully * INDICATIVE_RATES.fully.amount +
        severely * INDICATIVE_RATES.severely.amount +
        partially * INDICATIVE_RATES.partially.amount +
        cropHa * INDICATIVE_RATES.cropHa.amount +
        livestock * INDICATIVE_RATES.livestockLarge.amount +
        displaced * INDICATIVE_RATES.gratuitous.amount * 7;

      return {
        zoneId: z.id,
        settlement: z.settlement,
        severity: z.severity,
        band: bandFor(z.severity).id,
        verified: Boolean(obs?.complete),
        houses: { fully, severely, partially, total: fully + severely + partially },
        cropHa,
        livestock,
        displaced,
        entitlement: Math.round(entitlement),
        evidence: {
          imagery: true,
          droneMosaic: Boolean(obs?.complete),
          fieldCountersigned: false,
        },
      };
    })
    .sort((a, b) => b.entitlement - a.entitlement);

  const totals = rows.reduce(
    (acc, r) => ({
      fully: acc.fully + r.houses.fully,
      severely: acc.severely + r.houses.severely,
      partially: acc.partially + r.houses.partially,
      cropHa: +(acc.cropHa + r.cropHa).toFixed(1),
      livestock: acc.livestock + r.livestock,
      displaced: acc.displaced + r.displaced,
      entitlement: acc.entitlement + r.entitlement,
    }),
    { fully: 0, severely: 0, partially: 0, cropHa: 0, livestock: 0, displaced: 0, entitlement: 0 }
  );

  return { rows, totals, ratesWarning: RATES_WARNING };
}

/**
 * Rebuild priority — the AFTER-phase decision.
 * Not the same ordering as rescue: what you rescue first is where people are
 * dying; what you rebuild first is what unblocks everything else.
 */
export function rebuildPriority(zones, damage) {
  const byZone = Object.fromEntries(damage.rows.map((r) => [r.zoneId, r]));
  const blockedZones = new Set(BRIDGES.filter((b) => b.status !== 'open').map((b) => b.zone));

  return zones
    .filter((z) => byZone[z.id])
    .map((z) => {
      const d = byZone[z.id];
      const connectivity = blockedZones.has(z.id) ? 1 : 0;
      const lifelineRoad = ROADS.some((r) => r.path.includes(z.id) && r.class !== 'District Road') ? 1 : 0;
      const score = Math.round(
        (connectivity * 0.34 + lifelineRoad * 0.2 + clamp01(d.houses.fully / 60) * 0.26 + clamp01(d.displaced / 400) * 0.2) * 100
      );
      const reasons = [
        connectivity ? 'Carries a bridge that is out — reopening it restores access to everything behind it.' : null,
        lifelineRoad ? 'Sits on a national or state highway.' : null,
        d.houses.fully > 20 ? `${d.houses.fully} houses fully damaged.` : null,
        d.displaced > 200 ? `${d.displaced} persons displaced.` : null,
      ].filter(Boolean);
      return {
        zoneId: z.id,
        settlement: z.settlement,
        score,
        connectivity: Boolean(connectivity),
        houses: d.houses,
        displaced: d.displaced,
        reasons: reasons.length ? reasons : ['Damage recorded; no connectivity or lifeline factor.'],
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 14)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

/**
 * After-action findings — the loop back into BEFORE.
 * The dossier's own point: post-event data on what failed is a planning input,
 * and it is the step districts most often skip.
 */
export function afterAction(zones, routes = [], allocation = null) {
  const findings = [];

  const unreachable = routes.filter((r) => !r.route?.reachable);
  if (unreachable.length) {
    findings.push({
      kind: 'access',
      title: `${unreachable.length} allocation${unreachable.length === 1 ? '' : 's'} had no surface route`,
      detail: `${unreachable.map((r) => r.zoneId).join(', ')} could not be reached by road at peak stage. These zones need either a raised approach or a pre-positioned boat, not a faster dispatch.`,
      feedsInto: 'Pre-monsoon boat allotment and road-raising proposals.',
    });
  }

  const bridgeOut = BRIDGES.filter((b) => b.status !== 'open');
  if (bridgeOut.length) {
    findings.push({
      kind: 'infrastructure',
      title: `${bridgeOut.length} crossings failed`,
      detail: bridgeOut.map((b) => `${b.name} (${b.status})`).join('; ') + '. Each removed a route the district plan assumed was available.',
      feedsInto: 'Vulnerability index — access isolation factor for the zones behind each crossing.',
    });
  }

  if (allocation) {
    const starved = allocation.allocations.filter((a) => a.coverage < 0.5);
    if (starved.length) {
      findings.push({
        kind: 'resources',
        title: `${starved.length} zones received under half their assessed requirement`,
        detail: `${starved.map((a) => a.zoneId).join(', ')}. This is a stock shortfall, not a dispatch failure — the district did not hold enough to meet assessed demand.`,
        feedsInto: 'State-level equipment indent for the next financial year.',
      });
    }
  }

  const unverifiedCritical = zones.filter((z) => z.severity >= 80 && !z.droneVerified);
  if (unverifiedCritical.length) {
    findings.push({
      kind: 'intelligence',
      title: `${unverifiedCritical.length} critical zones were never drone-verified`,
      detail: `${unverifiedCritical.map((z) => z.id).join(', ')} were resourced on predicted counts. Verify whether the prediction held; the error tells you whether the 0.34 evacuation-failure assumption is right for this district.`,
      feedsInto: 'Severity model calibration.',
    });
  }

  findings.push({
    kind: 'process',
    title: 'Approval latency',
    detail: 'Time between the recommendation being presented and the gate being cleared is recorded in the register. Where it is long, the bottleneck is authority availability, not analysis.',
    feedsInto: 'Delegation of financial and dispatch powers during declared incidents.',
  });

  return findings;
}
