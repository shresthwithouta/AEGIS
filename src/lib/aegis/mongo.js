/**
 * MongoDB connection, shared across the app.
 *
 * Optional, like everything else in this system: with no MONGODB_URI the
 * audit register falls back to the process-local in-memory store it always
 * had. With one set, entries survive a restart and a serverless cold start —
 * which matters once this runs on Vercel, where the in-memory store is
 * per-instance and not something an officer can rely on months later.
 *
 * The client is cached on `globalThis` so dev's hot reload and serverless's
 * warm invocations reuse one connection instead of opening a new pool per
 * request.
 */

import dns from 'node:dns';
import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const g = globalThis;

export function mongoConfigured() {
  return Boolean(uri);
}

function clientPromise() {
  if (!uri) return null;
  if (!g.__AEGIS_MONGO_PROMISE__) {
    // Node's built-in DNS resolver can fail the SRV/TXT lookups that
    // `mongodb+srv://` needs, on networks/sandboxes where the OS resolver
    // works fine (a known Node quirk, seen on Windows and some containers).
    // Set right before connecting — some dev runtimes run route handlers in
    // worker threads where a module-load-time override doesn't carry over.
    try {
      dns.setServers(['8.8.8.8', '1.1.1.1', ...dns.getServers()]);
    } catch {
      /* best-effort — falls through to whatever Node had configured */
    }
    const client = new MongoClient(uri);
    g.__AEGIS_MONGO_PROMISE__ = client.connect();
  }
  return g.__AEGIS_MONGO_PROMISE__;
}

/** Returns the database, or `null` when MONGODB_URI is not set. Never throws. */
export async function getDb() {
  const cp = clientPromise();
  if (!cp) return null;
  try {
    const client = await cp;
    return client.db('aegis');
  } catch (err) {
    console.error('[aegis] MongoDB connection failed, falling back to in-memory store:', err?.message ?? err);
    g.__AEGIS_MONGO_PROMISE__ = null;
    return null;
  }
}
