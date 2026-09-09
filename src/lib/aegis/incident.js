/**
 * The synthetic incident.
 *
 * SYNTHETIC DATA. Modelled on the Kosi–Bagmati basin in Darbhanga district,
 * Bihar, and on the 2024–25 Bhote Koshi flash floods used as the motivating
 * case in the project dossier. No figure here is an observation. A real
 * deployment replaces this module with Bhuvan / Sentinel ingestion and the
 * district's own census and resource registers.
 */

import { rngFrom, valueNoise2D, hashSeed, clamp01, range, intRange, bell } from './rng';
import { scoreZone, confidenceFor, predictedAtRisk, DEFAULT_WEIGHTS } from './severity';

export const GRID = 10; // 10 × 10 = the 100 zones the pipeline reasons over
export const ZONE_KM = 1; // each zone is 1 km²
export const COLUMNS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

export const INCIDENT = Object.freeze({
  fileNo: 'AEG/26206/2026-DM',
  name: 'Kamla Balan embankment breach',
  district: 'Darbhanga',
  state: 'Bihar',
  basin: 'Kosi–Bagmati',
  hazard: 'Riverine flood',
  declaredAt: '2026-09-08T01:40:00+05:30',
  aoiKm: GRID * ZONE_KM,
  centre: { lat: 26.1542, lon: 85.8918 },
  eoc: 'District Emergency Operations Centre, Darbhanga',
  sdrfBattalion: '9th Bn SDRF, Bihar',
  synthetic: true,
});

/** Imagery passes available to stage 1, coarse → fine. */
export const IMAGERY = Object.freeze([
  {
    id: 'sentinel-1',
    label: 'Sentinel-1 GRD',
    kind: 'Satellite · SAR',
    resolutionM: 10,
    capturedAt: '2026-09-08T02:12:00+05:30',
    cloudPenetrating: true,
    note: 'C-band SAR. Sees through the monsoon cloud deck; cannot classify damage.',
  },
  {
    id: 'sentinel-2',
    label: 'Sentinel-2 L2A',
    kind: 'Satellite · optical',
    resolutionM: 10,
    capturedAt: '2026-09-08T04:48:00+05:30',
    cloudPenetrating: false,
    note: 'Optical. Partially obscured — 41% of the area of interest under cloud.',
  },
  {
    id: 'uav-survey',
    label: 'UAV survey mosaic',
    kind: 'Drone · optical',
    resolutionM: 0.3,
    capturedAt: '2026-09-08T06:05:00+05:30',
    cloudPenetrating: false,
    note: 'Flown over priority zones only. Absent outside the drone corridor.',
  },
]);

export const TERRAIN = Object.freeze({
  urban: { label: 'Built-up', density: 4200, drain: 0.35 },
  periurban: { label: 'Peri-urban', density: 1600, drain: 0.5 },
  village: { label: 'Village', density: 900, drain: 0.6 },
  agri: { label: 'Agricultural', density: 180, drain: 0.75 },
  river: { label: 'River / char', density: 60, drain: 0.1 },
  embankment: { label: 'Embankment', density: 120, drain: 0.2 },
});

export function zoneId(col, row) {
  return `${COLUMNS[col]}-${String(row + 1).padStart(2, '0')}`;
}

export function parseZoneId(id) {
  const col = COLUMNS.indexOf(id.slice(0, 1));
  const row = parseInt(id.slice(2), 10) - 1;
  return { col, row };
}

/**
 * The river's path through the area of interest, as a polyline in grid space.
 * Everything about the flood field is derived from distance to this line, so
 * the map reads as a river flood and not as random noise.
 */
export const RIVER = Object.freeze([
  { x: -0.4, y: 1.1 },
  { x: 1.8, y: 2.2 },
  { x: 3.1, y: 3.9 },
  { x: 3.6, y: 5.4 },
  { x: 4.9, y: 6.6 },
  { x: 6.4, y: 7.1 },
  { x: 8.1, y: 8.4 },
  { x: 10.4, y: 9.2 },
]);

