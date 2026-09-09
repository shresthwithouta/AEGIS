/**
 * Preparedness assistant endpoint — self-correcting RAG over the doctrine corpus.
 */

import { ask } from '@/lib/aegis/rag';
import { record, ENTRY_KINDS, seedRegister } from '@/lib/aegis/store';
import { SUGGESTED } from '@/lib/aegis/retrieval';
import { DOCUMENTS, CORPUS_NOTE } from '@/lib/aegis/corpus';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  seedRegister();
  const { question, phase, officer } = await request.json().catch(() => ({}));

  if (!question || typeof question !== 'string' || question.trim().length < 3) {
    return Response.json({ error: 'A question of at least three characters is required.' }, { status: 400 });
  }

  const result = await ask(question.trim(), { phase: phase ?? 'before' });

  record({
    kind: ENTRY_KINDS.QUERY,
    actor: officer ?? 'DUTY OFFICER',
    summary: `Doctrine query: "${question.trim().slice(0, 110)}"`,
    detail: { grounded: result.grounded, citations: result.citations.length, mode: result.mode },
  });

  return Response.json(result);
}

export async function GET() {
  return Response.json({
    suggested: SUGGESTED,
    corpusNote: CORPUS_NOTE,
    documents: DOCUMENTS.map((d) => ({
      id: d.id,
      title: d.title,
      authority: d.authority,
      year: d.year,
      sourceRef: d.sourceRef,
      tags: d.tags,
    })),
  });
}
