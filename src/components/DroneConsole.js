'use client';

/**
 * The drone console.
 *
 * The simulation engine from `lib/aegis/drones` runs here at up to 32× on a
 * fixed-step loop, so what the map shows is a real integration of position,
 * wind, battery and link — not an animation of a predetermined path. A drone
 * that runs low turns for home and re-queues its zone, and you watch it happen.
 */

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import ZoneGrid, { GridLegend } from './ZoneGrid';
import DroneFeed from './DroneFeed';
import Icon from './Icon';
import {
  Sheet,
  SheetHead,
  Register,
  Cell,
  Field,
  Note,
  Empty,
  StatusDot,
  Provenance,
  BandChip,
} from './ui';
import {
  createSim,
  planSorties,
  advance,
  fleetSummary,
  formatSimClock,
  STATES,
  AIRFRAMES,
  windAt,
} from '@/lib/aegis/drones';

const SPEEDS = [1, 2, 4, 8, 16, 32];

export default function DroneConsole({ zones }) {
  const zonesById = useMemo(() => Object.fromEntries(zones.map((z) => [z.id, z])), [zones]);

  /* The simulation lives in a ref, not in state, and a counter drives the
     repaint. Holding it in state meant writing the ref during render to keep
     the animation frame in sync — which React Compiler is free to reorder, and
     the loop would then integrate a stale sim forever. One source of truth,
     mutated only inside the frame callback. */
  const simRef = useRef(null);
  if (simRef.current === null) simRef.current = createSim(zones);
  const [, repaint] = useReducer((n) => n + 1, 0);
  const sim = simRef.current;

  const setSim = useCallback((updater) => {
    simRef.current = typeof updater === 'function' ? updater(simRef.current) : updater;
    repaint();
  }, []);

  const [selected, setSelected] = useState('AEG-D01');
  const raf = useRef(null);
  const last = useRef(0);

  /* rAF drives wall-clock delta; the engine sub-steps internally, so frame rate
     never changes the physics. */
  useEffect(() => {
    if (!sim.running) return undefined;
    let alive = true;

    const step = (now) => {
      if (!alive) return;
      const dt = last.current ? Math.min(0.25, (now - last.current) / 1000) : 0;
      last.current = now;
      simRef.current = advance(simRef.current, dt, zonesById);
      repaint();
      raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    return () => {
      alive = false;
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      last.current = 0;
    };
  }, [sim.running, zonesById]);

  const summary = fleetSummary(sim);
  const drone = sim.drones.find((d) => d.id === selected) ?? sim.drones[0];
  const missionZone = drone?.mission ? zonesById[drone.mission.zoneId] : null;
  const observation = drone?.mission ? sim.observations[drone.mission.zoneId] : null;
  const wind = drone ? windAt(drone.pos.x, drone.pos.y, sim.t) : null;

  const gridZones = useMemo(
    () =>
      zones.map((z) => {
        const obs = sim.observations[z.id];
        return obs?.complete ? { ...z, droneVerified: true, observed: obs } : z;
      }),
    [zones, sim.observations]
  );

  const task = (n) => {
    const candidates = [...zones]
      .filter((z) => !sim.observations[z.id]?.complete && !sim.queue.includes(z.id))
      .sort((a, b) => b.severity - a.severity);
    setSim((s) => ({ ...planSorties(s, candidates, n), running: true }));
  };

  const reset = () => setSim(createSim(zones));

  return (
    <div className="space-y-4">
      {/* ---- Flight control bar ------------------------------------- */}
      <Sheet raised active={sim.running}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-3 py-2.5">
          <span className="flex flex-col leading-none">
            <span className="rail">Sortie clock</span>
            <span className="font-[family-name:var(--font-mono)] text-[1.0625rem] font-semibold tabular-nums text-[var(--ink)]">
              {formatSimClock(sim.t)}
            </span>
          </span>

          <span className="h-8 w-px bg-[var(--rule)]" aria-hidden="true" />

          <StatusDot
            tone={sim.running ? 'sim' : 'idle'}
            pulse={sim.running}
            label={sim.running ? `${summary.airborne} airborne` : 'Fleet on the ground'}
          />

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              className="btn"
              data-tone={sim.running ? undefined : 'primary'}
              onClick={() => setSim((s) => ({ ...s, running: !s.running }))}
            >
              <Icon name={sim.running ? 'pause' : 'play'} size={12} />
              {sim.running ? 'Hold' : 'Run'}
            </button>
            <button type="button" className="btn" onClick={reset}>
              <Icon name="rewind" size={12} />
              Reset
            </button>
          </div>

          <div className="flex items-center gap-1">
            <span className="field-label mr-1">Rate</span>
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                className="btn !px-2 !py-1"
                data-tone={sim.speed === s ? 'primary' : undefined}
                onClick={() => setSim((prev) => ({ ...prev, speed: s }))}
                aria-pressed={sim.speed === s}
              >
                {s}×
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <span className="rail mr-1">{sim.queue.length} queued</span>
            <button type="button" className="btn" onClick={() => task(6)}>
              <Icon name="drone" size={12} />
              Task top 6
            </button>
            <button type="button" className="btn" onClick={() => task(14)}>
              Task top 14
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-[var(--rule)] sm:grid-cols-5">
          {[
            ['Airborne', `${summary.airborne}/${summary.total}`],
            ['Zones surveyed', String(summary.surveyed)],
            ['In progress', String(summary.inProgress)],
            ['Mean battery', `${summary.meanBattery}%`],
            ['Flight time', `${summary.flightMinutes} min`],
          ].map(([label, value], i) => (
            <div
              key={label}
              className={`px-3 py-2 ${i < 4 ? 'border-r border-[var(--rule)]' : ''} ${i < 3 ? 'border-b sm:border-b-0' : ''}`}
            >
              <span className="field-label block">{label}</span>
              <span className="mt-0.5 block font-[family-name:var(--font-mono)] text-[0.9375rem] font-semibold tabular-nums text-[var(--ink)]">
                {value}
              </span>
            </div>
          ))}
        </div>
      </Sheet>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
        {/* ---- Map ---------------------------------------------------- */}
        <Sheet>
          <SheetHead
            title="Flight picture"
            sub="Position integrated from airspeed, wind and heading"
            action={<Provenance kind="simulated" detail="No aircraft exists. This is a flight model." />}
          />
          <div className="px-3 py-3">
            <ZoneGrid
              zones={gridZones}
              drones={sim.drones}
              coverage={sim.coverage}
              selected={drone?.mission?.zoneId ?? null}
              onSelect={(id) => {
                const d = sim.drones.find((x) => x.mission?.zoneId === id);
                if (d) setSelected(d.id);
              }}
            />
          </div>
          <div className="border-t border-[var(--rule)] px-3 py-2">
            <GridLegend compact />
          </div>
        </Sheet>

        {/* ---- Feed + selected airframe ------------------------------ */}
        <div className="min-w-0 space-y-4">
          <Sheet>
            <SheetHead
              title="Sensor feed"
              meta={drone ? AIRFRAMES[drone.airframe].sensor : undefined}
              action={
                <select
                  className="input !w-auto !py-1 !text-[0.6875rem]"
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  aria-label="Select airframe"
                >
                  {sim.drones.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.callsign}
                    </option>
                  ))}
                </select>
              }
            />
            <div className="px-3 py-3">
              <DroneFeed drone={drone} zone={missionZone} observation={observation} simTime={sim.t} />
            </div>

            {drone ? (
              <>
                <Field label="State" value={STATES[drone.state].label} />
                <Field label="Airframe" value={AIRFRAMES[drone.airframe].label} mono={false} />
                <Field
                  label="Tasked zone"
                  value={
                    drone.mission
                      ? `${drone.mission.zoneId}${missionZone?.settlement ? ` · ${missionZone.settlement}` : ''}`
                      : '—'
                  }
                />
                <Field
                  label="Battery"
                  value={`${Math.round(drone.battery)}%`}
                  tone={drone.battery < 25 ? 'var(--halt)' : drone.battery < 45 ? 'var(--warn)' : 'var(--seal)'}
                />
                <Field
                  label="C2 link"
                  value={`${Math.round(drone.link * 100)}%`}
                  tone={drone.link < 0.3 ? 'var(--halt)' : undefined}
                />
                <Field
                  label="Wind"
                  value={wind ? `${wind.speed.toFixed(1)} m/s from ${Math.round(wind.dir)}°` : '—'}
                />
                <Field label="Sorties flown" value={String(drone.sorties)} />
              </>
            ) : null}
          </Sheet>

          {observation ? (
            <Sheet>
              <SheetHead
                title="Detections"
                meta={`${Math.round((observation.coverage ?? 0) * 100)}% coverage`}
                action={
                  <Provenance
                    kind={observation.complete ? 'observed' : 'predicted'}
                    detail={
                      observation.complete
                        ? 'Pass complete — counts are final for this sortie.'
                        : 'Pass in progress — counts are not final and must not be dispatched against.'
                    }
                  />
                }
              />
              <Field label="Persons" value={String(observation.persons)} tone="var(--sev-critical)" />
              <Field label="Injured (thermal)" value={String(observation.injured)} tone="var(--sev-severe)" />
              <Field label="Animals" value={String(observation.animals)} tone="var(--sev-elevated)" />
              <Field label="Vehicles" value={String(observation.vehicles)} tone="var(--sev-monitor)" />
              <Field label="Detection confidence" value={observation.confidence.toFixed(2)} />
              {!observation.complete ? (
                <div className="px-3 py-2">
                  <p className="rail">Estimate until coverage completes.</p>
                </div>
              ) : null}
            </Sheet>
          ) : null}
        </div>
      </div>

      {/* ---- Fleet register ----------------------------------------- */}
      <Sheet>
        <SheetHead title="Fleet register" meta={`${sim.drones.length} airframes`} />
        <Register
          columns={[
            { key: 'cs', label: 'Callsign' },
            { key: 'st', label: 'State' },
            { key: 'mz', label: 'Tasked' },
            { key: 'alt', label: 'AGL', align: 'right' },
            { key: 'gs', label: 'GS', align: 'right' },
            { key: 'bat', label: 'Batt', align: 'right' },
            { key: 'lk', label: 'Link', align: 'right' },
          ]}
        >
          {sim.drones.map((d) => (
            <tr
              key={d.id}
              onClick={() => setSelected(d.id)}
              className="cursor-pointer border-b border-[var(--rule-soft)] hover:bg-[var(--sheet-sunk)]"
              style={selected === d.id ? { background: 'var(--sheet-sunk)' } : undefined}
            >
              <Cell>
                <span className="flex items-center gap-1.5">
                  <Icon
                    name="drone"
                    size={11}
                    style={{ color: STATES[d.state].flying ? 'var(--sim)' : 'var(--ink-4)' }}
                  />
                  <span className="font-[family-name:var(--font-mono)] text-[0.75rem] font-semibold">{d.callsign}</span>
                  <span className="rail">{d.id}</span>
                </span>
              </Cell>
              <Cell>
                <span className="text-[0.6875rem] text-[var(--ink-2)]">{STATES[d.state].label}</span>
              </Cell>
              <Cell mono>{d.mission?.zoneId ?? '—'}</Cell>
              <Cell mono align="right">
                {Math.round(d.alt)}
              </Cell>
              <Cell mono align="right">
                {d.groundSpeedMs.toFixed(1)}
              </Cell>
              <Cell mono align="right">
                <span
                  style={{
                    color: d.battery < 25 ? 'var(--halt)' : d.battery < 45 ? 'var(--warn)' : 'var(--ink)',
                  }}
                >
                  {Math.round(d.battery)}%
                </span>
              </Cell>
              <Cell mono align="right">
                <span style={{ color: d.link < 0.3 ? 'var(--halt)' : 'var(--ink-3)' }}>
                  {Math.round(d.link * 100)}%
                </span>
              </Cell>
            </tr>
          ))}
        </Register>
      </Sheet>

      {/* ---- Event log ---------------------------------------------- */}
      <Sheet>
        <SheetHead title="Sortie log" meta={`${sim.events.length} entries`} />
        {sim.events.length === 0 ? (
          <Empty title="No sorties flown" icon="drone">
            Task the fleet to the highest-severity unverified zones, then run the clock. Drones that reach bingo fuel
            will turn for home and re-queue their zone on their own.
          </Empty>
        ) : (
          <ol className="max-h-[18rem] divide-y divide-[var(--rule-soft)] overflow-y-auto">
            {[...sim.events].reverse().map((e, i) => (
              <li key={i} className="flex items-baseline gap-3 px-3 py-1.5">
                <span className="rail w-16 shrink-0">{formatSimClock(e.t)}</span>
                <span className="w-20 shrink-0 font-[family-name:var(--font-mono)] text-[0.6875rem] text-[var(--ink-2)]">
                  {e.callsign ?? '—'}
                </span>
                <span
                  className="w-24 shrink-0 font-[family-name:var(--font-narrow)] text-[0.5625rem] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: eventTone(e.kind) }}
                >
                  {e.kind}
                </span>
                <span className="min-w-0 flex-1 text-[0.6875rem] leading-[1.45] text-[var(--ink-2)]">{e.text}</span>
              </li>
            ))}
          </ol>
        )}
      </Sheet>
    </div>
  );
}

function eventTone(kind) {
  return (
    {
      tasking: 'var(--ink-3)',
      airborne: 'var(--sim)',
      'on-station': 'var(--sim)',
      'survey-complete': 'var(--seal)',
      abort: 'var(--warn)',
      'link-loss': 'var(--halt)',
      landed: 'var(--ink-3)',
      ready: 'var(--seal)',
    }[kind] ?? 'var(--ink-3)'
  );
}
