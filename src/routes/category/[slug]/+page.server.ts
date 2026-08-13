import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
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
import { assertKibblePreserveRoutePolicy, getContractSurfaceDecision } from '$lib/brand/composition-policy';
import {
	KibblePlpInputError,
	parseKibblePlpCursor,
	parseKibblePlpSort,
} from '$lib/brand/reference/kibble-plp';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';
import { logGeneration } from '$lib/server/generation-log';

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
	const surfaceDecision = renderMode === 'reference-preserve'
		? getContractSurfaceDecision(getBrand().id, 'plp')
		: null;
	if (surfaceDecision && surfaceDecision.mode !== 'reference-preserve') {
		throw error(503, 'This Kibble shelf is temporarily unavailable.');
	}
	if (surfaceDecision?.mode === 'reference-preserve') {
		try {
			assertKibblePreserveRoutePolicy(surfaceDecision.policy, 'plp');
		} catch (cause) {
			const detail = cause instanceof Error ? cause.message : 'Unknown Kibble category policy error.';
			console.error('[kibble-preserve] category policy failed closed:', detail);
			throw error(503, dev ? `Kibble Preserve cannot render: ${detail}` : 'This Kibble shelf is temporarily unavailable.');
		}
	}

	const configuredCategory = renderMode === 'reference-preserve'
		? Object.hasOwn(CATEGORY_MAP, slug)
		: Boolean(CATEGORY_MAP[slug]);
	if (!configuredCategory) {
		throw error(404, `Category "${slug}" not found`);
	}
	const kibblePlp = renderMode === 'reference-preserve' ? _parseKibblePlpRequest(url) : null;

	// ─── Signal Store: preserve request-time signals and inference. ───
	const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: slug });
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);

	// Preserve uses the canonical category sort and cursor. Legacy retains the
	// existing enrichment and persona-fit ordering path.
	const result = kibblePlp
		? await loadReferenceCategoryProducts(slug, kibblePlp)
		: await loadCategoryProducts(slug, inference.primary);
	if (!result) {
		throw error(404, `Category "${slug}" not found in BigCommerce`);
	}

	let kibbleCategory = null;
	let provenance = null;
	if (renderMode === 'reference-preserve' && kibblePlp && 'pageInfo' in result && surfaceDecision?.mode === 'reference-preserve') {
		try {
			kibbleCategory = materializeKibbleCategory(getBrand(), slug, result.products, {
				sort: kibblePlp.sort,
				pageInfo: result.pageInfo,
			});
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
			const detail = cause instanceof Error ? cause.message : 'Unknown Kibble category adapter error.';
			console.error('[kibble-preserve] category failed closed:', detail);
			throw error(503, dev ? `Kibble Preserve cannot render: ${detail}` : 'This Kibble shelf is temporarily unavailable.');
		}
	}
	const sessionIncentives = renderMode === 'reference-preserve'
		? null
		: await loadSessionIncentives(store, cookies);

	// Store current session state in cookies
	cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_last_category', slug, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });

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
