'use client';

/**
 * The 100-zone grid.
 *
 * A survey sheet, not a slippy map: fixed extent, fixed grid, readable at a
 * glance from across a control room and printable into a file. Severity reads
 * twice over — a low tint gives the flood its extent, and a hard rule on the
 * cell edge gives the band — while every label stays achromatic ink so the
 * references remain legible at projector distance.
 */

import { useMemo, useState } from 'react';
import { COLUMNS, RIVER, BREACH, ROADS, BRIDGES, DEPOTS, parseZoneId, GRID } from '@/lib/aegis/incident';
import { bandColour } from './ui';
import Icon from './Icon';

const PAD = 26;
const CELL = 46;
const SIZE = GRID * CELL;

function cellXY(col, row) {
  return { x: PAD + col * CELL, y: PAD + row * CELL };
}
function pointXY(x, y) {
  return { x: PAD + x * CELL, y: PAD + y * CELL };
}

export default function ZoneGrid({
  zones,
  selected,
  onSelect,
  threshold = 0,
  drones = null,
  coverage = null,
  routes = null,
  showRoads = true,
  showDepots = true,
  valueKey = 'severity',
  legendLabel = 'Severity',
  className = '',
}) {
  const [hover, setHover] = useState(null);

  const byId = useMemo(() => Object.fromEntries(zones.map((z) => [z.id, z])), [zones]);

  const riverPath = useMemo(
    () => RIVER.map((p, i) => `${i ? 'L' : 'M'}${pointXY(p.x, p.y).x},${pointXY(p.x, p.y).y}`).join(' '),
    []
  );

  const roadPaths = useMemo(
    () =>
      ROADS.map((r) => ({
        ...r,
        d: r.path
          .map((id, i) => {
            const { col, row } = parseZoneId(id);
            const { x, y } = cellXY(col, row);
            return `${i ? 'L' : 'M'}${x + CELL / 2},${y + CELL / 2}`;
          })
          .join(' '),
      })),
    []
  );

  const routePaths = useMemo(() => {
    if (!routes?.length) return [];
    return routes
      .filter((r) => r.route?.path?.length)
      .map((r) => ({
        id: `${r.depot}-${r.zoneId}`,
        mode: r.mode,
        wave: r.wave,
        d: r.route.path
          .map((id, i) => {
            const { col, row } = parseZoneId(id);
            const { x, y } = cellXY(col, row);
            return `${i ? 'L' : 'M'}${x + CELL / 2},${y + CELL / 2}`;
          })
          .join(' '),
      }));
  }, [routes]);

  const active = hover ?? selected;
  const activeZone = active ? byId[active] : null;

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${SIZE + PAD * 2} ${SIZE + PAD * 2}`}
        className="block h-auto w-full select-none"
        role="img"
        aria-label={`Zone grid for the area of interest — ${zones.length} zones, coloured by ${legendLabel.toLowerCase()}`}
      >
        <defs>
          {/* Flood hatch: reads as water on a printed sheet and survives a projector */}
          <pattern id="aegis-flood" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--water)" strokeWidth="1.4" opacity="0.5" />
          </pattern>
          <pattern id="aegis-blocked" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
            <line x1="0" y1="0" x2="0" y2="5" stroke="var(--halt)" strokeWidth="1.6" opacity="0.6" />
          </pattern>
        </defs>

        {/* Sheet ground */}
        <rect
          x={PAD}
          y={PAD}
          width={SIZE}
          height={SIZE}
          fill="var(--sheet-raised)"
          stroke="var(--rule-strong)"
          strokeWidth="1"
        />

        {/* Grid references in the margin, the way a survey sheet carries them */}
        {COLUMNS.map((c, i) => (
          <text
            key={`c${c}`}
            x={PAD + i * CELL + CELL / 2}
            y={PAD - 8}
            textAnchor="middle"
            fill="var(--ink-3)"
            style={{ font: '600 9px var(--font-narrow)', letterSpacing: '0.1em' }}
          >
            {c}
          </text>
        ))}
        {Array.from({ length: GRID }, (_, i) => (
          <text
            key={`r${i}`}
            x={PAD - 8}
            y={PAD + i * CELL + CELL / 2 + 3}
            textAnchor="end"
            fill="var(--ink-3)"
            style={{ font: '600 9px var(--font-narrow)', letterSpacing: '0.06em' }}
          >
            {String(i + 1).padStart(2, '0')}
          </text>
        ))}

        {/* Zone cells */}
        {zones.map((z) => {
          const { x, y } = cellXY(z.col, z.row);
          const value = z[valueKey] ?? 0;
          const dimmed = threshold > 0 && value < threshold;
          const colour = bandColour(z.band);
          const isActive = active === z.id;
          const cov = coverage?.[z.id] ?? 0;

          return (
            <g
              key={z.id}
              onMouseEnter={() => setHover(z.id)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelect?.(z.id)}
              style={{ cursor: onSelect ? 'pointer' : 'default' }}
              opacity={dimmed ? 0.2 : 1}
            >
              <rect
                x={x}
                y={y}
                width={CELL}
                height={CELL}
                fill={colour}
                fillOpacity={dimmed ? 0.03 : 0.055 + (value / 100) * 0.22}
                stroke="var(--rule)"
                strokeWidth="0.5"
              />
              {z.flood > 0.45 ? (
                <rect x={x} y={y} width={CELL} height={CELL} fill="url(#aegis-flood)" opacity={z.flood * 0.6} />
              ) : null}

              {/* The band lives in the edge — a hard 2px rule on the cell's foot */}
              <line x1={x} y1={y + CELL} x2={x + CELL} y2={y + CELL} stroke={colour} strokeWidth={value >= 40 ? 2.4 : 1} />

              {/* Drone coverage: a filling seam along the top edge */}
              {cov > 0 ? (
                <line
                  x1={x + 1}
                  y1={y + 1.5}
                  x2={x + 1 + (CELL - 2) * Math.min(1, cov)}
                  y2={y + 1.5}
                  stroke="var(--sim)"
                  strokeWidth="2.5"
                  strokeDasharray={cov >= 1 ? undefined : '3 2'}
                />
              ) : null}

              <text
                x={x + 4}
                y={y + 12}
                fill="var(--ink-3)"
                style={{ font: '500 8px var(--font-mono)', letterSpacing: '0.02em' }}
              >
                {z.id}
              </text>
              <text
                x={x + CELL - 4}
                y={y + CELL - 6}
                textAnchor="end"
                fill="var(--ink)"
                style={{ font: '600 13px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
              >
                {Math.round(value)}
              </text>
              {z.settlement ? (
                <text
                  x={x + 4}
                  y={y + CELL - 6}
                  fill="var(--ink-3)"
                  style={{ font: '500 7px var(--font-narrow)', letterSpacing: '0.03em' }}
                >
                  {z.settlement.length > 9 ? `${z.settlement.slice(0, 8)}·` : z.settlement}
                </text>
              ) : null}

              {isActive ? (
                <rect
                  x={x + 0.5}
                  y={y + 0.5}
                  width={CELL - 1}
                  height={CELL - 1}
                  fill="none"
                  stroke="var(--stamp)"
                  strokeWidth="2"
                />
              ) : null}
            </g>
          );
        })}

        {/* River — the reason the whole picture looks like it does */}
        <path d={riverPath} fill="none" stroke="var(--water)" strokeWidth="5" opacity="0.32" strokeLinecap="round" />
        <path d={riverPath} fill="none" stroke="var(--water)" strokeWidth="1.4" opacity="0.85" strokeLinecap="round" />

        {/* Roads */}
        {showRoads
          ? roadPaths.map((r) => (
              <path
                key={r.id}
                d={r.d}
                fill="none"
                stroke="var(--ink-3)"
                strokeWidth={r.class === 'National Highway' ? 1.8 : 1}
                strokeDasharray={r.class === 'District Road' || r.class === 'Embankment Road' ? '4 3' : undefined}
                opacity="0.5"
              />
            ))
          : null}

        {/* Approved routes ride above the road network */}
        {routePaths.map((r) => (
          <g key={r.id}>
            <path d={r.d} fill="none" stroke="var(--sheet-raised)" strokeWidth="4.5" opacity="0.85" />
            <path
              d={r.d}
              fill="none"
              stroke={r.mode === 'boat' ? 'var(--water)' : 'var(--seal)'}
              strokeWidth="2"
              strokeDasharray={r.mode === 'boat' ? '5 3' : undefined}
            />
          </g>
        ))}

        {/* Broken crossings */}
        {BRIDGES.map((b) => {
          const { col, row } = parseZoneId(b.zone);
          const { x, y } = cellXY(col, row);
          const cx = x + CELL / 2;
          const cy = y + CELL / 2;
          const out = b.status !== 'open';
          return (
            <g key={b.id}>
              <rect
                x={cx - 7}
                y={cy - 7}
                width="14"
                height="14"
                fill="var(--sheet-raised)"
                stroke={out ? 'var(--halt)' : 'var(--ink-3)'}
                strokeWidth="1.2"
              />
              {out ? (
                <path
                  d={`M${cx - 4},${cy - 4} L${cx + 4},${cy + 4} M${cx + 4},${cy - 4} L${cx - 4},${cy + 4}`}
                  stroke="var(--halt)"
                  strokeWidth="1.6"
                />
              ) : (
                <path d={`M${cx - 4},${cy} L${cx + 4},${cy}`} stroke="var(--ink-3)" strokeWidth="1.4" />
              )}
            </g>
          );
        })}

        {/* The breach — origin of everything downstream */}
        {(() => {
          const p = pointXY(BREACH.x, BREACH.y);
          return (
            <g>
              <circle cx={p.x} cy={p.y} r="9" fill="none" stroke="var(--halt)" strokeWidth="1.2" opacity="0.55" />
              <circle cx={p.x} cy={p.y} r="3.2" fill="var(--halt)" />
              <text
                x={p.x + 13}
                y={p.y + 3}
                fill="var(--halt)"
                style={{ font: '700 8px var(--font-narrow)', letterSpacing: '0.11em' }}
              >
                BREACH
              </text>
            </g>
          );
        })()}

        {/* Depots */}
        {showDepots
          ? DEPOTS.map((d) => {
              const { col, row } = parseZoneId(d.zone);
              const { x, y } = cellXY(col, row);
              const cx = x + CELL / 2;
              const cy = y + CELL / 2;
              return (
                <g key={d.id}>
                  <path
                    d={`M${cx},${cy - 8} L${cx + 8},${cy} L${cx},${cy + 8} L${cx - 8},${cy} Z`}
                    fill="var(--sheet-raised)"
                    stroke="var(--seal)"
                    strokeWidth="1.4"
                  />
                  <text
                    x={cx}
                    y={cy + 3}
                    textAnchor="middle"
                    fill="var(--seal)"
                    style={{ font: '700 7px var(--font-narrow)' }}
                  >
                    {d.kind.slice(0, 1)}
                  </text>
                </g>
              );
            })
          : null}

        {/* Drones — trail, airframe, and a heading tick */}
        {drones?.map((d) => {
          const p = pointXY(d.pos.x, d.pos.y);
          const flying = d.state !== 'ready' && d.state !== 'charging';
          const trail = d.trail
            ?.map((t, i) => {
              const q = pointXY(t.x, t.y);
              return `${i ? 'L' : 'M'}${q.x},${q.y}`;
            })
            .join(' ');
          return (
            <g key={d.id} opacity={flying ? 1 : 0.4}>
              {trail ? (
                <path d={trail} fill="none" stroke="var(--sim)" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
              ) : null}
              <g transform={`translate(${p.x} ${p.y}) rotate(${d.heading})`}>
                <path d="M-5,-4 L7,0 L-5,4 L-2.5,0 Z" fill="var(--sim)" stroke="var(--sheet-raised)" strokeWidth="0.6" />
              </g>
              {d.state === 'survey' ? (
                <circle cx={p.x} cy={p.y} r="13" fill="none" stroke="var(--sim)" strokeWidth="1" strokeDasharray="2 3" opacity="0.7" />
              ) : null}
              <text
                x={p.x + 10}
                y={p.y - 7}
                fill="var(--sim)"
                style={{ font: '700 7px var(--font-mono)', letterSpacing: '0.04em' }}
              >
                {d.callsign}
              </text>
            </g>
          );
        })}
      </svg>

      {/* Read-out for the hovered or selected zone. Sits under the sheet, not
          over it, so it never covers the cell you are reading. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[var(--rule)] pt-2">
        {activeZone ? (
          <>
            <span className="font-[family-name:var(--font-mono)] text-[0.75rem] font-semibold tracking-[0.04em] text-[var(--ink)]">
              {activeZone.id}
            </span>
            {activeZone.settlement ? (
              <span className="text-[0.75rem] text-[var(--ink-2)]">{activeZone.settlement}</span>
            ) : null}
            <span className="band-chip" data-band={activeZone.band}>
              {activeZone.band} {Math.round(activeZone[valueKey] ?? 0)}
            </span>
            <span className="rail">
              inundation {Math.round((activeZone.flood ?? 0) * 100)}% · depth {activeZone.depthM ?? 0} m · pop{' '}
              {activeZone.population}
            </span>
            {activeZone.droneVerified ? (
              <span className="rail" style={{ color: 'var(--sim)' }}>
                drone verified
              </span>
            ) : null}
          </>
        ) : (
          <span className="rail">Hover a zone for its record · click to open it</span>
        )}
      </div>
    </div>
  );
}

/** The sheet's legend box, as a survey sheet carries it. */
export function GridLegend({ compact = false }) {
  const bands = [
    ['critical', 'Critical ≥80'],
    ['severe', 'Severe 60–79'],
    ['elevated', 'Elevated 40–59'],
    ['monitor', 'Monitor 20–39'],
    ['clear', 'Clear <20'],
  ];
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      {bands.map(([band, label]) => (
        <span key={band} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            style={{ width: 14, height: 3, background: bandColour(band), display: 'inline-block' }}
          />
          <span className="rail">{label}</span>
        </span>
      ))}
      {!compact ? (
        <>
          <span className="flex items-center gap-1.5">
            <Icon name="cross" size={10} style={{ color: 'var(--halt)' }} />
            <span className="rail">crossing out</span>
          </span>
          <span className="flex items-center gap-1.5">
            <Icon name="drone" size={10} style={{ color: 'var(--sim)' }} />
            <span className="rail">drone</span>
          </span>
        </>
      ) : null}
    </div>
  );
}
