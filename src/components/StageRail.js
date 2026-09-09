'use client';

/**
 * The five-stage rail.
 *
 * One unbroken line that never wraps — it scales and scrolls — with a marker
 * on where the run actually is. Losing your place in the sequence mid-incident
 * is a real cost, so the sequence is always visible and always in the same
 * place. An unrun pipeline shows five open stages, which reads as an invitation
 * rather than as an error.
 */

import Icon from './Icon';

export const STAGES = [
  { n: 1, id: 'vision', label: 'Vision analysis', nodes: ['ingest', 'vision'], icon: 'layers' },
  { n: 2, id: 'zones', label: 'Zone priority', nodes: ['prioritise'], icon: 'grid' },
  { n: 3, id: 'drone', label: 'Drone intel', nodes: ['survey', 'fuse'], icon: 'drone' },
  { n: 4, id: 'decide', label: 'Resource decision', nodes: ['decide', 'review', 'gate_resources'], icon: 'scales', gate: 1 },
  { n: 5, id: 'dispatch', label: 'Safe dispatch', nodes: ['routing', 'gate_dispatch', 'dispatch'], icon: 'route', gate: 2 },
];

export function stageForNode(node) {
  return STAGES.find((s) => s.nodes.includes(node)) ?? null;
}

export default function StageRail({ currentNode, done = [], gateOpen = null, compact = false }) {
  const current = currentNode ? stageForNode(currentNode) : null;
  const doneStages = new Set(
    STAGES.filter((s) => s.nodes.every((n) => done.includes(n))).map((s) => s.id)
  );

  return (
    <ol className="flex items-stretch overflow-x-auto" role="list">
      {STAGES.map((s, i) => {
        const isDone = doneStages.has(s.id);
        const isNow = current?.id === s.id;
        const isGateOpen = gateOpen === s.gate;
        const tone = isGateOpen
          ? 'var(--stamp)'
          : isNow
            ? 'var(--stamp)'
            : isDone
              ? 'var(--seal)'
              : 'var(--ink-3)';

        return (
          <li key={s.id} className="flex min-w-0 shrink-0 items-stretch">
            {i > 0 ? (
              <span className="flex items-center px-1.5" aria-hidden="true">
                <svg width="18" height="8" viewBox="0 0 18 8" className="shrink-0">
                  <line
                    x1="0"
                    y1="4"
                    x2="18"
                    y2="4"
                    stroke={isDone || isNow ? 'var(--rule-strong)' : 'var(--rule)'}
                    strokeWidth="1"
                    strokeDasharray={isNow ? '3 3' : undefined}
                    className={isNow ? 'chase' : undefined}
                  />
                </svg>
              </span>
            ) : null}

            <div
              className="flex items-center gap-2 border-b-2 px-2.5 py-1.5"
              style={{ borderBottomColor: isNow || isGateOpen ? tone : 'transparent' }}
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center border"
                style={{ borderColor: tone, color: tone }}
              >
                {isDone && !isNow ? (
                  <Icon name="check" size={9} />
                ) : (
                  <span className="font-[family-name:var(--font-mono)] text-[0.5625rem] font-semibold tabular-nums">
                    {s.n}
                  </span>
                )}
              </span>
              <span className="flex flex-col leading-none">
                <span
                  className="whitespace-nowrap font-[family-name:var(--font-narrow)] text-[0.6875rem] font-semibold uppercase tracking-[0.1em]"
                  style={{ color: isNow || isGateOpen ? 'var(--ink)' : isDone ? 'var(--ink-2)' : 'var(--ink-3)' }}
                >
                  {s.label}
                </span>
                {!compact && s.gate ? (
                  <span
                    className="mt-[0.1875rem] flex items-center gap-1 whitespace-nowrap font-[family-name:var(--font-narrow)] text-[0.5rem] font-semibold uppercase tracking-[0.12em]"
                    style={{ color: isGateOpen ? 'var(--stamp)' : 'var(--ink-3)' }}
                  >
                    {isGateOpen ? (
                      <>
                        <Icon name="stamp" size={8} />
                        awaiting signature
                      </>
                    ) : (
                      `gate ${s.gate}`
                    )}
                  </span>
                ) : null}
              </span>
              {isNow ? (
                <span
                  className="pulse ml-0.5 shrink-0"
                  aria-label="current stage"
                  style={{ width: 5, height: 5, background: 'var(--stamp)' }}
                />
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
