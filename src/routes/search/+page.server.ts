import type { PageServerLoad } from './$types';
import { getProducts, customFieldsToRecord, type BCProduct } from '$lib/server/bigcommerce';
import { error, redirect } from '@sveltejs/kit';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { searchProducts } from '$lib/server/search';
import { loadSessionIncentives } from '$lib/server/incentives/session';

export const load: PageServerLoad = async ({ url, cookies, request, parent }) => {
	const query = url.searchParams.get('q') || '';
	const { devMode, chromeMode } = await parent();
	if (chromeMode === 'reference') {
		throw error(503, 'This Kibble & Co. section is not available in the reference-preserved preview.');
	}

	if (!query.trim()) {
		throw redirect(302, '/');
	}

	// Fetch all products (needed for both search paths)
	const allProducts = await getProducts(50);
	const productMap = new Map(allProducts.map((p) => [p.entityId, p]));

	// Try enrichment-powered search first, fall back to text match
	const enrichedResults = await searchProducts(query, 20);
	let matched;
	let searchMethod: 'enriched' | 'text';

	if (enrichedResults.length > 0) {
		// Enrichment search succeeded — map results back to full product data
		searchMethod = 'enriched';
		matched = enrichedResults
			.map((r) => {
				const bcProduct = productMap.get(r.bcEntityId);
				if (!bcProduct) return null;
				return {
					...transformProduct(bcProduct),
					relevanceScore: r.relevanceScore,
					semanticTags: r.semanticTags,
				};
			})
			.filter((p): p is NonNullable<typeof p> => p !== null);
	} else {
		// Fallback: basic text search
		searchMethod = 'text';
		const q = query.toLowerCase();
		matched = allProducts
			.filter((p) => {
				const searchable = `${p.name} ${p.description} ${p.sku}`.toLowerCase();
				const fields = p.customFields.edges.map((e) => e.node.value).join(' ').toLowerCase();
				return searchable.includes(q) || fields.includes(q);
			})
			.map((p) => ({ ...transformProduct(p), relevanceScore: null, semanticTags: [] as string[] }));
	}

	// Infer category from results/query for store context
	const categorySlug = inferCategory(matched, query.toLowerCase());

	// Signal store → inference
	const { store } = await createStoreFromRequest({
		url,
		request,
		cookies,
		category: categorySlug || 'search',
	});
	const sessionIncentives = await loadSessionIncentives(store, cookies);
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);

	cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });

	return {
		query,
		results: matched,
		resultCount: matched.length,
		searchMethod,
		inference,
		persona: inference.primary,
		confidence: inference.confidence,
		personaShift: inference.shift.detected,
		storedPersona: inferenceContext.storedPersona,
		suggestedCategory: categorySlug,
		devMode,
		incentives: sessionIncentives.payload,
		incentivesPromptContext: sessionIncentives.promptContext ?? null,
	};
};

function inferCategory(products: Array<{ category: string }>, query: string): string | null {
	if (/desk|chair|office|dorm|storage|bookshelf|monitor/i.test(query)) return 'office';
	if (/sofa|couch|sectional|table|lamp|rug|living/i.test(query)) return 'living-room';

	const categories = products.map((p) => p.category);
	if (categories.filter((c) => c.includes('Office')).length > categories.length / 2) return 'office';
	if (categories.filter((c) => c.includes('Living')).length > categories.length / 2) return 'living-room';

	return null;
}

function transformProduct(p: BCProduct) {
	const specs = customFieldsToRecord(p);
	return {
		id: p.path.replace(/^\/|\/$/g, '') || String(p.entityId),
		entityId: p.entityId,
		name: p.name,
		price: p.prices.price.value,
		salePrice: p.prices.salePrice?.value || undefined,
		image: p.defaultImage?.url || '',
		imageAlt: p.defaultImage?.altText || p.name,
		description: p.description.replace(/<[^>]*>/g, '').trim(),
		specs,
		tags: Object.values(specs).slice(0, 3),
		category: p.categories.edges[0]?.node.name || '',
	};
}
