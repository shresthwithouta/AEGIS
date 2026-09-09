'use client';

/**
 * The doctrine assistant.
 *
 * Retrieval-grounded, and visibly so: the answer's inline citations resolve to
 * the passages beside it, and clicking one moves to that passage. If the corpus
 * does not answer the question, the assistant says so instead of filling the
 * gap — which is the only acceptable failure mode for something an officer may
 * act on before a monsoon.
 */

import { useMemo, useRef, useState } from 'react';
import { Sheet, SheetHead, Note, Empty, Working, Provenance, StatusDot } from './ui';
import Icon from './Icon';

const GRAPH_STEPS = [
  { id: 'plan', label: 'Plan query' },
  { id: 'retrieve', label: 'Retrieve' },
  { id: 'grade', label: 'Grade evidence' },
  { id: 'broaden', label: 'Broaden', optional: true },
  { id: 'generate', label: 'Generate' },
  { id: 'verify', label: 'Verify citations' },
];

export default function Assistant({ suggested, corpusNote, documents }) {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [focusCite, setFocusCite] = useState(null);
  const citeRefs = useRef({});

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (text.length < 3 || busy) return;
    setQuestion(text);
    setBusy(true);
    setError(null);
    setResult(null);
    setFocusCite(null);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, phase: 'before' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Assistant responded ${res.status}`);
      setResult(data);
    } catch (err) {
      setError(String(err?.message ?? err));
    } finally {
      setBusy(false);
    }
  };

  const executed = useMemo(() => new Set((result?.trace ?? []).map((t) => t.node)), [result]);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(19rem,0.75fr)]">
      <div className="min-w-0 space-y-4">
        {/* ---- Ask ---------------------------------------------------- */}
        <Sheet raised active>
          <SheetHead
            title="Ask"
            sub="Answers come only from the indexed corpus"
            action={result ? <Provenance kind={result.mode === 'live' ? 'live' : 'fallback'} /> : null}
          />
          <form
            onSubmit={(e) => {
              e.preventDefault();
              ask();
            }}
            className="px-3 py-3"
          >
            <label className="block">
              <span className="sr-only">Your question</span>
              <div className="flex gap-2">
                <input
                  className="input"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. What is the evacuation sequence for a riverine flood?"
                  disabled={busy}
                  autoComplete="off"
                />
                <button type="submit" className="btn shrink-0" data-tone="primary" disabled={busy || question.trim().length < 3}>
                  <Icon name="search" size={12} />
                  {busy ? 'Working' : 'Ask'}
                </button>
              </div>
            </label>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {suggested.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="border border-[var(--rule)] px-2 py-1 text-left text-[0.6875rem] leading-[1.35] text-[var(--ink-2)] transition-colors hover:border-[var(--stamp)] hover:text-[var(--ink)]"
                  onClick={() => ask(s)}
                  disabled={busy}
                >
                  {s}
                </button>
              ))}
            </div>
          </form>
        </Sheet>

        {error ? <Note tone="halt" icon="alert">{error}</Note> : null}

        {busy ? (
          <Sheet>
            <SheetHead title="Answer" />
            <Working label="Retrieving, grading and verifying" />
          </Sheet>
        ) : null}

        {/* ---- Answer ------------------------------------------------- */}
        {result && !busy ? (
          <Sheet>
            <SheetHead
              title="Answer"
              meta={`${result.citations.length} source${result.citations.length === 1 ? '' : 's'}`}
              action={
                <StatusDot
                  tone={result.grounded ? 'live' : 'warn'}
                  label={result.grounded ? 'Grounded' : 'Ungrounded'}
                />
              }
            />

            {result.empty ? (
              <div className="px-3 py-3">
                <Note tone="warn" icon="alert">
                  {result.answer}
                </Note>
              </div>
            ) : (
              <div className="px-3 py-3">
                {result.extractive ? (
                  <div className="mb-3">
                    <Note tone="warn" icon="scales">
                      No reasoning layer available, so the assistant returned the source passages verbatim rather than
                      paraphrasing them. The text below is quoted, not composed.
                    </Note>
                  </div>
                ) : null}
                <div className="max-w-[72ch] space-y-2.5 text-[0.875rem] leading-[1.62] text-[var(--ink)]">
                  {result.answer.split(/\n\n+/).map((para, i) => (
                    <p key={i}>{renderCitations(para, setFocusCite, citeRefs)}</p>
                  ))}
                </div>
              </div>
            )}
          </Sheet>
        ) : null}

        {/* ---- Sources ------------------------------------------------ */}
        {result?.citations?.length ? (
          <Sheet>
            <SheetHead title="Sources" sub="Every passage the answer was allowed to use" />
            <ol className="divide-y divide-[var(--rule)]">
              {result.citations.map((c) => (
                <li
                  key={c.id}
                  ref={(el) => {
                    citeRefs.current[c.n] = el;
                  }}
                  className="px-3 py-2.5 transition-colors"
                  style={focusCite === c.n ? { background: 'var(--sheet-sunk)', boxShadow: 'inset 2px 0 0 var(--stamp)' } : undefined}
                >
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center border font-[family-name:var(--font-mono)] text-[0.5625rem] font-semibold"
                      style={{ borderColor: 'var(--stamp)', color: 'var(--stamp)' }}
                    >
                      {c.n}
                    </span>
                    <span className="font-[family-name:var(--font-narrow)] text-[0.75rem] font-semibold uppercase tracking-[0.06em] text-[var(--ink)]">
                      {c.title}
                    </span>
                    <span className="rail">
                      {c.authority} · {c.year}
                    </span>
                  </div>
                  <p className="mt-1 max-w-[74ch] text-[0.75rem] leading-[1.55] text-[var(--ink-2)]">{c.text}</p>
                  <p className="mt-1 font-[family-name:var(--font-mono)] text-[0.625rem] leading-[1.4] text-[var(--ink-3)]">
                    {c.sourceRef}
                  </p>
                </li>
              ))}
            </ol>
          </Sheet>
        ) : null}
      </div>

      {/* ---- Right column ------------------------------------------- */}
      <div className="min-w-0 space-y-4">
        <Sheet>
          <SheetHead title="Retrieval graph" sub="Self-correcting" />
          <ol className="px-3 py-3">
            {GRAPH_STEPS.map((s, i) => {
              const ran = executed.has(s.id);
              const skipped = s.optional && !ran;
              return (
                <li key={s.id} className="flex items-start gap-2.5">
                  <span className="flex flex-col items-center self-stretch">
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center border"
                      style={{
                        borderColor: ran ? 'var(--seal)' : 'var(--rule)',
                        color: ran ? 'var(--seal)' : 'var(--ink-4)',
                      }}
                    >
                      {ran ? <Icon name="check" size={8} /> : null}
                    </span>
                    {i < GRAPH_STEPS.length - 1 ? (
                      <span
                        className="w-px flex-1"
                        style={{ background: ran ? 'var(--seal)' : 'var(--rule)', minHeight: 14 }}
                        aria-hidden="true"
                      />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 pb-2">
                    <span
                      className="block font-[family-name:var(--font-narrow)] text-[0.6875rem] font-semibold uppercase tracking-[0.1em]"
                      style={{ color: ran ? 'var(--ink)' : 'var(--ink-3)' }}
                    >
                      {s.label}
                      {skipped ? <span className="ml-1.5 rail">not needed</span> : null}
                    </span>
                    {(result?.trace ?? [])
                      .filter((t) => t.node === s.id)
                      .map((t, k) => (
                        <span key={k} className="mt-0.5 block text-[0.6875rem] leading-[1.45] text-[var(--ink-3)]">
                          {t.detail}
                        </span>
                      ))}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="border-t border-[var(--rule)] px-3 py-2">
            <p className="text-[0.6875rem] leading-[1.5] text-[var(--ink-3)]">
              Retrieval is lexical (BM25), in-process. No vector service and no network — the assistant answers on a
              degraded link, which is when a control room needs it.
            </p>
          </div>
        </Sheet>

        <Sheet>
          <SheetHead title="Corpus" meta={`${documents.length} documents`} />
          <ul className="max-h-[20rem] divide-y divide-[var(--rule-soft)] overflow-y-auto">
            {documents.map((d) => (
              <li key={d.id} className="px-3 py-2">
                <span className="block text-[0.75rem] font-medium leading-[1.35] text-[var(--ink)]">{d.title}</span>
                <span className="rail">
                  {d.authority} · {d.year}
                </span>
              </li>
            ))}
          </ul>
        </Sheet>

        <Note tone="warn" icon="alert">
          {corpusNote}
        </Note>
      </div>
    </div>
  );
}

/** Turn inline [n] markers into controls that move to the cited passage. */
function renderCitations(text, setFocus, refs) {
  const parts = text.split(/(\[\d+\])/g);
  return parts.map((p, i) => {
    const m = p.match(/^\[(\d+)\]$/);
    if (!m) return <span key={i}>{p}</span>;
    const n = Number(m[1]);
    return (
      <button
        key={i}
        type="button"
        className="mx-[0.1em] inline-flex h-[1.05em] min-w-[1.05em] items-center justify-center border align-baseline font-[family-name:var(--font-mono)] text-[0.62em] font-semibold"
        style={{ borderColor: 'var(--stamp)', color: 'var(--stamp)' }}
        onClick={() => {
          setFocus(n);
          refs.current[n]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }}
        aria-label={`Go to source ${n}`}
      >
        {n}
      </button>
    );
  });
}
