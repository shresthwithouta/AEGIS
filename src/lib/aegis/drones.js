/**
 * Drone intelligence — flight simulation.
 *
 * SIMULATED. AEGIS has no drone hardware; this module models a fleet so the
 * command centre can be exercised end to end, and the interface says so on
 * screen wherever its output is shown. The model is deterministic: given the
 * same seed and the same tick sequence it produces the same flights, the same
 * detections and the same battery curve.
 *
 * It is a pure reducer — `stepFleet(state, dt)` returns a new state — so the
 * same engine drives the browser at 60 fps and a server-side replay.
 */

import { rngFrom, clamp, clamp01, intRange } from './rng';
import { parseZoneId, DEPOTS, GRID } from './incident';

const KM_PER_ZONE = 1;

/** Airframes in the district's inventory. Class C small UAS, DGCA-style. */
export const AIRFRAMES = Object.freeze({
  quad: {
    id: 'quad',
    label: 'Quadcopter · Class C',
    cruiseMs: 16, // m/s
    maxMs: 22,
    enduranceS: 2100, // 35 min
    ceilingM: 120, // DGCA green-zone ceiling
    sensor: 'RGB + thermal',
    swathM: 260,
  },
  vtol: {
    id: 'vtol',
    label: 'VTOL fixed-wing',
    cruiseMs: 26,
    maxMs: 33,
    enduranceS: 4800, // 80 min
    ceilingM: 120,
    sensor: 'RGB + multispectral',
    swathM: 520,
  },
});

export const FLEET_TEMPLATE = Object.freeze([
  { id: 'AEG-D01', callsign: 'GARUD 1', airframe: 'quad', depot: 'depot-sdrf' },
  { id: 'AEG-D02', callsign: 'GARUD 2', airframe: 'quad', depot: 'depot-sdrf' },
  { id: 'AEG-D03', callsign: 'CHAKOR 1', airframe: 'vtol', depot: 'depot-ndrf' },
  { id: 'AEG-D04', callsign: 'CHAKOR 2', airframe: 'vtol', depot: 'depot-ndrf' },
  { id: 'AEG-D05', callsign: 'GARUD 3', airframe: 'quad', depot: 'depot-block' },
  { id: 'AEG-D06', callsign: 'GARUD 4', airframe: 'quad', depot: 'depot-block' },
]);

export const STATES = Object.freeze({
  ready: { label: 'Ready', flying: false },
  launch: { label: 'Launching', flying: true },
  transit: { label: 'In transit', flying: true },
  survey: { label: 'Surveying', flying: true },
  rtb: { label: 'Returning', flying: true },
  landing: { label: 'Landing', flying: true },
  charging: { label: 'Battery swap', flying: false },
  grounded: { label: 'Grounded', flying: false },
});

function depotPos(depotId) {
  const depot = DEPOTS.find((d) => d.id === depotId) ?? DEPOTS[0];
  const { col, row } = parseZoneId(depot.zone);
  return { x: col + 0.5, y: row + 0.5 };
}

/**
 * Ground truth the drones are trying to discover.
 * Kept separate from the zone record so nothing in the UI can read a count the
 * fleet has not actually observed yet.
 */
export function groundTruth(zone) {
  const rng = rngFrom(`truth:${zone.id}`);
  const stranded = Math.round(zone.population * clamp01(zone.flood) * 0.34 * (0.7 + rng() * 0.6));
  return {
    persons: stranded,
    injured: Math.round(stranded * (0.06 + rng() * 0.09)),
    animals: Math.round(zone.population * 0.11 * clamp01(zone.flood) * (0.5 + rng())),
    vehicles: Math.round((zone.structures / 9) * clamp01(zone.flood) * (0.5 + rng())),
    structuresDamaged: zone.damagedStructures,
  };
}

