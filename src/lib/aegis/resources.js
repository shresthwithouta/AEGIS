/**
 * Resource requirement engine.
 *
 * This computes *demand* from published planning norms — deterministic,
 * inspectable, and identical every time. It deliberately does not decide
 * anything: when demand exceeds what the district holds, the allocation is a
 * judgement about whose rescue is delayed, and that judgement goes to the
 * reasoning layer for a recommendation and to a human officer for approval.
 *
 * Every norm below carries the basis it came from, and the interface shows it.
 */

import { DEPOTS } from './incident';
import { groundTruth } from './drones';
import { bandFor } from './severity';
import { planRoute, planAmphibious } from './routing';

/**
 * The clearance window this requirement is sized against.
 *
 * Sizing matters more than it looks. An earlier version of this engine counted
 * boats as simultaneous capacity — persons ÷ 8 — and produced a demand of 299
 * boats against a district stock of 28, which is not a shortfall an officer can
 * act on, it is a broken number. Rescue craft make repeated trips; what you are
 * really choosing is how long the zone takes to clear. So demand is throughput
 * over a stated window, and the window is the assumption on screen.
 */
export const CLEARANCE_TARGET_MIN = 180;

export const NORMS = Object.freeze({
  clearanceWindow: {
    value: CLEARANCE_TARGET_MIN,
    unit: 'minutes',
    basis: 'Target to clear a zone after a breach. Three hours, not a full shift — an unwarned breach does not give you a shift.',
  },
  boatCapacity: {
    value: 8,
    unit: 'evacuees per trip',
    basis: 'OBM rescue boat, 12-person rated — 8 evacuees plus 2 crew and freeboard reserve.',
  },
  boatTripMinutes: {
    value: 22,
    unit: 'minutes per round trip',
    basis: 'Mean in-zone round trip at 11 km/h through flooded built-up terrain.',
  },
  ambulanceRunMinutes: {
    value: 45,
    unit: 'minutes per run',
    basis: 'Zone to Sadar Hospital and back, including handover, on a degraded network.',
  },
  boatsCrewedPerTeam: {
    value: 2,
    unit: 'boats per rescue team',
    basis: 'A ten-person NDRF/SDRF flood team crews two craft and works the shore point between them.',
  },
  ambulancePerCasualties: {
    value: 2,
    unit: 'casualties per run',
    basis: '108 EMS loading — one stretcher case plus one seated per run.',
  },
  diverDepthM: {
    value: 2.5,
    unit: 'metres',
    basis: 'Below 2.5 m standing water, boat crews require dive support for structure entry.',
  },
  medicalCampPerDisplaced: {
    value: 500,
    unit: 'displaced per camp',
    basis: 'NDMA relief camp planning norm — one medical post per 500 sheltered persons.',
  },
  rationsPerPersonDay: {
    value: 3,
    unit: 'packets per person per day',
    basis: 'District relief scale — three cooked-meal packets per displaced person per day.',
  },
});

/**
 * Requirement for a single zone. `observed` is the drone's count when a pass
 * has been flown; otherwise the predicted range is used and the result is
 * flagged as unverified so nobody mistakes it for a headcount.
 */
