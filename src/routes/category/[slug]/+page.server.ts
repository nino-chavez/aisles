import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import {
	loadCategoryProducts,
	loadReferenceCategoryProducts,
	CATEGORY_MAP,
} from '$lib/server/catalog';
import { loadSessionIncentives } from '$lib/server/incentives/session';
import { getBrand } from '$lib/brand/config';
import { materializeKibbleCategory } from '$lib/brand/reference/kibble-runtime';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import {
	assertKibblePreserveRoutePolicy,
	getContractSurfaceDecision,
	KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_ROUTE,
	KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_SORT,
	getKibbleObservePlpProductRankingModelPolicyDescriptor,
} from '$lib/brand/composition-policy';
import {
	KibblePlpInputError,
	parseKibblePlpCursor,
	parseKibblePlpSort,
} from '$lib/brand/reference/kibble-plp';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';
import { logGeneration } from '$lib/server/generation-log';
import { executeKibblePlpZoneAdapter } from '$lib/brand/reference/kibble-zone-executor.server';
import { throwKibblePreserveError } from '$lib/brand/reference/kibble-error.server';

export function _parseKibblePlpRequest(url: URL) {
	try {
		return {
			sort: parseKibblePlpSort(url.searchParams.get('sort')),
			after: parseKibblePlpCursor(url.searchParams.get('after')),
		};
	} catch (cause) {
		if (cause instanceof KibblePlpInputError) throw error(400, cause.message);
		throw cause;
	}
}

