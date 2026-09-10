/**
 * Run state and the audit register.
 *
 * The audit register is the point of the system. Every AI recommendation,
 * every human decision, every override and every dispatch is written here with
 * an actor and a timestamp, because a district officer will be asked months
 * later why a particular boat went to a particular village, and "the system
 * decided" is not an answer that survives an inquiry.
 *
 * Backed by MongoDB when MONGODB_URI is set, so entries survive a restart and
 * a serverless cold start. Falls back to a process-local in-memory store when
 * it is not — the interface shape is identical either way, which is what lets
 * every caller stay unaware of which one it is talking to.
 */

import { INCIDENT } from './incident';
import { getDb } from './mongo';

const g = globalThis;
if (!g.__AEGIS_STORE__) {
  g.__AEGIS_STORE__ = {
    runs: new Map(), // threadId → run summary
    register: [], // audit entries, append-only
    serial: 40,
  };
}
const mem = g.__AEGIS_STORE__;

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

async function nextSerial(db) {
  if (!db) {
    mem.serial += 1;
    return String(mem.serial).padStart(4, '0');
  }
  const doc = await db
    .collection('counters')
    .findOneAndUpdate({ _id: 'register_serial' }, { $inc: { value: 1 } }, { upsert: true, returnDocument: 'after' });
  return String(doc.value).padStart(4, '0');
}

/**
 * Append to the register. Returns the written entry.
 * Entries are never updated or deleted — a correction is a new entry.
 */
export async function record({
  kind,
  actor = 'SYSTEM',
  designation = null,
  threadId = null,
  summary,
  detail = null,
  fileNo = INCIDENT.fileNo,
}) {
  const db = await getDb();
  const serial = await nextSerial(db);
  const entry = { serial, kind, actor, designation, threadId, fileNo, summary, detail, at: new Date().toISOString() };

  if (!db) {
    mem.register.push(entry);
    if (mem.register.length > 800) mem.register.splice(0, mem.register.length - 800);
    return entry;
  }

  await db.collection('register').insertOne({ ...entry });
  return entry;
}

export async function register({ limit = 200, kind = null, threadId = null } = {}) {
  const db = await getDb();

  if (!db) {
    let out = mem.register;
    if (kind) out = out.filter((e) => e.kind === kind);
    if (threadId) out = out.filter((e) => e.threadId === threadId);
    return out.slice(-limit).reverse();
  }

  const filter = {};
  if (kind) filter.kind = kind;
  if (threadId) filter.threadId = threadId;
  return db
    .collection('register')
    .find(filter, { projection: { _id: 0 } })
    .sort({ serial: -1 })
    .limit(limit)
    .toArray();
}

export async function registerCount() {
  const db = await getDb();
  if (!db) return mem.register.length;
  return db.collection('register').countDocuments();
}

/* ------------------------------------------------------------------ */
/* Run tracking                                                        */
/* ------------------------------------------------------------------ */

export async function saveRun(threadId, patch) {
  const db = await getDb();

  if (!db) {
    const prev = mem.runs.get(threadId) ?? { threadId, createdAt: Date.now() };
    const next = { ...prev, ...patch, updatedAt: Date.now() };
    mem.runs.set(threadId, next);
    if (mem.runs.size > 50) {
      const oldest = [...mem.runs.entries()].sort((a, b) => a[1].updatedAt - b[1].updatedAt)[0];
      if (oldest) mem.runs.delete(oldest[0]);
    }
    return next;
  }

  const now = Date.now();
  return db.collection('runs').findOneAndUpdate(
    { threadId },
    { $set: { ...patch, updatedAt: now }, $setOnInsert: { threadId, createdAt: now } },
    { upsert: true, returnDocument: 'after', projection: { _id: 0 } }
  );
}

export async function getRun(threadId) {
  const db = await getDb();
  if (!db) return mem.runs.get(threadId) ?? null;
  return db.collection('runs').findOne({ threadId }, { projection: { _id: 0 } });
}

export async function listRuns() {
  const db = await getDb();
  if (!db) return [...mem.runs.values()].sort((a, b) => b.updatedAt - a.updatedAt);
  return db.collection('runs').find({}, { projection: { _id: 0 } }).sort({ updatedAt: -1 }).limit(50).toArray();
}

/** Seed the register so a cold start still shows a plausible shift history. */
export async function seedRegister() {
  const db = await getDb();
  const seed = [
    [0, ENTRY_KINDS.RUN_START, 'SYSTEM', null, 'Incident file opened — Kamla Balan embankment breach reported by Water Resources Dept patrol.'],
    [7, ENTRY_KINDS.STAGE, 'SYSTEM', null, 'CWC Jhanjharpur gauge crossed warning level 48.80 m at 01:47 IST.'],
    [19, ENTRY_KINDS.STAGE, 'SYSTEM', null, 'Sentinel-1 GRD pass ingested — 41% of AOI under cloud, SAR product selected.'],
    [26, ENTRY_KINDS.WEIGHTS, 'R. K. Sinha', 'Addl. District Magistrate (Disaster)', 'Severity weights confirmed at default 0.45 / 0.35 / 0.20.'],
    [34, ENTRY_KINDS.SIM, 'SYSTEM', null, 'Drone survey round 1 tasked to 6 zones — GARUD 1/2, CHAKOR 1.'],
    [58, ENTRY_KINDS.STAGE, 'SYSTEM', null, 'Survey round 1 complete — 6 zones verified, 214 persons observed.'],
  ];
  const base = new Date('2026-09-08T01:40:00+05:30').getTime();

  if (!db) {
    if (mem.register.length) return;
    for (const [minutes, kind, actor, designation, summary] of seed) {
      mem.register.push({
        serial: await nextSerial(null),
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
    return;
  }

  const count = await db.collection('register').countDocuments();
  if (count) return;

  const docs = [];
  for (const [minutes, kind, actor, designation, summary] of seed) {
    docs.push({
      serial: await nextSerial(db),
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
  await db.collection('register').insertMany(docs);
}
