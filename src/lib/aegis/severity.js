/**
 * Severity scoring.
 *
 * This is deliberately a transparent weighted formula rather than a learned
 * score. An approving officer is legally accountable for the dispatch that
 * follows from this ranking, so they must be able to read the arithmetic that
 * produced it and override it. Every term below is surfaced in the interface.
 */

import { clamp01 } from './rng';

/** Default weights. Officers may retune these per incident; the audit log records it. */
export const DEFAULT_WEIGHTS = Object.freeze({
  flood: 0.45,
  damage: 0.35,
  exposure: 0.2,
});

export const WEIGHT_LABELS = Object.freeze({
  flood: 'Inundation',
  damage: 'Structural damage',
  exposure: 'Population exposure',
});

export const WEIGHT_BASIS = Object.freeze({
  flood: 'Share of zone pixels classified as floodwater, depth-weighted.',
  damage: 'Damaged-structure count normalised by built-up footprint.',
  exposure: 'Resident population normalised across the area of interest.',
});

/**
 * Priority bands. Ordered high to low; `atLeast` is inclusive.
 * Band names use the language of an Indian district control room, not a colour.
 */
export const BANDS = Object.freeze([
  { id: 'critical', label: 'Critical', atLeast: 80, token: 'critical' },
  { id: 'severe', label: 'Severe', atLeast: 60, token: 'severe' },
  { id: 'elevated', label: 'Elevated', atLeast: 40, token: 'elevated' },
  { id: 'monitor', label: 'Monitor', atLeast: 20, token: 'monitor' },
  { id: 'clear', label: 'Clear', atLeast: 0, token: 'clear' },
]);

export function bandFor(severity) {
  return BANDS.find((b) => severity >= b.atLeast) ?? BANDS[BANDS.length - 1];
}

/**
 * Combined severity, 0–100.
 * Returns the score alongside every contributing term so the UI never has to
 * recompute — and never shows a number it cannot explain.
 */
export function scoreZone(zone, weights = DEFAULT_WEIGHTS) {
  const total = weights.flood + weights.damage + weights.exposure || 1;
  const terms = [
    {
      key: 'flood',
      weight: weights.flood / total,
      value: clamp01(zone.flood),
      contribution: 0,
    },
    {
      key: 'damage',
      weight: weights.damage / total,
      value: clamp01(zone.damage),
      contribution: 0,
    },
    {
      key: 'exposure',
      weight: weights.exposure / total,
      value: clamp01(zone.exposure),
      contribution: 0,
    },
  ];

  let sum = 0;
  for (const t of terms) {
    t.contribution = t.weight * t.value;
    sum += t.contribution;
  }

  const severity = Math.round(sum * 100);
  return { severity, terms, band: bandFor(severity) };
}

/**
 * Confidence in the severity figure, 0–1.
 * Drops with cloud cover and coarse imagery; rises sharply once a drone has
 * physically verified the zone. This is what makes stage 3 worth flying.
 */
export function confidenceFor(zone, source) {
  let c = 0.55;
  if (source?.resolutionM != null) {
    // 10 m Sentinel-class ⇒ weak; 0.3 m drone-class ⇒ strong.
    c += clamp01((10 - source.resolutionM) / 10) * 0.25;
  }
  c -= clamp01(zone.cloudCover ?? 0) * 0.3;
  if (zone.droneVerified) c = Math.max(c, 0.93);
  return clamp01(c);
}

/** Rank zones high → low, with a stable tiebreak so the order never flickers. */
export function rankZones(zones, weights = DEFAULT_WEIGHTS) {
  return zones
    .map((z) => {
      const s = scoreZone(z, weights);
      // Spread the score, not the band object: downstream reads `band` as the id.
      return { ...z, severity: s.severity, terms: s.terms, band: s.band.id };
    })
    .sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id))
    .map((z, i) => ({ ...z, rank: i + 1 }));
}

/**
 * Predicted persons at risk before a drone has looked.
 * Presented as a range, never a point estimate — a false precision here would
 * be read as a headcount and dispatched against.
 */
export function predictedAtRisk(zone) {
  const base = zone.population * clamp01(zone.flood) * 0.34;
  const spread = 0.45;
  return {
    low: Math.round(base * (1 - spread)),
    high: Math.round(base * (1 + spread)),
    basis: 'Resident population × inundated fraction × 0.34 evacuation-failure rate (NDMA planning assumption).',
  };
}
