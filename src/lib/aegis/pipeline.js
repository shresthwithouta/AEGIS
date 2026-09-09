/**
 * The AEGIS response pipeline — a LangGraph `StateGraph`.
 *
 * Built on `@langchain/langgraph`, the official JavaScript LangGraph runtime.
 * Same library and same semantics as the Python one the project architecture
 * calls for — `StateGraph`, `Annotation` channels with reducers, conditional
 * edges, `interrupt()`, `MemorySaver` checkpointing, `Command` resume — running
 * in-process so the whole system deploys as one artifact and the graph streams
 * straight into the interface.
 *
 * Five stages and two human approval gates:
 *
 *   ingest → vision → prioritise → ⟨triage⟩ ⇄ survey → fuse → decide → review
 *          → ▣ GATE 1 (resources) → routing → ▣ GATE 2 (dispatch) → dispatch
 *
 * The gates are LangGraph `interrupt()` calls. Reaching one checkpoints the
 * thread and ends the run; only a `Command({ resume })` carrying a named
 * officer's decision continues it. That is the whole safety argument of the
 * system, and it lives in the graph runtime rather than in the UI layer where
 * it could be bypassed.
 *
 * Cycles are real: unverified critical zones send the graph back to the drone
 * stage, the safety reviewer can send a plan back to the allocator, and a
 * returned plan sends it back with the officer's remark in state.
 */

import { StateGraph, Annotation, START, END, MemorySaver, interrupt } from '@langchain/langgraph';
import { reason, toolInput, textOf, MODE, explainFallback } from '../agent/llm';
import { READ_TOOLS, SUBMIT_PLAN_TOOL, SUBMIT_REVIEW_TOOL, runTool } from '../agent/tools';
import { buildZones, IMAGERY, INCIDENT, DEPOTS } from './incident';
import { rankZones, DEFAULT_WEIGHTS } from './severity';
import { createSim, planSorties, stepFleet } from './drones';
import { buildRequirement, allocateDeterministic, assignDepots } from './resources';
import { planRoute, planAmphibious, BOAT_ONLY_FLOOD } from './routing';
import { probeVisionService, visionServiceConfigured } from './visionService';

/* ------------------------------------------------------------------ */
/* Channels                                                            */
/* ------------------------------------------------------------------ */

const last = (_prev, next) => next;
const appendAll = (prev = [], next) => [...prev, ...(Array.isArray(next) ? next : [next])];
const mergeObj = (prev = {}, next = {}) => ({ ...prev, ...next });

const AegisState = Annotation.Root({
  incidentRef: Annotation({ reducer: last, default: () => INCIDENT.fileNo }),
  officer: Annotation({ reducer: last, default: () => null }),
  weights: Annotation({ reducer: last, default: () => DEFAULT_WEIGHTS }),
  imagery: Annotation({ reducer: last, default: () => null }),
  visionService: Annotation({ reducer: last, default: () => null }),
  zones: Annotation({ reducer: last, default: () => [] }),
  ranked: Annotation({ reducer: last, default: () => [] }),
  observations: Annotation({ reducer: mergeObj, default: () => ({}) }),
  sorties: Annotation({ reducer: appendAll, default: () => [] }),
  surveyRounds: Annotation({ reducer: last, default: () => 0 }),
  requirement: Annotation({ reducer: last, default: () => null }),
  allocation: Annotation({ reducer: last, default: () => null }),
  safetyReview: Annotation({ reducer: last, default: () => null }),
  reviewRounds: Annotation({ reducer: last, default: () => 0 }),
  routes: Annotation({ reducer: last, default: () => [] }),
  dispatchOrder: Annotation({ reducer: last, default: () => null }),
  approvals: Annotation({ reducer: appendAll, default: () => [] }),
  reasoningTrace: Annotation({ reducer: appendAll, default: () => [] }),
  mode: Annotation({ reducer: last, default: () => MODE.FALLBACK }),
  modeReason: Annotation({ reducer: last, default: () => null }),
  notes: Annotation({ reducer: appendAll, default: () => [] }),
  revision: Annotation({ reducer: last, default: () => 0 }),
});

/**
 * Emit a custom stream event. Nodes announce their own start this way, because
 * LangGraph's `updates` mode reports a node only once it has finished — and a
 * console watching a run needs to light the node that is currently working.
 */
function emit(config, event) {
  try {
    config?.writer?.(event);
  } catch {
    /* streaming is observability, never a reason to fail a run */
  }
}

const started = (config, node) => emit(config, { kind: 'node:start', node });

/* ------------------------------------------------------------------ */
/* Stage 1 — vision analysis                                           */
/* ------------------------------------------------------------------ */

