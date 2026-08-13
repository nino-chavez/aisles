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
import { LayoutProvenanceSchema, type LayoutProvenance } from './layout-provenance';

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
	type: 'layout' | 'refine' | 'preserve_render';
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
	provenance: LayoutProvenance;
}

export async function logGeneration(entry: GenerationLogEntry): Promise<void> {
	const sql = getDb();
	const provenance = LayoutProvenanceSchema.parse(entry.provenance);
	const cost = estimateCost(entry.model, entry.inputTokens, entry.outputTokens);
	await sql`
		INSERT INTO generation_logs (
			organization_id, brand_id, type, persona, category_slug, cache_hit, generation_ms,
			product_count, input_tokens, output_tokens, eval_score,
			prompt_version, model, estimated_cost, session_id, synthetic, scenario_id,
			provenance_version, reference_status, reference_id, reference_version,
			policy_version, surface, route, viewport_class,
			renderer_component_id, renderer_variant_id, decision_source,
			input_hash, catalog_version, shopper_context_hash, picks_hash, incentive_hash,
			autonomy_preset, effective_capabilities, decision_mode, publication_mode,
			schema_version
		) VALUES (
			${provenance.organizationId}, ${provenance.brandId}, ${entry.type},
			${entry.persona}, ${entry.categorySlug},
			${entry.cacheHit}, ${entry.generationTimeMs},
			${entry.productCount ?? null}, ${entry.inputTokens ?? null},
			${entry.outputTokens ?? null}, ${entry.evalScore ?? null},
			${provenance.promptVersion}, ${entry.model ?? null}, ${cost}, ${entry.sessionId ?? null},
			${provenance.synthetic.value}, ${provenance.synthetic.scenarioId},
			${provenance.version}, ${provenance.reference.status},
			${provenance.reference.id}, ${provenance.reference.version},
			${provenance.policyVersion}, ${provenance.surface}, ${provenance.route},
			${provenance.viewportClass}, ${provenance.renderer.componentId},
			${provenance.renderer.variantId}, ${provenance.decisionSource},
			${provenance.inputHash}, ${provenance.catalogVersion},
			${provenance.shopperContextHash}, ${provenance.picksHash},
			${provenance.incentiveHash}, ${provenance.autonomy.preset},
			${sql.json(provenance.autonomy.effectiveCapabilities)},
			${provenance.autonomy.decisionMode}, ${provenance.autonomy.publicationMode},
			${provenance.schemaVersion}
		)
	`;
}
