import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { getBrand } from '$lib/brand/config';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import { buildKibbleHomeReference } from '$lib/brand/reference/kibble-runtime';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { loadSessionIncentives } from '$lib/server/incentives/session';
import { loadCatalogProductByEntityId, loadHomeProducts, loadReferenceHomeProducts } from '$lib/server/catalog';
import { assertKibblePreserveRoutePolicy, getContractSurfaceDecision } from '$lib/brand/composition-policy';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';
import { logGeneration } from '$lib/server/generation-log';

export const load: PageServerLoad = async ({ url, request, cookies, parent }) => {
	const { devMode, renderMode } = await parent();
	const brand = getBrand();
	const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: 'home' });
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);
	const storedPersona = cookies.get('aisles_persona') || null;
	const storedCategory = cookies.get('aisles_last_category') || null;
	cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });

	if (renderMode === 'reference-preserve') {
		const preserveStartedAt = Date.now();
		try {
			const surfaceDecision = getContractSurfaceDecision(brand.id, 'home');
			if (surfaceDecision.mode !== 'reference-preserve') throw new Error('Kibble home reference policy is unavailable.');
			assertKibblePreserveRoutePolicy(surfaceDecision.policy, 'home');
			const [referenceProducts, bundleProduct] = await Promise.all([
				loadReferenceHomeProducts(9),
				loadCatalogProductByEntityId(KIBBLE_PRESERVE_MANIFEST.display.featuredBundle.entityId),
			]);
			const kibbleHome = buildKibbleHomeReference(
				brand,
				referenceProducts.products,
				referenceProducts.source,
				bundleProduct,
			);
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
				contractInput: KIBBLE_REFERENCE_CONTRACT.recipes.home,
				catalogInput: { source: referenceProducts.source, products: referenceProducts.products, bundle: bundleProduct },
				shopperContext: { persona: inference.primary, probabilities: inference.probabilities },
				scenarioId: store.getCrossSessionContext().scenarioId,
			});
			await logGeneration({
				type: 'preserve_render', persona: inference.primary, categorySlug: 'home', cacheHit: false,
				generationTimeMs: Date.now() - preserveStartedAt, productCount: referenceProducts.products.length, sessionId: cookies.get('aisles_session') || undefined,
				provenance,
			});
			return {
				renderMode,
				provenance,
				kibbleHome,
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
				products: referenceProducts.products,
				inference,
				persona: inference.primary,
				devMode,
				sessionId: cookies.get('aisles_session') || null,
				incentivesPromptContext: null,
			};
		} catch (cause) {
			const detail = cause instanceof Error ? cause.message : 'Unknown Kibble reference adapter error.';
			console.error('[kibble-preserve] home failed closed:', detail);
			throw error(503, dev ? `Kibble Preserve cannot render: ${detail}` : 'This Kibble shelf is temporarily unavailable.');
		}
	}

	// ─── Legacy generation retains its current incentive and persona path. ───
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
