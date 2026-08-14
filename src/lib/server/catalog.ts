/**
 * Catalog utilities shared between page servers and API endpoints.
 *
 * Handles the category slug → BC category mapping, product transformation,
 * and enrichment merging. This is the single source of truth for how
 * raw BC data becomes the product shape that layout generation consumes.
 */

import {
	getCategories,
	getFeaturedProducts,
	getNewestProducts,
	getProductByEntityId,
	getProducts,
	getProductsByCategory,
	customFieldsToRecord,
	type BCProduct,
	type BCPageInfo,
} from './bigcommerce';
import { getEnrichmentByEntityIds } from './enrichment/query';
import { getBrand } from '$lib/brand/config';
import {
	KIBBLE_PLP_GRAPHQL_SORT,
	KIBBLE_PLP_PAGE_SIZE,
	type KibblePlpSort,
} from '$lib/brand/reference/kibble-plp';
import { MAX_LAYOUT_PRODUCTS } from './layout-prompt';
import type { Product } from '$lib/types';
import type { PersonaFitScores, PetProfile } from './enrichment/types';
import { getKibbleCatalogSignals, materializeKibbleSubscriptionOffers } from '$lib/brand/reference/kibble-catalog-enrichment';

/** Category map — driven by the active brand config */
export const CATEGORY_MAP: Record<string, { bcName: string; displayName: string }> = getBrand().categories;

export interface EnrichedProduct extends Product {
	personaFit: { gatherer: number; hunter: number; researcher: number; gifter: number } | null;
	semanticTags: string[];
	compatibleWith: string[];
	priceTier: string | null;
	petProfile: PetProfile | null;
}

export type ReferenceHomeProducts = {
	products: Array<Product & { personaFit: PersonaFitScores | null; catalogSignals: ReturnType<typeof getKibbleCatalogSignals> }>;
	source: 'featured' | 'newest' | 'deterministic-catalog';
	subscriptionOffers: Record<string, import('$lib/components/kibble/types').KibbleAutoRefillOffer>;
};

export type ReferenceCategoryProducts = {
	products: Product[];
	categoryName: string;
	categoryDescription: string;
	pageInfo: BCPageInfo;
	subscriptionOffers: Record<string, import('$lib/components/kibble/types').KibbleAutoRefillOffer>;
};

/**
 * Preserve home merchandising uses BigCommerce's explicit featured order,
 * then its newest order. If neither query can produce products, the final
 * fallback is a stable entity-id sort over the live catalog rather than a
 * price or persona heuristic.
 */
export async function loadReferenceHomeProducts(limit = 8): Promise<ReferenceHomeProducts> {
	try {
		const featured = uniqueProductsByEntityId((await getFeaturedProducts(limit)).map(transformProduct));
		if (featured.length > 0) return materializeReferenceHomeResult(featured, 'featured');
	} catch (error) {
		console.warn('[kibble-preserve] featured product query unavailable; trying newest products', error);
	}

	try {
		const newest = uniqueProductsByEntityId((await getNewestProducts(limit)).map(transformProduct));
		if (newest.length > 0) return materializeReferenceHomeResult(newest, 'newest');
	} catch (error) {
		console.warn('[kibble-preserve] newest product query unavailable; using deterministic catalog order', error);
	}

	const products = uniqueProductsByEntityId((await getProducts(Math.max(limit, 30))).map(transformProduct))
		.sort((a, b) => b.entityId - a.entityId)
		.slice(0, limit);
	return materializeReferenceHomeResult(products, 'deterministic-catalog');
}

async function materializeReferenceHomeResult(
	products: Product[],
	source: ReferenceHomeProducts['source'],
): Promise<ReferenceHomeProducts> {
	const enrichedProducts = await attachReferenceEnrichment(products);
	return {
		products: enrichedProducts,
		source,
		subscriptionOffers: materializeKibbleSubscriptionOffers(enrichedProducts),
	};
}

async function attachReferenceEnrichment(
	products: Product[],
): Promise<Array<Product & { personaFit: PersonaFitScores | null; catalogSignals: ReturnType<typeof getKibbleCatalogSignals> }>> {
	const enrichment = await getEnrichmentByEntityIds(products.map(({ entityId }) => entityId));
	return products.map((product) => ({
		...product,
		personaFit: enrichment.get(product.entityId)?.personaFit ?? null,
		catalogSignals: getKibbleCatalogSignals(product.entityId, product.category, product),
	}));
}

export async function loadCatalogProductByEntityId(entityId: number): Promise<Product | null> {
	const product = await getProductByEntityId(entityId);
	return product ? transformProduct(product) : null;
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
	const products = uniqueProductsByEntityId(bcProducts.map(transformProduct));

	const enrichedProducts = await enrichAndSortByFit(products, persona);

	return { products: enrichedProducts, categoryName: catConfig.displayName };
}

/**
 * Preserve PLPs keep BigCommerce's selected category order intact. They do not
 * enrich or persona-sort the returned slice, because doing so would break the
 * canonical category sort contract and cursor continuation.
 */
export async function loadReferenceCategoryProducts(
	categorySlug: string,
	options: { sort: KibblePlpSort; after: string | null },
): Promise<ReferenceCategoryProducts | null> {
	const catConfig = CATEGORY_MAP[categorySlug];
	if (!catConfig) return null;

	const categories = await getCategories();
	const bcCategory = categories.find((category) => category.name === catConfig.bcName);
	if (!bcCategory) return null;

	const result = await getProductsByCategory(bcCategory.entityId, {
		first: KIBBLE_PLP_PAGE_SIZE,
		after: options.after,
		sortBy: KIBBLE_PLP_GRAPHQL_SORT[options.sort],
	});

	const products = uniqueProductsByEntityId(result.products.map(transformProduct));
	return {
		products,
		categoryName: catConfig.displayName,
		categoryDescription: result.category.description,
		pageInfo: result.pageInfo,
		subscriptionOffers: materializeKibbleSubscriptionOffers(products),
	};
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

	const products = uniqueProductsByEntityId(perCategoryProducts.flat());
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

function uniqueProductsByEntityId(products: Product[]): Product[] {
	return [...new Map(products.map((product) => [product.entityId, product])).values()];
}