/** A steady monsoon wind field — gives ground speed and battery something to fight. */
export function windAt(x, y, t) {
  const dir = 118 + Math.sin((x + y) * 0.35 + t / 900) * 14; // deg, from
  const speed = 5.4 + Math.sin(x * 0.5 - t / 640) * 1.6 + Math.cos(y * 0.42) * 1.1; // m/s
  const rad = ((dir - 90) * Math.PI) / 180;
  return { dir, speed, vx: Math.cos(rad) * speed, vy: Math.sin(rad) * speed };
}

export function createFleet(seedRef = 'AEG/26206/2026-DM') {
  const rng = rngFrom(`${seedRef}:fleet`);
  return FLEET_TEMPLATE.map((d) => {
    const pos = depotPos(d.depot);
    return {
      ...d,
      pos: { ...pos },
      home: { ...pos },
      alt: 0,
      heading: 90,
      groundSpeedMs: 0,
      battery: 88 + Math.round(rng() * 12),
      state: 'ready',
      mission: null,
      link: 1,
      trail: [],
      flightTimeS: 0,
      sorties: 0,
      surveyed: [],
    };
  });
}

export function createSim(zones, seedRef = 'AEG/26206/2026-DM') {
  return {
    t: 0, // simulated seconds since sortie start
    running: false,
    speed: 8, // sim seconds per wall second
    drones: createFleet(seedRef),
    queue: [], // zone ids awaiting a pass
    coverage: {}, // zoneId → 0..1
    observations: {}, // zoneId → progressively revealed counts
    events: [],
    seedRef,
  };
}

/**
 * Assign the highest-severity unverified zones to the fleet.
 * Greedy by severity, then by flight time — a drone that can reach a zone
 * sooner takes it, which is what a real tasking officer would do.
 */
export function planSorties(sim, rankedZones, limit = 12) {
  const already = new Set([...sim.queue, ...Object.keys(sim.coverage)]);
  const targets = rankedZones
    .filter((z) => !already.has(z.id) && !z.droneVerified)
    .slice(0, limit)
    .map((z) => z.id);
  return { ...sim, queue: [...sim.queue, ...targets] };
}

function logEvent(events, t, drone, kind, text) {
  const next = events.slice(-160);
  next.push({ t, at: Date.now(), drone: drone?.id ?? null, callsign: drone?.callsign ?? null, kind, text });
  return next;
}

function zoneCentre(id) {
  const { col, row } = parseZoneId(id);
  return { x: col + 0.5, y: row + 0.5 };
}

/** Battery needed to fly `distKm` home, with a 20% reserve. DGCA-style margin. */
function reserveFor(drone, frame, distKm) {
  const seconds = (distKm * 1000) / frame.cruiseMs;
  return (seconds / frame.enduranceS) * 100 * 1.2 + 8;
}

/**
 * Advance the simulation by `dt` simulated seconds.
 * Pure: never mutates `sim`.
 */
