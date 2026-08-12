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
		try {
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
			return {
				renderMode,
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
