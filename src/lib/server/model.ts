/**
 * Model access — Anthropic via Cloudflare AI Gateway.
 *
 * All layout/suggest/refine generation goes through one provider instance.
 * When CF_AI_GATEWAY_URL is set (e.g.
 * https://gateway.ai.cloudflare.com/v1/<account>/<gateway>/anthropic) requests
 * route through Cloudflare AI Gateway for observability and caching; without
 * it, calls go straight to the Anthropic API. Either way ANTHROPIC_API_KEY
 * authenticates.
 *
 * Fallback is explicit here rather than delegated to a gateway: Haiku is the
 * primary (fast, cheap, right most of the time), and a failed generation is
 * retried once on Sonnet.
 */
import { createAnthropic } from '@ai-sdk/anthropic';

const GATEWAY_URL = process.env.CF_AI_GATEWAY_URL;

const anthropic = createAnthropic({
	apiKey: process.env.ANTHROPIC_API_KEY,
	...(GATEWAY_URL ? { baseURL: `${GATEWAY_URL.replace(/\/$/, '')}/v1` } : {})
});

export const PRIMARY_MODEL = 'claude-haiku-4-5';
export const FALLBACK_MODEL = 'claude-sonnet-4-6';
export const MODEL_PROVIDER = 'anthropic' as const;

export function model(id: string = PRIMARY_MODEL) {
	return anthropic(id);
}

/**
 * Run a generation on the primary model; retry once on the fallback model if
 * the primary attempt throws. Returns the result plus the model id that
 * actually served it.
 */
export async function withModelFallback<T>(
	run: (modelId: string) => Promise<T>,
	signal?: AbortSignal,
): Promise<{ result: T; modelId: string }> {
	throwIfAborted(signal);
	try {
		return { result: await run(PRIMARY_MODEL), modelId: PRIMARY_MODEL };
	} catch (primaryError) {
		// The action has one total deadline. A primary failure may fall back only
		// while the same deadline remains live.
		if (signal?.aborted) throw primaryError;
		console.warn(`[model] ${PRIMARY_MODEL} failed, retrying on ${FALLBACK_MODEL}:`, primaryError);
		return { result: await run(FALLBACK_MODEL), modelId: FALLBACK_MODEL };
	}
}

function throwIfAborted(signal: AbortSignal | undefined) {
	if (signal?.aborted) throw signal.reason instanceof Error ? signal.reason : new Error('Model action was aborted.');
}