export function stepFleet(sim, dt, zonesById) {
  if (dt <= 0) return sim;

  let events = sim.events;
  const coverage = { ...sim.coverage };
  const observations = { ...sim.observations };
  const queue = [...sim.queue];
  const t = sim.t + dt;

  const drones = sim.drones.map((d0) => {
    const d = { ...d0, pos: { ...d0.pos }, trail: d0.trail };
    const frame = AIRFRAMES[d.airframe];

    // ---- tasking ------------------------------------------------------
    if (d.state === 'ready' && queue.length && d.battery > 45) {
      const targetId = queue.shift();
      const target = zoneCentre(targetId);
      d.mission = {
        zoneId: targetId,
        target,
        phase: 'outbound',
        surveyProgress: 0,
        surveyNeededS: 34 + (zonesById[targetId]?.damage ?? 0.4) * 46,
        startedT: t,
      };
      d.state = 'launch';
      d.sorties += 1;
      d.trail = [{ ...d.pos }];
      coverage[targetId] = coverage[targetId] ?? 0;
      events = logEvent(events, t, d, 'tasking', `Tasked to ${targetId}${zonesById[targetId]?.settlement ? ` (${zonesById[targetId].settlement})` : ''}`);
    }

    if (d.state === 'charging') {
      d.battery = Math.min(100, d.battery + (dt / 240) * 100); // 4-min battery swap
      if (d.battery >= 96) {
        d.state = 'ready';
        events = logEvent(events, t, d, 'ready', 'Battery swapped — airframe ready');
      }
      return d;
    }

    if (!STATES[d.state].flying) return d;

    // ---- climb / descend ---------------------------------------------
    if (d.state === 'launch') {
      d.alt = Math.min(frame.ceilingM * 0.75, d.alt + 6 * dt);
      if (d.alt >= frame.ceilingM * 0.75 - 0.5) {
        d.state = 'transit';
        events = logEvent(events, t, d, 'airborne', `Airborne · AGL ${Math.round(d.alt)} m`);
      }
    }
    if (d.state === 'landing') {
      d.alt = Math.max(0, d.alt - 5 * dt);
      d.groundSpeedMs = 0;
      if (d.alt <= 0.1) {
        d.state = 'charging';
        d.battery = Math.max(0, d.battery);
        events = logEvent(events, t, d, 'landed', `Landed · ${Math.round(d.flightTimeS / 60)} min sortie`);
      }
      return d;
    }

    // ---- navigation ----------------------------------------------------
    const goal = d.state === 'rtb' ? d.home : d.mission?.target ?? d.home;
    const dx = goal.x - d.pos.x;
    const dy = goal.y - d.pos.y;
    const distKm = Math.hypot(dx, dy) * KM_PER_ZONE;

    const wind = windAt(d.pos.x, d.pos.y, t);
    const airspeed = d.state === 'survey' ? frame.cruiseMs * 0.35 : frame.cruiseMs;

    if (d.state === 'survey') {
      // Loiter a tight box over the zone centre while the sensor runs.
      const m = d.mission;
      const phase = (t - m.startedT) * 0.6;
      d.pos.x = m.target.x + Math.cos(phase) * 0.22;
      d.pos.y = m.target.y + Math.sin(phase * 1.3) * 0.18;
      d.heading = (phase * 57.3) % 360;
      d.groundSpeedMs = airspeed;

      const rate = dt / m.surveyNeededS;
      m.surveyProgress = clamp01(m.surveyProgress + rate);
      coverage[m.zoneId] = m.surveyProgress;

      // Detections firm up as coverage grows: the estimate converges on truth.
      const zone = zonesById[m.zoneId];
      if (zone) {
        const truth = groundTruth(zone);
        const p = m.surveyProgress;
        const noise = (1 - p) * 0.55;
        const rng = rngFrom(`obs:${m.zoneId}:${Math.floor(p * 8)}`);
        observations[m.zoneId] = {
          persons: Math.max(0, Math.round(truth.persons * (p + (rng() - 0.5) * noise))),
          injured: Math.max(0, Math.round(truth.injured * (p + (rng() - 0.5) * noise))),
          animals: Math.max(0, Math.round(truth.animals * (p + (rng() - 0.5) * noise))),
          vehicles: Math.max(0, Math.round(truth.vehicles * (p + (rng() - 0.5) * noise))),
          coverage: p,
          confidence: +(0.42 + p * 0.53).toFixed(2),
          complete: p >= 1,
          sensor: frame.sensor,
          drone: d.id,
        };
      }

      if (m.surveyProgress >= 1) {
        d.surveyed = [...d.surveyed, m.zoneId];
        const o = observations[m.zoneId];
        events = logEvent(
          events,
          t,
          d,
          'survey-complete',
          `${m.zoneId} surveyed — ${o?.persons ?? 0} persons, ${o?.animals ?? 0} animals, ${o?.vehicles ?? 0} vehicles`
        );
        d.state = 'rtb';
        d.mission = { ...m, phase: 'inbound' };
      }
    } else {
      // Straight-line leg with wind correction.
      if (distKm > 0.04) {
        const ux = dx / (distKm || 1);
        const uy = dy / (distKm || 1);
        const groundVx = ux * airspeed + wind.vx * 0.35;
        const groundVy = uy * airspeed + wind.vy * 0.35;
        const gs = Math.hypot(groundVx, groundVy);
        d.groundSpeedMs = gs;
        d.heading = (Math.atan2(groundVy, groundVx) * 180) / Math.PI;
        const stepKm = (gs * dt) / 1000;
        d.pos.x += (groundVx / gs) * stepKm;
        d.pos.y += (groundVy / gs) * stepKm;
      } else if (d.state === 'transit') {
        d.state = 'survey';
        d.mission = { ...d.mission, startedT: t };
        events = logEvent(events, t, d, 'on-station', `On station over ${d.mission.zoneId} — sensor running`);
      } else if (d.state === 'rtb') {
        d.state = 'landing';
      }
    }

    // ---- trail, battery, link -------------------------------------------
    const last = d.trail[d.trail.length - 1];
    if (!last || Math.hypot(last.x - d.pos.x, last.y - d.pos.y) > 0.09) {
      d.trail = [...d.trail.slice(-90), { x: d.pos.x, y: d.pos.y }];
    }

    d.flightTimeS += dt;
    const windPenalty = 1 + (wind.speed / frame.cruiseMs) * 0.22;
    const drain = (dt / frame.enduranceS) * 100 * windPenalty * (d.state === 'survey' ? 1.12 : 1);
    d.battery = clamp(d.battery - drain, 0, 100);

    // C2 link degrades with slant range from the launch depot.
    const homeKm = Math.hypot(d.pos.x - d.home.x, d.pos.y - d.home.y);
    d.link = +clamp01(1.06 - Math.pow(homeKm / 7.2, 2.1)).toFixed(2);

    // ---- safety: come home before you cannot ----------------------------
    const homeReserve = reserveFor(d, frame, homeKm);
    if (d.state !== 'rtb' && d.state !== 'landing' && d.battery <= homeReserve) {
      if (d.mission && d.mission.surveyProgress < 1) {
        queue.unshift(d.mission.zoneId); // re-queue the unfinished zone
        events = logEvent(events, t, d, 'abort', `Bingo fuel — ${d.mission.zoneId} re-queued, returning to base`);
      }
      d.state = 'rtb';
    }
    if (d.link < 0.12 && d.state !== 'rtb' && d.state !== 'landing') {
      events = logEvent(events, t, d, 'link-loss', 'C2 link lost — executing return-to-home');
      d.state = 'rtb';
    }

    return d;
  });

  return { ...sim, t, drones, queue, coverage, observations, events };
}

