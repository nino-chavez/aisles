import type { PageServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { loadSessionIncentives } from '$lib/server/incentives/session';
import { loadHomeProducts } from '$lib/server/catalog';

export const load: PageServerLoad = async ({ url, request, cookies, parent }) => {
	const { devMode } = await parent();

	// ─── Signal Store: same request-time inference the category page runs,
	// so the homepage can request an AI layout for categorySlug "home" ───
	const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: 'home' });
	const sessionIncentives = await loadSessionIncentives(store, cookies);
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);

	// Cross-category product set, sorted by persona-fit — same shape and
	// source layout generation uses, so LayoutRenderer can resolve any
	// product reference the generated "home" layout comes back with.
	const homeResult = await loadHomeProducts(inference.primary);
	const products = homeResult?.products ?? [];

	// Check for returning visitor persona/category (set by a prior category visit)
	const storedPersona = cookies.get('aisles_persona') || null;
	const storedCategory = cookies.get('aisles_last_category') || null;

	// Pick featured products (first 4 from different price ranges)
	const sorted = [...products].sort((a, b) => b.price - a.price);
	const featured = sorted.length >= 4
		? [sorted[0], sorted[Math.floor(sorted.length / 3)], sorted[Math.floor(sorted.length * 2 / 3)], sorted[sorted.length - 1]]
		: sorted.slice(0, 4);

	// Map categories for display — driven by brand config
	const brand = getBrand();
	const categoryList = Object.entries(brand.categories).map(([slug, config]) => ({
		name: config.displayName,
		path: `/${slug}/`,
		slug,
	}));

	// Persist this visit's inferred persona. Do not touch aisles_last_category —
	// that cookie means "last category browsed" and the homepage isn't one.
	cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });

	return {
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
