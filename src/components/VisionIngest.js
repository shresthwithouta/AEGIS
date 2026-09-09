'use client';

/**
 * Stage 1, with a real image.
 *
 * Drop a satellite or UAV frame and the Python service segments it, grids it
 * into the same 100 zones the rest of the system reasons over, and reports
 * which model produced each field. The provenance strip is not decoration: a
 * flood fraction from a trained U-Net and one from a classical water index are
 * different kinds of claim, and an officer must be able to see which they have.
 *
 * When no service is configured this panel says so and stays out of the way —
 * the pipeline runs on the incident model regardless.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import Icon from './Icon';
import { Sheet, SheetHead, Field, Note, Working, Provenance, StatusDot, bandColour } from './ui';

export default function VisionIngest() {
  const [health, setHealth] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef(null);
  const previewRef = useRef(null);

  useEffect(() => {
    fetch('/api/vision', { cache: 'no-store' })
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth({ configured: false, reachable: false }));
  }, []);

  // Object URLs leak if they outlive the component; revoke on replace and unmount.
  useEffect(() => {
    return () => {
      if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    };
  }, []);

  const analyse = useCallback(async (file) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);

    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = URL.createObjectURL(file);
    setPreview(previewRef.current);

    try {
      const body = new FormData();
      body.append('image', file);
      const res = await fetch('/api/vision', { method: 'POST', body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Vision service responded ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer?.files?.[0];
    if (file) analyse(file);
  };

  if (health && !health.configured) {
    return (
      <Sheet>
        <SheetHead title="Imagery ingestion" meta="not configured" />
        <div className="px-3 py-2">
          <Note tone="info" icon="layers">
            {health.note} The pipeline runs on the incident model and labels stage 1 SIMULATED.
          </Note>
        </div>
      </Sheet>
    );
  }

  const trained = health?.trainedSegmentation;
  const detects = health?.detectionAvailable;

  return (
    <Sheet active={Boolean(result)}>
      <SheetHead
        title="Imagery ingestion"
        sub="Stage 1 · real inference over an uploaded frame"
        meta={health?.reachable ? `${health.segmentation?.model ?? ''}` : undefined}
        action={
          <StatusDot
            tone={health?.reachable ? 'live' : 'warn'}
            pulse={health?.reachable}
            label={health?.reachable ? `Vision service · ${health.device}` : 'Service down'}
          />
        }
      />

      {health && !health.reachable ? (
        <div className="px-3 py-2">
          <Note tone="warn" icon="alert">
            {health.note}
          </Note>
        </div>
      ) : null}

      {health?.reachable ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 border-b border-rule px-3 py-1.5">
          {[
            ['Extent', trained ? 'U-Net' : 'water index', trained],
            ['Counts', detects ? (health.detection?.model ?? 'YOLO') : 'off', detects],
            ['Damage', health.damageAvailable ? 'xBD' : 'off', health.damageAvailable],
          ].map(([k, v, on]) => (
            <span key={k} className="flex items-baseline gap-1.5">
              <span className="field-label">{k}</span>
              <span className="rail" style={{ color: on ? 'var(--seal)' : 'var(--ink-3)' }}>{v}</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* Drop target */}
      <div className="px-3 py-3">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className="flex items-center justify-center gap-3 border px-4 py-3 transition-colors"
          style={{
            borderColor: dragging ? 'var(--stamp)' : 'var(--rule)',
            borderStyle: 'dashed',
            background: dragging ? 'var(--sheet-sunk)' : 'transparent',
          }}
        >
          <Icon name="layers" size={14} style={{ color: 'var(--ink-3)' }} />
          <span className="rail">Drop a frame, or</span>
          <button
            type="button"
            className="btn"
            onClick={() => inputRef.current?.click()}
            disabled={busy || !health?.reachable}
          >
            <Icon name="search" size={12} />
            Choose an image
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/tiff"
            className="sr-only"
            onChange={(e) => analyse(e.target.files?.[0])}
          />
          
        </div>
      </div>

      {busy ? <Working label="Segmenting and gridding" /> : null}
      {error ? (
        <div className="px-3 pb-3">
          <Note tone="halt" icon="alert">
            {error}
          </Note>
        </div>
      ) : null}

      {result ? (
        <>
          <div className="grid gap-3 border-t border-[var(--rule)] px-3 py-3 md:grid-cols-2">
            <div>
              <span className="field-label mb-1.5 block">Frame</span>
              {preview ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={preview}
                  alt="Uploaded frame being analysed"
                  className="block w-full border border-[var(--rule)]"
                  style={{ imageRendering: 'auto' }}
                />
              ) : null}
            </div>
            <div>
              <span className="field-label mb-1.5 block">Segmented flood extent, gridded to 100 zones</span>
              <FloodGrid zones={result.zones} />
            </div>
          </div>

          <Field label="File" value={`${result.file?.name ?? '—'} · ${((result.file?.bytes ?? 0) / 1e6).toFixed(2)} MB`} mono={false} />
          <Field label="Image" value={`${result.image?.width} × ${result.image?.height} px`} />
          <Field label="Inference time" value={`${result.elapsed_ms} ms (service) · ${result.roundTripMs} ms round trip`} />
          <Field
            label="Zones above 30% inundation"
            value={`${result.summary?.flooded_zones} of ${result.summary?.zones}`}
            tone={result.summary?.flooded_zones > 0 ? 'var(--water)' : undefined}
          />
          <Field label="Mean inundation" value={`${Math.round((result.summary?.mean_flood ?? 0) * 100)}%`} />
          <Field
            label="Persons detected"
            value={
              result.provenance?.detection?.available
                ? String(result.summary?.persons ?? 0)
                : 'detector not installed — unavailable, not zero'
            }
            tone={result.provenance?.detection?.available ? 'var(--sev-critical)' : 'var(--warn)'}
          />

          <div className="space-y-2 border-t border-rule px-3 py-2">
            {result.provenance?.segmentation?.notes?.includes('WEAK SEPARATION') ? (
              <Note tone="halt" icon="alert">
                Flood fractions unreliable — no clear water/land boundary in this frame. Do not dispatch against them.
              </Note>
            ) : null}
            <p className="rail">
              extent {result.provenance?.segmentation?.model} · conf {result.provenance?.segmentation?.confidence}
              {' · '}depth and damage not modelled
            </p>
          </div>
        </>
      ) : null}
    </Sheet>
  );
}