/** Roll the sim forward in fixed steps — stable regardless of frame rate. */
export function advance(sim, wallDeltaS, zonesById) {
  if (!sim.running) return sim;
  const simSeconds = wallDeltaS * sim.speed;
  const STEP = 0.25;
  let out = sim;
  let remaining = Math.min(simSeconds, 20); // never fast-forward more than 20 s per frame
  while (remaining > 0) {
    const dt = Math.min(STEP, remaining);
    out = stepFleet(out, dt, zonesById);
    remaining -= dt;
  }
  return out;
}

export function fleetSummary(sim) {
  const airborne = sim.drones.filter((d) => STATES[d.state].flying);
  const surveyed = Object.values(sim.coverage).filter((c) => c >= 1).length;
  return {
    airborne: airborne.length,
    total: sim.drones.length,
    queued: sim.queue.length,
    surveyed,
    inProgress: Object.values(sim.coverage).filter((c) => c > 0 && c < 1).length,
    meanBattery: Math.round(sim.drones.reduce((a, d) => a + d.battery, 0) / sim.drones.length),
    flightMinutes: Math.round(sim.drones.reduce((a, d) => a + d.flightTimeS, 0) / 60),
  };
}

export function formatSimClock(seconds) {
  const s = Math.max(0, Math.floor(seconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}
