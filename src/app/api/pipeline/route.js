/**
 * Pipeline execution endpoint.
 *
 * Streams LangGraph's own event stream out as server-sent events, so the console
 * renders the graph executing rather than showing a spinner and a result. Two
 * stream modes are combined: `custom`, which carries the markers each node emits
 * as it starts and the events it wants surfaced, and `updates`, which carries
 * each node's state update as it finishes and LangGraph's `__interrupt__`
 * payload when the graph halts at an approval gate.
 *
 * GET returns the checkpointed state of a thread, so a reload during an incident
 * does not lose the run.
 */

import { Command } from '@langchain/langgraph';
import { compilePipeline, checkpointer } from '@/lib/aegis/pipeline';
import { record, saveRun, getRun, ENTRY_KINDS, seedRegister } from '@/lib/aegis/store';
import { reasoningConfigured } from '@/lib/agent/llm';
import { INCIDENT } from '@/lib/aegis/incident';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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

/**
 * Strip the bulk out of a state update. The full 100-zone array does not need
 * to cross the wire on every node transition — the client already holds it.
 */
function slim(update) {
  if (!update || typeof update !== 'object') return update;
  const { zones, ranked, ...rest } = update;
  return {
    ...rest,
    ...(ranked ? { rankedCount: ranked.length, rankedTop: ranked.slice(0, 14) } : {}),
    ...(zones ? { zonesCount: zones.length } : {}),
  };
}

export async function POST(request) {
  await seedRegister();
  const body = await request.json().catch(() => ({}));
  const { threadId, resume, officer, designation, weights, visionResult } = body;

  if (!threadId) return Response.json({ error: 'threadId is required' }, { status: 400 });

  const isResume = resume !== undefined && resume !== null;

  if (isResume) {
    await record({
      kind: resume.action === 'approve' ? ENTRY_KINDS.APPROVAL : ENTRY_KINDS.OVERRIDE,
      actor: resume.officer ?? officer ?? 'UNNAMED',
      designation: resume.designation ?? designation ?? null,
      threadId,
      summary:
        resume.action === 'approve'
          ? `Gate cleared — ${resume.gateLabel ?? 'approval gate'} approved.`
          : resume.action === 'revise'
            ? `Gate returned for revision — ${resume.remark ?? 'no reason recorded'}`
            : `Gate rejected — ${resume.remark ?? 'no reason recorded'}`,
      detail: resume,
    });
  } else {
    await record({
      kind: ENTRY_KINDS.RUN_START,
      actor: officer ?? 'DUTY OFFICER',
      designation: designation ?? null,
      threadId,
      summary: `Pipeline run opened on file ${INCIDENT.fileNo}.`,
    });
  }

  const app = compilePipeline();
  const encoder = new TextEncoder();
  const config = { configurable: { thread_id: threadId }, recursionLimit: 60 };

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          /* client disconnected */
        }
      };

      try {
        const input = isResume
          ? new Command({ resume })
          : {
              incidentRef: INCIDENT.fileNo,
              officer: officer ?? null,
              ...(weights ? { weights } : {}),
              ...(visionResult ? { uploadedVision: visionResult } : {}),
            };

        send({ type: isResume ? 'resume' : 'start', threadId, value: isResume ? resume : undefined });

        let interrupted = false;

        for await (const [mode, chunk] of await app.stream(input, {
          ...config,
          streamMode: ['custom', 'updates'],
        })) {
          if (mode === 'custom') {
            // Nodes announce their own start; everything else is an observation
            // the console shows in the trace.
            if (chunk?.kind === 'node:start') {
              send({ type: 'node:start', node: chunk.node, meta: { label: NODE_LABELS[chunk.node] ?? chunk.node } });
            } else {
              send({ type: 'node:emit', event: chunk });
            }
            continue;
          }

          if (mode !== 'updates' || !chunk) continue;

          // LangGraph reports a halt as an `__interrupt__` entry in the update.
          if (chunk.__interrupt__) {
            const payload = chunk.__interrupt__[0]?.value ?? chunk.__interrupt__[0];
            interrupted = true;
            await record({
              kind: ENTRY_KINDS.GATE_OPEN,
              threadId,
              summary: `${payload?.title ?? 'Approval gate'} awaiting a decision.`,
              detail: { gate: payload?.gate },
            });
            await saveRun(threadId, { status: 'interrupted', gate: payload?.gate });
            send({ type: 'interrupt', threadId, node: payload?.gate === 1 ? 'gate_resources' : 'gate_dispatch', payload });
            continue;
          }

          for (const [node, update] of Object.entries(chunk)) {
            send({ type: 'node:end', node, meta: { label: NODE_LABELS[node] ?? node }, update: slim(update) });

            if (node === 'decide') {
              await record({
                kind: ENTRY_KINDS.RECOMMENDATION,
                actor: update?.mode === 'live' ? 'AEGIS ALLOCATION AGENT' : 'AEGIS RULE ENGINE',
                threadId,
                summary: update?.allocation?.headline ?? 'Resource recommendation produced.',
                detail: { mode: update?.mode, strategy: update?.allocation?.strategy },
              });
            } else if (node === 'review') {
              const r = update?.safetyReview;
              await record({
                kind: ENTRY_KINDS.RECOMMENDATION,
                actor: r?.source === 'reasoned' ? 'AEGIS SAFETY AGENT' : 'AEGIS RULE ENGINE',
                threadId,
                summary: `Safety review: ${r?.verdict ?? 'unknown'}${
                  r?.objections?.length ? ` — ${r.objections.length} objection(s)` : ''
                }.`,
                detail: r,
              });
            } else if (node === 'dispatch') {
              await record({
                kind: ENTRY_KINDS.DISPATCH,
                actor: 'AEGIS',
                threadId,
                summary: `Dispatch order issued — ${update?.dispatchOrder?.orders?.length ?? 0} movement orders.`,
              });
            } else {
              await record({ kind: ENTRY_KINDS.STAGE, threadId, summary: `${NODE_LABELS[node] ?? node} complete.` });
            }
          }
        }

        if (!interrupted) {
          const snapshot = await app.getState(config);
          await saveRun(threadId, { status: 'complete' });
          send({ type: 'end', threadId, state: slim(snapshot?.values ?? {}) });
        }
      } catch (err) {
        await saveRun(threadId, { status: 'error', error: String(err?.message ?? err) });
        send({ type: 'error', error: String(err?.message ?? err) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function GET(request) {
  const threadId = new URL(request.url).searchParams.get('threadId');
  if (!threadId) return Response.json({ error: 'threadId is required' }, { status: 400 });

  const app = compilePipeline();
  const snapshot = await app.getState({ configurable: { thread_id: threadId } });
  if (!snapshot?.createdAt && !snapshot?.values) return Response.json({ status: 'none' });

  const pending = snapshot.tasks?.flatMap((t) => t.interrupts ?? []) ?? [];

  return Response.json({
    status: pending.length ? 'interrupted' : snapshot.next?.length ? 'running' : 'complete',
    next: snapshot.next ?? [],
    payload: pending[0]?.value ?? null,
    state: slim(snapshot.values ?? {}),
    run: await getRun(threadId),
    reasoningConfigured: reasoningConfigured(),
  });
}

export { checkpointer };
