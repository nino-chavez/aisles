import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import {
	buildKibbleSearchHref,
	parseKibbleSearchCursor,
	parseKibbleSearchQuery,
	searchKibbleCatalog,
	KibbleSearchInputError,
} from '$lib/brand/reference/kibble-search.server';
import { executeKibbleErrorZoneAdapter, executeKibbleSearchEmptyZoneTerminal, kibbleNativeAdapterBinding } from '$lib/brand/reference/kibble-zone-executor.server';
import { getProducts, customFieldsToRecord, type BCProduct } from '$lib/server/bigcommerce';
import { searchProducts } from '$lib/server/search';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { loadSessionIncentives } from '$lib/server/incentives/session';

export const load: PageServerLoad = async ({ url, parent, setHeaders, cookies, request }) => {
	const { renderMode, devMode } = await parent();
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (!routePolicy) return loadLegacySearch({ url, cookies, request, renderMode, devMode });
	if (routePolicy.surface !== 'search') throw error(500, 'Kibble search route resolved to the wrong policy surface.');
	setHeaders({ 'cache-control': 'private, max-age=0, must-revalidate' });
	try {
		const query = parseKibbleSearchQuery(url.searchParams.get('q'));
		const after = parseKibbleSearchCursor(url.searchParams.get('after'));
		const result = await searchKibbleCatalog({ query, after });
		const emptyExecution = await executeKibbleSearchEmptyZoneTerminal(result.products.length === 0 ? {
			query,
			body: query ? 'Try a different keyword, or browse all categories.' : 'Type something above to search the catalog.',
		} : null);
		return {
			renderMode,
			kibbleSearch: {
				query,
				products: result.products,
				pageInfo: result.pageInfo,
				loadMoreHref: result.pageInfo.hasNextPage && result.pageInfo.endCursor ? buildKibbleSearchHref(query, result.pageInfo.endCursor) : null,
				policyVersion: routePolicy.policy.policyVersion,
				responseProvenance: {
					...result.provenance,
					policyVersion: routePolicy.policy.policyVersion,
					routePath: '/search' as const,
				},
				zoneAdapter: emptyExecution.adapter ? kibbleNativeAdapterBinding(emptyExecution) : null,
			},
		};
	} catch (cause) {
		if (cause instanceof KibbleSearchInputError) throw error(400, cause.message);
		console.error('[kibble-preserve] read-only search failed closed:', cause);
		const message = 'Catalog search is temporarily unavailable.';
		const kibbleErrorAdapter = await executeKibbleErrorZoneAdapter({
			surface: 'error-empty',
			routePath: url.pathname,
			status: 503,
			message,
		});
		throw error(503, {
			message,
			kibbleErrorAdapter,
			kibbleErrorPolicy: {
				referenceId: KIBBLE_REFERENCE_CONTRACT.id,
				referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
				policies: [{ surface: 'error-empty', policyVersion: routePolicy.policy.policyVersion }],
			},
		} as never);
	}
};

async function loadLegacySearch({ url, cookies, request, renderMode, devMode }: {
	url: URL; cookies: Parameters<PageServerLoad>[0]['cookies']; request: Request; renderMode: string; devMode: boolean;
}) {
	const query = url.searchParams.get('q')?.trim() ?? '';
	const allProducts = await getProducts(50);
	const productMap = new Map(allProducts.map((product) => [product.entityId, product]));
	const enrichedResults = query ? await searchProducts(query, 20) : [];
	const matched = enrichedResults.length > 0
		? enrichedResults.map((result) => {
			const product = productMap.get(result.bcEntityId);
			return product ? { ...transformProduct(product), relevanceScore: result.relevanceScore, semanticTags: result.semanticTags } : null;
		}).filter((product): product is NonNullable<typeof product> => product !== null)
		: allProducts.filter((product) => {
			if (!query) return false;
			const haystack = `${product.name} ${product.description} ${product.sku} ${product.customFields.edges.map(({ node }) => node.value).join(' ')}`.toLowerCase();
			return haystack.includes(query.toLowerCase());
		}).map((product) => ({ ...transformProduct(product), relevanceScore: null, semanticTags: [] as string[] }));
	const { store } = await createStoreFromRequest({ url, request, cookies, category: 'search' });
	const incentives = await loadSessionIncentives(store, cookies);
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);
	return {
		renderMode, query, results: matched, resultCount: matched.length, searchMethod: enrichedResults.length > 0 ? 'enriched' as const : 'text' as const,
		inference, persona: inference.primary, confidence: inference.confidence, personaShift: inference.shift.detected,
		storedPersona: inferenceContext.storedPersona, suggestedCategory: null as string | null, devMode,
		incentives: incentives.payload, incentivesPromptContext: incentives.promptContext ?? null,
	};
}

function transformProduct(product: BCProduct) {
	const specs = customFieldsToRecord(product);
	return {
		id: product.path.replace(/^\/|\/$/g, '') || String(product.entityId), entityId: product.entityId,
		name: product.name, price: product.prices.price.value, salePrice: product.prices.salePrice?.value || undefined,
		image: product.defaultImage?.url || '', imageAlt: product.defaultImage?.altText || product.name,
		description: product.description.replace(/<[^>]*>/g, '').trim(), specs, tags: Object.values(specs).slice(0, 3),
		category: product.categories.edges[0]?.node.name || '',
	};
}
