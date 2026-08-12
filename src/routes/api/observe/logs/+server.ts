import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/db';
import { getBrand } from '$lib/brand/config';

/**
	* GET /api/observe/logs?limit=20
	* Returns recent generation logs from Postgres.
 */
export const GET: RequestHandler = async ({ url }) => {
	const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100);
	const sessionId = url.searchParams.get('session') || null;

	const sql = getDb();
	const brand = getBrand();
	const brandId = brand.id;
	const organizationId = brand.organizationId;
		const rows = sessionId
			? await sql`
				SELECT
					type, persona, category_slug, cache_hit,
					generation_ms, product_count, input_tokens, output_tokens,
					eval_score, prompt_version, model, estimated_cost, session_id, synthetic, scenario_id, created_at,
					organization_id, brand_id, provenance_version, reference_status,
					reference_id, reference_version, policy_version, surface, route,
					viewport_class, renderer_component_id, renderer_variant_id,
					decision_source, input_hash, catalog_version, shopper_context_hash,
					picks_hash, incentive_hash, autonomy_preset, effective_capabilities,
					decision_mode, publication_mode, schema_version
				FROM generation_logs
				WHERE brand_id = ${brandId}
					AND (organization_id = ${organizationId} OR organization_id IS NULL)
					AND session_id = ${sessionId}
				ORDER BY created_at DESC
				LIMIT ${limit}
			`
			: await sql`
				SELECT
					type, persona, category_slug, cache_hit,
					generation_ms, product_count, input_tokens, output_tokens,
					eval_score, prompt_version, model, estimated_cost, session_id, synthetic, scenario_id, created_at,
					organization_id, brand_id, provenance_version, reference_status,
					reference_id, reference_version, policy_version, surface, route,
					viewport_class, renderer_component_id, renderer_variant_id,
					decision_source, input_hash, catalog_version, shopper_context_hash,
					picks_hash, incentive_hash, autonomy_preset, effective_capabilities,
					decision_mode, publication_mode, schema_version
				FROM generation_logs
				WHERE brand_id = ${brandId}
					AND (organization_id = ${organizationId} OR organization_id IS NULL)
				ORDER BY created_at DESC
				LIMIT ${limit}
			`;

		const logs = rows.map((row) => ({
			type: row.type,
			persona: row.persona,
			categorySlug: row.category_slug,
			cacheHit: row.cache_hit,
			generationMs: row.generation_ms,
			productCount: row.product_count,
			inputTokens: row.input_tokens,
			outputTokens: row.output_tokens,
			evalScore: row.eval_score,
			promptVersion: row.prompt_version,
			model: row.model,
			estimatedCost: row.estimated_cost,
			sessionId: row.session_id,
			synthetic: row.synthetic,
			scenarioId: row.scenario_id,
			createdAt: row.created_at,
			provenance: row.provenance_version ? {
				version: row.provenance_version,
				organizationId: row.organization_id,
				brandId: row.brand_id,
				reference: {
					status: row.reference_status,
					id: row.reference_id,
					version: row.reference_version,
				},
				policyVersion: row.policy_version,
				surface: row.surface,
				route: row.route,
				viewportClass: row.viewport_class,
				renderer: {
					componentId: row.renderer_component_id,
					variantId: row.renderer_variant_id,
				},
				decisionSource: row.decision_source,
				inputHash: row.input_hash,
				catalogVersion: row.catalog_version,
				shopperContextHash: row.shopper_context_hash,
				picksHash: row.picks_hash,
				incentiveHash: row.incentive_hash,
				autonomy: {
					preset: row.autonomy_preset,
					effectiveCapabilities: row.effective_capabilities ?? [],
					decisionMode: row.decision_mode,
					publicationMode: row.publication_mode,
				},
				promptVersion: row.prompt_version,
				schemaVersion: row.schema_version,
				synthetic: { value: row.synthetic, scenarioId: row.scenario_id },
			} : null,
		}));

	return json({ logs });
};
