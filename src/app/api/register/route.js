/**
 * The audit register — read endpoint.
 * Append-only by construction; there is deliberately no delete or update route.
 */

import { register, registerCount, seedRegister } from '@/lib/aegis/store';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  seedRegister();
  const params = new URL(request.url).searchParams;
  const limit = Math.min(400, parseInt(params.get('limit') ?? '200', 10) || 200);
  const kind = params.get('kind');
  const threadId = params.get('threadId');

  return Response.json({
    entries: register({ limit, kind, threadId }),
    total: registerCount(),
    retention: 'Process-local for this prototype. A deployment writes to the district record system under the state retention policy.',
  });
}