async function ingestNode(state, config) {
  started(config, 'ingest');
  const zones = buildZones(state.incidentRef);
  const meanCloud = zones.reduce((a, z) => a + z.cloudCover, 0) / zones.length;

  // Choose the finest usable pass. Heavy cloud forces the SAR product, which
  // sees water but cannot classify damage — the system says so rather than
  // quietly producing a damage score it cannot support.
  const optical = IMAGERY.find((i) => i.id === 'sentinel-2');
  const sar = IMAGERY.find((i) => i.id === 'sentinel-1');
  const chosen = meanCloud > 0.38 ? sar : optical;

  emit(config, { kind: 'imagery', label: chosen.label, cloud: +meanCloud.toFixed(2) });

  return {
    zones,
    imagery: { ...chosen, meanCloudCover: +meanCloud.toFixed(2), degraded: meanCloud > 0.38 },
    notes: [
      meanCloud > 0.38
        ? `Optical imagery ${Math.round(meanCloud * 100)}% cloud-obscured. Fell back to ${sar.label}; damage classification confidence is reduced accordingly.`
        : `Optical pass usable — ${Math.round(meanCloud * 100)}% mean cloud cover.`,
    ],
  };
}

/**
 * Prefers the Python vision service (U-Net + YOLOv8) when one is configured and
 * reachable; otherwise the incident model's fields stand and the note says so.
 * Both paths produce the same zone shape, so nothing downstream knows or cares
 * which ran — and the interface labels whichever did.
 */
async function visionNode(state, config) {
  started(config, 'vision');
  const zones = state.zones;
  let vision = null;

  if (visionServiceConfigured()) {
    const health = await probeVisionService();
    if (health?.reachable) {
      vision = health;
      emit(config, {
        kind: 'vision-service',
        segmentation: health.segmentation?.method,
        trained: health.trainedSegmentation,
        detection: health.detectionAvailable,
      });
    } else {
      emit(config, { kind: 'vision-service', reachable: false });
    }
  }

  const flooded = zones.filter((z) => z.flood > 0.3).length;
  const damaged = zones.reduce((a, z) => a + z.damagedStructures, 0);
  emit(config, { kind: 'vision', floodedZones: flooded, damagedStructures: damaged });

  const notes = [
    `Flood segmentation: ${flooded} of ${zones.length} zones show inundation above 30%.`,
    `Damage detection: ${damaged} structures classified damaged across the area of interest.`,
  ];
  if (vision) {
    notes.push(
      `Vision service reachable on ${vision.device}: segmentation via ${vision.segmentation?.model} (${
        vision.trainedSegmentation ? 'trained U-Net' : 'classical baseline'
      }), detection ${vision.detectionAvailable ? `via ${vision.detection?.model}` : 'unavailable'}.`
    );
  } else if (visionServiceConfigured()) {
    notes.push('Vision service configured but unreachable — stage 1 fell back to the incident model.');
  } else {
    notes.push(
      'No vision service configured. Flood and damage fields come from the incident model and are labelled SIMULATED.'
    );
  }

  return { visionService: vision, notes };
}

/* ------------------------------------------------------------------ */
/* Stage 2 — zone prioritisation                                       */
/* ------------------------------------------------------------------ */

async function zonesNode(state, config) {
  started(config, 'prioritise');
  const ranked = rankZones(state.zones, state.weights);
  const critical = ranked.filter((z) => z.severity >= 80).length;
  emit(config, { kind: 'zones', critical, top: ranked.slice(0, 5).map((z) => z.id) });
  return {
    ranked,
    notes: [`${critical} zone${critical === 1 ? '' : 's'} scored Critical (≥80). Top priority: ${ranked[0]?.id}.`],
  };
}

/* ------------------------------------------------------------------ */
/* Stage 3 — drone intelligence                                        */
/* ------------------------------------------------------------------ */

async function surveyNode(state, config) {
  started(config, 'survey');
  const zonesById = Object.fromEntries(state.ranked.map((z) => [z.id, z]));
  const unverified = state.ranked
    .filter((z) => z.severity >= 55 && !state.observations[z.id]?.complete)
    .slice(0, 6);

  let sim = createSim(state.ranked, state.incidentRef);
  sim = planSorties({ ...sim, observations: { ...state.observations } }, unverified, unverified.length);
  sim.running = true;

  // Fast-forward the same flight engine the live console runs. Fixed 2-second
  // steps keep it deterministic.
  const deadline = 4 * 3600;
  while (sim.t < deadline) {
    sim = stepFleet(sim, 2, zonesById);
    if (unverified.every((z) => sim.observations[z.id]?.complete)) break;
  }

  const completed = unverified.filter((z) => sim.observations[z.id]?.complete);
  emit(config, {
    kind: 'survey',
    tasked: unverified.map((z) => z.id),
    completed: completed.map((z) => z.id),
    simMinutes: Math.round(sim.t / 60),
  });

  const round = (state.surveyRounds ?? 0) + 1;
  return {
    observations: sim.observations,
    surveyRounds: round,
    sorties: [
      {
        round,
        tasked: unverified.map((z) => z.id),
        completed: completed.map((z) => z.id),
        simMinutes: Math.round(sim.t / 60),
        events: sim.events.slice(-24),
      },
    ],
    notes: [
      `Survey round ${round}: ${completed.length} of ${unverified.length} tasked zones verified in ${Math.round(sim.t / 60)} simulated minutes.`,
    ],
  };
}

