/**
 * Query enrichment data from brand-scoped Postgres.
 * Used by page servers to merge persona-fit scores with BC product data.
 */

import { getDb } from '../db';
import { getBrand } from '$lib/brand/config';
import type { PersonaFitScores } from './types';

export interface ProductEnrichment {
	bcEntityId: number;
	personaFit: PersonaFitScores;
	semanticTags: string[];
	compatibleWith: string[];
	priceTier: string | null;
	style: string | null;
	material: string | null;
}

/**
 * Fetch enrichment data for a list of BC entity IDs.
 * Returns a Map for O(1) lookup when merging with product data.
 */
export async function getEnrichmentByEntityIds(entityIds: number[]): Promise<Map<number, ProductEnrichment>> {
	if (entityIds.length === 0) return new Map();

	try {
		const sql = getDb();
		const brandId = getBrand().id;
		const rows = await sql`
			SELECT
				bc_entity_id,
				fit_gatherer, fit_hunter, fit_researcher, fit_gifter,
				semantic_tags, compatible_with, price_tier, style, material
			FROM enriched_products
			WHERE brand_id = ${brandId} AND bc_entity_id = ANY(${entityIds})
		`;

		const map = new Map<number, ProductEnrichment>();
		for (const row of rows) {
			map.set(row.bc_entity_id as number, {
				bcEntityId: row.bc_entity_id as number,
				personaFit: {
					gatherer: row.fit_gatherer as number,
					hunter: row.fit_hunter as number,
					researcher: row.fit_researcher as number,
					gifter: row.fit_gifter as number,
				},
				semanticTags: (row.semantic_tags as string[]) || [],
				compatibleWith: (row.compatible_with as string[]) || [],
				priceTier: row.price_tier as string | null,
				style: row.style as string | null,
				material: row.material as string | null,
			});
		}
		return map;
	} catch (err) {
		console.warn('[enrichment] Failed to fetch enrichment data:', err);
		return new Map();
	}
}
