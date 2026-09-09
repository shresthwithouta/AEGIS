/**
 * Tools the reasoning layer may call while forming a recommendation.
 *
 * All read-only. The model investigates the incident — opens a zone, tests
 * whether a depot can actually reach it, checks what doctrine says — and then
 * submits a plan. It cannot dispatch, allocate, or write anything: the only
 * path to action is through a human approval gate in the graph.
 */

import { planRoute, nearestDepot } from '../aegis/routing';
import { requirementFor } from '../aegis/resources';
import { search, citationList } from '../aegis/retrieval';
import { groundTruth } from '../aegis/drones';
import { DEPOTS, BRIDGES, ROADS } from '../aegis/incident';
import { scoreZone } from '../aegis/severity';

export const READ_TOOLS = [
  {
    name: 'get_zone_detail',
    description:
      'Open the full record for one zone: severity arithmetic, inundation depth, population, structures, ' +
      'drone observation status and predicted persons at risk. Use this before recommending resources for a zone.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        zone_id: { type: 'string', description: 'Zone reference, e.g. "D-07"' },
      },
      required: ['zone_id'],
      additionalProperties: false,
    },
  },
  {
    name: 'check_route',
    description:
      'Test whether a depot can physically reach a zone, and how long it takes. Returns the safe route, the ' +
      'naive direct route for comparison, and any hazards that forced a detour. Use this before committing a ' +
      'resource to a zone — a zone that cannot be reached by road may need boats instead.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        from_zone: { type: 'string', description: 'Origin zone reference, usually a depot zone' },
        to_zone: { type: 'string', description: 'Destination zone reference' },
        mode: { type: 'string', enum: ['vehicle', 'heavy', 'boat'], description: 'Vehicle class' },
      },
      required: ['from_zone', 'to_zone', 'mode'],
      additionalProperties: false,
    },
  },
  {
    name: 'lookup_doctrine',
    description:
      'Search Indian disaster-management doctrine (DM Act 2005, NDMA guidelines, NDMP, IRS, relief norms, ' +
      'Drone Rules 2021). Use this when a decision turns on a published norm or on who holds authority. ' +
      'Returns passages with their source citation.',
    strict: true,
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'What you need to know' },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
  {
    name: 'list_depot_stock',
    description: 'What each depot physically holds right now, and where it is.',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
  {
    name: 'list_blocked_infrastructure',
    description: 'Bridges and road links currently collapsed, submerged or restricted.',
    strict: true,
    input_schema: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
];

/**
 * The safety reviewer's verdict.
 *
 * A second agent challenges the allocation before a human ever sees it. Its job
 * is adversarial: find the way this plan fails, not confirm that it is sensible.
 * It cannot approve — only a human does that — but it can send the plan back
 * once, so the officer's time is spent on a plan that has already survived a
 * challenge rather than on catching an obvious error.
 */
export const SUBMIT_REVIEW_TOOL = {
  name: 'submit_safety_review',
  description:
    'Submit the safety review of a proposed allocation. Call this exactly once, after checking the routes and any ' +
    'doctrine the plan depends on.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      verdict: {
        type: 'string',
        enum: ['sound', 'sound_with_risks', 'return_for_revision'],
        description:
          'return_for_revision only when the plan cannot be executed as written — a zone that cannot be reached ' +
          'by what it was given, or a resource sent where it cannot operate. Sub-optimal is not a reason to return.',
      },
      objections: {
        type: 'array',
        description: 'Specific, executable failures. Empty when there are none. Do not pad this.',
        items: {
          type: 'object',
          properties: {
            zone_id: { type: 'string' },
            problem: { type: 'string', description: 'What will fail, stated concretely' },
            remedy: { type: 'string', description: 'The specific change that would fix it' },
            blocking: { type: 'boolean', description: 'True only if the plan cannot be executed as written' },
          },
          required: ['zone_id', 'problem', 'remedy', 'blocking'],
          additionalProperties: false,
        },
      },
      residual_risk: {
        type: 'string',
        description:
          'What the approving officer is accepting if they sign this as it stands. One paragraph, plain, no hedging.',
      },
    },
    required: ['verdict', 'objections', 'residual_risk'],
    additionalProperties: false,
  },
};

/** Structured output the model must produce to finish stage 4. */
export const SUBMIT_PLAN_TOOL = {
  name: 'submit_resource_plan',
  description:
    'Submit the recommended allocation for human approval. Call this exactly once, after you have investigated ' +
    'enough zones to justify the ordering. Every zone in the priority list must appear, even if it receives nothing.',
  strict: true,
  input_schema: {
    type: 'object',
    properties: {
      headline: {
        type: 'string',
        description: 'One sentence an incident commander can read in three seconds. State the shape of the plan, not its virtues.',
      },
      allocations: {
        type: 'array',
        description: 'One entry per priority zone, ordered by dispatch sequence.',
        items: {
          type: 'object',
          properties: {
            zone_id: { type: 'string' },
            wave: { type: 'integer', description: '1 = immediate, 2 = follow-on, 3 = next operational period' },
            boats: { type: 'integer' },
            ambulances: { type: 'integer' },
            teams: { type: 'integer' },
            divers: { type: 'integer' },
            depot: { type: 'string', description: 'Depot id that supplies this zone' },
            reason: { type: 'string', description: 'Why this zone gets this, in one sentence.' },
          },
          required: ['zone_id', 'wave', 'boats', 'ambulances', 'teams', 'divers', 'depot', 'reason'],
          additionalProperties: false,
        },
      },
      tradeoffs: {
        type: 'array',
        description:
          'Where demand exceeded supply, name what was deprioritised and the consequence. If nothing was ' +
          'constrained, return an empty array. Do not soften these.',
        items: {
          type: 'object',
          properties: {
            zone_id: { type: 'string' },
            withheld: { type: 'string', description: 'What this zone did not get' },
            consequence: { type: 'string', description: 'The operational consequence, stated plainly' },
          },
          required: ['zone_id', 'withheld', 'consequence'],
          additionalProperties: false,
        },
      },
      unverified_risk: {
        type: 'string',
        description:
          'The risk carried by acting on zones no drone has confirmed. Name the specific zones. If all priority ' +
          'zones are verified, say so.',
      },
      escalation: {
        type: 'string',
        description:
          'What the district should request from the state now, if anything — additional NDRF companies, ' +
          'aviation, or nothing.',
      },
    },
    required: ['headline', 'allocations', 'tradeoffs', 'unverified_risk', 'escalation'],
    additionalProperties: false,
  },
};