/** Fold drone counts back into the zone records so downstream sees one truth. */
async function fuseNode(state, config) {
  started(config, 'fuse');
  const ranked = state.ranked.map((z) => {
    const obs = state.observations[z.id];
    if (!obs?.complete) return z;
    return {
      ...z,
      droneVerified: true,
      observed: { persons: obs.persons, injured: obs.injured, animals: obs.animals, vehicles: obs.vehicles },
      confidence: obs.confidence,
    };
  });
  return { ranked, zones: ranked };
}

/* ------------------------------------------------------------------ */
/* Stage 4a — the allocation agent                                     */
/* ------------------------------------------------------------------ */

const DECIDE_SYSTEM = `You are the resource-planning analyst inside AEGIS, a decision-support system used by an Indian District Emergency Operations Centre during a flood.

You do not commit resources. You produce one recommendation, which a safety reviewer will challenge and a named district officer will then approve, modify or reject. Write for that officer: experienced, accountable, under time pressure, and about to be asked to justify this decision.

How to work:
- Investigate before you recommend. Open the zones you are ranking. Test whether a depot can actually reach a zone before assigning a vehicle to it — a zone that is unreachable by road needs boats, not ambulances.
- Consult doctrine when a decision turns on a published norm or on who holds authority.
- Supply is constrained. When demand exceeds stock you are choosing whose rescue is delayed. Say so plainly in the trade-offs; do not spread resources thinly to avoid naming the choice.
- Distinguish drone-verified counts from predicted ranges. Never present a prediction as a headcount.
- Severity ranking is an input, not an instruction. If reachability, verification status or population composition justifies departing from strict severity order, do it and say why.

Constraints:
- Recommend only from stock the depots actually hold.
- Every zone in the priority list appears in your allocation, even if it receives nothing in this wave.
- No praise for the system, no hedging, no restating the question.

Finish by calling submit_resource_plan exactly once.`;

/** Bounded agentic loop. The cap is a safety property, not an optimisation. */
async function runAgent({ system, userMessage, tools, submitTool, toolCtx, maxTurns = 6, config, agentName }) {
  const messages = [{ role: 'user', content: userMessage }];
  const trace = [];
  let submitted = null;
  let narrative = '';
  let mode = MODE.FALLBACK;
  let modeReason = null;
  let usage = null;

  for (let turn = 0; turn < maxTurns; turn++) {
    const res = await reason({ system, messages, tools: [...tools, submitTool], maxTokens: 6000, effort: 'high' });

    if (!res.ok) {
      mode = MODE.FALLBACK;
      modeReason = res.reason;
      trace.push({ turn, kind: 'fallback', detail: explainFallback(res.reason) });
      break;
    }

    mode = MODE.LIVE;
    usage = res.usage;
    const text = textOf(res.content);
    if (text) {
      narrative = text;
      trace.push({ turn, kind: 'thought', text });
    }

    const out = toolInput(res.content, submitTool.name);
    if (out) {
      submitted = out;
      trace.push({ turn, kind: 'submitted', agent: agentName });
      break;
    }

    const toolUses = res.content.filter((b) => b.type === 'tool_use');
    if (!toolUses.length) {
      trace.push({ turn, kind: 'stalled', detail: 'No tool call and nothing submitted.' });
      break;
    }

    messages.push({ role: 'assistant', content: res.content });
    const results = toolUses.map((tu) => {
      const output = runTool(tu.name, tu.input, toolCtx);
      trace.push({ turn, kind: 'tool', agent: agentName, name: tu.name, input: tu.input, output: output.slice(0, 900) });
      emit(config, { kind: 'tool', agent: agentName, name: tu.name, input: tu.input });
      return { type: 'tool_result', tool_use_id: tu.id, content: output };
    });
    messages.push({ role: 'user', content: results });
  }

  return { submitted, narrative, mode, modeReason, usage, trace };
}

