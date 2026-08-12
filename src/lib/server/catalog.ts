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
import { MAX_LAYOUT_PRODUCTS } from './layout-prompt';
import type { Product } from '$lib/types';
import type { PetProfile } from './enrichment/types';

/** Category map — driven by the active brand config */
export const CATEGORY_MAP: Record<string, { bcName: string; displayName: string }> = getBrand().categories;

export interface EnrichedProduct extends Product {
	personaFit: { gatherer: number; hunter: number; researcher: number; gifter: number } | null;
	semanticTags: string[];
	compatibleWith: string[];
	priceTier: string | null;
	petProfile: PetProfile | null;
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

	const enrichedProducts = await enrichAndSortByFit(products, persona);

	return { products: enrichedProducts, categoryName: catConfig.displayName };
}

/**
 * Load a cross-category product set for the generated home page.
 * Draws breadth across every configured category rather than depth from
 * one — a homepage showing a single category's products isn't a homepage.
 * Capped at MAX_LAYOUT_PRODUCTS (shared with the prompt builder) so a home
 * surface with many categories doesn't overfetch past what the prompt uses.
 *
 * Returns null if the brand has no configured categories.
 */
export async function loadHomeProducts(
	persona?: string,
): Promise<{ products: EnrichedProduct[]; categoryName: string } | null> {
	const brand = getBrand();
	const slugs = Object.keys(CATEGORY_MAP);
	if (slugs.length === 0) return null;

	const categories = await getCategories();
	const perCategory = Math.max(1, Math.ceil(MAX_LAYOUT_PRODUCTS / slugs.length));

	const perCategoryProducts = await Promise.all(
		slugs.map(async (slug) => {
			const bcCategory = categories.find((c) => c.name === CATEGORY_MAP[slug].bcName);
			if (!bcCategory) return [];
			const { products: bcProducts } = await getProductsByCategory(bcCategory.entityId);
			return bcProducts.slice(0, perCategory).map(transformProduct);
		}),
	);

	const products = perCategoryProducts.flat();
	if (products.length === 0) return null;

	const enrichedProducts = await enrichAndSortByFit(products, persona);

	// Storefront's own name, not a category label — this set spans categories.
	return { products: enrichedProducts, categoryName: brand.name };
}

/**
 * Merge enrichment data onto raw products and sort by persona-fit.
 * Shared by the category and home product loaders so the merge logic
 * lives in exactly one place.
 */
async function enrichAndSortByFit(products: Product[], persona?: string): Promise<EnrichedProduct[]> {
	// Fetch enrichment in parallel (non-blocking — returns empty map on failure)
	const enrichmentMap = await getEnrichmentByEntityIds(products.map((p) => p.entityId));

	const enrichedProducts: EnrichedProduct[] = products.map((p) => {
		const enrichment = enrichmentMap.get(p.entityId);
		return {
			...p,
			personaFit: enrichment?.personaFit ?? null,
			semanticTags: enrichment?.semanticTags ?? [],
			compatibleWith: enrichment?.compatibleWith ?? [],
			priceTier: enrichment?.priceTier ?? null,
			petProfile: enrichment?.petProfile ?? null,
		};
	});

	if (persona) {
		enrichedProducts.sort((a, b) => {
			const fitA = a.personaFit?.[persona as keyof NonNullable<EnrichedProduct['personaFit']>] ?? 0.5;
			const fitB = b.personaFit?.[persona as keyof NonNullable<EnrichedProduct['personaFit']>] ?? 0.5;
			return fitB - fitA;
		});
	}

	return enrichedProducts;
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
