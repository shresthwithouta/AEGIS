/**
 * Client for the Python vision service.
 *
 * Stage 1 has two possible sources and the difference is visible to the user:
 *
 *   Service reachable   Flood extent and victim counts come from real inference
 *                       over a real image, and the zone records carry the model
 *                       name that produced them.
 *   Service absent      The incident model supplies them, labelled SIMULATED.
 *
 * The command centre never blocks on the service and never fails because of it.
 * A vision service that is down during a flood must degrade the analysis, not
 * take the control room offline.
 */

const BASE = process.env.VISION_SERVICE_URL ?? '';
const TIMEOUT_MS = Number(process.env.VISION_SERVICE_TIMEOUT_MS ?? 20000);

export function visionServiceConfigured() {
  return Boolean(BASE);
}

async function withTimeout(promise, ms, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await promise(controller.signal);
  } catch (err) {
    if (err?.name === 'AbortError') throw new Error(`${label} timed out after ${ms} ms`);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Ask the service what it can currently do.
 * Returns a normalised capability record, or `null` when unreachable — never
 * throws, because a health probe failing is an expected state, not an error.
 */
export async function probeVisionService() {
  if (!BASE) return null;
  try {
    const res = await withTimeout(
      (signal) => fetch(`${BASE.replace(/\/$/, '')}/health`, { signal, cache: 'no-store' }),
      5000,
      'Vision service health probe'
    );
    if (!res.ok) return null;
    const health = await res.json();
    return {
      reachable: true,
      device: health.device,
      segmentation: health.segmentation,
      detection: health.detection,
      damage: health.damage_classification,
      // "Real" here means a trained model produced it — the classical baseline
      // is a real method but not a trained one, and the distinction is what the
      // interface labels.
      trainedSegmentation: Boolean(health.segmentation?.trained),
      detectionAvailable: Boolean(health.detection?.available),
      damageAvailable: Boolean(health.damage_classification?.available),
    };
  } catch {
    return null;
  }
}

/**
 * Run stage 1 over an image.
 * `file` is a Blob/File. Returns the service's per-zone record and provenance.
 */
export async function analyseFrame(file, { grid = 10 } = {}) {
  if (!BASE) throw new Error('VISION_SERVICE_URL is not configured');

  const form = new FormData();
  form.append('image', file);

  const res = await withTimeout(
    (signal) =>
      fetch(`${BASE.replace(/\/$/, '')}/analyse?grid=${grid}`, {
        method: 'POST',
        body: form,
        signal,
      }),
    TIMEOUT_MS,
    'Vision analysis'
  );

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Vision service responded ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`);
  }
  return res.json();
}

/**
 * Merge a service response into the zone records the pipeline reasons over.
 *
 * Only fields the service actually measured are overwritten. Damage is left on
 * the incident model's value when no damage checkpoint is loaded, and the merged
 * record says so per field — so a zone can honestly report "flood observed,
 * damage still modelled", which is the real state of a build with FloodNet
 * weights but no xBD weights.
 */
export function mergeVisionResult(zones, result) {
  const byId = Object.fromEntries((result?.zones ?? []).map((z) => [z.id, z]));
  const prov = result?.provenance ?? {};
  const damageMeasured = Boolean(prov.damage?.available);
  const detectionAvailable = Boolean(prov.detection?.available);

  return zones.map((z) => {
    const obs = byId[z.id];
    if (!obs) return z;

    return {
      ...z,
      flood: obs.flood,
      ...(damageMeasured && obs.damage != null ? { damage: obs.damage } : {}),
      ...(damageMeasured && obs.damaged_structures != null
        ? { damagedStructures: obs.damaged_structures }
        : {}),
      confidence: obs.segmentation_confidence ?? z.confidence,
      // Depth is not inferable from one RGB frame; the incident model's figure
      // stays, and is flagged as modelled rather than measured.
      source: {
        flood: prov.segmentation?.method === 'unet' ? 'unet' : 'spectral-baseline',
        floodModel: prov.segmentation?.model ?? null,
        damage: damageMeasured ? 'yolo-xbd' : 'modelled',
        counts: detectionAvailable ? 'yolo' : 'unavailable',
        depth: 'modelled',
      },
      ...(detectionAvailable
        ? {
            detected: {
              persons: obs.persons,
              animals: obs.animals,
              vehicles: obs.vehicles,
              confidence: obs.detection_confidence,
            },
          }
        : {}),
    };
  });
}
