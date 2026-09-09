'use client';

/**
 * The execution graph, drawn.
 *
 * Judges and officers both ask the same question — "what is it actually
 * doing?" — and a list of stage names does not answer it. This draws the real
 * compiled graph: its nodes, its conditional edges, its cycles, and the two
 * points where it halts for a signature. The node currently executing is lit,
 * and the edge that was taken is inked while the others stay hairlines.
 */

import { useMemo } from 'react';
import Icon from './Icon';

/* Laid out by hand. The pipeline's shape is fixed and meaningful — the drone
   loop and the two revision cycles should be legible, not auto-arranged. */
const LAYOUT = {
  __start__: { x: 22, y: 140, w: 44, kind: 'terminal', label: 'START' },
  ingest: { x: 84, y: 100, kind: 'io' },
  vision: { x: 192, y: 100, kind: 'model' },
  prioritise: { x: 300, y: 100, kind: 'compute' },
  survey: { x: 300, y: 26, kind: 'sim' },
  fuse: { x: 412, y: 26, kind: 'compute' },
  decide: { x: 412, y: 140, kind: 'agent' },
  review: { x: 526, y: 140, kind: 'agent' },
  gate_resources: { x: 526, y: 214, kind: 'gate' },
  routing: { x: 646, y: 214, kind: 'compute' },
  gate_dispatch: { x: 646, y: 140, kind: 'gate' },
  dispatch: { x: 762, y: 140, kind: 'io' },
  __end__: { x: 874, y: 140, w: 40, kind: 'terminal', label: 'END' },
};

const NODE_W = 96;
const NODE_H = 30;

const KIND_TONE = {
  io: 'var(--ink-3)',
  model: 'var(--sev-monitor)',
  compute: 'var(--ink-2)',
  sim: 'var(--sim)',
  agent: 'var(--stamp)',
  gate: 'var(--tape)',
  terminal: 'var(--ink-4)',
  check: 'var(--seal)',
};

const KIND_ICON = {
  io: 'layers',
  model: 'grid',
  compute: 'scales',
  sim: 'drone',
  agent: 'node',
  gate: 'stamp',
  check: 'check',
};

function box(id) {
  const l = LAYOUT[id];
  if (!l) return null;
  const w = l.w ?? NODE_W;
  return { ...l, w, h: NODE_H, cx: l.x + w / 2, cy: l.y + NODE_H / 2 };
}

/** Orthogonal connector — a ruled line, in keeping with everything else. */
function edgePath(from, to) {
  const a = box(from);
  const b = box(to);
  if (!a || !b) return null;

  // Straight run
  if (Math.abs(a.cy - b.cy) < 2) {
    return `M${a.x + a.w},${a.cy} L${b.x},${b.cy}`;
  }
  // Vertical-ish neighbours in the same column
  if (Math.abs(a.cx - b.cx) < 2) {
    return a.cy < b.cy
      ? `M${a.cx},${a.y + a.h} L${b.cx},${b.y}`
      : `M${a.cx},${a.y} L${b.cx},${b.y + b.h}`;
  }
  // Dogleg: out the side, along, then in
  const midX = a.x + a.w + Math.max(14, (b.x - (a.x + a.w)) / 2);
  if (b.x >= a.x + a.w) {
    return `M${a.x + a.w},${a.cy} L${midX},${a.cy} L${midX},${b.cy} L${b.x},${b.cy}`;
  }
  // Backwards edge (a cycle) — route below everything
  const dropY = Math.max(a.y + a.h, b.y + b.h) + 24;
  return `M${a.cx},${a.y + a.h} L${a.cx},${dropY} L${b.cx},${dropY} L${b.cx},${b.y + b.h}`;
}

