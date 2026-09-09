/**
 * Run state and the audit register.
 *
 * The audit register is the point of the system. Every AI recommendation,
 * every human decision, every override and every dispatch is written here with
 * an actor and a timestamp, because a district officer will be asked months
 * later why a particular boat went to a particular village, and "the system
 * decided" is not an answer that survives an inquiry.
 *
 * Process-local for the prototype. A deployment writes to the district's own
 * database with retention under the state's records policy; the interface
 * shape does not change.
 */

import { INCIDENT } from './incident';

const g = globalThis;
if (!g.__AEGIS_STORE__) {
  g.__AEGIS_STORE__ = {
    runs: new Map(), // threadId → run summary
    register: [], // audit entries, append-only
    serial: 40,
  };
}
const store = g.__AEGIS_STORE__;

export const ENTRY_KINDS = Object.freeze({
  RUN_START: 'run.start',
  STAGE: 'stage',
  RECOMMENDATION: 'recommendation',
  GATE_OPEN: 'gate.open',
  APPROVAL: 'approval',
  OVERRIDE: 'override',
  DISPATCH: 'dispatch',
  QUERY: 'query',
  WEIGHTS: 'weights',
  SIM: 'simulation',
});

function nextSerial() {
  store.serial += 1;
  return String(store.serial).padStart(4, '0');
}

/**
 * Append to the register. Returns the written entry.
 * Entries are never updated or deleted — a correction is a new entry.
 */
export function record({ kind, actor = 'SYSTEM', designation = null, threadId = null, summary, detail = null, fileNo = INCIDENT.fileNo }) {
  const entry = {
    serial: nextSerial(),
    kind,
    actor,
    designation,
    threadId,
    fileNo,
    summary,
    detail,
    at: new Date().toISOString(),
  };
  store.register.push(entry);
  if (store.register.length > 800) store.register.splice(0, store.register.length - 800);
  return entry;
}

export function register({ limit = 200, kind = null, threadId = null } = {}) {
  let out = store.register;
  if (kind) out = out.filter((e) => e.kind === kind);
  if (threadId) out = out.filter((e) => e.threadId === threadId);
  return out.slice(-limit).reverse();
}

export function registerCount() {
  return store.register.length;
}

/* ------------------------------------------------------------------ */
/* Run tracking                                                        */
/* ------------------------------------------------------------------ */

export function saveRun(threadId, patch) {
  const prev = store.runs.get(threadId) ?? { threadId, createdAt: Date.now() };
  const next = { ...prev, ...patch, updatedAt: Date.now() };
  store.runs.set(threadId, next);
  if (store.runs.size > 50) {
    const oldest = [...store.runs.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
    if (oldest) store.runs.delete(oldest[0]);
  }
  return next;
}

export function getRun(threadId) {
  return store.runs.get(threadId) ?? null;
}

export function listRuns() {
  return [...store.runs.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Seed the register so a cold start still shows a plausible shift history. */
export function seedRegister() {
  if (store.register.length) return;
  const base = new Date('2026-09-08T01:40:00+05:30').getTime();
  const seed = [
    [0, ENTRY_KINDS.RUN_START, 'SYSTEM', null, 'Incident file opened — Kamla Balan embankment breach reported by Water Resources Dept patrol.'],
    [7, ENTRY_KINDS.STAGE, 'SYSTEM', null, 'CWC Jhanjharpur gauge crossed warning level 48.80 m at 01:47 IST.'],
    [19, ENTRY_KINDS.STAGE, 'SYSTEM', null, 'Sentinel-1 GRD pass ingested — 41% of AOI under cloud, SAR product selected.'],
    [26, ENTRY_KINDS.WEIGHTS, 'R. K. Sinha', 'Addl. District Magistrate (Disaster)', 'Severity weights confirmed at default 0.45 / 0.35 / 0.20.'],
    [34, ENTRY_KINDS.SIM, 'SYSTEM', null, 'Drone survey round 1 tasked to 6 zones — GARUD 1/2, CHAKOR 1.'],
    [58, ENTRY_KINDS.STAGE, 'SYSTEM', null, 'Survey round 1 complete — 6 zones verified, 214 persons observed.'],
  ];
  for (const [minutes, kind, actor, designation, summary] of seed) {
    store.register.push({
      serial: nextSerial(),
      kind,
      actor,
      designation,
      threadId: null,
      fileNo: INCIDENT.fileNo,
      summary,
      detail: null,
      at: new Date(base + minutes * 60000).toISOString(),
    });
  }
}