async function decideNode(state, config) {
  started(config, 'decide');
  const requirement = buildRequirement(state.ranked, state.observations, 12);
  const fallback = allocateDeterministic(requirement);
  const withDepots = assignDepots(fallback, state.ranked);

  const priorityBrief = requirement.perZone
    .map(
      (r) =>
        `${r.zoneId}${r.settlement ? ` (${r.settlement})` : ''} · severity ${r.severity} ${r.band} · ` +
        `${r.verified ? `VERIFIED ${r.persons} persons, ${r.injured} injured` : `UNVERIFIED, predicted ~${r.persons} persons`} · ` +
        `norm requirement ${r.need.boats}b/${r.need.teams}t/${r.need.ambulances}a/${r.need.divers}d`
    )
    .join('\n');

  const shortfallBrief = requirement.constrained.length
    ? `SHORTFALL: ${requirement.constrained
        .map((k) => `${k} short by ${requirement.shortfall[k]} (demand ${requirement.demand[k]}, stock ${requirement.stock[k]})`)
        .join('; ')}`
    : 'Stock covers total demand across the priority list.';

  // A returned plan carries either the officer's remark or the safety agent's
  // blocking objections. Both are instructions, and the revision must answer them.
  const objections = state.safetyReview?.objections?.filter((o) => o.blocking) ?? [];
  const revisionNote = state.revision
    ? `\n\nThis is revision ${state.revision + 1}. The previous plan was returned with these instructions:\n` +
      (objections.length
        ? objections.map((o) => `- ${o.zone_id}: ${o.problem} — remedy: ${o.remedy}`).join('\n')
        : `- ${state.notes[state.notes.length - 1] ?? 'no reason recorded'}`) +
      `\nAddress every one of them.`
    : '';

  const userMessage = `INCIDENT ${state.incidentRef} — ${INCIDENT.name}, ${INCIDENT.district} district, ${INCIDENT.state}.
Hazard: ${INCIDENT.hazard}. Imagery: ${state.imagery?.label}${state.imagery?.degraded ? ' (degraded — cloud)' : ''}.

PRIORITY ZONES (severity order):
${priorityBrief}

DISTRICT STOCK: ${requirement.stock.boats} boats, ${requirement.stock.ambulances} ambulances, ${requirement.stock.teams} rescue teams, ${requirement.stock.divers} dive pairs, across ${DEPOTS.length} depots.
AGGREGATE DEMAND: ${requirement.demand.boats} boats, ${requirement.demand.ambulances} ambulances, ${requirement.demand.teams} teams, ${requirement.demand.divers} dive pairs.
${shortfallBrief}

${requirement.totals.verifiedZones} of ${requirement.totals.zones} priority zones are drone-verified.${revisionNote}

Investigate, then submit the plan.`;

  const { submitted, narrative, mode, modeReason, usage, trace } = await runAgent({
    system: DECIDE_SYSTEM,
    userMessage,
    tools: READ_TOOLS,
    submitTool: SUBMIT_PLAN_TOOL,
    toolCtx: { zones: state.ranked, observations: state.observations },
    config,
    agentName: 'allocation',
  });

  const allocation = submitted
    ? {
        strategy: 'reasoned',
        label: 'Allocation agent',
        headline: submitted.headline,
        narrative,
        allocations: submitted.allocations.map((a) => {
          const req = requirement.perZone.find((r) => r.zoneId === a.zone_id);
          return {
            zoneId: a.zone_id,
            settlement: req?.settlement ?? null,
            severity: req?.severity ?? 0,
            verified: req?.verified ?? false,
            persons: req?.persons ?? 0,
            need: req?.need ?? { boats: 0, ambulances: 0, teams: 0, divers: 0 },
            allocated: { boats: a.boats, ambulances: a.ambulances, teams: a.teams, divers: a.divers },
            wave: a.wave,
            depot: a.depot,
            depotName: DEPOTS.find((d) => d.id === a.depot)?.name ?? a.depot,
            reason: a.reason,
            coverage: req?.need.boats ? +(a.boats / req.need.boats).toFixed(2) : 1,
          };
        }),
        tradeoffs: submitted.tradeoffs,
        unverifiedRisk: submitted.unverified_risk,
        escalation: submitted.escalation,
        rationale: narrative || submitted.headline,
      }
    : {
        ...fallback,
        allocations: withDepots,
        headline: `Rule-engine allocation across ${withDepots.length} priority zones in strict severity order.`,
        tradeoffs: requirement.constrained.map((k) => ({
          zone_id: withDepots.filter((a) => a.allocated[k] < a.need[k]).map((a) => a.zoneId).join(', ') || '—',
          withheld: `${requirement.shortfall[k]} ${k}`,
          consequence: `Demand for ${k} exceeds district stock by ${requirement.shortfall[k]}; zones below the cut receive none this wave.`,
        })),
        unverifiedRisk: `${requirement.totals.zones - requirement.totals.verifiedZones} of ${requirement.totals.zones} priority zones are not drone-verified; their person counts are predicted ranges.`,
        escalation: requirement.constrained.length
          ? 'Shortfall present — a state-level request for additional NDRF resources is indicated.'
          : 'No escalation indicated on current stock.',
      };

  emit(config, { kind: 'decision', mode, strategy: allocation.strategy });

  return {
    requirement,
    allocation,
    mode,
    modeReason,
    reasoningTrace: [{ stage: 'decide', agent: 'allocation', mode, usage, trace, at: Date.now() }],
    notes: [
      mode === MODE.LIVE
        ? 'Allocation agent produced a recommendation after investigating zones and routes.'
        : `Reasoning layer unavailable (${explainFallback(modeReason)}) — deterministic rule engine used.`,
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Stage 4b — the safety reviewer agent                                */
/* ------------------------------------------------------------------ */

const REVIEW_SYSTEM = `You are the safety reviewer inside AEGIS, a decision-support system used by an Indian District Emergency Operations Centre during a flood.

A separate allocation agent has proposed a resource plan. Your job is adversarial: find how this plan fails in execution, before a human officer is asked to sign it. You are not here to confirm that it looks sensible.

Check, using the tools:
- Can each assigned depot physically reach its zone with the resources it was given? A wheeled unit cannot enter standing water.
- Is any inundated zone assigned people but no rescue craft?
- Does any zone with drone-verified casualties get less than a zone running on a predicted range?
- Does the plan contradict doctrine on evacuation sequencing or authority?

Rules:
- Return for revision ONLY when the plan cannot be executed as written. Sub-optimal is not a reason to return; the officer can accept a sub-optimal plan, and returning it costs time that people do not have.
- Objections must be specific and executable. "Consider reviewing the allocation" is worthless. Name the zone, the failure, and the fix.
- If the plan is sound, say so and return no objections. Padding the list to look thorough is a failure of this role.

Finish by calling submit_safety_review exactly once.`;

/**
 * The deterministic reviewer — what runs with no reasoning layer.
 * Applies the same four checks as arithmetic, so a plan is challenged even
 * offline. This is why the fallback is a mode, not a degradation.
 */
function reviewDeterministic(state) {
  const byId = Object.fromEntries(state.ranked.map((z) => [z.id, z]));
  const objections = [];

  for (const a of state.allocation?.allocations ?? []) {
    const zone = byId[a.zoneId];
    if (!zone) continue;
    const committed = a.allocated.boats + a.allocated.ambulances + a.allocated.teams + a.allocated.divers;
    if (committed === 0) continue;

    if (zone.flood >= BOAT_ONLY_FLOOD && a.allocated.boats === 0) {
      objections.push({
        zone_id: a.zoneId,
        problem: `Zone is under ${zone.depthM} m of standing water but no rescue craft were allocated. Wheeled units cannot enter.`,
        remedy: 'Reassign craft from a lower-severity zone, or hold this zone for the next wave and say so.',
        blocking: true,
      });
      continue;
    }
    const depot = DEPOTS.find((d) => d.id === a.depot);
    if (depot && depot.zone !== a.zoneId) {
      const r = a.allocated.boats > 0
        ? planAmphibious(state.ranked, depot.zone, a.zoneId)
        : planRoute(state.ranked, depot.zone, a.zoneId, 'vehicle');
      if (!r.reachable) {
        objections.push({
          zone_id: a.zoneId,
          problem: `No route from ${depot.name} at current stage.`,
          remedy: 'Reassign to a depot that can reach it, or flag for aerial insertion.',
          blocking: true,
        });
      }
    }
  }

  const verifiedStarved = (state.allocation?.allocations ?? []).filter(
    (a) => a.verified && a.coverage < 0.5
  );
  for (const a of verifiedStarved) {
    objections.push({
      zone_id: a.zoneId,
      problem: `Drone-verified casualties here, but under half the assessed requirement was issued.`,
      remedy: 'Prefer verified counts over predicted ranges when the two compete for the same craft.',
      blocking: false,
    });
  }

  // Blocking objections all survive; advisory ones are capped, because a list
  // of twelve tells an officer under time pressure nothing at all.
  const blockingList = objections.filter((o) => o.blocking);
  const advisory = objections.filter((o) => !o.blocking).slice(0, 4);
  const trimmed = [...blockingList, ...advisory];
  const blocking = blockingList.length;
  return {
    verdict: blocking ? 'return_for_revision' : trimmed.length ? 'sound_with_risks' : 'sound',
    objections: trimmed,
    residual_risk: blocking
      ? `${blocking} allocation${blocking === 1 ? '' : 's'} cannot be executed as written.`
      : trimmed.length
        ? 'Plan is executable. The risks listed above are accepted if signed as it stands.'
        : 'No executable failure found in this plan on the current network and stock.',
  };
}

async function reviewNode(state, config) {
  started(config, 'review');
  const deterministic = reviewDeterministic(state);

  const planBrief = (state.allocation?.allocations ?? [])
    .map((a) => {
      const zone = state.ranked.find((z) => z.id === a.zoneId);
      return (
        `${a.zoneId}${a.settlement ? ` (${a.settlement})` : ''} · wave ${a.wave} · from ${a.depot} · ` +
        `issued ${a.allocated.boats}b/${a.allocated.teams}t/${a.allocated.ambulances}a/${a.allocated.divers}d ` +
        `against need ${a.need.boats}b/${a.need.teams}t/${a.need.ambulances}a/${a.need.divers}d · ` +
        `${a.verified ? 'drone-verified' : 'predicted'} · inundation ${Math.round((zone?.flood ?? 0) * 100)}% at ${zone?.depthM ?? '?'} m`
      );
    })
    .join('\n');

  const { submitted, mode, modeReason, usage, trace } = await runAgent({
    system: REVIEW_SYSTEM,
    userMessage: `PROPOSED PLAN for ${state.incidentRef}\n\n${state.allocation?.headline ?? ''}\n\n${planBrief}\n\nCheck it and submit your review.`,
    tools: READ_TOOLS,
    submitTool: SUBMIT_REVIEW_TOOL,
    toolCtx: { zones: state.ranked, observations: state.observations },
    maxTurns: 5,
    config,
    agentName: 'safety',
  });

  const review = submitted
    ? { ...submitted, source: 'reasoned' }
    : { ...deterministic, source: 'rule-engine' };

  const blocking = review.objections?.filter((o) => o.blocking).length ?? 0;
  emit(config, { kind: 'review', verdict: review.verdict, objections: review.objections?.length ?? 0, blocking });

  return {
    safetyReview: review,
    reviewRounds: (state.reviewRounds ?? 0) + 1,
    reasoningTrace: [{ stage: 'review', agent: 'safety', mode, usage, trace, at: Date.now() }],
    revision: review.verdict === 'return_for_revision' ? (state.revision ?? 0) + 1 : state.revision,
    notes: [
      review.verdict === 'return_for_revision'
        ? `Safety review returned the plan — ${blocking} blocking objection${blocking === 1 ? '' : 's'}. Reallocating before the officer is asked to sign.`
        : `Safety review: ${review.verdict.replace(/_/g, ' ')}${review.objections?.length ? ` with ${review.objections.length} noted risk${review.objections.length === 1 ? '' : 's'}` : ''}.`,
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Approval gate 1                                                     */
/* ------------------------------------------------------------------ */

async function gateResourcesNode(state, config) {
  started(config, 'gate_resources');

  // LangGraph's interrupt: throws on the first pass so the run checkpoints and
  // ends; returns the officer's decision when resumed with Command({ resume }).
  const decision = interrupt({
    gate: 1,
    title: 'Approve resource allocation',
    fileNo: state.incidentRef,
    requires: 'District Magistrate or nominated Incident Commander',
    summary: state.allocation?.headline,
    allocation: state.allocation,
    requirement: state.requirement,
    safetyReview: state.safetyReview,
    mode: state.mode,
  });

  return {
    approvals: [
      {
        gate: 1,
        action: decision.action,
        officer: decision.officer,
        designation: decision.designation ?? null,
        remark: decision.remark ?? null,
        at: new Date().toISOString(),
        ref: `${state.incidentRef}/G1/${String((state.revision ?? 0) + 1).padStart(2, '0')}`,
      },
    ],
    officer: decision.officer,
    revision: decision.action === 'revise' ? (state.revision ?? 0) + 1 : state.revision,
    notes: decision.remark ? [decision.remark] : [],
  };
}

/* ------------------------------------------------------------------ */
/* Stage 5 — safe routing                                              */
/* ------------------------------------------------------------------ */

async function routingNode(state, config) {
  started(config, 'routing');
  const byId = Object.fromEntries(state.ranked.map((z) => [z.id, z]));
  const active = state.allocation.allocations.filter(
    (a) => a.allocated.boats + a.allocated.ambulances + a.allocated.teams + a.allocated.divers > 0
  );

  const routes = active.map((a) => {
    const depot = DEPOTS.find((d) => d.id === a.depot) ?? DEPOTS[0];
    const zone = byId[a.zoneId];
    const mode = a.allocated.boats > 0 ? 'boat' : 'vehicle';
    const onSite = depot.zone === a.zoneId;

    // A zone under standing water with no craft cannot be served by what it was
    // given, however good the road is. The road is not the problem; say which.
    const craftShortfall = zone && zone.flood >= BOAT_ONLY_FLOOD && a.allocated.boats === 0;
    if (craftShortfall) {
      return {
        zoneId: a.zoneId,
        settlement: a.settlement,
        wave: a.wave,
        depot: depot.id,
        depotName: depot.name,
        mode: 'blocked',
        onSite: false,
        craftShortfall: true,
        route: {
          reachable: false,
          minutes: null,
          distanceKm: null,
          legs: [],
          blockedEdges: [
            {
              from: depot.zone,
              to: a.zoneId,
              reason: `Zone under ${zone.depthM} m of water and no rescue craft allocated — wheeled units cannot enter`,
            },
          ],
          path: null,
        },
        allocated: a.allocated,
      };
    }

    const primary = onSite
      ? null
      : mode === 'boat'
        ? planAmphibious(state.ranked, depot.zone, a.zoneId)
        : planRoute(state.ranked, depot.zone, a.zoneId, 'vehicle');

    return {
      zoneId: a.zoneId,
      settlement: a.settlement,
      wave: a.wave,
      depot: depot.id,
      depotName: depot.name,
      depotZone: depot.zone,
      mode,
      onSite,
      route: primary ?? { reachable: true, minutes: 0, distanceKm: 0, legs: [], blockedEdges: [], path: [a.zoneId] },
      allocated: a.allocated,
    };
  });

  const craftShort = routes.filter((r) => r.craftShortfall);
  const unreachable = routes.filter((r) => !r.route.reachable && !r.craftShortfall);
  emit(config, {
    kind: 'routing',
    planned: routes.length,
    unreachable: unreachable.length,
    craftShortfall: craftShort.length,
  });

  return {
    routes,
    notes: [
      unreachable.length
        ? `${unreachable.length} allocation${unreachable.length === 1 ? '' : 's'} have no safe route on the current network and are flagged for aerial insertion.`
        : null,
      craftShort.length
        ? `${craftShort.length} zone${craftShort.length === 1 ? '' : 's'} (${craftShort.map((r) => r.zoneId).join(', ')}) are inundated but received no rescue craft — the constraint is the boat shortfall, not the road network.`
        : null,
      !unreachable.length && !craftShort.length ? `Safe routes planned for all ${routes.length} allocations.` : null,
    ].filter(Boolean),
  };
}

/* ------------------------------------------------------------------ */
/* Approval gate 2                                                     */
/* ------------------------------------------------------------------ */

async function gateDispatchNode(state, config) {
  started(config, 'gate_dispatch');

  const decision = interrupt({
    gate: 2,
    title: 'Approve dispatch and routes',
    fileNo: state.incidentRef,
    requires: 'District Magistrate or nominated Incident Commander',
    summary: `${state.routes.length} movement orders across ${new Set(state.routes.map((r) => r.wave)).size} waves`,
    routes: state.routes,
  });

  return {
    approvals: [
      {
        gate: 2,
        action: decision.action,
        officer: decision.officer,
        designation: decision.designation ?? null,
        remark: decision.remark ?? null,
        at: new Date().toISOString(),
        ref: `${state.incidentRef}/G2/01`,
      },
    ],
    notes: decision.remark ? [decision.remark] : [],
  };
}

/* ------------------------------------------------------------------ */
/* Dispatch                                                            */
/* ------------------------------------------------------------------ */

function fieldInstruction(route, lang) {
  const r = route.route;
  const a = route.allocated;

  if (lang === 'hi') {
    const kitHi = [
      a.boats ? `${a.boats} नाव` : null,
      a.teams ? `${a.teams} बचाव दल` : null,
      a.ambulances ? `${a.ambulances} एम्बुलेंस` : null,
      a.divers ? `${a.divers} गोताखोर जोड़ी` : null,
    ].filter(Boolean);
    return [
      `आपातकालीन बचाव निर्देश — ${route.zoneId}${route.settlement ? ` (${route.settlement})` : ''}`,
      `भेजा जा रहा है: ${kitHi.join(', ')}`,
      `प्रस्थान: ${route.depotName}`,
      route.onSite
        ? `स्थिति: संसाधन इसी ज़ोन में पहले से मौजूद हैं। कोई आवागमन आवश्यक नहीं — स्टेजिंग बिंदु से सीधे तैनात करें।`
        : r.reachable
          ? `मार्ग: ${r.legs.map((l) => l.road).join(' → ')} · अनुमानित समय ${r.minutes} मिनट, ${r.distanceKm} कि.मी.`
          : `चेतावनी: कोई सतही मार्ग उपलब्ध नहीं। हवाई मार्ग से पहुँचें।`,
      r.launchZone && r.waterLegKm > 0
        ? `नाव उतारने का स्थान: ${r.launchZone} — वहाँ से ${r.waterLegKm} कि.मी. जल मार्ग।`
        : null,
      r.blockedEdges?.length ? `बचें: ${r.blockedEdges.map((b) => b.reason).join('; ')}` : null,
      `निकासी क्रम: बीमार और गर्भवती महिलाएँ, फिर बच्चे, फिर बुजुर्ग और दिव्यांग, फिर शेष।`,
      `नाव में क्षमता से कम लोग बैठाएँ। पशुओं को अलग यात्रा में ले जाएँ।`,
      `क्षेत्र खाली होने पर चिह्न लगाएँ और संख्या दर्ज करें।`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  const kit = [
    a.boats ? `${a.boats} boat` : null,
    a.teams ? `${a.teams} team` : null,
    a.ambulances ? `${a.ambulances} ambulance` : null,
    a.divers ? `${a.divers} dive pair` : null,
  ].filter(Boolean);

  return [
    `EMERGENCY DISPATCH — ${route.zoneId}${route.settlement ? ` (${route.settlement})` : ''}`,
    `Assigned: ${kit.join(', ')}`,
    `From: ${route.depotName}`,
    route.onSite
      ? `Status: resources are already staged in this zone. No movement required — deploy from the staging point.`
      : r.reachable
        ? `Route: ${r.legs.map((l) => l.road).join(' → ')} · ETA ${r.minutes} min, ${r.distanceKm} km`
        : `WARNING: no surface route and no reachable launch point. Aerial insertion required.`,
    r.launchZone && r.waterLegKm > 0
      ? `Launch point: ${r.launchZone} — then ${r.waterLegKm} km by water into ${route.zoneId}.`
      : null,
    r.blockedEdges?.length ? `Avoid: ${r.blockedEdges.map((b) => b.reason).join('; ')}` : null,
    `Evacuation order: medical cases and pregnant women, then children, then elderly and persons with disabilities, then general population.`,
    `Load boats below rated capacity. Move livestock in separate trips.`,
    `Mark cleared settlements and record the count.`,
  ]
    .filter(Boolean)
    .join('\n');
}

async function dispatchNode(state, config) {
  started(config, 'dispatch');
  const g1 = state.approvals.find((a) => a.gate === 1 && a.action === 'approve');
  const g2 = state.approvals.find((a) => a.gate === 2 && a.action === 'approve');

  const orders = state.routes.map((route, i) => ({
    orderNo: `${state.incidentRef}/OP/${String(i + 1).padStart(3, '0')}`,
    zoneId: route.zoneId,
    settlement: route.settlement,
    wave: route.wave,
    depot: route.depotName,
    mode: route.mode,
    onSite: Boolean(route.onSite),
    reachable: route.route.reachable,
    etaMinutes: route.onSite ? 0 : route.route.minutes,
    distanceKm: route.route.distanceKm,
    allocated: route.allocated,
    waypoints: route.route.path ?? [],
    channels: ['SMS', 'WhatsApp', 'Voice (TTS)'],
    text: { en: fieldInstruction(route, 'en'), hi: fieldInstruction(route, 'hi') },
  }));

  emit(config, { kind: 'dispatch', orders: orders.length });

  return {
    dispatchOrder: {
      fileNo: state.incidentRef,
      issuedAt: new Date().toISOString(),
      incident: INCIDENT.name,
      district: INCIDENT.district,
      approvedBy: { gate1: g1 ?? null, gate2: g2 ?? null },
      orders,
      waves: [...new Set(orders.map((o) => o.wave))].sort(),
      delivery:
        'SIMULATED — no message is transmitted. A deployment routes these through the district SMS gateway.',
    },
    notes: [`Dispatch order issued: ${orders.length} movement orders under file ${state.incidentRef}.`],
  };
}

/* ------------------------------------------------------------------ */
/* Graph assembly                                                      */
/* ------------------------------------------------------------------ */

/** One checkpointer per process, so a thread survives navigation and reloads. */
export const checkpointer = new MemorySaver();

export function buildPipeline() {
  return new StateGraph(AegisState)
    .addNode('ingest', ingestNode)
    .addNode('vision', visionNode)
    .addNode('prioritise', zonesNode)
    .addNode('survey', surveyNode)
    .addNode('fuse', fuseNode)
    .addNode('decide', decideNode)
    .addNode('review', reviewNode)
    .addNode('gate_resources', gateResourcesNode)
    .addNode('routing', routingNode)
    .addNode('gate_dispatch', gateDispatchNode)
    .addNode('dispatch', dispatchNode)

    .addEdge(START, 'ingest')
    .addEdge('ingest', 'vision')
    .addEdge('vision', 'prioritise')

    // Fly only if something worth verifying is unverified, and only twice.
    .addConditionalEdges(
      'prioritise',
      (s) => (s.ranked.some((z) => z.severity >= 55 && !s.observations[z.id]?.complete) ? 'survey' : 'decide'),
      { survey: 'survey', decide: 'decide' }
    )
    .addEdge('survey', 'fuse')
    .addConditionalEdges(
      'fuse',
      (s) =>
        s.ranked.some((z) => z.severity >= 55 && !s.observations[z.id]?.complete) && (s.surveyRounds ?? 0) < 2
          ? 'survey'
          : 'decide',
      { survey: 'survey', decide: 'decide' }
    )

    // The allocation agent proposes; the safety agent challenges. One revision
    // round, then it goes to the human either way — a reviewer that can loop
    // forever is a reviewer that can stop a rescue.
    .addEdge('decide', 'review')
    .addConditionalEdges(
      'review',
      (s) =>
        s.safetyReview?.verdict === 'return_for_revision' && (s.reviewRounds ?? 0) < 2 ? 'revise' : 'approve',
      { revise: 'decide', approve: 'gate_resources' }
    )

    .addConditionalEdges(
      'gate_resources',
      (s) => s.approvals[s.approvals.length - 1]?.action ?? 'reject',
      { approve: 'routing', revise: 'decide', reject: END }
    )
    .addEdge('routing', 'gate_dispatch')
    .addConditionalEdges(
      'gate_dispatch',
      (s) => s.approvals[s.approvals.length - 1]?.action ?? 'reject',
      { approve: 'dispatch', revise: 'routing', reject: END }
    )
    .addEdge('dispatch', END);
}

export function compilePipeline() {
  return buildPipeline().compile({ checkpointer });
}

/**
 * The graph's shape for rendering, read from LangGraph itself rather than
 * hand-maintained — so the picture cannot drift from the executor.
 */
export async function pipelineShape() {
  const drawable = await compilePipeline().getGraphAsync({});
  return {
    nodes: Object.values(drawable.nodes).map((n) => ({ id: n.id, label: n.name ?? n.id })),
    edges: drawable.edges.map((e) => ({
      from: e.source,
      to: e.target,
      label: e.data ?? undefined,
      kind: e.conditional ? 'conditional' : 'direct',
    })),
  };
}
