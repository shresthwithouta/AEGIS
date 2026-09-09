/**
 * Safe routing — flood-aware shortest path.
 *
 * Dijkstra over a graph of the 100 zones, with impassable edges hard-removed
 * rather than penalised. The choice is deliberate: on a life-safety route the
 * system must be able to state that a path *cannot* cross a collapsed bridge,
 * not merely that it would prefer not to. A learned router could not make that
 * guarantee, and a heuristic search (A*) buys nothing at district scale.
 *
 * The planner returns the safe route alongside the naive shortest route so the
 * approving officer can see exactly what the detour bought.
 */

import { COLUMNS, GRID, parseZoneId, zoneId, ROADS, BRIDGES, DEPOTS } from './incident';

/** Flood fraction above which a zone is impassable to wheeled vehicles. */
export const IMPASSABLE_FLOOD = 0.72;
/** Above this, boats only. */
export const BOAT_ONLY_FLOOD = 0.45;

const NEIGHBOURS = [
  [0, -1], [1, 0], [0, 1], [-1, 0],
  [1, -1], [1, 1], [-1, 1], [-1, -1],
];

function roadIndex() {
  const map = new Map();
  for (const road of ROADS) {
    for (const z of road.path) {
      if (!map.has(z)) map.set(z, []);
      map.get(z).push(road);
    }
  }
  return map;
}

function bridgeIndex() {
  const map = new Map();
  for (const b of BRIDGES) map.set(b.zone, b);
  return map;
}

/**
 * Edge cost in minutes for a given vehicle class.
 * Returns null when the edge is impassable — that is the hard block.
 */
function edgeCost(a, b, opts) {
  const { roads, bridges, mode } = opts;
  const diagonal = a.col !== b.col && a.row !== b.row;
  const km = diagonal ? Math.SQRT2 : 1;

  const bridge = bridges.get(b.id);
  if (bridge) {
    if (bridge.status === 'collapsed' || bridge.status === 'submerged') {
      return { cost: null, reason: `${bridge.name} — ${bridge.status}` };
    }
  }

  if (mode === 'boat') {
    // A boat wants water, and is stopped by dry ground and by current.
    if (b.flood < 0.2) return { cost: null, reason: 'Insufficient draught — dry ground' };
    const speedKmh = 11 - b.flood * 2.5;
    return { cost: (km / speedKmh) * 60, reason: null };
  }

  if (b.flood >= IMPASSABLE_FLOOD) {
    return { cost: null, reason: `Zone ${b.id} inundated to ${b.depthM} m` };
  }

  const onRoad = roads.has(a.id) && roads.has(b.id) &&
    roads.get(a.id).some((r) => roads.get(b.id).some((s) => s.id === r.id));

  let speedKmh = onRoad ? 44 : 17;
  if (onRoad) {
    const cls = roads.get(b.id)[0].class;
    if (cls === 'National Highway') speedKmh = 58;
    else if (cls === 'State Highway') speedKmh = 46;
  }
  // Standing water slows everything long before it stops it.
  speedKmh *= 1 - Math.min(0.8, b.flood * 1.05);
  if (bridge?.status === 'restricted') {
    if (mode === 'heavy') return { cost: null, reason: `${bridge.name} — ${bridge.note}` };
    speedKmh *= 0.45;
  }
  if (speedKmh < 2) return { cost: null, reason: `Zone ${b.id} impassable — ${b.depthM} m standing water` };

  return { cost: (km / speedKmh) * 60, reason: null };
}

/**
 * Dijkstra with a binary-heap-free sorted frontier. 100 nodes — an array
 * frontier is faster than the heap bookkeeping and much easier to audit.
 */
