#!/usr/bin/env node
/**
 * AEGIS verification.
 *
 * Exercises every route and every API path the way a reviewer would, and
 * reports what actually happened rather than that it "ran". Run it against a
 * dev server after any change:
 *
 *   node scripts/verify.mjs
 *   node scripts/verify.mjs --url http://localhost:3111
 *
 * Exits non-zero if anything fails, so it works in CI too.
 */

import zlib from 'node:zlib';
import { Buffer } from 'node:buffer';

const args = process.argv.slice(2);
const BASE = (args[args.indexOf('--url') + 1] ?? 'http://localhost:3000').replace(/\/$/, '');

let passed = 0;
let failed = 0;
const failures = [];

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const DIM = '\x1b[2m';
const BOLD = '\x1b[1m';
const OFF = '\x1b[0m';

function ok(name, detail = '') {
  passed++;
  console.log(`  ${GREEN}PASS${OFF}  ${name}${detail ? `  ${DIM}${detail}${OFF}` : ''}`);
}

function bad(name, detail) {
  failed++;
  failures.push(`${name} — ${detail}`);
  console.log(`  ${RED}FAIL${OFF}  ${name}  ${RED}${detail}${OFF}`);
}

function section(title) {
  console.log(`\n${BOLD}${title}${OFF}`);
}

async function get(path, ms = 60000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(`${BASE}${path}`, { signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

async function postJson(path, body, ms = 120000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: c.signal,
    });
  } finally {
    clearTimeout(t);
  }
}

/** Read an SSE stream to completion and return the parsed events. */
async function readSse(res) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const events = [];
  let buffer = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const line = part.trim();
      if (!line.startsWith('data:')) continue;
      try {
        events.push(JSON.parse(line.slice(5).trim()));
      } catch {
        /* partial frame */
      }
    }
  }
  return events;
}

/* ------------------------------------------------------------------ */

async function checkPages() {
  section('Pages');
  const routes = [
    '/',
    '/before',
    '/before/assistant',
    '/operations',
    '/drones',
    '/after',
    '/register',
    '/system',
  ];
  for (const route of routes) {
    try {
      const res = await get(route);
      if (res.status === 200) ok(route);
      else bad(route, `HTTP ${res.status}`);
    } catch (err) {
      bad(route, String(err?.message ?? err));
    }
  }
}

async function checkStatus() {
  section('System status');
  try {
    const res = await get('/api/status');
    const j = await res.json();

    const live = j.reasoning?.configured;
    ok('reasoning mode', live ? `LIVE (${j.reasoning.model})` : 'FALLBACK — rule engines (no API key)');

    const nodes = j.graphs?.pipeline?.nodes?.map((n) => n.id) ?? [];
    const expected = ['ingest', 'vision', 'prioritise', 'survey', 'fuse', 'decide', 'review', 'gate_resources', 'routing', 'gate_dispatch', 'dispatch'];
    const missing = expected.filter((n) => !nodes.includes(n));
    if (missing.length) bad('LangGraph pipeline shape', `missing nodes: ${missing.join(', ')}`);
    else ok('LangGraph pipeline shape', `${nodes.length} nodes, ${j.graphs.pipeline.edges.length} edges`);

    const ragNodes = j.graphs?.rag?.nodes?.map((n) => n.id) ?? [];
    if (ragNodes.includes('verify')) ok('LangGraph RAG shape', `${ragNodes.length} nodes`);
    else bad('LangGraph RAG shape', 'verify node missing');
  } catch (err) {
    bad('/api/status', String(err?.message ?? err));
  }
}

