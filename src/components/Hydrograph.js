'use client';

/**
 * River stage and rainfall.
 *
 * Two measures on two different scales, so two stacked plots sharing one time
 * axis — never one plot with two y-scales. The gauge plot carries the warning
 * and danger levels as labelled reference rules, because the district plan's
 * trigger is the forecast crossing danger level, not the observed crossing, and
 * that is the single thing an officer is looking for here.
 *
 * Observed and forecast are the same measure from different provenance, so they
 * are separated by line style as well as tone — never by colour alone.
 */

import { useMemo, useState } from 'react';
import { Sheet, SheetHead, Register, Cell, Note } from './ui';
import Icon from './Icon';

const W = 720;
const H_GAUGE = 168;
const H_RAIN = 86;
const M = { top: 14, right: 62, bottom: 22, left: 46 };

export default function Hydrograph({ forecast }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);

  const { hours, warningLevelM, dangerLevelM, station, source } = forecast;

  const geom = useMemo(() => {
    const xs = hours.map((h) => h.offsetH);
    const xMin = Math.min(...xs);
    const xMax = Math.max(...xs);
    const gMin = Math.min(...hours.map((h) => h.gaugeM), warningLevelM) - 0.25;
    const gMax = Math.max(...hours.map((h) => h.gaugeM), dangerLevelM) + 0.2;
    const rMax = Math.max(...hours.map((h) => h.rainfallMm)) * 1.12;

    const plotW = W - M.left - M.right;
    const x = (h) => M.left + ((h - xMin) / (xMax - xMin)) * plotW;
    const yG = (v) => M.top + (1 - (v - gMin) / (gMax - gMin)) * (H_GAUGE - M.top - M.bottom);
    const yR = (v) => H_GAUGE + M.top + (1 - v / rMax) * (H_RAIN - M.top - M.bottom);

    return { x, yG, yR, xMin, xMax, gMin, gMax, rMax, plotW };
  }, [hours, warningLevelM, dangerLevelM]);

  const observed = hours.filter((h) => !h.forecast);
  const forecastPts = hours.filter((h) => h.forecast);
  // Join the two runs so the line has no gap at the boundary.
  const bridge = observed.length ? [observed[observed.length - 1], ...forecastPts] : forecastPts;

  const line = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${geom.x(p.offsetH)},${geom.yG(p.gaugeM)}`).join(' ');

  const peak = hours.reduce((a, h) => (h.gaugeM > a.gaugeM ? h : a), hours[0]);
  const crossing = forecastPts.find((h) => h.gaugeM >= dangerLevelM);
  const barW = Math.max(3, geom.plotW / hours.length - 2);

  const hovered = hover != null ? hours.find((h) => h.offsetH === hover) : null;

  return (
    <Sheet>
      <SheetHead
        title="Stage and rainfall"
        sub={station}
        meta={source}
        action={
          <button type="button" className="btn !px-2 !py-1" onClick={() => setAsTable((v) => !v)}>
            <Icon name={asTable ? 'forecast' : 'file'} size={11} />
            {asTable ? 'Chart' : 'Table'}
          </button>
        }
      />

      {asTable ? (
        <div className="max-h-[22rem] overflow-y-auto">
          <Register
            columns={[
              { key: 't', label: 'Hour' },
              { key: 'src', label: 'Source' },
              { key: 'g', label: 'Gauge (m)', align: 'right' },
              { key: 'r', label: 'Rain (mm)', align: 'right' },
              { key: 's', label: 'Against danger', align: 'right' },
            ]}
          >
            {hours.map((h) => (
              <tr key={h.offsetH} className="border-b border-[var(--rule-soft)]">
                <Cell mono>{h.offsetH >= 0 ? `H+${h.offsetH}` : `H${h.offsetH}`}</Cell>
                <Cell>
                  <span className="rail">{h.forecast ? 'Forecast' : 'Observed'}</span>
                </Cell>
                <Cell mono align="right">
                  {h.gaugeM.toFixed(2)}
                </Cell>
                <Cell mono align="right">
                  {h.rainfallMm.toFixed(1)}
                </Cell>
                <Cell mono align="right">
                  <span
                    style={{
                      color:
                        h.gaugeM >= dangerLevelM
                          ? 'var(--halt)'
                          : h.gaugeM >= warningLevelM
                            ? 'var(--warn)'
                            : 'var(--ink-3)',
                    }}
                  >
                    {h.gaugeM >= dangerLevelM ? 'above danger' : h.gaugeM >= warningLevelM ? 'above warning' : 'below warning'}
                  </span>
                </Cell>
              </tr>
            ))}
          </Register>
        </div>
      ) : (
        <div className="overflow-x-auto px-3 py-3">
          <svg
            viewBox={`0 0 ${W} ${H_GAUGE + H_RAIN}`}
            className="block h-auto w-full min-w-[38rem]"
            role="img"
            aria-label={`River stage at ${station}: peak ${peak.gaugeM} m at hour ${peak.offsetH}. Danger level ${dangerLevelM} m.`}
            onMouseLeave={() => setHover(null)}
          >
            {/* Recessive grid */}
            {[0, 0.25, 0.5, 0.75, 1].map((f) => {
              const v = geom.gMin + f * (geom.gMax - geom.gMin);
              return (
                <g key={f}>
                  <line
                    x1={M.left}
                    y1={geom.yG(v)}
                    x2={W - M.right}
                    y2={geom.yG(v)}
                    stroke="var(--rule-soft)"
                    strokeWidth="1"
                  />
                  <text
                    x={M.left - 6}
                    y={geom.yG(v) + 3}
                    textAnchor="end"
                    fill="var(--ink-3)"
                    style={{ font: '500 8px var(--font-mono)' }}
                  >
                    {v.toFixed(1)}
                  </text>
                </g>
              );
            })}

            {/* Forecast region — hatched, so provenance is visible without colour */}
            <rect
              x={geom.x(0)}
              y={M.top}
              width={W - M.right - geom.x(0)}
              height={H_GAUGE + H_RAIN - M.top - M.bottom}
              fill="var(--ink)"
              opacity="0.028"
            />
            <line
              x1={geom.x(0)}
              y1={M.top}
              x2={geom.x(0)}
              y2={H_GAUGE + H_RAIN - M.bottom}
              stroke="var(--ink-3)"
              strokeWidth="1"
              strokeDasharray="2 3"
            />
            <text
              x={geom.x(0) + 4}
              y={M.top + 8}
              fill="var(--ink-3)"
              style={{ font: '600 8px var(--font-narrow)', letterSpacing: '0.1em' }}
            >
              NOW
            </text>

            {/* Threshold rules — status colour, always labelled */}
            {[
              [warningLevelM, 'WARNING', 'var(--warn)'],
              [dangerLevelM, 'DANGER', 'var(--halt)'],
            ].map(([v, label, tone]) => (
              <g key={label}>
                <line
                  x1={M.left}
                  y1={geom.yG(v)}
                  x2={W - M.right}
                  y2={geom.yG(v)}
                  stroke={tone}
                  strokeWidth="1.4"
                  strokeDasharray="6 3"
                />
                <text
                  x={W - M.right + 5}
                  y={geom.yG(v) + 3}
                  fill={tone}
                  style={{ font: '700 8px var(--font-narrow)', letterSpacing: '0.1em' }}
                >
                  {label} {v}
                </text>
              </g>
            ))}

            {/* Gauge — observed solid, forecast dashed */}
            <path d={line(observed)} fill="none" stroke="var(--water)" strokeWidth="2" strokeLinejoin="miter" />
            <path
              d={line(bridge)}
              fill="none"
              stroke="var(--water)"
              strokeWidth="2"
              strokeDasharray="5 3"
              opacity="0.95"
            />

            {/* Peak, direct-labelled — not every point */}
            <g>
              <rect x={geom.x(peak.offsetH) - 4} y={geom.yG(peak.gaugeM) - 4} width="8" height="8" fill="var(--sheet-raised)" stroke="var(--water)" strokeWidth="1.6" />
              <text
                x={geom.x(peak.offsetH)}
                y={geom.yG(peak.gaugeM) - 9}
                textAnchor="middle"
                fill="var(--ink)"
                style={{ font: '600 9px var(--font-mono)' }}
              >
                {peak.gaugeM.toFixed(2)} m
              </text>
            </g>

            {crossing ? (
              <g>
                <line
                  x1={geom.x(crossing.offsetH)}
                  y1={M.top}
                  x2={geom.x(crossing.offsetH)}
                  y2={H_GAUGE - M.bottom}
                  stroke="var(--halt)"
                  strokeWidth="1"
                />
                <text
                  x={geom.x(crossing.offsetH) + 4}
                  y={H_GAUGE - M.bottom - 4}
                  fill="var(--halt)"
                  style={{ font: '700 8px var(--font-narrow)', letterSpacing: '0.08em' }}
                >
                  CROSSES H+{crossing.offsetH}
                </text>
              </g>
            ) : null}

            {/* Rainfall — its own plot, its own scale */}
            <line
              x1={M.left}
              y1={geom.yR(0)}
              x2={W - M.right}
              y2={geom.yR(0)}
              stroke="var(--rule-strong)"
              strokeWidth="1"
            />
            {hours.map((h) => (
              <rect
                key={h.offsetH}
                x={geom.x(h.offsetH) - barW / 2}
                y={geom.yR(h.rainfallMm)}
                width={barW}
                height={Math.max(0, geom.yR(0) - geom.yR(h.rainfallMm))}
                fill="var(--water)"
                opacity={h.forecast ? 0.45 : 0.8}
                stroke="var(--sheet)"
                strokeWidth="1"
              />
            ))}
            <text
              x={M.left - 6}
              y={geom.yR(geom.rMax) + 8}
              textAnchor="end"
              fill="var(--ink-3)"
              style={{ font: '500 8px var(--font-mono)' }}
            >
              {Math.round(geom.rMax)}
            </text>
            <text
              x={W - M.right + 5}
              y={geom.yR(0)}
              fill="var(--ink-3)"
              style={{ font: '600 8px var(--font-narrow)', letterSpacing: '0.08em' }}
            >
              mm/3h
            </text>

            {/* x axis */}
            {hours
              .filter((_, i) => i % 4 === 0)
              .map((h) => (
                <text
                  key={h.offsetH}
                  x={geom.x(h.offsetH)}
                  y={H_GAUGE + H_RAIN - 6}
                  textAnchor="middle"
                  fill="var(--ink-3)"
                  style={{ font: '500 8px var(--font-mono)' }}
                >
                  {h.offsetH >= 0 ? `+${h.offsetH}` : h.offsetH}
                </text>
              ))}

            {/* Crosshair + hit targets */}
            {hovered ? (
              <line
                x1={geom.x(hovered.offsetH)}
                y1={M.top}
                x2={geom.x(hovered.offsetH)}
                y2={H_GAUGE + H_RAIN - M.bottom}
                stroke="var(--stamp)"
                strokeWidth="1"
              />
            ) : null}
            {hours.map((h) => (
              <rect
                key={`hit-${h.offsetH}`}
                x={geom.x(h.offsetH) - geom.plotW / hours.length / 2}
                y={M.top}
                width={geom.plotW / hours.length}
                height={H_GAUGE + H_RAIN - M.top - M.bottom}
                fill="transparent"
                onMouseEnter={() => setHover(h.offsetH)}
              />
            ))}
          </svg>

          {/* Legend — always present for two series, plus the readout */}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--rule)] pt-2">
            <span className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="18" y2="3" stroke="var(--water)" strokeWidth="2" />
              </svg>
              <span className="rail">Observed (CWC gauge)</span>
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="18" height="6" aria-hidden="true">
                <line x1="0" y1="3" x2="18" y2="3" stroke="var(--water)" strokeWidth="2" strokeDasharray="5 3" />
              </svg>
              <span className="rail">Forecast</span>
            </span>
            {hovered ? (
              <span className="ml-auto flex items-center gap-3">
                <span className="rail">{hovered.offsetH >= 0 ? `H+${hovered.offsetH}` : `H${hovered.offsetH}`}</span>
                <span className="field-value">{hovered.gaugeM.toFixed(2)} m</span>
                <span className="field-value">{hovered.rainfallMm.toFixed(1)} mm</span>
                <span
                  className="band-chip"
                  style={{
                    borderColor:
                      hovered.gaugeM >= dangerLevelM
                        ? 'var(--halt)'
                        : hovered.gaugeM >= warningLevelM
                          ? 'var(--warn)'
                          : 'var(--rule-strong)',
                    color:
                      hovered.gaugeM >= dangerLevelM
                        ? 'var(--halt)'
                        : hovered.gaugeM >= warningLevelM
                          ? 'var(--warn)'
                          : 'var(--ink-3)',
                  }}
                >
                  {hovered.gaugeM >= dangerLevelM ? 'Danger' : hovered.gaugeM >= warningLevelM ? 'Warning' : 'Normal'}
                </span>
              </span>
            ) : (
              <span className="ml-auto rail">Hover for the reading at any hour</span>
            )}
          </div>
        </div>
      )}

      <div className="border-t border-[var(--rule)] px-3 py-2">
        <Note tone="sim" icon="forecast">
          Synthetic series shaped like a CWC gauge record and an IMD district quantitative precipitation forecast. A
          deployment reads the real feeds; the trigger logic below does not change.
        </Note>
      </div>
    </Sheet>
  );
}
