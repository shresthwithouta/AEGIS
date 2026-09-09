/**
 * The preparedness assistant — self-correcting RAG as a LangGraph `StateGraph`.
 *
 * Plain RAG retrieves once and hopes. This graph grades what it retrieved,
 * broadens the query when the evidence is thin, and verifies after generating
 * that every citation the answer used actually resolves to a passage that was
 * supplied. An answer that cannot be grounded is returned as "not in the corpus"
 * rather than as a confident paragraph — the only acceptable failure mode for
 * something an officer may act on before a monsoon.
 *
 *   plan → retrieve → grade → ⟨enough?⟩ ⇄ broaden
 *                                ↓
 *                            generate → verify → ⟨grounded?⟩ ⇄ generate → END
 */

import { StateGraph, Annotation, START, END, MemorySaver } from '@langchain/langgraph';
import { reason, textOf, MODE, explainFallback } from '../agent/llm';
import { search, toContext, citationList, tokenize } from './retrieval';
import { CORPUS_NOTE } from './corpus';

const last = (_p, n) => n;
const appendAll = (p = [], n) => [...p, ...(Array.isArray(n) ? n : [n])];

const RagState = Annotation.Root({
  question: Annotation({ reducer: last, default: () => '' }),
  phase: Annotation({ reducer: last, default: () => null }),
  queries: Annotation({ reducer: appendAll, default: () => [] }),
  hits: Annotation({ reducer: last, default: () => [] }),
  citations: Annotation({ reducer: last, default: () => [] }),
  answer: Annotation({ reducer: last, default: () => null }),
  grounded: Annotation({ reducer: last, default: () => null }),
  attempts: Annotation({ reducer: last, default: () => 0 }),
  broadenings: Annotation({ reducer: last, default: () => 0 }),
  mode: Annotation({ reducer: last, default: () => MODE.FALLBACK }),
  modeReason: Annotation({ reducer: last, default: () => null }),
  trace: Annotation({ reducer: appendAll, default: () => [] }),
});

/** Domain expansions lexical search will not find on its own. */
const EXPANSIONS = [
  [/\bevacuat/i, 'evacuation sequence vulnerable groups boats capacity livestock'],
  [/\bwho (can|has|is)\b|authority|permission|order\b/i, 'DDMA District Magistrate powers Section 30 authority Incident Commander'],
  [/\bbreach|embankment|bandh\b/i, 'embankment breach closure patrolling sandbags vulnerable reach'],
  [/\bcamp|shelter|relief\b/i, 'relief camp minimum standards water toilets covered space displaced'],
  [/\bdrone|uav|rpas\b/i, 'Drone Rules 2021 green zone 400 feet remote pilot certificate Digital Sky'],
  [/\bwarning|danger|gauge|level\b/i, 'CWC warning level danger level highest flood level forecast'],
  [/\brain|forecast|imd\b/i, 'IMD rainfall categories heavy very heavy extremely heavy colour warning'],
  [/\bcompensation|claim|damage assessment|relief fund\b/i, 'SDRF norms assistance damage assessment documentation grading'],
  [/\bvulnerab|pre-?monsoon|mitigat|prepared/i, 'hazard vulnerability capacity analysis ranking pre-monsoon planning'],
  [/\bai\b|automat|recommend|accountab/i, 'decision support accountability override audit record human'],
];

function expand(question) {
  const extra = EXPANSIONS.filter(([re]) => re.test(question)).map(([, terms]) => terms);
  return extra.length ? `${question} ${extra.join(' ')}` : question;
}

/* ------------------------------------------------------------------ */

async function planNode(state) {
  const expanded = expand(state.question);
  return {
    queries: [expanded],
    trace: [
      {
        node: 'plan',
        detail: expanded === state.question ? 'No expansion needed.' : 'Query expanded with domain terms.',
      },
    ],
  };
}

async function retrieveNode(state) {
  const query = state.queries[state.queries.length - 1];
  const hits = search(query, { topK: 7, phase: state.phase, minScore: 0.5 });
  return {
    hits,
    trace: [{ node: 'retrieve', detail: `${hits.length} passages above threshold.` }],
  };
}

