'use client';

/**
 * The audit register.
 *
 * Append-only, serial-numbered, in the order things happened. This is the
 * artifact an inquiry reads months later, so it records the AI's recommendation
 * and the human's decision as two separate entries with two separate actors —
 * never as one "approved" event that hides which of them chose.
 */

import { useCallback, useEffect, useState } from 'react';
import { Sheet, SheetHead, Register, Cell, Note, Empty, Working, StatusDot } from './ui';
import Icon from './Icon';

const KINDS = [
  { id: null, label: 'All' },
  { id: 'recommendation', label: 'AI recommendations' },
  { id: 'approval', label: 'Approvals' },
  { id: 'override', label: 'Overrides' },
  { id: 'dispatch', label: 'Dispatch' },
  { id: 'query', label: 'Queries' },
  { id: 'stage', label: 'Stages' },
];

const KIND_TONE = {
  'run.start': 'var(--ink-3)',
  stage: 'var(--ink-3)',
  recommendation: 'var(--sim)',
  'gate.open': 'var(--warn)',
  approval: 'var(--seal)',
  override: 'var(--halt)',
  dispatch: 'var(--stamp)',
  query: 'var(--water)',
  weights: 'var(--warn)',
  simulation: 'var(--sim)',
};

export default function RegisterView() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [retention, setRetention] = useState('');
  const [kind, setKind] = useState(null);
  const [busy, setBusy] = useState(true);
  const [live, setLive] = useState(true);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const url = kind ? `/api/register?limit=300&kind=${encodeURIComponent(kind)}` : '/api/register?limit=300';
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      setEntries(data.entries ?? []);
      setTotal(data.total ?? 0);
      setRetention(data.retention ?? '');
    } catch {
      /* leave the last good view on screen rather than blanking the register */
    } finally {
      setBusy(false);
    }
  }, [kind]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!live) return undefined;
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [live, load]);

  return (
    <div className="space-y-4">
      <Sheet raised>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-1">
            {KINDS.map((k) => (
              <button
                key={k.label}
                type="button"
                className="btn !px-2 !py-1"
                data-tone={kind === k.id ? 'primary' : undefined}
                onClick={() => setKind(k.id)}
                aria-pressed={kind === k.id}
              >
                {k.label}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2.5">
            <StatusDot tone={live ? 'live' : 'idle'} pulse={live} label={live ? 'Following' : 'Paused'} />
            <button type="button" className="btn !px-2 !py-1" onClick={() => setLive((v) => !v)}>
              <Icon name={live ? 'pause' : 'play'} size={11} />
              {live ? 'Pause' : 'Follow'}
            </button>
            <button type="button" className="btn !px-2 !py-1" onClick={load} disabled={busy}>
              <Icon name="rewind" size={11} />
              Refresh
            </button>
            <span className="rail">{total} entries</span>
          </div>
        </div>
      </Sheet>

      <Sheet>
        <SheetHead title="Register of proceedings" meta="append-only · newest first" />
        {busy && !entries.length ? (
          <Working label="Reading register" />
        ) : entries.length === 0 ? (
          <Empty title="No entries of this kind" icon="file">
            Run the response pipeline or ask the doctrine assistant, and the register fills as the system works.
          </Empty>
        ) : (
          <Register
            columns={[
              { key: 'sl', label: 'Sl.', width: '3.4rem' },
              { key: 'at', label: 'Timestamp', width: '9.5rem' },
              { key: 'kind', label: 'Kind', width: '8rem' },
              { key: 'actor', label: 'Actor', width: '11rem' },
              { key: 'sum', label: 'Entry' },
            ]}
          >
            {entries.map((e) => (
              <tr key={e.serial} className="border-b border-[var(--rule-soft)] align-top">
                <Cell mono className="rail !text-[0.625rem]">
                  {e.serial}
                </Cell>
                <Cell mono className="!text-[0.6875rem] text-[var(--ink-3)]">
                  {new Date(e.at).toLocaleString('en-IN', {
                    timeZone: 'Asia/Kolkata',
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                  })}
                </Cell>
                <Cell>
                  <span
                    className="band-chip"
                    style={{ borderColor: KIND_TONE[e.kind] ?? 'var(--rule-strong)', color: KIND_TONE[e.kind] ?? 'var(--ink-3)' }}
                  >
                    {e.kind}
                  </span>
                </Cell>
                <Cell>
                  <span className="block text-[0.6875rem] font-medium text-[var(--ink)]">{e.actor}</span>
                  {e.designation ? (
                    <span className="block text-[0.625rem] leading-[1.35] text-[var(--ink-3)]">{e.designation}</span>
                  ) : null}
                </Cell>
                <Cell>
                  <span className="block max-w-[62ch] text-[0.75rem] leading-[1.5] text-[var(--ink-2)]">
                    {e.summary}
                  </span>
                  {e.threadId ? <span className="mt-0.5 block rail">{e.threadId}</span> : null}
                </Cell>
              </tr>
            ))}
          </Register>
        )}
      </Sheet>

      {retention ? (
        <Note tone="info" icon="file">
          {retention} Entries are never updated or deleted — a correction is a new entry, so the sequence of what was
          believed and when is itself part of the record.
        </Note>
      ) : null}
    </div>
  );
}