/** The embankment breach — origin of the inundation. */
export const BREACH = Object.freeze({ x: 3.6, y: 5.4, widthM: 220, zone: 'D-06' });

function distanceToRiver(x, y) {
  let best = Infinity;
  for (let i = 0; i < RIVER.length - 1; i++) {
    const a = RIVER[i];
    const b = RIVER[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    let t = ((x - a.x) * dx + (y - a.y) * dy) / len2;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const px = a.x + t * dx;
    const py = a.y + t * dy;
    best = Math.min(best, Math.hypot(x - px, y - py));
  }
  return best;
}

const SETTLEMENTS = [
  { name: 'Kamtaul', zone: 'C-03', terrain: 'periurban' },
  { name: 'Jale', zone: 'B-06', terrain: 'village' },
  { name: 'Singhwara', zone: 'E-04', terrain: 'village' },
  { name: 'Bahadurpur', zone: 'F-06', terrain: 'urban' },
  { name: 'Darbhanga Sadar', zone: 'G-08', terrain: 'urban' },
  { name: 'Hanuman Nagar', zone: 'D-07', terrain: 'periurban' },
  { name: 'Keotirunway', zone: 'H-05', terrain: 'village' },
  { name: 'Manigachhi', zone: 'I-07', terrain: 'village' },
  { name: 'Tardih', zone: 'E-09', terrain: 'village' },
  { name: 'Baheri', zone: 'C-08', terrain: 'periurban' },
];

/**
 * Build the 100-zone grid. Pure function of the incident reference, so the
 * same file number always yields the same district picture.
 */
export function buildZones(seedRef = INCIDENT.fileNo) {
  const seed = hashSeed(seedRef);
  const rng = rngFrom(seedRef);
  const damageNoise = valueNoise2D(seed ^ 0x9e3779b9);
  const cloudNoise = valueNoise2D(seed ^ 0x85ebca6b);
  const elevNoise = valueNoise2D(seed ^ 0xc2b2ae35);

  const byZone = new Map(SETTLEMENTS.map((s) => [s.zone, s]));
  const zones = [];

  for (let row = 0; row < GRID; row++) {
    for (let col = 0; col < GRID; col++) {
      const id = zoneId(col, row);
      const cx = col + 0.5;
      const cy = row + 0.5;

      const dRiver = distanceToRiver(cx, cy);
      const dBreach = Math.hypot(cx - BREACH.x, cy - BREACH.y);

      // Elevation: the basin falls south-east; noise gives it local relief.
      const elevation = 42 + (GRID - row) * 0.55 + elevNoise(cx * 0.4, cy * 0.4) * 3.2 - col * 0.18;

      const settlement = byZone.get(id);
      let terrainKey = settlement?.terrain;
      if (!terrainKey) {
        if (dRiver < 0.55) terrainKey = 'river';
        else if (dRiver < 0.95) terrainKey = 'embankment';
        else if (rng() < 0.18) terrainKey = 'village';
        else terrainKey = 'agri';
      }
      const terrain = TERRAIN[terrainKey];

      // Inundation falls off with distance from the river and from the breach,
      // and is resisted by local drainage and elevation.
      //
      // The breach term is deliberately the stronger and wider of the two. That
      // is the whole danger of an embanked river: when the embankment goes, the
      // water arrives faster and deeper than an unembanked flood would, and it
      // arrives over the settlements that were built behind it precisely because
      // they believed they were protected. A model where the deepest water sits
      // on the empty channel and the villages behind the breach stay dry would
      // be describing a different, safer river.
      const riverTerm = Math.exp(-Math.pow(dRiver / 1.9, 1.7));
      const breachTerm = Math.exp(-Math.pow(dBreach / 4.4, 1.5)) * 1.15;
      const relief = clamp01((elevation - 41) / 8);
      // Built-up drainage is overwhelmed in a breach, so it buys less than its
      // nominal rating suggests.
      let flood = clamp01((riverTerm * 0.66 + breachTerm) * (1 - terrain.drain * 0.28) * (1 - relief * 0.42));
      flood = clamp01(flood + (bell(rng) - 0.5) * 0.1);

      const depthM = +(flood * range(rng, 2.4, 3.6)).toFixed(1);

      // Damage tracks inundation but needs something to damage.
      const builtUp = clamp01(terrain.density / 4200);
      const structures = Math.round(terrain.density / 5.2 + intRange(rng, -14, 14));
      const damage = clamp01(flood * (0.35 + builtUp * 0.75) * range(rng, 0.75, 1.2));
      const damagedStructures = Math.max(0, Math.round(structures * damage * 0.55));

      const population = Math.round(terrain.density * range(rng, 0.82, 1.18));
      const cloudCover = clamp01(cloudNoise(cx * 0.33, cy * 0.33) * 1.25 - 0.15);

      const zone = {
        id,
        col,
        row,
        centre: { x: cx, y: cy },
        settlement: settlement?.name ?? null,
        terrain: terrainKey,
        terrainLabel: terrain.label,
        elevation: +elevation.toFixed(1),
        distanceToRiverKm: +dRiver.toFixed(2),
        flood: +flood.toFixed(3),
        depthM,
        damage: +damage.toFixed(3),
        structures,
        damagedStructures,
        population,
        cloudCover: +cloudCover.toFixed(2),
        droneVerified: false,
        observed: null, // filled in by a drone pass
      };

      zone.exposure = 0; // normalised below, once the whole grid is known
      zones.push(zone);
    }
  }

  /**
   * Population exposure, normalised against a planning threshold rather than
   * against the area's own maximum.
   *
   * Normalising by the AOI maximum was the earlier approach and it ranked the
   * district wrongly: an uninhabited river char under 3 m of water scored above
   * a settlement of 1,500 people, because the char had more water and the
   * settlement had "only 40% of the largest population". Severity is meant to
   * rank risk to people, not depth. Above roughly 1,800 residents in a 1 km²
   * zone the exposure term saturates — beyond that point what separates zones
   * is hazard, not headcount.
   */
  const EXPOSURE_SATURATION = 1800;
  for (const z of zones) {
    z.exposure = +clamp01(z.population / EXPOSURE_SATURATION).toFixed(3);
    z.predicted = predictedAtRisk(z);
    const scored = scoreZone(z, DEFAULT_WEIGHTS);
    z.severity = scored.severity;
    z.band = scored.band.id;
    z.confidence = +confidenceFor(z, IMAGERY[0]).toFixed(2);
  }

  return zones;
}

/**
 * Resource depots, with what is physically on hand at this point in the event.
 *
 * These are post-deployment holdings: an NDRF company has already staged into
 * the district, which is what happens once a breach is declared. That matters
 * for the shape of the decision downstream — pre-deployment stock leaves demand
 * so far ahead of supply that the allocation stops being a choice and becomes
 * arithmetic. The residual shortfall here is the real one: enough to cover the
 * critical zones, not enough to cover everything, which is the decision an
 * officer is actually asked to make.
 */
export const DEPOTS = Object.freeze([
  {
    id: 'depot-sdrf',
    name: '9th Bn SDRF, Laheriasarai',
    zone: 'G-09',
    kind: 'SDRF',
    stock: { boats: 22, ambulances: 6, teams: 12, divers: 12 },
  },
  {
    id: 'depot-ndrf',
    name: 'NDRF 9th Bn staging, Bahadurpur',
    zone: 'F-06',
    kind: 'NDRF',
    stock: { boats: 16, ambulances: 4, teams: 9, divers: 8 },
  },
  {
    id: 'depot-health',
    name: 'Sadar Hospital dispatch bay',
    zone: 'G-08',
    kind: 'Health',
    stock: { boats: 0, ambulances: 14, teams: 3, divers: 0 },
  },
  {
    id: 'depot-block',
    name: 'Jale block relief store',
    zone: 'B-06',
    kind: 'Civil',
    stock: { boats: 8, ambulances: 1, teams: 5, divers: 0 },
  },
]);

/** Named roads. Each is a run of zones; bridges are the fragile links. */
export const ROADS = Object.freeze([
  { id: 'nh-27', name: 'NH-27', class: 'National Highway', path: ['A-08', 'B-08', 'C-08', 'D-08', 'E-08', 'F-08', 'G-08', 'H-08', 'I-08', 'J-08'] },
  { id: 'nh-57', name: 'NH-57 spur', class: 'National Highway', path: ['G-08', 'G-07', 'G-06', 'G-05', 'G-04', 'G-03'] },
  { id: 'sh-88', name: 'SH-88', class: 'State Highway', path: ['B-02', 'B-03', 'B-04', 'B-05', 'B-06', 'C-06', 'D-06', 'D-07', 'E-07', 'F-07'] },
  { id: 'sh-56', name: 'SH-56', class: 'State Highway', path: ['C-03', 'D-03', 'E-03', 'E-04', 'E-05', 'F-05', 'G-05', 'H-05', 'I-05'] },
  { id: 'mdr-11', name: 'MDR-11', class: 'District Road', path: ['D-09', 'E-09', 'F-09', 'G-09', 'H-09'] },
  { id: 'mdr-04', name: 'MDR-04', class: 'District Road', path: ['I-07', 'I-06', 'I-05', 'I-04', 'H-04'] },
  { id: 'vr-kamla', name: 'Kamla bandh service road', class: 'Embankment Road', path: ['C-04', 'C-05', 'D-05', 'D-06', 'E-06', 'E-07'] },
]);

export const BRIDGES = Object.freeze([
  { id: 'br-01', name: 'Kamla road bridge', zone: 'D-06', road: 'sh-88', status: 'collapsed', since: '2026-09-08T02:05:00+05:30' },
  { id: 'br-02', name: 'Bagmati rail-cum-road bridge', zone: 'F-07', road: 'sh-88', status: 'restricted', note: 'Single lane, 12 t limit — no heavy rescue vehicles.' },
  { id: 'br-03', name: 'Baheri culvert', zone: 'C-08', road: 'nh-27', status: 'open' },
  { id: 'br-04', name: 'Manigachhi causeway', zone: 'I-07', road: 'mdr-04', status: 'submerged', note: 'Under 1.4 m of water. Impassable to wheeled vehicles.' },
]);

/** Forecast series driving the BEFORE phase. Synthetic, IMD/CWC-shaped. */
export function buildForecast(seedRef = INCIDENT.fileNo) {
  const rng = rngFrom(`${seedRef}:forecast`);
  const hours = [];
  const now = new Date('2026-09-08T06:00:00+05:30').getTime();
  let level = 48.9; // m above datum; danger level 49.6, warning 48.8
  let rain = 18;
  for (let h = -18; h <= 48; h += 3) {
    const peak = Math.exp(-Math.pow((h - 9) / 14, 2));
    rain = Math.max(0, 12 + peak * 46 + (rng() - 0.5) * 9);
    level = 48.55 + peak * 1.55 + (rng() - 0.5) * 0.08;
    hours.push({
      t: new Date(now + h * 3600 * 1000).toISOString(),
      offsetH: h,
      rainfallMm: +rain.toFixed(1),
      gaugeM: +level.toFixed(2),
      forecast: h > 0,
    });
  }
  return {
    station: 'Jhanjharpur (Kamla Balan)',
    source: 'CWC gauge + IMD district QPF · SYNTHETIC',
    warningLevelM: 48.8,
    dangerLevelM: 49.6,
    hours,
  };
}
