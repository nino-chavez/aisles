/**
 * Catalog utilities shared between page servers and API endpoints.
 *
 * Handles the category slug → BC category mapping, product transformation,
 * and enrichment merging. This is the single source of truth for how
 * raw BC data becomes the product shape that layout generation consumes.
 */

import { getCategories, getProductsByCategory, customFieldsToRecord, type BCProduct } from './bigcommerce';
import { getEnrichmentByEntityIds } from './enrichment/query';
import { getBrand } from '$lib/brand/config';
import type { Product } from '$lib/types';

/** Category map — driven by the active brand config */
export const CATEGORY_MAP: Record<string, { bcName: string; displayName: string }> = getBrand().categories;

export interface EnrichedProduct extends Product {
	personaFit: { gatherer: number; hunter: number; researcher: number; gifter: number } | null;
	semanticTags: string[];
}

/**
 * Load products for a category slug, merged with enrichment data.
 * Sorted by persona-fit for the given persona.
 *
 * Returns null if the category doesn't exist.
 */
export async function loadCategoryProducts(
	categorySlug: string,
	persona?: string,
): Promise<{ products: EnrichedProduct[]; categoryName: string } | null> {
	const catConfig = CATEGORY_MAP[categorySlug];
	if (!catConfig) return null;

	const categories = await getCategories();
	const bcCategory = categories.find((c) => c.name === catConfig.bcName);
	if (!bcCategory) return null;

	const { products: bcProducts } = await getProductsByCategory(bcCategory.entityId);
	const products = bcProducts.map(transformProduct);

	// Fetch enrichment in parallel (non-blocking — returns empty map on failure)
	const enrichmentMap = await getEnrichmentByEntityIds(products.map((p) => p.entityId));

	// Merge enrichment
	const enrichedProducts: EnrichedProduct[] = products.map((p) => {
		const enrichment = enrichmentMap.get(p.entityId);
		return {
			...p,
			personaFit: enrichment?.personaFit ?? null,
			semanticTags: enrichment?.semanticTags ?? [],
		};
	});

	// Sort by persona-fit if persona is provided
	if (persona) {
		enrichedProducts.sort((a, b) => {
			const fitA = a.personaFit?.[persona as keyof NonNullable<EnrichedProduct['personaFit']>] ?? 0.5;
			const fitB = b.personaFit?.[persona as keyof NonNullable<EnrichedProduct['personaFit']>] ?? 0.5;
			return fitB - fitA;
		});
	}

	return { products: enrichedProducts, categoryName: catConfig.displayName };
}

/** Transform a BC product into the shape our layout components expect */
function transformProduct(p: BCProduct): Product {
	const specs = customFieldsToRecord(p);

	return {
		id: p.path.replace(/^\/|\/$/g, '') || String(p.entityId),
		entityId: p.entityId,
		name: p.name,
		price: p.prices.price.value,
		salePrice: p.prices.salePrice?.value || undefined,
		image: p.defaultImage?.url || '',
		imageAlt: p.defaultImage?.altText || p.name,
		description: stripHtml(p.description),
		specs,
		tags: Object.values(specs).slice(0, 3),
		category: p.categories.edges[0]?.node.name || '',
	};
}

function stripHtml(html: string): string {
	return html.replace(/<[^>]*>/g, '').trim();
}
