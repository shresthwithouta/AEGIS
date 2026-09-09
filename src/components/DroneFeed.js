'use client';

/**
 * The sensor feed.
 *
 * This is the one surface where the file grammar steps aside, because an
 * operator looking through a sensor is genuinely looking through a viewfinder,
 * and the viewfinder's own language is the honest representation: safe-area
 * corner brackets, focus brackets that snap to what the detector found, zebra
 * hatching over saturated water, and a tape counter. Rendered in the file's
 * palette so it still belongs to the same product.
 *
 * SIMULATED. The scene is generated from the zone's own record — there is no
 * camera. Every frame carries that label.
 */

import { useMemo } from 'react';
import { rngFrom } from '@/lib/aegis/rng';
import { formatSimClock } from '@/lib/aegis/drones';

const W = 320;
const H = 200;

function buildScene(zone) {
  if (!zone) return null;
  const rng = rngFrom(`scene:${zone.id}`);

  // Water body: a band across the frame whose coverage tracks inundation.
  const waterY = H * (0.28 + rng() * 0.2);
  const waterH = H * (0.2 + zone.flood * 0.55);

  const structures = Array.from({ length: Math.min(9, Math.round(zone.structures / 90) + 3) }, () => ({
    x: rng() * (W - 40) + 12,
    y: rng() * (H - 44) + 14,
    w: 12 + rng() * 18,
    h: 9 + rng() * 12,
    damaged: rng() < zone.damage,
  }));

  return { waterY, waterH, structures };
}

function buildDetections(zone, observation) {
  if (!zone || !observation) return [];
  const rng = rngFrom(`det:${zone.id}`);
  const out = [];
  const push = (kind, n, cap) => {
    for (let i = 0; i < Math.min(n, cap); i++) {
      out.push({
        kind,
        x: 18 + rng() * (W - 52),
        y: 18 + rng() * (H - 52),
        w: kind === 'vehicle' ? 22 : kind === 'animal' ? 15 : 11,
        h: kind === 'vehicle' ? 13 : kind === 'animal' ? 10 : 15,
        conf: +(0.62 + rng() * 0.33).toFixed(2),
      });
    }
  };
  push('person', observation.persons, 7);
  push('animal', observation.animals, 3);
  push('vehicle', observation.vehicles, 3);
  return out;
}

const KIND_TONE = {
  person: 'var(--sev-critical)',
  animal: 'var(--sev-elevated)',
  vehicle: 'var(--water)',
};

