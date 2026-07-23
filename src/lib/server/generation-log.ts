/**
 * Domain-specific generation logging.
 *
 * Records every layout/refinement generation with context that the
 * AI Gateway doesn't have: persona, category, signal count, cache hit,
 * evaluation score. Stored in Neon Postgres alongside enrichment data.
 *
 * AI Gateway handles LLM-level observability (tokens, latency, cost).
 * This handles domain-level observability (persona, quality, conversion).
 */

import { getDb } from './db';

let tableCreated = false;

async function ensureTable() {
	if (tableCreated) return;
	const sql = getDb();
	await sql`
		CREATE TABLE IF NOT EXISTS generation_logs (
			id              SERIAL PRIMARY KEY,
			type            TEXT NOT NULL,
			persona         TEXT NOT NULL,
			category_slug   TEXT NOT NULL,
			cache_hit       BOOLEAN NOT NULL DEFAULT false,
			generation_ms   INTEGER NOT NULL,
			product_count   INTEGER,
			input_tokens    INTEGER,
			output_tokens   INTEGER,
			eval_score      REAL,
			prompt_version  TEXT DEFAULT 'v1',
			model           TEXT,
			estimated_cost  REAL,
			created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
		)
	`;
	// Add columns if they don't exist (idempotent migration for existing tables)
	await sql`ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS model TEXT`.catch(() => {});
	await sql`ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS estimated_cost REAL`.catch(() => {});
	await sql`ALTER TABLE generation_logs ADD COLUMN IF NOT EXISTS session_id TEXT`.catch(() => {});
	tableCreated = true;
}

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
}

export async function logGeneration(entry: GenerationLogEntry): Promise<void> {
	try {
		await ensureTable();
		const sql = getDb();
		const cost = estimateCost(entry.model, entry.inputTokens, entry.outputTokens);
		await sql`
			INSERT INTO generation_logs (
				type, persona, category_slug, cache_hit, generation_ms,
				product_count, input_tokens, output_tokens, eval_score,
				model, estimated_cost, session_id
			) VALUES (
				${entry.type}, ${entry.persona}, ${entry.categorySlug},
				${entry.cacheHit}, ${entry.generationTimeMs},
				${entry.productCount ?? null}, ${entry.inputTokens ?? null},
				${entry.outputTokens ?? null}, ${entry.evalScore ?? null},
				${entry.model ?? null}, ${cost}, ${entry.sessionId ?? null}
			)
		`;
	} catch (err) {
		console.warn('[generation-log] Failed to log:', err instanceof Error ? err.message : err);
	}
}