/** Execute a read tool. Returns a string — what the model sees. */
export function runTool(name, input, ctx) {
  const { zones, observations = {} } = ctx;
  const byId = Object.fromEntries(zones.map((z) => [z.id, z]));

  switch (name) {
    case 'get_zone_detail': {
      const z = byId[input.zone_id];
      if (!z) return `No zone "${input.zone_id}" in this area of interest.`;
      const scored = scoreZone(z);
      const obs = observations[z.id];
      const req = requirementFor(z, obs);
      const lines = [
        `ZONE ${z.id}${z.settlement ? ` · ${z.settlement}` : ''} · ${z.terrainLabel}`,
        `Severity ${scored.severity}/100 (${scored.band.label})`,
        ...scored.terms.map(
          (t) => `  ${t.key}: ${t.value.toFixed(3)} × weight ${t.weight.toFixed(2)} = ${t.contribution.toFixed(3)}`
        ),
        `Inundation ${(z.flood * 100).toFixed(0)}% at ${z.depthM} m mean depth`,
        `Damage index ${z.damage.toFixed(3)} — ${z.damagedStructures} of ${z.structures} structures`,
        `Resident population ${z.population}; elevation ${z.elevation} m; ${z.distanceToRiverKm} km from the river`,
        `Imagery confidence ${z.confidence} (cloud cover ${(z.cloudCover * 100).toFixed(0)}%)`,
        obs?.complete
          ? `DRONE VERIFIED by ${obs.drone}: ${obs.persons} persons, ${obs.injured} injured, ${obs.animals} animals, ${obs.vehicles} vehicles (confidence ${obs.confidence})`
          : obs
            ? `DRONE PASS IN PROGRESS — ${(obs.coverage * 100).toFixed(0)}% coverage, counts not final`
            : `NOT DRONE VERIFIED — predicted ${z.predicted.low}–${z.predicted.high} persons at risk. ${z.predicted.basis}`,
        `Requirement from norms: ${req.need.boats} boats, ${req.need.teams} teams, ${req.need.ambulances} ambulances, ${req.need.divers} dive pairs`,
      ];
      return lines.join('\n');
    }

    case 'check_route': {
      const r = planRoute(zones, input.from_zone, input.to_zone, input.mode);
      if (!r.reachable) {
        return [
          `NO ${input.mode.toUpperCase()} ROUTE from ${input.from_zone} to ${input.to_zone}.`,
          ...r.blockedEdges.map((b) => `  blocked: ${b.reason}`),
        ].join('\n');
      }
      const out = [
        `${input.mode} route ${input.from_zone} → ${input.to_zone}: ${r.minutes} min, ${r.distanceKm} km`,
        `Legs: ${r.legs.map((l) => `${l.road} (${l.from}→${l.to})`).join(' · ')}`,
      ];
      if (r.comparison) {
        out.push(`Direct route would be ${r.comparison.minutes} min but crosses: ${r.comparison.hazards.map((h) => `${h.zone} ${h.reason}`).join('; ') || 'no hazards'}`);
      }
      if (r.blockedEdges.length) out.push(`Avoided: ${r.blockedEdges.map((b) => b.reason).join('; ')}`);
      return out.join('\n');
    }

    case 'lookup_doctrine': {
      const hits = search(input.query, { topK: 3 });
      if (!hits.length) return 'No matching passage in the indexed corpus.';
      return citationList(hits)
        .map((c) => `[${c.n}] ${c.title} — ${c.authority} ${c.year}\nSource: ${c.sourceRef}\n${c.text}`)
        .join('\n\n');
    }

    case 'list_depot_stock':
      return DEPOTS.map(
        (d) =>
          `${d.id} · ${d.name} (zone ${d.zone}, ${d.kind}): ${d.stock.boats} boats, ${d.stock.ambulances} ambulances, ${d.stock.teams} teams, ${d.stock.divers} divers`
      ).join('\n');

    case 'list_blocked_infrastructure': {
      const bridges = BRIDGES.filter((b) => b.status !== 'open').map(
        (b) => `${b.name} (zone ${b.zone}, on ${ROADS.find((r) => r.id === b.road)?.name ?? b.road}): ${b.status}${b.note ? ` — ${b.note}` : ''}`
      );
      const flooded = zones
        .filter((z) => z.flood >= 0.72)
        .map((z) => `Zone ${z.id}${z.settlement ? ` (${z.settlement})` : ''}: impassable, ${z.depthM} m standing water`);
      return [...bridges, ...flooded].join('\n') || 'No blocked infrastructure recorded.';
    }

    default:
      return `Unknown tool "${name}".`;
  }
}