function dijkstra(zonesById, fromId, toId, opts) {
  const dist = new Map();
  const prev = new Map();
  const visited = new Set();
  const blocked = [];

  dist.set(fromId, 0);
  const frontier = [fromId];

  while (frontier.length) {
    frontier.sort((a, b) => (dist.get(a) ?? Infinity) - (dist.get(b) ?? Infinity));
    const current = frontier.shift();
    if (current === toId) break;
    if (visited.has(current)) continue;
    visited.add(current);

    const { col, row } = parseZoneId(current);
    const a = zonesById[current];

    for (const [dc, dr] of NEIGHBOURS) {
      const nc = col + dc;
      const nr = row + dr;
      if (nc < 0 || nc >= GRID || nr < 0 || nr >= GRID) continue;
      const nid = zoneId(nc, nr);
      if (visited.has(nid)) continue;
      const b = zonesById[nid];
      if (!b) continue;

      const { cost, reason } = edgeCost(a, b, opts);
      if (cost == null) {
        if (reason) blocked.push({ from: current, to: nid, reason });
        continue;
      }
      const alt = (dist.get(current) ?? Infinity) + cost;
      if (alt < (dist.get(nid) ?? Infinity)) {
        dist.set(nid, alt);
        prev.set(nid, current);
        if (!frontier.includes(nid)) frontier.push(nid);
      }
    }
  }

  if (!dist.has(toId)) return { path: null, minutes: null, blocked };

  const path = [toId];
  let cur = toId;
  while (prev.has(cur)) {
    cur = prev.get(cur);
    path.unshift(cur);
  }
  return { path, minutes: dist.get(toId), blocked };
}

/** Turn a zone path into named waypoints an officer can read aloud on a radio. */
function describe(path, zonesById) {
  const roads = roadIndex();
  const legs = [];
  let currentRoad = null;
  let legStart = path[0];

  for (let i = 0; i < path.length; i++) {
    const id = path[i];
    const rs = roads.get(id);
    const name = rs?.[0]?.name ?? 'Unmetalled track';
    if (name !== currentRoad) {
      if (currentRoad) legs.push({ road: currentRoad, from: legStart, to: path[i - 1] });
      currentRoad = name;
      legStart = id;
    }
  }
  legs.push({ road: currentRoad, from: legStart, to: path[path.length - 1] });

  return legs.map((l) => ({
    ...l,
    settlement: zonesById[l.to]?.settlement ?? null,
    depth: zonesById[l.to]?.depthM ?? 0,
  }));
}

/**
 * Plan a route from a depot to a target zone.
 * `mode` is 'vehicle' | 'heavy' | 'boat'.
 */
export function planRoute(zones, fromZoneId, toZoneId, mode = 'vehicle') {
  const zonesById = Object.fromEntries(zones.map((z) => [z.id, z]));
  const opts = { roads: roadIndex(), bridges: bridgeIndex(), mode };

  const safe = dijkstra(zonesById, fromZoneId, toZoneId, opts);

  // The naive comparison: distance only, ignoring water and broken bridges.
  const naive = dijkstra(zonesById, fromZoneId, toZoneId, {
    ...opts,
    mode: 'naive',
  });

  const naiveHazards = naive.path
    ? naive.path
        .map((id) => zonesById[id])
        .filter((z) => z && (z.flood >= IMPASSABLE_FLOOD || bridgeIndex().get(z.id)?.status === 'collapsed' || bridgeIndex().get(z.id)?.status === 'submerged'))
        .map((z) => {
          const b = bridgeIndex().get(z.id);
          return {
            zone: z.id,
            reason: b && b.status !== 'open' ? `${b.name} — ${b.status}` : `${z.depthM} m standing water`,
          };
        })
    : [];

  return {
    mode,
    from: fromZoneId,
    to: toZoneId,
    reachable: Boolean(safe.path),
    path: safe.path,
    minutes: safe.minutes == null ? null : Math.round(safe.minutes),
    distanceKm: safe.path ? +pathKm(safe.path).toFixed(1) : null,
    legs: safe.path ? describe(safe.path, zonesById) : [],
    blockedEdges: dedupeBlocked(safe.blocked).slice(0, 8),
    comparison: naive.path
      ? {
          minutes: Math.round(naive.minutes),
          distanceKm: +pathKm(naive.path).toFixed(1),
          hazards: naiveHazards,
          path: naive.path,
        }
      : null,
    algorithm: 'Dijkstra · 8-connected zone graph · hard edge removal on impassable links',
  };
}