/**
 * The returned flood fractions, drawn on the same 10 × 10 sheet the rest of the
 * system uses — so a real image and the incident model produce a picture the
 * officer reads the same way.
 */
function FloodGrid({ zones }) {
  const CELL = 30;
  const PAD = 16;
  const SIZE = 10 * CELL;

  return (
    <svg
      viewBox={`0 0 ${SIZE + PAD * 2} ${SIZE + PAD * 2}`}
      className="block h-auto w-full"
      role="img"
      aria-label="Flood extent per zone, from the segmentation"
    >
      <rect x={PAD} y={PAD} width={SIZE} height={SIZE} fill="var(--sheet-raised)" stroke="var(--rule-strong)" />
      {'ABCDEFGHIJ'.split('').map((c, i) => (
        <text
          key={c}
          x={PAD + i * CELL + CELL / 2}
          y={PAD - 5}
          textAnchor="middle"
          fill="var(--ink-3)"
          style={{ font: '600 7px var(--font-narrow)', letterSpacing: '0.08em' }}
        >
          {c}
        </text>
      ))}
      {zones.map((z) => {
        const x = PAD + z.col * CELL;
        const y = PAD + z.row * CELL;
        const band = z.flood >= 0.8 ? 'critical' : z.flood >= 0.55 ? 'severe' : z.flood >= 0.3 ? 'elevated' : z.flood >= 0.08 ? 'monitor' : 'clear';
        return (
          <g key={z.id}>
            <rect
              x={x}
              y={y}
              width={CELL}
              height={CELL}
              fill="var(--water)"
              fillOpacity={z.flood * 0.55}
              stroke="var(--rule)"
              strokeWidth="0.4"
            />
            <line
              x1={x}
              y1={y + CELL}
              x2={x + CELL}
              y2={y + CELL}
              stroke={bandColour(band)}
              strokeWidth={z.flood >= 0.3 ? 2 : 0.8}
            />
            {z.flood >= 0.08 ? (
              <text
                x={x + CELL / 2}
                y={y + CELL / 2 + 3}
                textAnchor="middle"
                fill="var(--ink)"
                style={{ font: '600 8px var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}
              >
                {Math.round(z.flood * 100)}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
