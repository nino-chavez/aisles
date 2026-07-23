import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { loadCategoryProducts, CATEGORY_MAP } from '$lib/server/catalog';
import { loadSessionIncentives } from '$lib/server/incentives/session';

export const load: PageServerLoad = async ({ params, url, cookies, request, parent }) => {
	const slug = params.slug;
	const { devMode } = await parent();

	if (!CATEGORY_MAP[slug]) {
		throw error(404, `Category "${slug}" not found`);
	}

	// ─── Signal Store: emit request-time signals, resolve incentives, infer ───
	const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: slug });
	const sessionIncentives = await loadSessionIncentives(store, cookies);
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);

	// ─── Load products with enrichment, sorted by persona-fit ──────
	const result = await loadCategoryProducts(slug, inference.primary);
	if (!result) {
		throw error(404, `Category "${slug}" not found in BigCommerce`);
	}

	// Store current session state in cookies
	cookies.set('aisles_persona', inference.primary, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_last_category', slug, { path: '/', maxAge: 60 * 60 * 24 * 30 });
	cookies.set('aisles_visits', String(visitCount), { path: '/', maxAge: 60 * 60 * 24 * 30 });

	return {
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
		incentives: sessionIncentives.payload,
		incentivesPromptContext: sessionIncentives.promptContext ?? null,
	};
};