/**
 * Grade retrieved passages against the question that was actually asked.
 *
 * A single shared word is not relevance. Asked for the melting point of
 * tungsten carbide, an earlier version of this gate kept a relief-camp passage
 * because "melting **point**" matched "water **points** should be within 500
 * metres" — one common noun, and the assistant then answered a metallurgy
 * question out of the WASH standards. So a passage must cover at least two
 * distinct content terms *from the question itself*, not from the domain
 * expansion the planner added, which would otherwise let a passage qualify on
 * words the officer never typed.
 */
const MIN_TERM_COVERAGE = 2;

async function gradeNode(state) {
  // The question's own stemmed content terms — not the expanded query's.
  const qTerms = new Set(tokenize(state.question));
  const required = Math.min(MIN_TERM_COVERAGE, qTerms.size);

  const scored = state.hits.map((h) => {
    const covered = new Set(h.matched.filter((m) => qTerms.has(m)));
    return { hit: h, covered: covered.size, terms: [...covered] };
  });

  const kept = scored.filter((s) => s.covered >= required && s.hit.score >= 1.0).map((s) => s.hit);

  const best = scored.reduce((a, b) => (b.covered > a.covered ? b : a), { covered: 0, terms: [] });
  const detail = kept.length
    ? `${kept.length} of ${state.hits.length} passages kept — each covers ≥${required} of the question's own terms.`
    : `${state.hits.length} passages retrieved, none kept. Best covered only ${best.covered} question term${
        best.covered === 1 ? '' : 's'
      }${best.terms.length ? ` (${best.terms.join(', ')})` : ''} — below the ${required}-term floor, so this is a keyword collision, not an answer.`;

  return { hits: kept, citations: citationList(kept), trace: [{ node: 'grade', detail }] };
}

async function broadenNode(state) {
  const base = state.question
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .join(' ');
  return {
    queries: [`${base} disaster management district flood response norm guideline`],
    broadenings: (state.broadenings ?? 0) + 1,
    trace: [{ node: 'broaden', detail: 'Evidence thin — broadened to general doctrine terms.' }],
  };
}

const ANSWER_SYSTEM = `You answer questions from a district disaster-management officer, using ONLY the numbered passages supplied. This is the preparedness desk of an Indian District Emergency Operations Centre.

Rules, in order of priority:
1. Ground every substantive statement in a supplied passage and cite it inline as [1], [2]. A sentence with no citation must contain no claim.
2. If the passages do not answer the question, say exactly what is missing and stop. Do not fill the gap from general knowledge. "The indexed corpus does not cover X" is a correct and useful answer.
3. Where a figure is a planning minimum rather than a target, say so.
4. Lead with the answer. No preamble, no restating the question, no closing summary.
5. Write plainly, for someone who will act on this. Short paragraphs. Use a list only when the content is genuinely a sequence or a set of items.
6. Note when something depends on the district's own plan or SOP rather than a national norm.

Never invent a citation number that was not supplied.`;

async function generateNode(state) {
  if (!state.hits.length) {
    return {
      answer: {
        text: 'The indexed corpus does not contain a passage that answers this. The assistant will not answer from general knowledge, because an officer may act on it. Try rephrasing, or consult the District Disaster Management Plan directly.',
        empty: true,
      },
      mode: MODE.FALLBACK,
      grounded: true,
      trace: [{ node: 'generate', detail: 'No evidence — declined to answer.' }],
    };
  }

  const res = await reason({
    system: ANSWER_SYSTEM,
    messages: [{ role: 'user', content: `PASSAGES\n\n${toContext(state.hits)}\n\n---\n\nQUESTION: ${state.question}` }],
    maxTokens: 2000,
    effort: 'medium',
  });

  if (!res.ok) {
    // Extractive fallback: return the strongest passages verbatim rather than
    // paraphrasing them without a model. Honest, and still useful.
    return {
      answer: {
        text: state.hits.slice(0, 3).map((h, i) => `[${i + 1}] ${h.chunk.text}`).join('\n\n'),
        extractive: true,
      },
      mode: MODE.FALLBACK,
      modeReason: res.reason,
      grounded: true,
      attempts: (state.attempts ?? 0) + 1,
      trace: [
        {
          node: 'generate',
          detail: `Reasoning unavailable (${explainFallback(res.reason)}) — returned source passages verbatim.`,
        },
      ],
    };
  }

  return {
    answer: { text: textOf(res.content) },
    mode: MODE.LIVE,
    attempts: (state.attempts ?? 0) + 1,
    trace: [{ node: 'generate', detail: `Answer drafted from ${state.hits.length} passages.` }],
  };
}