async function checkZones() {
  section('Zone model');
  try {
    const res = await get('/api/zones');
    const j = await res.json();

    if (j.count === 100) ok('zone count', '100');
    else bad('zone count', `expected 100, got ${j.count}`);

    const d = j.distribution ?? {};
    const bands = Object.values(d).reduce((a, b) => a + b, 0);
    if (bands === 100) ok('band distribution', JSON.stringify(d));
    else bad('band distribution', `bands sum to ${bands}, not 100`);

    if (d.critical > 0) ok('critical zones present', String(d.critical));
    else bad('critical zones present', 'zero zones scored Critical — severity model is too compressed');

    // Settlements must outrank empty channel: severity should track risk to people.
    const top = j.top?.[0];
    if (top?.settlement) ok('top zone is inhabited', `${top.id} ${top.settlement} sev ${top.severity}`);
    else bad('top zone is inhabited', `top zone ${top?.id} has no settlement — model may be ranking water, not people`);

    const r = j.requirement;
    const ratio = r.demand.boats / Math.max(1, r.stock.boats);
    if (ratio > 1 && ratio < 3) ok('shortfall is meaningful', `demand/stock = ${ratio.toFixed(2)}× on boats`);
    else bad('shortfall is meaningful', `demand/stock = ${ratio.toFixed(2)}× — allocation decision is trivial or absurd`);
  } catch (err) {
    bad('/api/zones', String(err?.message ?? err));
  }
}

async function checkAssistant() {
  section('Doctrine assistant (RAG)');
  const questions = [
    ['What is the evacuation sequence for a riverine flood?', 'evacuat'],
    ['Who has the authority to order a district evacuation?', 'DDMA|Magistrate|Section 30'],
  ];
  for (const [q, expect] of questions) {
    try {
      const res = await postJson('/api/assistant', { question: q });
      const j = await res.json();
      if (!res.ok) {
        bad(`ask: ${q.slice(0, 40)}`, j.error ?? `HTTP ${res.status}`);
        continue;
      }
      const hit = new RegExp(expect, 'i').test(j.answer);
      if (j.citations.length && hit) {
        ok(`ask: ${q.slice(0, 44)}…`, `${j.citations.length} citations, grounded=${j.grounded}, mode=${j.mode}`);
      } else if (!j.citations.length) {
        bad(`ask: ${q.slice(0, 40)}`, 'no citations returned');
      } else {
        bad(`ask: ${q.slice(0, 40)}`, 'answer did not contain the expected doctrine');
      }
    } catch (err) {
      bad(`ask: ${q.slice(0, 40)}`, String(err?.message ?? err));
    }
  }

  // The refusal path matters more than the happy path: it must decline, not guess.
  try {
    const res = await postJson('/api/assistant', {
      question: 'What is the melting point of tungsten carbide in a vacuum furnace?',
    });
    const j = await res.json();
    const declined = j.empty || j.citations.length === 0 || /does not (contain|cover)/i.test(j.answer);
    if (declined) ok('refuses off-corpus question', 'did not answer from general knowledge');
    else bad('refuses off-corpus question', 'answered a question the corpus does not cover');
  } catch (err) {
    bad('refuses off-corpus question', String(err?.message ?? err));
  }
}