export function requirementFor(zone, observation) {
  const verified = Boolean(observation?.complete);
  const truth = groundTruth(zone);

  const persons = verified ? observation.persons : Math.round((zone.predicted.low + zone.predicted.high) / 2);
  const injured = verified ? observation.injured : Math.round(persons * 0.09);
  const animals = verified ? observation.animals : truth.animals;

  // Throughput within the clearance window, not simultaneous capacity.
  const boatTrips = Math.max(1, Math.floor(CLEARANCE_TARGET_MIN / NORMS.boatTripMinutes.value));
  const personsPerBoat = boatTrips * NORMS.boatCapacity.value;
  const ambulanceRuns = Math.max(1, Math.floor(CLEARANCE_TARGET_MIN / NORMS.ambulanceRunMinutes.value));
  const casualtiesPerAmbulance = ambulanceRuns * NORMS.ambulancePerCasualties.value;

  const boats = zone.flood >= 0.45 ? Math.ceil(persons / personsPerBoat) : 0;
  const ambulances = Math.ceil(injured / casualtiesPerAmbulance);
  const teams = Math.max(
    zone.severity >= 60 ? 1 : 0,
    Math.ceil(boats / NORMS.boatsCrewedPerTeam.value)
  );
  const divers = zone.depthM >= NORMS.diverDepthM.value ? Math.ceil(boats / 3) : 0;

  const evacuationMinutes = boats
    ? Math.ceil(persons / (boats * NORMS.boatCapacity.value)) * NORMS.boatTripMinutes.value
    : 0;

  return {
    zoneId: zone.id,
    settlement: zone.settlement,
    severity: zone.severity,
    band: bandFor(zone.severity).id,
    verified,
    persons,
    injured,
    animals,
    need: { boats, ambulances, teams, divers },
    evacuationMinutes,
    rationsDay1: persons * NORMS.rationsPerPersonDay.value,
    medicalCamps: Math.ceil(persons / NORMS.medicalCampPerDisplaced.value),
    personsPerBoat,
    workings: [
      boats
        ? `${persons} persons ÷ (${NORMS.boatCapacity.value} per trip × ${boatTrips} trips in ${CLEARANCE_TARGET_MIN} min) = ${boats} boat${boats === 1 ? '' : 's'}`
        : `Inundation ${(zone.flood * 100).toFixed(0)}% — below the 45% boat threshold; wheeled evacuation`,
      `${boats} boats ÷ ${NORMS.boatsCrewedPerTeam.value} crewed per team = ${teams} rescue team${teams === 1 ? '' : 's'}`,
      `${injured} casualties ÷ (${NORMS.ambulancePerCasualties.value} per run × ${ambulanceRuns} runs) = ${ambulances} ambulance${ambulances === 1 ? '' : 's'}`,
      divers ? `Depth ${zone.depthM} m ≥ ${NORMS.diverDepthM.value} m — ${divers} dive pair${divers === 1 ? '' : 's'} attached` : null,
    ].filter(Boolean),
  };
}

/** Total the district actually holds, across all depots. */
export function districtStock() {
  return DEPOTS.reduce(
    (acc, d) => ({
      boats: acc.boats + d.stock.boats,
      ambulances: acc.ambulances + d.stock.ambulances,
      teams: acc.teams + d.stock.teams,
      divers: acc.divers + d.stock.divers,
    }),
    { boats: 0, ambulances: 0, teams: 0, divers: 0 }
  );
}

/**
 * Aggregate demand across the priority zones, and expose the shortfall.
 * The shortfall is the interesting part: it is the decision the officer is
 * actually being asked to make.
 */
export function buildRequirement(zones, observations = {}, topN = 12) {
  const priority = [...zones].sort((a, b) => b.severity - a.severity).slice(0, topN);
  const perZone = priority.map((z) => requirementFor(z, observations[z.id]));

  const demand = perZone.reduce(
    (acc, r) => ({
      boats: acc.boats + r.need.boats,
      ambulances: acc.ambulances + r.need.ambulances,
      teams: acc.teams + r.need.teams,
      divers: acc.divers + r.need.divers,
    }),
    { boats: 0, ambulances: 0, teams: 0, divers: 0 }
  );

  const stock = districtStock();
  const shortfall = {
    boats: Math.max(0, demand.boats - stock.boats),
    ambulances: Math.max(0, demand.ambulances - stock.ambulances),
    teams: Math.max(0, demand.teams - stock.teams),
    divers: Math.max(0, demand.divers - stock.divers),
  };

  const constrained = Object.entries(shortfall)
    .filter(([, v]) => v > 0)
    .map(([k]) => k);

  return {
    perZone,
    demand,
    stock,
    shortfall,
    constrained,
    totals: {
      persons: perZone.reduce((a, r) => a + r.persons, 0),
      injured: perZone.reduce((a, r) => a + r.injured, 0),
      animals: perZone.reduce((a, r) => a + r.animals, 0),
      verifiedZones: perZone.filter((r) => r.verified).length,
      zones: perZone.length,
    },
  };
}

