/**
 * Lexical retrieval over the doctrine corpus.
 *
 * BM25, not embeddings. The reason is operational rather than academic: an
 * embedding index needs either a vector service or a model download, and the
 * BEFORE-phase assistant has to answer inside a district control room whose
 * link may be the thing the flood took out. BM25 runs in-process, in
 * milliseconds, on a corpus this size, and its scores are inspectable — an
 * officer can see exactly which terms matched.
 */

import { CHUNKS } from './corpus';

const K1 = 1.5;
const B = 0.75;

const STOPWORDS = new Set(
  ('a an and are as at be by for from has have how in is it its of on or that the to was were what when where which who why will with do does did should could would may might must can shall this these those there their them they i we you your our not no if then than so such about into over under during before after between'
    .split(' '))
);

/** Light suffix stripping. Enough to bridge flood/flooding/floods, not a full stemmer. */
function stem(word) {
  if (word.length <= 4) return word;
  for (const suffix of ['ations', 'ation', 'ements', 'ement', 'ingly', 'ing', 'ies', 'ied', 'ees', 'ed', 'es', 's']) {
    if (word.endsWith(suffix) && word.length - suffix.length >= 3) {
      return word.slice(0, word.length - suffix.length);
    }
  }
  return word;
}

export function tokenize(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9\s./-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w && w.length > 1 && !STOPWORDS.has(w))
    .map(stem);
}

function buildIndex(chunks) {
  const docs = chunks.map((c) => {
    const tokens = tokenize(`${c.title} ${c.text} ${c.tags.join(' ')}`);
    const tf = new Map();
    for (const t of tokens) tf.set(t, (tf.get(t) ?? 0) + 1);
    return { chunk: c, tf, length: tokens.length };
  });

  const df = new Map();
  for (const d of docs) {
    for (const term of d.tf.keys()) df.set(term, (df.get(term) ?? 0) + 1);
  }

  const avgLength = docs.reduce((a, d) => a + d.length, 0) / (docs.length || 1);
  return { docs, df, avgLength, n: docs.length };
}

let INDEX = null;
function index() {
  if (!INDEX) INDEX = buildIndex(CHUNKS);
  return INDEX;
}

/**
 * Rank passages for a query.
 * `phase` softly boosts documents tagged for the phase the officer is in.
 */
export function search(query, { topK = 6, phase = null, minScore = 0.6 } = {}) {
  const { docs, df, avgLength, n } = index();
  const terms = tokenize(query);
  if (!terms.length) return [];

  const results = docs.map(({ chunk, tf, length }) => {
    let score = 0;
    const matched = [];
    for (const term of terms) {
      const f = tf.get(term);
      if (!f) continue;
      const dfT = df.get(term) ?? 0;
      const idf = Math.log(1 + (n - dfT + 0.5) / (dfT + 0.5));
      const norm = f * (K1 + 1) / (f + K1 * (1 - B + B * (length / avgLength)));
      score += idf * norm;
      matched.push(term);
    }
    // Title hits are worth more than body hits in a doctrine corpus.
    const titleTokens = new Set(tokenize(chunk.title));
    const titleHits = terms.filter((t) => titleTokens.has(t)).length;
    score *= 1 + titleHits * 0.18;
    if (phase && chunk.tags.includes(phase)) score *= 1.15;

    return { chunk, score: +score.toFixed(3), matched: [...new Set(matched)] };
  });

  return results
    .filter((r) => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/** Format retrieved passages for a grounded prompt, with stable citation keys. */
export function toContext(results) {
  return results
    .map((r, i) => {
      const c = r.chunk;
      return `[${i + 1}] ${c.title} — ${c.authority} (${c.year})\nSource: ${c.sourceRef}\n${c.text}`;
    })
    .join('\n\n');
}

export function citationList(results) {
  return results.map((r, i) => ({
    n: i + 1,
    id: r.chunk.id,
    docId: r.chunk.docId,
    title: r.chunk.title,
    authority: r.chunk.authority,
    year: r.chunk.year,
    sourceRef: r.chunk.sourceRef,
    score: r.score,
    matched: r.matched,
    text: r.chunk.text,
  }));
}

/** Suggested questions — real things a duty officer asks before a monsoon. */
export const SUGGESTED = [
  'What is the evacuation sequence for a riverine flood?',
  'Who has the authority to order a district evacuation?',
  'What do we do when an embankment breaches?',
  'How many boats and toilets does a relief camp of 800 people need?',
  'What is the difference between warning level and danger level?',
  'Can we fly survey drones without prior permission?',
  'What documentation do we need for relief compensation claims?',
];