/** Every [n] in the answer must resolve to a passage that was actually supplied. */
async function verifyNode(state) {
  if (state.answer?.empty || state.answer?.extractive) return { grounded: true };

  const text = state.answer?.text ?? '';
  const used = [...text.matchAll(/\[(\d+)\]/g)].map((m) => parseInt(m[1], 10));
  const valid = new Set(state.citations.map((c) => c.n));
  const dangling = [...new Set(used)].filter((n) => !valid.has(n));

  // A substantive answer with no citation at all is ungrounded by definition.
  const substantive = text.length > 180;
  const grounded = dangling.length === 0 && (!substantive || used.length > 0);

  return {
    grounded,
    citations: state.citations.map((c) => ({ ...c, used: used.includes(c.n) })),
    trace: [
      {
        node: 'verify',
        detail: grounded
          ? `${new Set(used).size} citation${new Set(used).size === 1 ? '' : 's'} resolved.`
          : dangling.length
            ? `Citations ${dangling.join(', ')} do not resolve — regenerating.`
            : 'Answer made claims without citing evidence — regenerating.',
      },
    ],
  };
}

/* ------------------------------------------------------------------ */

export const ragCheckpointer = new MemorySaver();

export function buildRagGraph() {
  return new StateGraph(RagState)
    .addNode('plan', planNode)
    .addNode('retrieve', retrieveNode)
    .addNode('grade', gradeNode)
    .addNode('broaden', broadenNode)
    .addNode('generate', generateNode)
    .addNode('verify', verifyNode)

    .addEdge(START, 'plan')
    .addEdge('plan', 'retrieve')
    .addEdge('retrieve', 'grade')
    .addConditionalEdges('grade', (s) => (s.hits.length === 0 && (s.broadenings ?? 0) < 1 ? 'broaden' : 'generate'), {
      broaden: 'broaden',
      generate: 'generate',
    })
    .addEdge('broaden', 'retrieve')
    .addEdge('generate', 'verify')
    .addConditionalEdges('verify', (s) => (s.grounded || (s.attempts ?? 0) >= 2 ? 'done' : 'retry'), {
      done: END,
      retry: 'generate',
    });
}

export function compileRag() {
  return buildRagGraph().compile({ checkpointer: ragCheckpointer });
}

export async function ragShape() {
  const drawable = await compileRag().getGraphAsync({});
  return {
    nodes: Object.values(drawable.nodes).map((n) => ({ id: n.id, label: n.name ?? n.id })),
    edges: drawable.edges.map((e) => ({
      from: e.source,
      to: e.target,
      kind: e.conditional ? 'conditional' : 'direct',
    })),
  };
}

export async function ask(question, { phase = 'before', threadId } = {}) {
  const app = compileRag();
  const config = { configurable: { thread_id: threadId ?? `rag-${Date.now()}` }, recursionLimit: 20 };
  const s = await app.invoke({ question, phase }, config);

  return {
    question,
    answer: s.answer?.text ?? 'The assistant could not produce an answer.',
    empty: Boolean(s.answer?.empty),
    extractive: Boolean(s.answer?.extractive),
    citations: (s.citations ?? []).filter((c) => c.used !== false),
    grounded: s.grounded,
    mode: s.mode,
    modeReason: s.modeReason,
    trace: s.trace ?? [],
    corpusNote: CORPUS_NOTE,
  };
}
