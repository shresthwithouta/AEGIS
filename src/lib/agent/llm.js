/**
 * Reasoning layer.
 *
 * AEGIS runs in one of two reasoning modes and always says which one it is in:
 *
 *   LIVE      Claude reasons over the structured pipeline state and returns a
 *             recommendation with its rationale and trade-offs.
 *   FALLBACK  No key, no network, or the call failed. The deterministic rule
 *             engines produce the same shape of answer from published norms.
 *
 * The fallback is not a degraded demo mode — it is a design requirement. A
 * district emergency operations centre during a flood is exactly where a
 * network dependency fails, and an officer must still be able to get a plan and
 * sign it. Every screen that shows a recommendation shows the mode that
 * produced it.
 */

import Anthropic from '@anthropic-ai/sdk';

export const MODEL = 'claude-opus-5';

export const MODE = Object.freeze({
  LIVE: 'live',
  FALLBACK: 'fallback',
});

let client = null;

function getClient() {
  if (client) return client;
  // The SDK also resolves ANTHROPIC_AUTH_TOKEN and an `ant auth login` profile,
  // so absence of the env var is not proof there are no credentials.
  try {
    client = new Anthropic();
    return client;
  } catch {
    return null;
  }
}

export function reasoningConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

/**
 * One reasoning call. Never throws — a failure returns `{ ok: false }` and the
 * caller falls back to the rule engine.
 */
export async function reason({
  system,
  messages,
  tools,
  toolChoice,
  maxTokens = 4000,
  effort = 'high',
  timeoutMs = 45000,
}) {
  const c = getClient();
  if (!c || !reasoningConfigured()) {
    return { ok: false, mode: MODE.FALLBACK, reason: 'no-credentials' };
  }

  const started = Date.now();
  try {
    const response = await c.messages.create(
      {
        model: MODEL,
        max_tokens: maxTokens,
        thinking: { type: 'adaptive' },
        output_config: { effort },
        system,
        messages,
        ...(tools ? { tools } : {}),
        ...(toolChoice ? { tool_choice: toolChoice } : {}),
      },
      { timeout: timeoutMs }
    );

    if (response.stop_reason === 'refusal') {
      return { ok: false, mode: MODE.FALLBACK, reason: 'refusal', details: response.stop_details };
    }

    return {
      ok: true,
      mode: MODE.LIVE,
      model: response.model,
      content: response.content,
      stopReason: response.stop_reason,
      usage: response.usage,
      latencyMs: Date.now() - started,
    };
  } catch (err) {
    let reasonCode = 'error';
    if (err instanceof Anthropic.AuthenticationError) reasonCode = 'auth';
    else if (err instanceof Anthropic.RateLimitError) reasonCode = 'rate-limit';
    else if (err instanceof Anthropic.APIConnectionError) reasonCode = 'offline';
    else if (err instanceof Anthropic.APIError) reasonCode = `api-${err.status}`;
    return { ok: false, mode: MODE.FALLBACK, reason: reasonCode, message: String(err?.message ?? err) };
  }
}

/** Pull the first tool_use block with a given name out of a response. */
export function toolInput(content, name) {
  const block = content?.find((b) => b.type === 'tool_use' && b.name === name);
  return block?.input ?? null;
}

/** Concatenate the visible text of a response. */
export function textOf(content) {
  return (content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();
}

/** A short human-readable explanation of why the system is in fallback mode. */
export const FALLBACK_REASONS = Object.freeze({
  'no-credentials': 'No reasoning credentials configured on this deployment.',
  offline: 'No route to the reasoning service — operating on local rule engines.',
  auth: 'Reasoning credentials were rejected.',
  'rate-limit': 'Reasoning service rate-limited; local rule engines used instead.',
  refusal: 'The reasoning service declined this request; local rule engines used instead.',
  error: 'Reasoning call failed; local rule engines used instead.',
});

export function explainFallback(code) {
  return FALLBACK_REASONS[code] ?? FALLBACK_REASONS.error;
}