async function checkPipeline() {
  section('Response pipeline (LangGraph, end to end)');
  const threadId = `verify-${Date.now().toString(36)}`;
  const officer = 'VERIFY OFFICER';

  try {
    // --- leg 1: start, expect a halt at gate 1 ---
    const r1 = await postJson('/api/pipeline', { threadId, officer, designation: 'Automated check' });
    if (!r1.ok) return bad('pipeline start', `HTTP ${r1.status}`);
    const e1 = await readSse(r1);

    const err1 = e1.find((e) => e.type === 'error');
    if (err1) return bad('pipeline start', err1.error);

    const visited = e1.filter((e) => e.type === 'node:end').map((e) => e.node);
    for (const n of ['ingest', 'vision', 'prioritise', 'decide', 'review']) {
      if (visited.includes(n)) ok(`node executed: ${n}`);
      else bad(`node executed: ${n}`, 'never ran');
    }

    if (visited.filter((n) => n === 'survey').length >= 1) ok('drone survey ran', `${visited.filter((n) => n === 'survey').length} round(s)`);
    else bad('drone survey ran', 'survey node never executed');

    const int1 = e1.find((e) => e.type === 'interrupt');
    if (int1?.payload?.gate === 1) ok('HALTED at approval gate 1', 'graph stopped for a human — this is the safety property');
    else return bad('HALTED at approval gate 1', 'graph did not stop; it should be impossible to reach dispatch without a signature');

    const review = int1.payload.safetyReview;
    if (review?.verdict) ok('safety agent reviewed the plan', `${review.verdict}, ${review.objections?.length ?? 0} objection(s), source=${review.source}`);
    else bad('safety agent reviewed the plan', 'no safety review attached to the gate');

    const alloc = int1.payload.allocation;
    if (alloc?.allocations?.length) ok('allocation produced', `${alloc.allocations.length} zones, strategy=${alloc.strategy}`);
    else bad('allocation produced', 'no allocations');

    // --- leg 2: approve gate 1, expect a halt at gate 2 ---
    const r2 = await postJson('/api/pipeline', {
      threadId,
      resume: { action: 'approve', officer, designation: 'Automated check', gateLabel: 'gate 1' },
    });
    const e2 = await readSse(r2);
    const err2 = e2.find((e) => e.type === 'error');
    if (err2) return bad('resume gate 1', err2.error);

    const int2 = e2.find((e) => e.type === 'interrupt');
    if (int2?.payload?.gate === 2) ok('HALTED at approval gate 2');
    else return bad('HALTED at approval gate 2', 'second gate did not halt');

    if (e2.some((e) => e.node === 'routing' && e.type === 'node:end')) ok('routing planned');
    else bad('routing planned', 'routing node never completed');

    // --- leg 3: approve gate 2, expect dispatch ---
    const r3 = await postJson('/api/pipeline', {
      threadId,
      resume: { action: 'approve', officer, designation: 'Automated check', gateLabel: 'gate 2' },
    });
    const e3 = await readSse(r3);
    const err3 = e3.find((e) => e.type === 'error');
    if (err3) return bad('resume gate 2', err3.error);

    const end = e3.find((e) => e.type === 'end');
    const order = end?.state?.dispatchOrder;
    if (order?.orders?.length) ok('dispatch order issued', `${order.orders.length} movement orders`);
    else return bad('dispatch order issued', 'run completed without a dispatch order');

    const g1 = order.approvedBy?.gate1;
    const g2 = order.approvedBy?.gate2;
    if (g1?.officer === officer && g2?.officer === officer) ok('both signatures recorded', `${g1.officer} at both gates`);
    else bad('both signatures recorded', `gate1=${g1?.officer ?? 'none'} gate2=${g2?.officer ?? 'none'}`);

    const first = order.orders[0];
    if (first?.text?.hi && /[ऀ-ॿ]/.test(first.text.hi)) ok('bilingual field instruction', 'Hindi present');
    else bad('bilingual field instruction', 'no Devanagari in the Hindi instruction');

    // --- checkpoint recovery ---
    const rec = await get(`/api/pipeline?threadId=${threadId}`);
    const jr = await rec.json();
    if (jr.state?.dispatchOrder) ok('thread recovers from checkpoint', `status=${jr.status}`);
    else bad('thread recovers from checkpoint', 'state did not survive');
  } catch (err) {
    bad('pipeline', String(err?.message ?? err));
  }
}

/**
 * The vision service is optional by design — the pipeline must run without it.
 * So an absent service is reported, not failed; only a *broken* one fails.
 */