export default function DroneFeed({ drone, zone, observation, simTime }) {
  const scene = useMemo(() => buildScene(zone), [zone]);
  const detections = useMemo(() => buildDetections(zone, observation), [zone, observation]);

  const onStation = drone?.state === 'survey';
  const coverage = observation?.coverage ?? 0;

  return (
    <div className="border border-[var(--rule-strong)] bg-[#0b0f13]">
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label="Simulated drone sensor feed">
        <defs>
          <pattern id="feed-zebra" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <rect width="3" height="6" fill="#ffffff" opacity="0.16" />
          </pattern>
        </defs>

        <rect width={W} height={H} fill="#0b0f13" />

        {zone && scene ? (
          <>
            {/* Ground */}
            <rect width={W} height={H} fill="#1a231c" />
            {/* Field texture */}
            {Array.from({ length: 10 }, (_, i) => (
              <line
                key={i}
                x1="0"
                y1={(i * H) / 10}
                x2={W}
                y2={(i * H) / 10 + 6}
                stroke="#243026"
                strokeWidth="1"
              />
            ))}

            {/* Water — with zebra over the saturated part, as an OSD does */}
            <rect x="0" y={scene.waterY} width={W} height={scene.waterH} fill="#16323f" />
            <rect x="0" y={scene.waterY} width={W} height={scene.waterH} fill="url(#feed-zebra)" />

            {/* Structures */}
            {scene.structures.map((s, i) => (
              <g key={i}>
                <rect
                  x={s.x}
                  y={s.y}
                  width={s.w}
                  height={s.h}
                  fill={s.damaged ? '#3a2a24' : '#2e332c'}
                  stroke={s.damaged ? 'var(--sev-severe)' : '#454d44'}
                  strokeWidth="0.8"
                />
                {s.damaged ? (
                  <path
                    d={`M${s.x},${s.y} L${s.x + s.w},${s.y + s.h}`}
                    stroke="var(--sev-severe)"
                    strokeWidth="0.8"
                    opacity="0.8"
                  />
                ) : null}
              </g>
            ))}

            {/* Focus brackets snap to detections as coverage grows */}
            {detections.slice(0, Math.ceil(detections.length * Math.max(0.15, coverage))).map((d, i) => {
              const tone = KIND_TONE[d.kind];
              const b = 4;
              return (
                <g key={i}>
                  {[
                    [d.x, d.y, 1, 1],
                    [d.x + d.w, d.y, -1, 1],
                    [d.x, d.y + d.h, 1, -1],
                    [d.x + d.w, d.y + d.h, -1, -1],
                  ].map(([cx, cy, sx, sy], k) => (
                    <path
                      key={k}
                      d={`M${cx},${cy + sy * b} L${cx},${cy} L${cx + sx * b},${cy}`}
                      stroke={tone}
                      strokeWidth="1.2"
                      fill="none"
                    />
                  ))}
                  <text
                    x={d.x}
                    y={d.y - 2.5}
                    fill={tone}
                    style={{ font: '600 5px var(--font-mono)', letterSpacing: '0.04em' }}
                  >
                    {d.kind.toUpperCase()} {d.conf}
                  </text>
                </g>
              );
            })}
          </>
        ) : null}

        {/* Safe-area corner brackets — the frame's own furniture */}
        {[
          [10, 10, 1, 1],
          [W - 10, 10, -1, 1],
          [10, H - 10, 1, -1],
          [W - 10, H - 10, -1, -1],
        ].map(([cx, cy, sx, sy], i) => (
          <path
            key={i}
            d={`M${cx},${cy + sy * 12} L${cx},${cy} L${cx + sx * 12},${cy}`}
            stroke="#e8f0e8"
            strokeWidth="1"
            fill="none"
            opacity="0.55"
          />
        ))}

        {/* OSD */}
        <text x="14" y="24" fill="#e8f0e8" style={{ font: '600 8px var(--font-mono)', letterSpacing: '0.08em' }}>
          {drone ? `${drone.callsign} · ${drone.id}` : 'NO FEED'}
        </text>
        {onStation ? (
          <>
            <circle cx="16" cy="34" r="2.6" fill="var(--sev-critical)" className="pulse" />
            <text x="23" y="37" fill="var(--sev-critical)" style={{ font: '700 7px var(--font-mono)', letterSpacing: '0.12em' }}>
              REC
            </text>
          </>
        ) : null}

        <text
          x={W - 14}
          y="24"
          textAnchor="end"
          fill="#e8f0e8"
          style={{ font: '600 8px var(--font-mono)', letterSpacing: '0.1em' }}
        >
          {formatSimClock(simTime ?? 0)}
        </text>

        {zone ? (
          <text x="14" y={H - 26} fill="#e8f0e8" style={{ font: '600 8px var(--font-mono)' }}>
            ZONE {zone.id}
            {zone.settlement ? ` · ${zone.settlement}` : ''}
          </text>
        ) : null}

        {drone ? (
          <>
            <text x="14" y={H - 14} fill="#9fb0a4" style={{ font: '500 7px var(--font-mono)' }}>
              AGL {Math.round(drone.alt)}m · GS {drone.groundSpeedMs.toFixed(1)}m/s · HDG{' '}
              {String(Math.round((drone.heading + 360) % 360)).padStart(3, '0')}°
            </text>
            <text
              x={W - 14}
              y={H - 14}
              textAnchor="end"
              fill={drone.battery < 25 ? 'var(--sev-critical)' : '#9fb0a4'}
              style={{ font: '500 7px var(--font-mono)' }}
            >
              BATT {Math.round(drone.battery)}% · LINK {Math.round(drone.link * 100)}%
            </text>
          </>
        ) : null}

        {/* Coverage bar — the tape reel filling */}
        {onStation || coverage > 0 ? (
          <>
            <rect x="14" y={H - 34} width={W - 28} height="2" fill="#2a3630" />
            <rect x="14" y={H - 34} width={(W - 28) * Math.min(1, coverage)} height="2" fill="var(--sim)" />
          </>
        ) : null}

        {/* Standing label — this is not a camera */}
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          fill="#e8f0e8"
          opacity="0.13"
          style={{ font: '700 15px var(--font-narrow)', letterSpacing: '0.3em' }}
        >
          SIMULATED
        </text>
      </svg>
    </div>
  );
}
