'use client';

/**
 * The response pipeline console.
 *
 * The graph executes server-side and streams its events here, so what you watch
 * is the run itself rather than a replay of it. When the executor reaches an
 * approval gate it genuinely stops — the stream ends, the thread is
 * checkpointed, and nothing continues until an officer stamps. Reloading the
 * page mid-incident recovers the thread from its checkpoint.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import GraphView from './GraphView';
import StageRail from './StageRail';
import StampButton from './StampButton';
import ZoneGrid, { GridLegend } from './ZoneGrid';
import Icon from './Icon';
import {
  Sheet,
  SheetHead,
  Register,
  Cell,
  BandChip,
  Field,
  Note,
  Empty,
  Working,
  Provenance,
  StatusDot,
  bandColour,
} from './ui';

const NODE_LABELS = {
  ingest: 'Ingest imagery',
  vision: 'Vision analysis',
  prioritise: 'Zone prioritisation',
  survey: 'Drone survey',
  fuse: 'Fuse observations',
  decide: 'Resource decision',
  review: 'Safety review',
  gate_resources: 'Approval gate 1',
  routing: 'Safe routing',
  gate_dispatch: 'Approval gate 2',
  dispatch: 'Issue dispatch order',
};

export default function PipelineConsole({ zones: baseZones, shape, reasoningLive, visionResult }) {
  const [threadId] = useState(() => `run-${Date.now().toString(36)}`);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState([]);
  const [currentNode, setCurrentNode] = useState(null);
  const [visited, setVisited] = useState([]);
  const [taken, setTaken] = useState([]);
  const [state, setState] = useState({});
  const [gate, setGate] = useState(null);
  const [error, setError] = useState(null);
  const [officer, setOfficer] = useState('R. K. Sinha');
  const [designation, setDesignation] = useState('Addl. District Magistrate (Disaster)');
  const [remark, setRemark] = useState('');
  const [stamped, setStamped] = useState({});
  const abortRef = useRef(null);
  const traceEnd = useRef(null);

  /* ---- streaming ------------------------------------------------- */

  const consume = useCallback(async (body) => {
    setError(null);
    setRunning(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, ...body }),
        signal: controller.signal,
      });
      if (!res.ok || !res.body) throw new Error(`Pipeline responded ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let prevNode = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() ?? '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data:')) continue;
          let ev;
          try {
            ev = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          setEvents((prev) => [...prev.slice(-400), ev]);

          if (ev.type === 'node:start') {
            setCurrentNode(ev.node);
            if (prevNode) setTaken((t) => [...t, { from: prevNode, to: ev.node }]);
            else setTaken((t) => [...t, { from: '__start__', to: ev.node }]);
            prevNode = ev.node;
          }
          if (ev.type === 'node:end') {
            setVisited((v) => (v.includes(ev.node) ? v : [...v, ev.node]));
            if (ev.update) setState((s) => mergeUpdate(s, ev.update));
          }
          if (ev.type === 'interrupt') {
            setCurrentNode(ev.node);
            setGate(ev.payload);
            if (prevNode) setTaken((t) => [...t, { from: prevNode, to: ev.node }]);
            setRunning(false);
          }
          if (ev.type === 'end') {
            if (prevNode) setTaken((t) => [...t, { from: prevNode, to: '__end__' }]);
            setCurrentNode(null);
            setGate(null);
            setRunning(false);
            if (ev.state) setState((s) => mergeUpdate(s, ev.state));
          }
          if (ev.type === 'error') {
            setError(ev.error);
            setRunning(false);
          }
        }
      }
    } catch (err) {
      if (err?.name !== 'AbortError') setError(String(err?.message ?? err));
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, [threadId]);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    traceEnd.current?.scrollIntoView({ block: 'nearest' });
  }, [events.length]);

  const start = () => {
    setEvents([]);
    setVisited([]);
    setTaken([]);
    setState({});
    setGate(null);
    setStamped({});
    consume({ officer, designation, ...(visionResult ? { visionResult } : {}) });
  };

  const decide = (action) => {
    const g = gate?.gate;
    setStamped((s) => ({ ...s, [g]: action }));
    setGate(null);
    consume({
      resume: {
        action,
        officer,
        designation,
        remark: remark.trim() || null,
        gateLabel: gate?.title,
      },
    });
    setRemark('');
  };

  /* ---- derived ---------------------------------------------------- */

  const zones = useMemo(() => {
    const obs = state.observations ?? {};
    const ranked = state.rankedTop ?? [];
    const rankedById = Object.fromEntries(ranked.map((z) => [z.id, z]));
    return baseZones.map((z) => ({ ...z, ...(rankedById[z.id] ?? {}), observation: obs[z.id] ?? null }));
  }, [baseZones, state.rankedTop, state.observations]);

  const coverage = useMemo(() => {
    const obs = state.observations ?? {};
    return Object.fromEntries(Object.entries(obs).map(([k, v]) => [k, v.coverage ?? 0]));
  }, [state.observations]);

  const allocation = state.allocation ?? null;
  const dispatchOrder = state.dispatchOrder ?? null;
  const trace = (state.reasoningTrace ?? []).flatMap((t) => t.trace ?? []);
  const started = events.length > 0;
  const finished = Boolean(dispatchOrder);

  return (
    <div className="space-y-4">
      {/* ---- Control bar --------------------------------------------- */}
      <Sheet raised active={running || Boolean(gate)}>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 px-3 py-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex flex-col leading-none">
              <span className="rail">Thread</span>
              <span className="font-[family-name:var(--font-mono)] text-[0.6875rem] text-[var(--ink-2)]">{threadId}</span>
            </span>
            <span className="h-7 w-px bg-[var(--rule)]" aria-hidden="true" />
            <StatusDot
              tone={error ? 'halt' : gate ? 'warn' : running ? 'live' : finished ? 'live' : 'idle'}
              pulse={running}
              label={
                error
                  ? 'Halted on error'
                  : gate
                    ? 'Awaiting signature'
                    : running
                      ? `Executing · ${NODE_LABELS[currentNode] ?? currentNode ?? ''}`
                      : finished
                        ? 'Order issued'
                        : 'Idle'
              }
            />
            <span className="ml-auto shrink-0">
              <Provenance
                kind={reasoningLive ? 'live' : 'fallback'}
                detail={
                  reasoningLive
                    ? 'Stage 4 is produced by the reasoning layer, which investigates zones and routes before recommending.'
                    : 'No reasoning credentials — stage 4 uses the deterministic rule engine.'
                }
              />
            </span>
          </div>
          <div className="flex items-center gap-2">
            {visionResult ? (
              <span className="rail" title="The pipeline will use the frame uploaded above instead of the incident model's imagery.">
                Using uploaded frame
              </span>
            ) : null}
            {started ? (
              <button type="button" className="btn" onClick={start} disabled={running}>
                <Icon name="rewind" size={12} />
                Restart
              </button>
            ) : null}
            <button type="button" className="btn" data-tone="primary" onClick={start} disabled={running}>
              <Icon name={running ? 'pause' : 'play'} size={12} />
              {running ? 'Executing' : started ? 'Run again' : 'Execute pipeline'}
            </button>
          </div>
        </div>

        <div className="border-t border-[var(--rule)] px-3 py-1.5">
          <StageRail currentNode={currentNode} done={visited} gateOpen={gate?.gate ?? null} />
        </div>
      </Sheet>

      {error ? (
        <Note tone="halt" icon="alert">
          {error}
        </Note>
      ) : null}

      {/* ---- The graph ----------------------------------------------- */}
      <Sheet>
        <SheetHead
          title="Execution graph"
          sub="LangGraph StateGraph · live execution"
          meta={`${visited.length}/${shape?.nodes?.length ?? 10} nodes executed`}
        />
        <div className="px-3 py-3">
          <GraphView
            shape={shape}
            currentNode={currentNode}
            visited={visited}
            takenEdges={taken}
            gateOpen={gate?.gate ?? null}
          />
        </div>
      </Sheet>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(21rem,26rem)]">
        <div className="min-w-0 space-y-4">
          {/* ---- Approval gate ---------------------------------------- */}
          {gate ? <ApprovalGate
            gate={gate}
            officer={officer}
            designation={designation}
            remark={remark}
            setOfficer={setOfficer}
            setDesignation={setDesignation}
            setRemark={setRemark}
            onDecide={decide}
          /> : null}

          {/* ---- Stage output ----------------------------------------- */}
          {!started ? (
            <Sheet>
              <SheetHead title="Stage output" />
              <Empty title="Not yet run" icon="node">
                Upload imagery above, then execute. Two approval gates require a named officer&rsquo;s signature before dispatch.
              </Empty>
            </Sheet>
          ) : null}

          {state.ranked || state.rankedTop ? (
            <Sheet>
              <SheetHead
                title="Zone priority"
                meta={`${state.rankedTop?.length ?? 0} shown of ${state.zonesCount ?? state.rankedCount ?? 100}`}
                action={
                  Object.keys(coverage).length ? (
                    <span className="rail">{Object.values(coverage).filter((c) => c >= 1).length} drone-verified</span>
                  ) : null
                }
              />
              <div className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div>
                  <ZoneGrid
                    zones={zones}
                    coverage={coverage}
                    drones={null}
                    routes={state.routes ?? null}
                  />
                </div>
                <div className="min-w-0">
                  <Register
                    columns={[
                      { key: 'z', label: 'Zone' },
                      { key: 'b', label: 'Band' },
                      { key: 'p', label: 'Persons', align: 'right' },
                      { key: 's', label: 'Sev.', align: 'right' },
                    ]}
                  >
                    {(state.rankedTop ?? []).slice(0, 12).map((z) => {
                      const obs = state.observations?.[z.id];
                      return (
                        <tr key={z.id} className="border-b border-[var(--rule-soft)]">
                          <Cell>
                            <span className="band-edge -ml-2.5 block pl-2.5" data-band={z.band}>
                              <span className="font-[family-name:var(--font-mono)] text-[0.75rem] font-semibold">
                                {z.id}
                              </span>
                              {z.settlement ? (
                                <span className="ml-1.5 text-[0.6875rem] text-[var(--ink-3)]">{z.settlement}</span>
                              ) : null}
                            </span>
                          </Cell>
                          <Cell>
                            <BandChip band={z.band} />
                          </Cell>
                          <Cell mono align="right">
                            {obs?.complete ? (
                              <span style={{ color: 'var(--seal)' }}>{obs.persons}</span>
                            ) : (
                              <span style={{ color: 'var(--warn)' }}>
                                {z.predicted ? `${z.predicted.low}–${z.predicted.high}` : '—'}
                              </span>
                            )}
                          </Cell>
                          <Cell mono align="right" className="!font-semibold">
                            {z.severity}
                          </Cell>
                        </tr>
                      );
                    })}
                  </Register>
                  <p className="mt-2 flex items-center gap-3 border-t border-rule pt-2">
                    <span className="rail" style={{ color: 'var(--seal)' }}>observed</span>
                    <span className="rail" style={{ color: 'var(--warn)' }}>predicted range</span>
                  </p>
                </div>
              </div>
              <div className="border-t border-[var(--rule)] px-3 py-2">
                <GridLegend compact />
              </div>
            </Sheet>
          ) : null}

          {allocation ? <AllocationSheet allocation={allocation} requirement={state.requirement} stamped={stamped} /> : null}

          {state.routes?.length ? <RoutesSheet routes={state.routes} /> : null}

          {dispatchOrder ? <DispatchSheet order={dispatchOrder} /> : null}
        </div>

        {/* ---- Trace column ------------------------------------------ */}
        <div className="min-w-0 space-y-4">
          <Sheet>
            <SheetHead title="Execution trace" meta={`${events.length} events`} />
            <div className="max-h-[22rem] overflow-y-auto">
              {events.length === 0 ? (
                <Empty title="No events yet" icon="node" />
              ) : (
                <ol className="divide-y divide-[var(--rule-soft)]">
                  {events
                    .filter((e) => e.type !== 'node:emit' || e.event)
                    .map((e, i) => (
                      <li key={i} className="flex items-start gap-2 px-3 py-1.5">
                        <span className="rail w-8 shrink-0 pt-[0.1rem]">{String(i + 1).padStart(3, '0')}</span>
                        <span className="min-w-0 flex-1">
                          <span
                            className="font-[family-name:var(--font-narrow)] text-[0.625rem] font-semibold uppercase tracking-[0.1em]"
                            style={{ color: eventTone(e.type) }}
                          >
                            {eventLabel(e)}
                          </span>
                          {eventDetail(e) ? (
                            <span className="mt-0.5 block break-words text-[0.6875rem] leading-[1.45] text-[var(--ink-3)]">
                              {eventDetail(e)}
                            </span>
                          ) : null}
                        </span>
                      </li>
                    ))}
                  <li ref={traceEnd} />
                </ol>
              )}
            </div>
            {running ? <Working label={NODE_LABELS[currentNode] ?? 'Executing'} /> : null}
          </Sheet>

          {trace.length ? <ReasoningSheet trace={trace} live={reasoningLive} /> : null}

          {state.notes?.length ? (
            <Sheet>
              <SheetHead title="System notes" />
              <ul className="divide-y divide-[var(--rule-soft)]">
                {state.notes.map((n, i) => (
                  <li key={i} className="px-3 py-1.5 text-[0.6875rem] leading-[1.5] text-[var(--ink-2)]">
                    {n}
                  </li>
                ))}
              </ul>
            </Sheet>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Approval gate                                                       */
/* ------------------------------------------------------------------ */

function ApprovalGate({ gate, officer, designation, remark, setOfficer, setDesignation, setRemark, onDecide }) {
  const named = officer.trim().length > 2;

  return (
    <Sheet raised active className="border-[var(--stamp)]">
      <div className="flex flex-wrap items-baseline gap-3 border-b-2 border-[var(--stamp)] px-3 py-2">
        <span
          className="flex h-6 w-6 items-center justify-center border-2"
          style={{ borderColor: 'var(--stamp)', color: 'var(--stamp)' }}
        >
          <Icon name="stamp" size={12} />
        </span>
        <h2 className="font-[family-name:var(--font-narrow)] text-[0.875rem] font-bold uppercase tracking-[0.12em] text-[var(--ink)]">
          {gate.title}
        </h2>
        <span className="rail">Gate {gate.gate} of 2</span>
        <span className="ml-auto rail">{gate.requires}</span>
      </div>

      <div className="border-b border-[var(--rule)] px-3 py-2.5">
        <p className="max-w-[74ch] text-[0.8125rem] leading-[1.55] text-[var(--ink)]">{gate.summary}</p>
      </div>

      {gate.gate === 1 && gate.allocation?.tradeoffs?.length ? (
        <div className="border-b border-[var(--rule)] px-3 py-2.5">
          <h3 className="field-label">What this plan gives up</h3>
          <ul className="mt-1.5 space-y-1.5">
            {gate.allocation.tradeoffs.map((t, i) => (
              <li key={i} className="flex items-start gap-2 text-[0.75rem] leading-[1.5]">
                <span
                  aria-hidden="true"
                  className="mt-[0.4rem] block shrink-0"
                  style={{ width: 5, height: 5, background: 'var(--tape)' }}
                />
                <span>
                  <span className="font-[family-name:var(--font-mono)] font-semibold text-[var(--ink)]">
                    {t.zone_id}
                  </span>{' '}
                  <span className="text-[var(--ink-2)]">
                    — withheld {t.withheld}. {t.consequence}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {gate.gate === 1 && gate.allocation?.unverifiedRisk ? (
        <div className="px-3 py-2">
          <Note tone="warn" icon="alert">
            {gate.allocation.unverifiedRisk}
          </Note>
        </div>
      ) : null}

      {/* Signature block — the noting sheet's foot */}
      <div className="grid gap-3 border-t border-[var(--rule)] px-3 py-3 sm:grid-cols-2">
        <label className="block">
          <span className="field-label">Approving officer</span>
          <input
            className="input mt-1"
            value={officer}
            onChange={(e) => setOfficer(e.target.value)}
            placeholder="Full name"
            autoComplete="off"
          />
        </label>
        <label className="block">
          <span className="field-label">Designation</span>
          <input
            className="input mt-1"
            value={designation}
            onChange={(e) => setDesignation(e.target.value)}
            placeholder="e.g. District Magistrate"
            autoComplete="off"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="field-label">Remark {gate.gate === 1 ? '(required to return for revision)' : '(optional)'}</span>
          <input
            className="input mt-1"
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            placeholder="Reason, condition, or instruction for the revision"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--rule)] px-3 py-3">
        <StampButton
          label="Hold to approve"
          disabled={!named}
          onComplete={() => onDecide('approve')}
          hint={named ? 'Press and hold' : 'Enter the approving officer’s name first'}
        />
        <button
          type="button"
          className="btn"
          onClick={() => onDecide('revise')}
          disabled={!named || !remark.trim()}
          title={!remark.trim() ? 'A remark is required so the revision has an instruction to work to' : undefined}
        >
          <Icon name="rewind" size={12} />
          Return for revision
        </button>
        <button type="button" className="btn" data-tone="danger" onClick={() => onDecide('reject')} disabled={!named}>
          <Icon name="cross" size={12} />
          Reject
        </button>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Result sheets                                                       */
/* ------------------------------------------------------------------ */

function AllocationSheet({ allocation, requirement, stamped }) {
  const reasoned = allocation.strategy === 'reasoned';
  return (
    <Sheet>
      <SheetHead
        title="Resource recommendation"
        meta={allocation.label}
        action={<Provenance kind={reasoned ? 'live' : 'fallback'} detail={allocation.rationale} />}
      />

      <div className="relative border-b border-[var(--rule)] px-3 py-2.5">
        <p className="max-w-[74ch] text-[0.875rem] font-medium leading-[1.5] text-[var(--ink)]">{allocation.headline}</p>
        {allocation.narrative ? (
          <p className="mt-2 max-w-[74ch] whitespace-pre-wrap text-[0.75rem] leading-[1.6] text-[var(--ink-2)]">
            {allocation.narrative}
          </p>
        ) : null}

        {stamped[1] === 'approve' ? (
          <span className="pointer-events-none absolute right-4 top-2">
            <span className="stamp" data-land="true">
              <span className="text-[0.625rem] font-bold">Approved</span>
              <span className="text-[0.5rem] tracking-[0.14em]">Gate 1</span>
            </span>
          </span>
        ) : null}
      </div>

      {requirement?.constrained?.length ? (
        <div className="border-b border-[var(--rule)] px-3 py-2">
          <Note tone="halt" icon="scales">
            Demand exceeds district stock on {requirement.constrained.join(', ')}. This allocation is a choice about
            whose rescue is delayed, not an arithmetic result.
          </Note>
        </div>
      ) : null}

      <Register
        columns={[
          { key: 'sl', label: 'Sl.', width: '2.6rem' },
          { key: 'w', label: 'Wave', width: '3rem' },
          { key: 'z', label: 'Zone' },
          { key: 'need', label: 'Required' },
          { key: 'got', label: 'Issued' },
          { key: 'cov', label: 'Met', align: 'right', width: '5rem' },
        ]}
      >
        {allocation.allocations.map((a, i) => (
          <tr key={a.zoneId} className="border-b border-[var(--rule-soft)] align-top">
            <Cell mono className="rail !text-[0.625rem]">
              {String(i + 1).padStart(3, '0')}
            </Cell>
            <Cell mono>
              <span className="rail">W{a.wave}</span>
            </Cell>
            <Cell>
              <span className="block font-[family-name:var(--font-mono)] text-[0.75rem] font-semibold">{a.zoneId}</span>
              {a.settlement ? <span className="text-[0.6875rem] text-[var(--ink-3)]">{a.settlement}</span> : null}
              {a.reason ? (
                <span className="mt-0.5 block max-w-[34ch] text-[0.6875rem] leading-[1.45] text-[var(--ink-3)]">
                  {a.reason}
                </span>
              ) : null}
            </Cell>
            <Cell mono>
              <Kit kit={a.need} muted />
            </Cell>
            <Cell mono>
              <Kit kit={a.allocated} />
            </Cell>
            <Cell align="right" mono>
              <span
                className="text-[0.8125rem] font-semibold"
                style={{
                  color: a.coverage >= 1 ? 'var(--seal)' : a.coverage >= 0.5 ? 'var(--warn)' : 'var(--halt)',
                }}
              >
                {Math.round((a.coverage ?? 0) * 100)}%
              </span>
            </Cell>
          </tr>
        ))}
      </Register>

      {allocation.escalation ? (
        <div className="border-t border-[var(--rule)] px-3 py-2">
          <Field label="Escalation" value={allocation.escalation} mono={false} />
        </div>
      ) : null}
    </Sheet>
  );
}

function Kit({ kit, muted }) {
  const items = [
    ['boat', kit.boats],
    ['team', kit.teams],
    ['ambulance', kit.ambulances],
  ].filter(([, n]) => n > 0);
  if (!items.length) return <span className="rail">—</span>;
  return (
    <span className="flex flex-wrap items-center gap-2">
      {items.map(([icon, n]) => (
        <span key={icon} className="inline-flex items-center gap-1" style={{ color: muted ? 'var(--ink-3)' : 'var(--ink)' }}>
          <Icon name={icon} size={11} />
          <span className="text-[0.75rem] tabular-nums">{n}</span>
        </span>
      ))}
    </span>
  );
}

function RoutesSheet({ routes }) {
  const craftShort = routes.filter((r) => r.craftShortfall);
  const unreachable = routes.filter((r) => !r.route.reachable && !r.craftShortfall);
  return (
    <Sheet>
      <SheetHead
        title="Safe routes"
        sub="Dijkstra · impassable links removed, not penalised"
        meta={`${routes.length} movements`}
      />
      {craftShort.length ? (
        <div className="border-b border-[var(--rule)] px-3 py-2">
          <Note tone="halt" icon="boat">
            {craftShort.map((r) => r.zoneId).join(', ')} {craftShort.length === 1 ? 'is' : 'are'} inundated but received
            no rescue craft. The constraint here is the boat shortfall, not the road network — wheeled units cannot
            enter standing water, so this allocation cannot be executed as it stands. Reassign craft, or raise a state
            request.
          </Note>
        </div>
      ) : null}
      {unreachable.length ? (
        <div className="border-b border-[var(--rule)] px-3 py-2">
          <Note tone="halt" icon="route">
            {unreachable.length} allocation{unreachable.length === 1 ? '' : 's'} have no surface route at current stage —{' '}
            {unreachable.map((r) => r.zoneId).join(', ')}. These need aerial insertion.
          </Note>
        </div>
      ) : null}
      <Register
        columns={[
          { key: 'z', label: 'To' },
          { key: 'from', label: 'From depot' },
          { key: 'mode', label: 'Mode' },
          { key: 'eta', label: 'ETA', align: 'right' },
          { key: 'avoid', label: 'Avoided' },
        ]}
      >
        {routes.map((r) => (
          /* A register hatches out an entry it cannot execute. */
          <tr
            key={`${r.depot}-${r.zoneId}`}
            className={`border-b border-[var(--rule-soft)] align-top ${
              r.craftShortfall || !r.route.reachable ? 'hatch' : ''
            }`}
          >
            <Cell mono className="!font-semibold">{r.zoneId}</Cell>
            <Cell>
              <span className="text-[0.6875rem] text-[var(--ink-2)]">{r.depotName}</span>
            </Cell>
            <Cell>
              <span className="inline-flex items-center gap-1 text-[0.6875rem]">
                <Icon name={r.mode === 'boat' ? 'boat' : 'ambulance'} size={11} />
                {r.mode}
              </span>
            </Cell>
            <Cell mono align="right">
              {r.onSite ? (
                <span style={{ color: 'var(--seal)' }}>on site</span>
              ) : r.route.reachable ? (
                <span>
                  {r.route.minutes}′ <span className="text-[var(--ink-3)]">/ {r.route.distanceKm} km</span>
                </span>
              ) : (
                <span style={{ color: 'var(--halt)' }}>no route</span>
              )}
            </Cell>
            <Cell>
              <span className="block max-w-[26ch] text-[0.625rem] leading-[1.4] text-[var(--ink-3)]">
                {r.onSite
                  ? 'Staged in this zone'
                  : r.route.blockedEdges?.length
                    ? r.route.blockedEdges.map((b) => b.reason).join('; ')
                    : '—'}
              </span>
            </Cell>
          </tr>
        ))}
      </Register>
    </Sheet>
  );
}

function DispatchSheet({ order }) {
  const [lang, setLang] = useState('en');
  const [copied, setCopied] = useState(null);

  return (
    <Sheet raised>
      <SheetHead
        title="Dispatch order"
        meta={order.fileNo}
        action={
          <span className="flex items-center gap-1">
            {['en', 'hi'].map((l) => (
              <button
                key={l}
                type="button"
                className="btn !px-2 !py-1"
                data-tone={lang === l ? 'primary' : undefined}
                onClick={() => setLang(l)}
              >
                {l === 'en' ? 'English' : 'हिन्दी'}
              </button>
            ))}
          </span>
        }
      />

      {/* Both signatures, side by side, the way a file's approval block reads */}
      <div className="grid gap-0 border-b border-[var(--rule)] sm:grid-cols-2">
        {[order.approvedBy.gate1, order.approvedBy.gate2].map((a, i) => (
          <div
            key={i}
            className={`px-3 py-2.5 ${i === 0 ? 'border-b border-[var(--rule)] sm:border-b-0 sm:border-r' : ''}`}
          >
            <span className="field-label">Gate {i + 1} — {i === 0 ? 'resources' : 'dispatch'}</span>
            {a ? (
              <>
                <p className="mt-1 text-[0.8125rem] font-semibold text-[var(--ink)]">{a.officer}</p>
                <p className="text-[0.6875rem] text-[var(--ink-3)]">{a.designation}</p>
                <p className="mt-1 font-[family-name:var(--font-mono)] text-[0.625rem] text-[var(--ink-3)]">
                  {a.ref} · {new Date(a.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })}
                </p>
              </>
            ) : (
              <p className="mt-1 rail">Not recorded</p>
            )}
          </div>
        ))}
      </div>

      <div className="px-3 py-2">
        <Note tone="sim" icon="radio">
          {order.delivery}
        </Note>
      </div>

      <ol className="divide-y divide-[var(--rule)]">
        {order.orders.map((o) => (
          <li key={o.orderNo} className="px-3 py-3">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-[family-name:var(--font-mono)] text-[0.625rem] text-[var(--ink-3)]">{o.orderNo}</span>
              <span className="font-[family-name:var(--font-mono)] text-[0.8125rem] font-semibold text-[var(--ink)]">
                {o.zoneId}
              </span>
              {o.settlement ? <span className="text-[0.75rem] text-[var(--ink-2)]">{o.settlement}</span> : null}
              <span className="rail">wave {o.wave}</span>
              <span className="ml-auto flex items-center gap-2">
                {o.channels.map((c) => (
                  <span key={c} className="rail">
                    {c}
                  </span>
                ))}
                <button
                  type="button"
                  className="btn !px-1.5 !py-1"
                  onClick={() => {
                    navigator.clipboard?.writeText(o.text[lang]);
                    setCopied(o.orderNo);
                    setTimeout(() => setCopied(null), 1600);
                  }}
                  title="Copy this instruction"
                >
                  <Icon name={copied === o.orderNo ? 'check' : 'copy'} size={11} />
                  {copied === o.orderNo ? 'Copied' : 'Copy'}
                </button>
              </span>
            </div>
            <pre
              className={`mt-2 overflow-x-auto whitespace-pre-wrap border-l px-3 py-2 text-[0.75rem] leading-[1.6] ${
                lang === 'hi' ? 'deva' : 'font-[family-name:var(--font-mono)]'
              }`}
              style={{ borderLeftColor: 'var(--seal)', color: 'var(--ink-2)' }}
            >
              {o.text[lang]}
            </pre>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

function ReasoningSheet({ trace, live }) {
  return (
    <Sheet>
      <SheetHead
        title="Reasoning trace"
        meta={`${trace.filter((t) => t.kind === 'tool').length} tool calls`}
        action={<Provenance kind={live ? 'live' : 'fallback'} />}
      />
      <ol className="max-h-[24rem] divide-y divide-[var(--rule-soft)] overflow-y-auto">
        {trace.map((t, i) => (
          <li key={i} className="px-3 py-2">
            <span
              className="font-[family-name:var(--font-narrow)] text-[0.5625rem] font-semibold uppercase tracking-[0.12em]"
              style={{
                color:
                  t.kind === 'tool'
                    ? 'var(--sev-monitor)'
                    : t.kind === 'plan'
                      ? 'var(--stamp)'
                      : t.kind === 'fallback'
                        ? 'var(--warn)'
                        : 'var(--ink-3)',
              }}
            >
              {t.kind === 'tool' ? `Tool · ${t.name}` : t.kind}
            </span>
            {t.kind === 'tool' ? (
              <>
                <p className="mt-0.5 font-[family-name:var(--font-mono)] text-[0.625rem] text-[var(--ink-3)]">
                  {JSON.stringify(t.input)}
                </p>
                <pre className="mt-1 max-h-24 overflow-y-auto whitespace-pre-wrap text-[0.625rem] leading-[1.45] text-[var(--ink-2)]">
                  {t.output}
                </pre>
              </>
            ) : (
              <p className="mt-0.5 whitespace-pre-wrap text-[0.6875rem] leading-[1.5] text-[var(--ink-2)]">
                {t.text ?? t.detail ?? t.headline}
              </p>
            )}
          </li>
        ))}
      </ol>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

function mergeUpdate(state, update) {
  const next = { ...state };
  for (const [k, v] of Object.entries(update)) {
    if (k === 'notes' || k === 'reasoningTrace' || k === 'approvals' || k === 'sorties') {
      next[k] = [...(state[k] ?? []), ...(Array.isArray(v) ? v : [v])];
    } else if (k === 'observations') {
      next[k] = { ...(state[k] ?? {}), ...v };
    } else {
      next[k] = v;
    }
  }
  return next;
}

function eventTone(type) {
  if (type === 'interrupt') return 'var(--stamp)';
  if (type === 'error') return 'var(--halt)';
  if (type === 'end') return 'var(--seal)';
  if (type === 'node:emit') return 'var(--sev-monitor)';
  return 'var(--ink-3)';
}

/** Marks are drawn, not typed — the icon set carries these exact three. */
function eventLabel(e) {
  const mark = (name, text) => (
    <span className="inline-flex items-center gap-1">
      <Icon name={name} size={9} />
      {text}
    </span>
  );

  switch (e.type) {
    case 'start':
      return 'Run opened';
    case 'resume':
      return `Resumed · ${e.value?.action ?? ''}`;
    case 'node:start':
      return mark('chevron', NODE_LABELS[e.node] ?? e.node);
    case 'node:end':
      return mark('check', NODE_LABELS[e.node] ?? e.node);
    case 'node:emit':
      return `· ${e.event?.kind ?? 'event'}`;
    case 'interrupt':
      return mark('stamp', `HALTED — ${e.payload?.title ?? 'approval required'}`);
    case 'end':
      return 'Run complete';
    case 'error':
      return 'Error';
    default:
      return e.type;
  }
}

function eventDetail(e) {
  if (e.type === 'node:emit') {
    const ev = e.event ?? {};
    const { kind, ...rest } = ev;
    return Object.entries(rest)
      .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : typeof v === 'object' ? JSON.stringify(v) : v}`)
      .join(' · ');
  }
  if (e.type === 'error') return e.error;
  if (e.type === 'interrupt') return 'The executor is checkpointed. Nothing proceeds without a signature.';
  return null;
}
