/**
 * Deterministic pseudo-random number generation.
 *
 * Every synthetic figure AEGIS shows a user is derived from a named seed, so
 * two officers looking at the same incident reference see identical numbers,
 * and a demo replays exactly. Nothing here is cryptographic.
 */

/** mulberry32 — small, fast, well-distributed 32-bit PRNG. */
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a — turns an incident reference such as "AEG/26206/2026-DM" into a seed. */
export function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export function rngFrom(str) {
  return makeRng(hashSeed(str));
}

/** Uniform float in [min, max). */
export function range(rng, min, max) {
  return min + rng() * (max - min);
}

/** Integer in [min, max] inclusive. */
export function intRange(rng, min, max) {
  return Math.floor(min + rng() * (max - min + 1));
}

/** Approximately normal via Irwin–Hall (sum of 3 uniforms), clamped to [0,1]. */
export function bell(rng) {
  return clamp01((rng() + rng() + rng()) / 3);
}

export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}

export function clamp01(n) {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n;
}

/** Smooth, seamless-ish value noise over a 2D lattice. Used for flood fields. */
export function valueNoise2D(seed) {
  const rng = makeRng(seed);
  const size = 16;
  const lattice = new Float32Array(size * size);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng();

  const at = (x, y) => lattice[(((y % size) + size) % size) * size + (((x % size) + size) % size)];
  const fade = (t) => t * t * (3 - 2 * t);

  return function sample(x, y) {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = fade(x - x0);
    const fy = fade(y - y0);
    const a = at(x0, y0);
    const b = at(x0 + 1, y0);
    const c = at(x0, y0 + 1);
    const d = at(x0 + 1, y0 + 1);
    return a * (1 - fx) * (1 - fy) + b * fx * (1 - fy) + c * (1 - fx) * fy + d * fx * fy;
  };
}