export const load: PageServerLoad = async ({ params, url, cookies, request, parent }) => {
	const slug = params.slug;
	const { devMode, renderMode } = await parent();
	const preserveStartedAt = Date.now();
	const failPreserve = async (cause: unknown, phase: string): Promise<never> => {
		if (renderMode !== 'reference-preserve') throw cause;
		const detail = cause instanceof Error ? cause.message : `Unknown Kibble category ${phase} error.`;
		console.error(`[kibble-preserve] category ${phase} failed closed:`, detail);
		return throwKibblePreserveError({
			brandId: getBrand().id,
			surface: 'error-empty',
			routePath: url.pathname,
			status: 503,
			message: 'This Kibble shelf is temporarily unavailable.',
		});
	};
	const surfaceDecision = renderMode === 'reference-preserve'
		? getContractSurfaceDecision(getBrand().id, 'plp')
		: null;
	if (surfaceDecision && surfaceDecision.mode !== 'reference-preserve') {
		await failPreserve(new Error('Kibble PLP reference policy is unavailable.'), 'policy');
	}
	if (surfaceDecision?.mode === 'reference-preserve') {
		try {
			assertKibblePreserveRoutePolicy(surfaceDecision.policy, 'plp');
		} catch (cause) {
			await failPreserve(cause, 'policy');
		}
	}

	const configuredCategory = renderMode === 'reference-preserve'
		? Object.hasOwn(CATEGORY_MAP, slug)
		: Boolean(CATEGORY_MAP[slug]);
	if (!configuredCategory) {
		if (renderMode === 'reference-preserve') {
			await throwKibblePreserveError({
				brandId: getBrand().id,
				surface: 'error-404',
				routePath: url.pathname,
				status: 404,
				message: `Category "${slug}" was not found.`,
			});
		}
		throw error(404, `Category "${slug}" not found`);
	}
	const kibblePlp = renderMode === 'reference-preserve' ? _parseKibblePlpRequest(url) : null;

	// ─── Signal Store: preserve request-time signals and inference. ───
	const requestState = await (async () => {
		const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: slug });
		const inferenceContext = store.toInferenceContext();
		return { store, visitCount, inferenceContext, inference: infer(inferenceContext) };
	})().catch((cause) => failPreserve(cause, 'session'));
	const { store, visitCount, inferenceContext, inference } = requestState;

	// Preserve uses the canonical category sort and cursor. Legacy retains the
	// existing enrichment and persona-fit ordering path.
	const result = await (kibblePlp
		? loadReferenceCategoryProducts(slug, kibblePlp)
		: loadCategoryProducts(slug, inference.primary)
	).catch((cause) => failPreserve(cause, 'catalog'));
	if (!result) {
		if (renderMode === 'reference-preserve') {
			await throwKibblePreserveError({
				brandId: getBrand().id,
				surface: 'error-404',
				routePath: url.pathname,
				status: 404,
				message: `Category "${slug}" was not found.`,
			});
		}
		throw error(404, `Category "${slug}" not found in BigCommerce`);
	}

	let kibbleCategory = null;
	let provenance = null;
	if (renderMode === 'reference-preserve' && kibblePlp && 'pageInfo' in result && surfaceDecision?.mode === 'reference-preserve') {
		try {
			const categoryBase = materializeKibbleCategory(getBrand(), slug, result.products, {
				sort: kibblePlp.sort,
				pageInfo: result.pageInfo,
			});
			kibbleCategory = {
				...categoryBase,
				productRanking: (() => {
					const prefix = result.products.slice(0, Math.min(8, result.products.length)).map(({ entityId }) => String(entityId));
					const tail = result.products.slice(prefix.length).map(({ entityId }) => String(entityId));
					const observing = url.searchParams.get('observe') === 'true' || cookies.get('aisles_observe_demo') === '1';
					const exactApproval = url.pathname === KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_ROUTE && kibblePlp.sort === KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_SORT && kibblePlp.after === null;
					return observing && exactApproval && prefix.length >= 3 && prefix.length <= 8
						? { eligible: true, ...getKibbleObservePlpProductRankingModelPolicyDescriptor(url.pathname), prefixIds: prefix, tailIds: tail }
						: null;
				})(),
				zoneAdapter: await executeKibblePlpZoneAdapter({
					routePath: url.pathname,
					eyebrow: categoryBase.eyebrow,
					title: categoryBase.title,
					productCount: categoryBase.productCount,
				}),
			};
			provenance = buildContractedLayoutProvenance({
				policy: surfaceDecision.policy,
				surface: 'plp',
				route: url.pathname,
				persona: inference.primary,
				rendererComponentId: 'kibble.category-listing',
				rendererVariantId: KIBBLE_REFERENCE_CONTRACT.recipes.plp.id,
				decisionSource: 'fixed',
				promptVersion: 'no-model-preserve-v1',
				schemaVersion: `kibble-reference-${KIBBLE_REFERENCE_CONTRACT.version}`,
				contractInput: KIBBLE_REFERENCE_CONTRACT.recipes.plp,
				catalogInput: {
					category: result.categoryName,
					products: result.products,
					pageInfo: result.pageInfo,
					sort: kibblePlp.sort,
					after: kibblePlp.after,
				},
				shopperContext: { persona: inference.primary, probabilities: inference.probabilities },
				scenarioId: store.getCrossSessionContext().scenarioId,
			});
			await logGeneration({
				type: 'preserve_render',
				persona: inference.primary,
				categorySlug: slug,
				cacheHit: false,
				generationTimeMs: Date.now() - preserveStartedAt,
				productCount: result.products.length,
				sessionId: cookies.get('aisles_session') || undefined,
				provenance,
			});
		} catch (cause) {
			await failPreserve(cause, 'adapter');
		}
	}

	// Store current session state in cookies
	cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_last_category', slug, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });

	if (renderMode === 'reference-preserve') {
		if (!kibbleCategory || !provenance) {
			await failPreserve(new Error('Kibble PLP did not materialize its contracted response.'), 'adapter');
		}
		return {
			renderMode: 'reference-preserve' as const,
			provenance,
			kibbleCategory,
			category: { slug, name: result.categoryName },
		};
	}

	const sessionIncentives = await loadSessionIncentives(store, cookies);

	return {
		renderMode,
		provenance,
		kibbleCategory,
		category: {
			slug,
			name: result.categoryName,
			description: '',
		},
		products: result.products,
		inference,
		persona: inference.primary,
		confidence: inference.confidence,
		devMode,
		sessionContext: {
			personaSource: inference.dominantSource,
			personaShift: inference.shift.detected,
			storedPersona: inferenceContext.storedPersona,
			storedCategory: inferenceContext.storedCategory,
			visitCount,
			searchQuery: inferenceContext.searchQuery,
			signalCount: store.eventCount,
		},
		sessionId: cookies.get('aisles_session') || null,
		incentives: sessionIncentives?.payload ?? null,
		incentivesPromptContext: sessionIncentives?.promptContext ?? null,
	};
};
