/**
 * Imagery ingestion — stage 1, against the real vision service.
 *
 * Takes an uploaded frame, forwards it to the Python U-Net + YOLOv8 service,
 * and returns the 100-zone record it produced together with the provenance
 * block saying which model produced each field. The command centre labels the
 * result from that block: a figure a trained model produced and a figure a
 * classical baseline produced must not look alike on screen.
 *
 * GET reports whether the service is reachable and what it can currently do,
 * so the interface can say so before anyone uploads anything.
 */

import { analyseFrame, probeVisionService, visionServiceConfigured } from '@/lib/aegis/visionService';
import { record, ENTRY_KINDS, seedRegister } from '@/lib/aegis/store';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MAX_BYTES = 24 * 1024 * 1024;
const ACCEPTED = /^image\/(png|jpeg|jpg|webp|tiff?)$/i;

export async function GET() {
  if (!visionServiceConfigured()) {
    return Response.json({
      configured: false,
      reachable: false,
      note: 'No vision service configured. Set VISION_SERVICE_URL to enable imagery ingestion; stage 1 uses the incident model until then.',
    });
  }

  const health = await probeVisionService();
  if (!health?.reachable) {
    return Response.json({
      configured: true,
      reachable: false,
      note: 'Vision service configured but not answering. Start it: cd services/vision && .venv/Scripts/python -m uvicorn app:app --port 8000',
    });
  }

  return Response.json({ configured: true, ...health });
}

export async function POST(request) {
  await seedRegister();

  if (!visionServiceConfigured()) {
    return Response.json(
      { error: 'No vision service configured on this deployment.', configured: false },
      { status: 503 }
    );
  }

  let form;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: 'Expected a multipart form with an "image" field.' }, { status: 400 });
  }

  const file = form.get('image');
  if (!file || typeof file === 'string') {
    return Response.json({ error: 'No image supplied.' }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `Image is ${(file.size / 1e6).toFixed(1)} MB; the limit is ${MAX_BYTES / 1e6} MB.` },
      { status: 413 }
    );
  }
  if (file.type && !ACCEPTED.test(file.type)) {
    return Response.json({ error: `Unsupported image type "${file.type}".` }, { status: 415 });
  }

  const started = Date.now();
  try {
    const result = await analyseFrame(file, { grid: 10 });
    const prov = result.provenance ?? {};

    await record({
      kind: ENTRY_KINDS.STAGE,
      actor: prov.segmentation?.trained ? 'AEGIS VISION (U-Net)' : 'AEGIS VISION (classical baseline)',
      summary:
        `Imagery ingested — ${result.summary?.flooded_zones ?? 0} of ${result.summary?.zones ?? 0} zones above 30% inundation` +
        `${prov.detection?.available ? `, ${result.summary?.persons ?? 0} persons detected` : ', detection unavailable'}.`,
      detail: { file: file.name, bytes: file.size, provenance: prov },
    });

    return Response.json({
      ...result,
      file: { name: file.name, bytes: file.size, type: file.type || null },
      roundTripMs: Date.now() - started,
    });
  } catch (err) {
    // A vision service that is down must degrade the analysis, never take the
    // control room offline — so this is a reported failure, not a crash.
    return Response.json(
      {
        error: String(err?.message ?? err),
        note: 'Stage 1 falls back to the incident model when the vision service is unavailable.',
      },
      { status: 502 }
    );
  }
}
