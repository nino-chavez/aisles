/**
 * Product search with two strategies:
 *
 * 1. Vector search (pgvector) — embeds the query and finds nearest products
 *    by cosine similarity. Best results, requires OpenRouter API key.
 *
 * 2. Tag search (fallback) — matches query terms against enrichment data
 *    (semantic tags and Kibble pet-profile fields). No API call needed.
 */

import { env } from '$env/dynamic/private';
import { getDb } from './db';
import { getBrand } from '$lib/brand/config';

export interface SearchResult {
	bcEntityId: number;
	bcProductPath: string;
	relevanceScore: number;
	personaFit: {
		gatherer: number;
		hunter: number;
		researcher: number;
		gifter: number;
	};
	semanticTags: string[];
	priceTier: string | null;
	petProfile: {
		protein: string;
		lifeStage: string;
		format: string;
		dietary: string;
		petSize: string;
		replenishmentDays: number | null;
		subscriptionFit: number;
	};
}

/**
 * Search products — tries vector search first, falls back to tag search.
 */
export async function searchProducts(query: string, limit = 20): Promise<SearchResult[]> {
	// Try vector search if OpenRouter is configured
	const vectorResults = await vectorSearch(query, limit);
	if (vectorResults.length > 0) return vectorResults;

	// Fallback to tag-based search
	return tagSearch(query, limit);
}

// ─── Vector search (pgvector) ──────────────────────────────────────

async function vectorSearch(query: string, limit: number): Promise<SearchResult[]> {
	const apiKey = env.OPENROUTER_API_KEY;
	if (!apiKey) return [];

	try {
		const { createOpenRouter } = await import('@openrouter/ai-sdk-provider');
		const { embed } = await import('ai');

		const openrouter = createOpenRouter({ apiKey });
		const { embedding } = await embed({
			model: openrouter.textEmbeddingModel('openai/text-embedding-3-small'),
			value: query,
		});

		const vecStr = `[${embedding.join(',')}]`;
		const sql = getDb();
		const brandId = getBrand().id;

		const rows = await sql`
			SELECT
				bc_entity_id,
				bc_product_path,
				fit_gatherer, fit_hunter, fit_researcher, fit_gifter,
				semantic_tags,
				price_tier,
				protein, life_stage, format, dietary, pet_size, replenishment_days, subscription_fit,
				1 - (embedding <=> ${vecStr}::extensions.vector) as similarity
			FROM enriched_products
			WHERE brand_id = ${brandId} AND embedding IS NOT NULL
			ORDER BY embedding <=> ${vecStr}::extensions.vector
			LIMIT ${limit}
		`;

		return rows.map((r) => ({
			bcEntityId: r.bc_entity_id as number,
			bcProductPath: r.bc_product_path as string,
			relevanceScore: r.similarity as number,
			personaFit: {
				gatherer: r.fit_gatherer as number,
				hunter: r.fit_hunter as number,
				researcher: r.fit_researcher as number,
				gifter: r.fit_gifter as number,
			},
				semanticTags: (r.semantic_tags as string[]) || [],
				priceTier: r.price_tier as string | null,
				petProfile: rowToPetProfile(r),
		}));
	} catch (err) {
		console.warn('[search] Vector search failed, falling back to tags:', err instanceof Error ? err.message : err);
		return [];
	}
}

// ─── Tag search (fallback) ─────────────────────────────────────────

async function tagSearch(query: string, limit: number): Promise<SearchResult[]> {
	try {
		const sql = getDb();
		const brandId = getBrand().id;
		const terms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
		if (terms.length === 0) return [];

		const likePatterns = terms.map((t) => `%${t}%`);

		const rows = await sql`
			SELECT
				bc_entity_id,
				bc_product_path,
				fit_gatherer, fit_hunter, fit_researcher, fit_gifter,
				semantic_tags,
				price_tier,
				protein, life_stage, format, dietary, pet_size, replenishment_days, subscription_fit,
				(
					SELECT COUNT(*)::int FROM unnest(${likePatterns}::text[]) AS term
					WHERE
						bc_product_path ILIKE term
						OR protein ILIKE term
						OR life_stage ILIKE term
						OR format ILIKE term
						OR dietary ILIKE term
						OR pet_size ILIKE term
						OR EXISTS (
							SELECT 1 FROM unnest(semantic_tags) AS tag WHERE tag ILIKE term
						)
				) as match_count
			FROM enriched_products
			WHERE brand_id = ${brandId} AND EXISTS (
				SELECT 1 FROM unnest(${likePatterns}::text[]) AS term
				WHERE
					bc_product_path ILIKE term
					OR protein ILIKE term
					OR life_stage ILIKE term
					OR format ILIKE term
					OR dietary ILIKE term
					OR pet_size ILIKE term
					OR EXISTS (
						SELECT 1 FROM unnest(semantic_tags) AS tag WHERE tag ILIKE term
					)
			)
			ORDER BY match_count DESC, bc_entity_id
			LIMIT ${limit}
		`;

		return rows.map((r) => ({
			bcEntityId: r.bc_entity_id as number,
			bcProductPath: r.bc_product_path as string,
			relevanceScore: (r.match_count as number) / terms.length,
			personaFit: {
				gatherer: r.fit_gatherer as number,
				hunter: r.fit_hunter as number,
				researcher: r.fit_researcher as number,
				gifter: r.fit_gifter as number,
			},
				semanticTags: (r.semantic_tags as string[]) || [],
				priceTier: r.price_tier as string | null,
				petProfile: rowToPetProfile(r),
		}));
	} catch (err) {
		console.warn('[search] Tag search failed:', err);
		return [];
	}
}

function rowToPetProfile(row: Record<string, unknown>): SearchResult['petProfile'] {
	return {
		protein: row.protein as string,
		lifeStage: row.life_stage as string,
		format: row.format as string,
		dietary: row.dietary as string,
		petSize: row.pet_size as string,
		replenishmentDays: row.replenishment_days as number | null,
		subscriptionFit: row.subscription_fit as number,
	};
}
