import type { PageServerLoad } from './$types';
import { dev } from '$app/environment';
import { env as privateEnv } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import { buildKibbleHomeReference } from '$lib/brand/reference/kibble-runtime';
import { decideKibbleHome } from '$lib/brand/reference/kibble-home-decision';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { loadSessionIncentives } from '$lib/server/incentives/session';
import { loadCatalogProductByEntityId, loadHomeProducts, loadReferenceHomeProducts } from '$lib/server/catalog';
import { assertKibblePreserveRoutePolicy, getContractSurfaceDecision } from '$lib/brand/composition-policy';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';
import { logGeneration } from '$lib/server/generation-log';
import { sanitizeInspectorInference } from '$lib/components/kibble/kibble-dev-inspector';
import { executeKibbleHomeZoneAdapters } from '$lib/brand/reference/kibble-zone-executor.server';
import { throwKibblePreserveError } from '$lib/brand/reference/kibble-error.server';

export const load: PageServerLoad = async ({ url, request, cookies, parent }) => {
	const { devMode, renderMode } = await parent();
	const brand = getBrand();
	const loadRequestState = async () => {
		const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: 'home' });
		const inferenceContext = store.toInferenceContext();
		return { store, visitCount, inferenceContext, inference: infer(inferenceContext) };
	};

	if (renderMode === 'reference-preserve') {
		const preserveStartedAt = Date.now();
		try {
			const { store, visitCount, inference } = await loadRequestState();
			const showcaseScenarioId = dev ? privateEnv.KIBBLE_SHOWCASE_SCENARIO_ID?.trim() : '';
			if (showcaseScenarioId) store.setScenarioId(showcaseScenarioId);
			const storedPersona = cookies.get('aisles_persona') || null;
			const storedCategory = cookies.get('aisles_last_category') || null;
			cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
			cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });
			const surfaceDecision = getContractSurfaceDecision(brand.id, 'home');
			if (surfaceDecision.mode !== 'reference-preserve') throw new Error('Kibble home reference policy is unavailable.');
			assertKibblePreserveRoutePolicy(surfaceDecision.policy, 'home');
			const [referenceProducts, bundleProduct] = await Promise.all([
				loadReferenceHomeProducts(9),
				loadCatalogProductByEntityId(KIBBLE_PRESERVE_MANIFEST.display.featuredBundle.entityId),
			]);
			const homeDecision = decideKibbleHome(surfaceDecision.policy, inference, referenceProducts.products);
			const rankedProductIds = homeDecision.products.map(({ entityId }) => entityId);
			const shopperInference = sanitizeInspectorInference(inference);
			// Enrichment scores authorize the server-side ranking. They are not
			// shopper-facing product data and must not cross the render boundary.
			const renderedHomeProducts = homeDecision.products.map(({ personaFit: _personaFit, ...product }) => product);
			const kibbleHomeBase = buildKibbleHomeReference(
				brand,
				renderedHomeProducts,
				referenceProducts.source,
				bundleProduct,
			);
			const kibbleHome = {
				...kibbleHomeBase,
				zoneAdapters: await executeKibbleHomeZoneAdapters(kibbleHomeBase),
			};
			const provenance = buildContractedLayoutProvenance({
				policy: surfaceDecision.policy,
				surface: 'home',
				route: '/',
				persona: inference.primary,
				rendererComponentId: 'kibble.home',
				rendererVariantId: KIBBLE_REFERENCE_CONTRACT.recipes.home.id,
				decisionSource: 'rules',
				promptVersion: 'no-model-preserve-v1',
				schemaVersion: `kibble-reference-${KIBBLE_REFERENCE_CONTRACT.version}`,
				contractInput: {
					recipe: KIBBLE_REFERENCE_CONTRACT.recipes.home,
					rankedProductIds,
					persona: inference.primary,
					decisionTrace: homeDecision.inspector,
				},
				catalogInput: {
					source: referenceProducts.source,
					candidates: referenceProducts.products,
					rankedProductIds,
					bundle: bundleProduct,
				},
				shopperContext: { persona: inference.primary, probabilities: inference.probabilities },
				scenarioId: store.getCrossSessionContext().scenarioId,
			});
			await logGeneration({
				type: 'preserve_render', persona: inference.primary, categorySlug: 'home', cacheHit: false,
				generationTimeMs: Date.now() - preserveStartedAt, productCount: homeDecision.products.length, sessionId: cookies.get('aisles_session') || undefined,
				provenance,
			});
			// Kibble's decision inspector requires an explicit query on this request.
			// The older site-wide dev cookie must never reopen it on a later visit.
			const kibbleHomeInspector = dev && devMode && url.searchParams.get('dev') === 'true'
				? {
					...homeDecision.inspector,
					inference: shopperInference,
					dataSourceLabel: privateEnv.KIBBLE_SHOWCASE_DATA_SOURCE || homeDecision.inspector.dataSourceLabel,
					provenance,
				}
				: null;
			return {
				renderMode,
				provenance,
				kibbleHome,
				kibbleHomeInspector,
				featured: [],
				categories: Object.entries(brand.categories).map(([slug, config]) => ({
					name: config.displayName,
					path: `/${slug}/`,
					slug,
				})),
				storedPersona,
				storedCategory,
				brandName: brand.name,
				brandTagline: brand.tagline,
				brandDomain: brand.domain,
				homepage: brand.homepage,
				products: renderedHomeProducts,
				inference: shopperInference,
				persona: inference.primary,
				devMode,
				sessionId: cookies.get('aisles_session') || null,
				incentivesPromptContext: null,
			};
		} catch (cause) {
			const detail = cause instanceof Error ? cause.message : 'Unknown Kibble reference adapter error.';
			console.error('[kibble-preserve] home failed closed:', detail);
			await throwKibblePreserveError({
				brandId: brand.id,
				surface: 'error-empty',
				routePath: url.pathname,
				status: 503,
				message: 'This Kibble shelf is temporarily unavailable.',
			});
		}
	}

	// ─── Legacy generation retains its current incentive and persona path. ───
	const { store, visitCount, inferenceContext, inference } = await loadRequestState();
	const storedPersona = cookies.get('aisles_persona') || null;
	const storedCategory = cookies.get('aisles_last_category') || null;
	cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });
	const sessionIncentives = await loadSessionIncentives(store, cookies);

	// Cross-category product set, sorted by persona-fit — same shape and
	// source layout generation uses, so LayoutRenderer can resolve any
	// product reference the generated "home" layout comes back with.
	const homeResult = await loadHomeProducts(inference.primary);
	const products = homeResult?.products ?? [];

	// Pick featured products (first 4 from different price ranges)
	const sorted = [...products].sort((a, b) => b.price - a.price);
	const featured = sorted.length >= 4
		? [sorted[0], sorted[Math.floor(sorted.length / 3)], sorted[Math.floor(sorted.length * 2 / 3)], sorted[sorted.length - 1]]
		: sorted.slice(0, 4);

	// Map categories for display — driven by brand config
	const categoryList = Object.entries(brand.categories).map(([slug, config]) => ({
		name: config.displayName,
		path: `/${slug}/`,
		slug,
	}));

	return {
		renderMode,
		provenance: null,
		kibbleHome: null,
		kibbleHomeInspector: null,
		featured,
		categories: categoryList,
		storedPersona,
		storedCategory,
		brandName: brand.name,
		brandTagline: brand.tagline,
		brandDomain: brand.domain,
		homepage: brand.homepage,
		// Full product list, for LayoutRenderer to resolve product refs from a generated layout
		products,
		inference,
		persona: inference.primary,
		devMode,
		sessionId: cookies.get('aisles_session') || null,
		incentivesPromptContext: sessionIncentives.promptContext ?? null,
	};
};