/**
 * Deterministic allocation — the fallback that runs with no reasoning layer
 * available, and the baseline the reasoning layer is compared against.
 *
 * Strict severity order, verified zones first within a band. Simple, defensible
 * and completely predictable, which is exactly what you want when the network
 * is down and an officer still has to sign something.
 */
export function allocateDeterministic(requirement) {
  const pool = { ...requirement.stock };
  const allocations = [];

  const ordered = [...requirement.perZone].sort(
    (a, b) => b.severity - a.severity || (b.verified ? 1 : 0) - (a.verified ? 1 : 0)
  );

  for (const r of ordered) {
    const give = {
      boats: Math.min(pool.boats, r.need.boats),
      ambulances: Math.min(pool.ambulances, r.need.ambulances),
      teams: Math.min(pool.teams, r.need.teams),
      divers: Math.min(pool.divers, r.need.divers),
    };
    pool.boats -= give.boats;
    pool.ambulances -= give.ambulances;
    pool.teams -= give.teams;
    pool.divers -= give.divers;

    const met =
      (r.need.boats ? give.boats / r.need.boats : 1) * 0.5 +
      (r.need.teams ? give.teams / r.need.teams : 1) * 0.3 +
      (r.need.ambulances ? give.ambulances / r.need.ambulances : 1) * 0.2;

    allocations.push({
      zoneId: r.zoneId,
      settlement: r.settlement,
      severity: r.severity,
      verified: r.verified,
      persons: r.persons,
      need: r.need,
      allocated: give,
      coverage: +met.toFixed(2),
      wave: allocations.length < 4 ? 1 : allocations.length < 8 ? 2 : 3,
    });
  }

  return {
    strategy: 'deterministic',
    label: 'Rule engine · strict severity order',
    allocations,
    remaining: pool,
    rationale:
      'Resources issued in descending severity order until exhausted. No trade-off between zones is attempted; ' +
      'zones below the cut receive nothing in this wave and are held for the next operational period.',
  };
}

/**
 * Which depot should physically supply each allocation.
 *
 * By travel time on the network as it currently stands, not by straight-line
 * distance. The distinction is the whole point: after a breach the nearest
 * depot is routinely the one that cannot get there, because the water sits
 * between them. Choosing on proximity produced allocations that routing then
 * declared unreachable — a depot assignment that ignores the flood is not an
 * assignment, it is a guess.
 *
 * Falls back to proximity only when no depot can reach the zone at all, so the
 * downstream route still reports the unreachability rather than silently
 * dropping the zone.
 */
export function assignDepots(allocation, zones) {
  const byId = Object.fromEntries(zones.map((z) => [z.id, z]));

  return allocation.allocations.map((a) => {
    const zone = byId[a.zoneId];
    const needsBoats = a.allocated.boats > 0;

    const scored = DEPOTS.map((d) => {
      // A depot cannot supply what it does not hold.
      const holds = needsBoats ? d.stock.boats > 0 : true;
      const route = needsBoats
        ? planAmphibious(zones, d.zone, a.zoneId)
        : planRoute(zones, d.zone, a.zoneId, 'vehicle');
      const from = byId[d.zone];
      const straight = from && zone ? Math.hypot(from.centre.x - zone.centre.x, from.centre.y - zone.centre.y) : 99;
      return {
        depot: d,
        holds,
        reachable: Boolean(route?.reachable),
        minutes: route?.minutes ?? Infinity,
        straight,
      };
    });

    const usable = scored
      .filter((s) => s.reachable && s.holds)
      .sort((x, y) => x.minutes - y.minutes);

    const chosen =
      usable[0] ??
      scored.filter((s) => s.reachable).sort((x, y) => x.minutes - y.minutes)[0] ??
      [...scored].sort((x, y) => x.straight - y.straight)[0];

    return {
      ...a,
      depot: chosen?.depot.id ?? null,
      depotName: chosen?.depot.name ?? null,
      depotReachable: Boolean(chosen?.reachable),
      depotMinutes: Number.isFinite(chosen?.minutes) ? Math.round(chosen.minutes) : null,
    };
  });
}