async function checkVision() {
  section('Vision service (Python · optional)');
  let health;
  try {
    const res = await get('/api/vision');
    health = await res.json();
  } catch (err) {
    return bad('/api/vision', String(err?.message ?? err));
  }

  if (!health.configured) {
    ok('not configured', 'stage 1 uses the incident model — this is a supported mode, not a failure');
    return;
  }
  if (!health.reachable) {
    ok('configured but down', 'pipeline falls back cleanly — start it with uvicorn to enable');
    return;
  }

  ok('reachable', `device=${health.device}`);
  ok('segmentation', `${health.segmentation?.model} — ${health.trainedSegmentation ? 'TRAINED U-Net' : 'classical baseline (untrained)'}`);
  ok('detection', health.detectionAvailable ? `${health.detection?.model} — real COCO detection` : 'not installed (pip install ultralytics)');

  // Round-trip a generated frame and confirm the segmentation actually
  // separates water from land, rather than merely returning a shaped payload.
  try {
    const W = 240;
    const H = 240;
    const png = makeTestPng(W, H);
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'verify.png');

    const res = await fetch(`${BASE}/api/vision`, { method: 'POST', body: form });
    const j = await res.json();
    if (!res.ok) return bad('analyse a frame', j.error ?? `HTTP ${res.status}`);

    if (j.zones?.length === 100) ok('gridded to 100 zones');
    else bad('gridded to 100 zones', `got ${j.zones?.length}`);

    // Top half is land, bottom half is water in the generated frame.
    const top = j.zones.filter((z) => z.row < 4).reduce((a, z) => a + z.flood, 0) / 40;
    const bottom = j.zones.filter((z) => z.row > 5).reduce((a, z) => a + z.flood, 0) / 40;
    if (bottom > 0.6 && top < 0.3) ok('separates water from land', `land ${top.toFixed(2)} vs water ${bottom.toFixed(2)}`);
    else bad('separates water from land', `land ${top.toFixed(2)} vs water ${bottom.toFixed(2)} — segmentation is not discriminating`);

    // Unmodelled quantities must be null, never zero.
    const z0 = j.zones[0];
    if (z0.depth_m === null) ok('depth reported as null', 'not inferable from one RGB frame — correctly not faked as 0');
    else bad('depth reported as null', `got ${z0.depth_m}`);

    if (!j.provenance?.damage?.available && z0.damage === null) {
      ok('damage reported as null', 'no xBD model loaded — correctly not faked as 0');
    } else if (j.provenance?.damage?.available) {
      ok('damage measured', 'xBD model loaded');
    } else {
      bad('damage reported as null', `damage=${z0.damage} with no model loaded`);
    }

    ok('inference time', `${j.elapsed_ms} ms service / ${j.roundTripMs} ms round trip`);
  } catch (err) {
    bad('analyse a frame', String(err?.message ?? err));
  }
}

/** Minimal uncompressed-ish PNG: dry land on top, water below. No dependencies. */
function makeTestPng(w, h) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  let p = 0;
  for (let y = 0; y < h; y++) {
    raw[p++] = 0; // filter: none
    for (let x = 0; x < w; x++) {
      const water = y > h * 0.5;
      raw[p++] = water ? 68 : 110;
      raw[p++] = water ? 96 : 122;
      raw[p++] = water ? 112 : 68;
    }
  }
  const idat = zlib.deflateSync(raw);

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

async function checkRegister() {
  section('Audit register');
  try {
    const res = await get('/api/register?limit=400');
    const j = await res.json();
    if (j.entries?.length) ok('register has entries', String(j.total));
    else return bad('register has entries', 'empty');

    const kinds = new Set(j.entries.map((e) => e.kind));
    for (const k of ['approval', 'recommendation', 'dispatch']) {
      if (kinds.has(k)) ok(`records ${k}`);
      else bad(`records ${k}`, 'no entry of this kind');
    }

    // The AI's recommendation and the human's approval must be separate actors.
    const rec = j.entries.find((e) => e.kind === 'recommendation');
    const app = j.entries.find((e) => e.kind === 'approval');
    if (rec && app && rec.actor !== app.actor) {
      ok('AI and human recorded separately', `"${rec.actor}" vs "${app.actor}"`);
    } else {
      bad('AI and human recorded separately', 'an inquiry could not tell which of them chose');
    }
  } catch (err) {
    bad('/api/register', String(err?.message ?? err));
  }
}

/* ------------------------------------------------------------------ */

console.log(`${BOLD}AEGIS verification${OFF}  ${DIM}${BASE}${OFF}`);

try {
  await get('/', 8000);
} catch {
  console.log(`\n${RED}No server at ${BASE}${OFF}\nStart it with:  npm run dev\n`);
  process.exit(2);
}

await checkPages();
await checkStatus();
await checkZones();
await checkAssistant();
await checkPipeline();
await checkVision();
await checkRegister();

console.log(`\n${BOLD}${passed} passed, ${failed} failed${OFF}`);
if (failed) {
  console.log(`\n${RED}Failures:${OFF}`);
  for (const f of failures) console.log(`  · ${f}`);
  console.log('');
  process.exit(1);
}
console.log(`${GREEN}Everything checked out.${OFF}\n`);
console.log(`${DIM}This checks behaviour, not appearance. Open ${BASE} and look at it too.${OFF}\n`);