export default function GraphView({ shape, currentNode, visited = [], takenEdges = [], gateOpen = null, compact = false }) {
  const nodes = useMemo(() => {
    const declared = shape?.nodes ?? [];
    const all = [{ id: '__start__' }, ...declared, { id: '__end__' }];
    return all.filter((n) => LAYOUT[n.id]).map((n) => ({ ...n, ...box(n.id) }));
  }, [shape]);

  const edges = useMemo(() => {
    const list = shape?.edges ?? [];
    return list
      .map((e) => ({ ...e, d: edgePath(e.from, e.to) }))
      .filter((e) => e.d);
  }, [shape]);

  const visitedSet = new Set(visited);
  const takenSet = new Set(takenEdges.map((e) => `${e.from}→${e.to}`));

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox="0 0 930 300"
        className="block h-auto w-full min-w-[46rem]"
        role="img"
        aria-label="Execution graph of the AEGIS response pipeline"
      >
        <defs>
          <marker id="ag-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--rule-strong)" />
          </marker>
          <marker id="ag-arrow-on" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0,0 L8,4 L0,8 z" fill="var(--stamp)" />
          </marker>
        </defs>

        {edges.map((e, i) => {
          const on = takenSet.has(`${e.from}→${e.to}`);
          return (
            <g key={`${e.from}-${e.to}-${i}`}>
              <path
                d={e.d}
                fill="none"
                stroke={on ? 'var(--stamp)' : 'var(--rule-strong)'}
                strokeWidth={on ? 1.6 : 0.8}
                strokeDasharray={e.kind === 'conditional' ? '4 3' : undefined}
                markerEnd={on ? 'url(#ag-arrow-on)' : 'url(#ag-arrow)'}
                opacity={on ? 1 : 0.55}
              />
              {e.label && !compact ? (
                (() => {
                  const a = box(e.from);
                  const b = box(e.to);
                  const mx = (a.x + a.w + b.x) / 2;
                  const my = (a.cy + b.cy) / 2 - 4;
                  return (
                    <text
                      x={mx}
                      y={my}
                      textAnchor="middle"
                      fill={on ? 'var(--stamp)' : 'var(--ink-3)'}
                      style={{ font: '600 7px var(--font-narrow)', letterSpacing: '0.08em', textTransform: 'uppercase' }}
                    >
                      {e.label}
                    </text>
                  );
                })()
              ) : null}
            </g>
          );
        })}

        {nodes.map((n) => {
          const isNow = currentNode === n.id;
          const wasVisited = visitedSet.has(n.id);
          const isGate = n.kind === 'gate';
          const isOpenGate = isGate && gateOpen && n.id.includes(gateOpen === 1 ? 'resources' : 'dispatch');
          const tone = KIND_TONE[n.kind] ?? 'var(--ink-3)';
          const terminal = n.kind === 'terminal';

          return (
            <g key={n.id}>
              <rect
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                fill={isNow || isOpenGate ? 'var(--sheet-raised)' : wasVisited ? 'var(--sheet)' : 'var(--sheet-sunk)'}
                stroke={isNow || isOpenGate ? 'var(--stamp)' : wasVisited ? tone : 'var(--rule)'}
                strokeWidth={isNow || isOpenGate ? 2 : 1}
                strokeDasharray={terminal ? '3 2' : undefined}
              />
              {/* Gates get a doubled rule — a stamped box on a form */}
              {isGate ? (
                <rect
                  x={n.x + 3}
                  y={n.y + 3}
                  width={n.w - 6}
                  height={n.h - 6}
                  fill="none"
                  stroke={isOpenGate ? 'var(--stamp)' : 'var(--tape)'}
                  strokeWidth="0.7"
                  opacity={wasVisited || isOpenGate ? 0.9 : 0.35}
                />
              ) : null}

              {!terminal ? (
                <g transform={`translate(${n.x + 7} ${n.y + 8})`} style={{ color: wasVisited || isNow ? tone : 'var(--ink-4)' }}>
                  <svg viewBox="0 0 16 16" width="11" height="11" style={{ overflow: 'visible' }}>
                    <use href={`#ag-i-${n.id}`} />
                  </svg>
                </g>
              ) : null}

              <text
                x={terminal ? n.cx : n.x + 22}
                y={n.cy + 3.2}
                textAnchor={terminal ? 'middle' : 'start'}
                fill={isNow || isOpenGate ? 'var(--ink)' : wasVisited ? 'var(--ink-2)' : 'var(--ink-3)'}
                style={{ font: `${terminal ? '700' : '600'} 8px var(--font-narrow)`, letterSpacing: '0.07em', textTransform: 'uppercase' }}
              >
                {n.label ?? shorten(n.label ?? n.id)}
              </text>

              {isNow ? (
                <circle cx={n.x + n.w - 7} cy={n.y + 7} r="2.6" fill="var(--stamp)" className="pulse" />
              ) : null}
            </g>
          );
        })}

        {/* Icon symbol defs — drawn once, referenced per node */}
        <g style={{ display: 'none' }}>
          {nodes
            .filter((n) => n.kind !== 'terminal')
            .map((n) => (
              <symbol id={`ag-i-${n.id}`} key={n.id} viewBox="0 0 16 16">
                <IconGlyph name={KIND_ICON[n.kind] ?? 'node'} />
              </symbol>
            ))}
        </g>
      </svg>

      {!compact ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-[var(--rule)] pt-2">
          {[
            ['agent', 'Reasoning node'],
            ['gate', 'Human approval gate — the graph halts here'],
            ['sim', 'Simulated subsystem'],
            ['compute', 'Deterministic computation'],
          ].map(([kind, label]) => (
            <span key={kind} className="flex items-center gap-1.5">
              <span
                aria-hidden="true"
                style={{ width: 10, height: 10, border: `1.5px solid ${KIND_TONE[kind]}`, display: 'inline-block' }}
              />
              <span className="rail">{label}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <svg width="16" height="6" aria-hidden="true">
              <line x1="0" y1="3" x2="16" y2="3" stroke="var(--rule-strong)" strokeWidth="1" strokeDasharray="3 2" />
            </svg>
            <span className="rail">conditional edge</span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function shorten(id) {
  return String(id).replace(/_/g, ' ');
}

/** Inline glyph so the graph does not depend on the icon component's wrapper. */
function IconGlyph({ name }) {
  const s = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.4, strokeLinecap: 'square' };
  switch (name) {
    case 'node':
      return (
        <>
          <circle {...s} cx="8" cy="8" r="3" />
          <path {...s} d="M8 1.6v3.4M8 11v3.4M1.6 8H5M11 8h3.4" />
        </>
      );
    case 'stamp':
      return (
        <>
          <path {...s} d="M2.5 13.5h11" />
          <path {...s} d="M3.6 11.4h8.8v1.4H3.6z" />
          <path {...s} d="M6 11.4V8.6a1.6 1.6 0 0 0-.5-1.2 3 3 0 1 1 5 0 1.6 1.6 0 0 0-.5 1.2v2.8" />
        </>
      );
    case 'drone':
      return (
        <>
          <path {...s} d="M6.2 6.2h3.6v3.6H6.2z" />
          <path {...s} d="M6.2 6.2 3.4 3.4M9.8 6.2l2.8-2.8M6.2 9.8l-2.8 2.8M9.8 9.8l2.8 2.8" />
        </>
      );
    case 'grid':
      return (
        <>
          <path {...s} d="M2 2h12v12H2z" />
          <path {...s} d="M6 2v12M10 2v12M2 6h12M2 10h12" />
        </>
      );
    case 'scales':
      return (
        <>
          <path {...s} d="M8 2.4v11M4 13.6h8M2 5.2h12" />
          <path {...s} d="M4.4 5.2 2 9.8h4.8zM11.6 5.2 9.2 9.8H14z" />
        </>
      );
    case 'layers':
    default:
      return (
        <>
          <path {...s} d="M8 1.8 1.8 5 8 8.2 14.2 5z" />
          <path {...s} d="m1.8 8.4 6.2 3.2 6.2-3.2" />
        </>
      );
  }
}