function pathKm(path) {
  let km = 0;
  for (let i = 1; i < path.length; i++) {
    const a = parseZoneId(path[i - 1]);
    const b = parseZoneId(path[i]);
    km += a.col !== b.col && a.row !== b.row ? Math.SQRT2 : 1;
  }
  return km;
}

function dedupeBlocked(blocked) {
  const seen = new Set();
  const out = [];
  for (const b of blocked) {
    const key = b.reason;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(b);
  }
  return out;
}

/**
 * Amphibious movement — how rescue craft actually reach a flooded zone.
 *
 * A boat does not travel from the depot to the incident by water. It is
 * trailered along the road network to the last point a vehicle can reach, then
 * launched and worked in. Routing the whole journey as a boat leg was the
 * earlier behaviour and it declared most zones unreachable, because there is no
 * continuous water path from a dry depot to a flooded village — which is true,
 * and useless.
 *
 * So: a road leg to a launch point, then a water leg in. The launch point is
 * the target zone itself when a vehicle can still get there, and otherwise the
 * nearest vehicle-reachable zone to it.
 */
export function planAmphibious(zones, fromZoneId, toZoneId) {
  const zonesById = Object.fromEntries(zones.map((z) => [z.id, z]));

  // Best case: the vehicle can reach the zone and launch on the spot.
  const direct = planRoute(zones, fromZoneId, toZoneId, 'vehicle');
  if (direct.reachable) {
    return {
      mode: 'boat',
      reachable: true,
      launchZone: toZoneId,
      roadLeg: direct,
      waterLegKm: 0,
      minutes: direct.minutes,
      distanceKm: direct.distanceKm,
      legs: direct.legs,
      blockedEdges: direct.blockedEdges,
      path: direct.path,
      note: `Trailer to ${toZoneId} and launch in the zone.`,
    };
  }

  // Otherwise find the closest zone to the target that a vehicle can still make.
  const target = zonesById[toZoneId];
  const candidates = zones
    .filter((z) => z.id !== toZoneId && z.flood < IMPASSABLE_FLOOD)
    .map((z) => ({ z, d: Math.hypot(z.centre.x - target.centre.x, z.centre.y - target.centre.y) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 14);

  for (const { z, d } of candidates) {
    const road = planRoute(zones, fromZoneId, z.id, 'vehicle');
    if (!road.reachable) continue;
    // ~9 km/h working through inundated built-up terrain under load.
    const waterMinutes = Math.round((d / 9) * 60) + 6; // + launch and rig time
    return {
      mode: 'boat',
      reachable: true,
      launchZone: z.id,
      roadLeg: road,
      waterLegKm: +d.toFixed(1),
      minutes: road.minutes + waterMinutes,
      distanceKm: +(road.distanceKm + d).toFixed(1),
      legs: road.legs,
      blockedEdges: road.blockedEdges,
      path: [...road.path, toZoneId],
      note: `Trailer to ${z.id}${z.settlement ? ` (${z.settlement})` : ''}, launch there, then ${d.toFixed(1)} km by water into ${toZoneId}.`,
    };
  }

  return {
    mode: 'boat',
    reachable: false,
    launchZone: null,
    roadLeg: null,
    waterLegKm: null,
    minutes: null,
    distanceKm: null,
    legs: [],
    blockedEdges: direct.blockedEdges,
    path: null,
    note: 'No vehicle-reachable launch point within range. Aerial insertion required.',
  };
}

/** Choose the depot that can reach a zone soonest for a given mode. */
export function nearestDepot(zones, toZoneId, mode = 'vehicle', kinds = null) {
  const candidates = DEPOTS.filter((d) => !kinds || kinds.includes(d.kind));
  const routes = candidates
    .map((d) => ({ depot: d, route: planRoute(zones, d.zone, toZoneId, mode) }))
    .filter((r) => r.route.reachable)
    .sort((a, b) => a.route.minutes - b.route.minutes);
  return routes[0] ?? null;
}

export { roadIndex, bridgeIndex };
