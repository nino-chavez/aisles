/**
 * Domain-specific generation logging.
 *
 * Records every layout/refinement generation with context that the
 * AI Gateway doesn't have: persona, category, signal count, cache hit,
 * evaluation score. Stored in Postgres alongside enrichment data.
 *
 * AI Gateway handles LLM-level observability (tokens, latency, cost).
 * This handles domain-level observability (persona, quality, conversion).
 */

import { getDb } from './db';
import { getBrand } from '$lib/brand/config';

// Per-1M token pricing (USD) — update when Anthropic changes pricing
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
	'anthropic/claude-haiku-4.5': { input: 0.80, output: 4.00 },
	'anthropic/claude-sonnet-4.6': { input: 3.00, output: 15.00 },
};

function estimateCost(model: string | undefined, inputTokens: number | undefined, outputTokens: number | undefined): number | null {
	if (!model || !inputTokens || !outputTokens) return null;
	const pricing = MODEL_PRICING[model];
	if (!pricing) return null;
	return (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
}

export interface GenerationLogEntry {
	type: 'layout' | 'refine';
	persona: string;
	categorySlug: string;
	cacheHit: boolean;
	generationTimeMs: number;
	productCount?: number;
	inputTokens?: number;
	outputTokens?: number;
	evalScore?: number;
	model?: string;
	sessionId?: string;
	synthetic?: boolean;
	scenarioId?: string | null;
}

export async function logGeneration(entry: GenerationLogEntry): Promise<void> {
	const sql = getDb();
	const brandId = getBrand().id;
	const cost = estimateCost(entry.model, entry.inputTokens, entry.outputTokens);
	await sql`
		INSERT INTO generation_logs (
			brand_id, type, persona, category_slug, cache_hit, generation_ms,
			product_count, input_tokens, output_tokens, eval_score,
			model, estimated_cost, session_id, synthetic, scenario_id
		) VALUES (
			${brandId}, ${entry.type}, ${entry.persona}, ${entry.categorySlug},
			${entry.cacheHit}, ${entry.generationTimeMs},
			${entry.productCount ?? null}, ${entry.inputTokens ?? null},
			${entry.outputTokens ?? null}, ${entry.evalScore ?? null},
			${entry.model ?? null}, ${cost}, ${entry.sessionId ?? null},
			${entry.synthetic ?? false}, ${entry.scenarioId ?? null}
		)
	`;
}
