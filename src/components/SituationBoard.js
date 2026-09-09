'use client';

/**
 * The situation sheet.
 *
 * Grid on the left at full scale, priority register ruled beside it. One
 * control — the severity cut — and moving it remaps all hundred cells and the
 * register live, with the count reading out as you drag. Filtering on release
 * would break the thing this control is for: finding where the cut falls.
 */

import { useMemo, useState } from 'react';
import Link from 'next/link';
import ZoneGrid, { GridLegend } from './ZoneGrid';
import { Sheet, SheetHead, Register, Cell, BandChip, Field, Note, bandColour, Provenance } from './ui';
import Icon from './Icon';
import { DEFAULT_WEIGHTS, WEIGHT_LABELS, WEIGHT_BASIS, scoreZone } from '@/lib/aegis/severity';

export default function SituationBoard({ zones: initialZones }) {
  const [threshold, setThreshold] = useState(0);
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [selected, setSelected] = useState(null);
  const [tuning, setTuning] = useState(false);

  // Rescoring all 100 zones is trivial arithmetic, so it happens on every
  // pointer move rather than on release.
  const zones = useMemo(
    () =>
      initialZones
        .map((z) => {
          const s = scoreZone(z, weights);
          return { ...z, severity: s.severity, band: s.band.id, terms: s.terms };
        })
        .sort((a, b) => b.severity - a.severity || a.id.localeCompare(b.id))
        .map((z, i) => ({ ...z, rank: i + 1 })),
    [initialZones, weights]
  );

  const above = zones.filter((z) => z.severity >= threshold);
  const counts = useMemo(() => {
    const c = { critical: 0, severe: 0, elevated: 0, monitor: 0, clear: 0 };
    for (const z of zones) c[z.band] += 1;
    return c;
  }, [zones]);

  const selectedZone = selected ? zones.find((z) => z.id === selected) : null;
  const dirty = JSON.stringify(weights) !== JSON.stringify(DEFAULT_WEIGHTS);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(22rem,0.85fr)]">
      {/* ---- The sheet ------------------------------------------------ */}
      <Sheet active>
        <SheetHead
          title="Area of interest"
          sub="10 × 10 km · 100 zones · 1 km² each"
          meta={`${above.length}/100 at or above cut`}
          action={
            <button
              type="button"
              className="btn !px-2 !py-1"
              onClick={() => setTuning((v) => !v)}
              aria-expanded={tuning}
            >
              <Icon name="scales" size={12} />
              Weights
            </button>
          }
        />

        {tuning ? (
          <div className="border-b border-[var(--rule)] bg-[var(--sheet-sunk)] px-3 py-3">
            <div className="grid gap-3 sm:grid-cols-3">
              {Object.keys(DEFAULT_WEIGHTS).map((k) => (
                <label key={k} className="block">
                  <span className="flex items-baseline justify-between">
                    <span className="field-label">{WEIGHT_LABELS[k]}</span>
                    <span className="field-value">{weights[k].toFixed(2)}</span>
                  </span>
                  <input
                    type="range"
                    className="slide mt-1"
                    min="0"
                    max="1"
                    step="0.05"
                    value={weights[k]}
                    onChange={(e) => setWeights((w) => ({ ...w, [k]: Number(e.target.value) }))}
                    aria-label={`${WEIGHT_LABELS[k]} weight`}
                  />
                  <span className="mt-0.5 block text-[0.625rem] leading-[1.4] text-[var(--ink-3)]">
                    {WEIGHT_BASIS[k]}
                  </span>
                </label>
              ))}
            </div>
            {dirty ? (
              <div className="mt-3 flex items-center gap-3">
                <button type="button" className="btn" onClick={() => setWeights(DEFAULT_WEIGHTS)}>
                  <Icon name="rewind" size={11} />
                  Restore defaults
                </button>
                <span className="rail">Non-default weights are recorded in the register when a run is opened.</span>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="px-3 py-3">
          <ZoneGrid zones={zones} selected={selected} onSelect={setSelected} threshold={threshold} />
        </div>

        {/* The cut — one control, live */}
        <div className="border-t border-[var(--rule)] px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="field-label shrink-0">Severity cut</span>
            <input
              type="range"
              className="slide"
              min="0"
              max="90"
              step="1"
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              aria-label="Severity cut"
              aria-valuetext={`${threshold}, ${above.length} zones at or above`}
            />
            <span className="shrink-0 font-[family-name:var(--font-mono)] text-[0.8125rem] font-semibold tabular-nums text-[var(--ink)]">
              {String(threshold).padStart(2, '0')}
            </span>
            <span className="shrink-0 rail">{above.length} zones</span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
            <GridLegend />
          </div>
        </div>
      </Sheet>

      {/* ---- The register --------------------------------------------- */}
      <div className="flex min-w-0 flex-col gap-4">
        <Sheet>
          <SheetHead
            title="Priority register"
            meta={`${counts.critical} critical · ${counts.severe} severe`}
            action={
              <Link href="/operations" className="btn" data-tone="primary">
                Open the response pipeline
                <Icon name="chevron" size={11} />
              </Link>
            }
          />
          <div className="max-h-[26rem] overflow-y-auto">
            <Register
              columns={[
                { key: 'sl', label: 'Sl.', width: '2.6rem' },
                { key: 'zone', label: 'Zone' },
                { key: 'band', label: 'Band' },
                { key: 'flood', label: 'Inund.', align: 'right' },
                { key: 'pop', label: 'Pop.', align: 'right' },
                { key: 'sev', label: 'Sev.', align: 'right' },
              ]}
            >
              {above.slice(0, 24).map((z) => (
                <tr
                  key={z.id}
                  onClick={() => setSelected(z.id)}
                  className="cursor-pointer border-b border-[var(--rule-soft)] transition-colors hover:bg-[var(--sheet-sunk)]"
                  style={selected === z.id ? { background: 'var(--sheet-sunk)' } : undefined}
                  data-band={z.band}
                >
                  <Cell mono className="rail !text-[0.625rem]">
                    {String(z.rank).padStart(3, '0')}
                  </Cell>
                  <Cell>
                    <span className="band-edge -ml-2.5 block pl-2.5" data-band={z.band}>
                      <span className="font-[family-name:var(--font-mono)] text-[0.75rem] font-semibold">{z.id}</span>
                      {z.settlement ? (
                        <span className="ml-1.5 text-[0.6875rem] text-[var(--ink-3)]">{z.settlement}</span>
                      ) : null}
                    </span>
                  </Cell>
                  <Cell>
                    <BandChip band={z.band} />
                  </Cell>
                  <Cell mono align="right">
                    {Math.round(z.flood * 100)}%
                  </Cell>
                  <Cell mono align="right">
                    {z.population.toLocaleString('en-IN')}
                  </Cell>
                  <Cell mono align="right" className="!text-[0.8125rem] !font-semibold">
                    {z.severity}
                  </Cell>
                </tr>
              ))}
            </Register>
          </div>
        </Sheet>

        {/* ---- Zone record ------------------------------------------- */}
        <Sheet raised>
          <SheetHead
            title={selectedZone ? `Zone record · ${selectedZone.id}` : 'Zone record'}
            meta={selectedZone?.settlement ?? undefined}
          />
          {selectedZone ? (
            <>
              <div className="border-b border-[var(--rule)] px-3 py-2.5">
                <div className="flex items-baseline gap-3">
                  <span
                    className="font-[family-name:var(--font-mono)] text-[2rem] font-semibold leading-none tabular-nums text-[var(--ink)]"
                    style={{ borderBottom: `3px solid ${bandColour(selectedZone.band)}` }}
                  >
                    {selectedZone.severity}
                  </span>
                  <BandChip band={selectedZone.band} />
                  <span className="ml-auto">
                    <Provenance
                      kind={selectedZone.droneVerified ? 'observed' : 'predicted'}
                      detail={
                        selectedZone.droneVerified
                          ? 'Counts confirmed by a drone pass.'
                          : 'No drone pass flown — person counts are a predicted range.'
                      }
                    />
                  </span>
                </div>

                {/* The arithmetic, shown rather than asserted */}
                <div className="mt-2.5 space-y-1">
                  {selectedZone.terms?.map((t) => (
                    <div key={t.key} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 field-label">{WEIGHT_LABELS[t.key]}</span>
                      <span className="flex-1">
                        <span className="relative block h-[3px] border-b border-[var(--rule)]">
                          <span
                            className="absolute inset-y-0 left-0 block"
                            style={{ width: `${t.contribution * 100}%`, background: bandColour(selectedZone.band) }}
                          />
                        </span>
                      </span>
                      <span className="w-32 shrink-0 text-right font-[family-name:var(--font-mono)] text-[0.625rem] tabular-nums text-[var(--ink-3)]">
                        {t.value.toFixed(2)} × {t.weight.toFixed(2)} = {t.contribution.toFixed(3)}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between border-t border-[var(--rule)] pt-1">
                    <span className="field-label">Sum × 100</span>
                    <span className="field-value">{selectedZone.severity}</span>
                  </div>
                </div>
              </div>

              <Field label="Terrain" value={selectedZone.terrainLabel} />
              <Field label="Inundation" value={`${Math.round(selectedZone.flood * 100)}% · ${selectedZone.depthM} m mean depth`} />
              <Field
                label="Structures"
                value={`${selectedZone.damagedStructures} damaged of ${selectedZone.structures}`}
              />
              <Field label="Resident population" value={selectedZone.population.toLocaleString('en-IN')} />
              <Field
                label="Persons at risk"
                value={
                  selectedZone.observed
                    ? `${selectedZone.observed.persons} observed`
                    : `${selectedZone.predicted.low}–${selectedZone.predicted.high} predicted`
                }
                tone={selectedZone.observed ? 'var(--seal)' : 'var(--warn)'}
                title={selectedZone.observed ? 'Confirmed by drone pass.' : selectedZone.predicted.basis}
              />
              <Field label="Distance to river" value={`${selectedZone.distanceToRiverKm} km`} />
              <Field label="Imagery confidence" value={selectedZone.confidence.toFixed(2)} />
            </>
          ) : (
            <div className="px-3 py-6">
              <p className="text-[0.75rem] text-[var(--ink-3)]">Select a zone to open its record.</p>
            </div>
          )}
        </Sheet>
        <p className="rail">Synthetic incident data · Kosi–Bagmati basin, Darbhanga</p>
      </div>
    </div>
  );
}
