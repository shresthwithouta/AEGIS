/**
 * The audit register — read endpoint.
 * Append-only by construction; there is deliberately no delete or update route.
 */

import { register, registerCount, seedRegister } from '@/lib/aegis/store';
import { mongoConfigured } from '@/lib/aegis/mongo';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  await seedRegister();
  const params = new URL(request.url).searchParams;
  const limit = Math.min(400, parseInt(params.get('limit') ?? '200', 10) || 200);
  const kind = params.get('kind');
  const threadId = params.get('threadId');

  return Response.json({
    entries: await register({ limit, kind, threadId }),
    total: await registerCount(),
    retention: mongoConfigured()
      ? 'Persisted to this deployment’s MongoDB. A production deployment applies the district record system’s own retention policy.'
      : 'Process-local for this prototype — resets on restart. Set MONGODB_URI to persist the register.',
  });
}
