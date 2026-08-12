import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { infer } from '$lib/signals/inference';
import { createStoreFromRequest } from '$lib/signals/request';
import { loadCategoryProducts, CATEGORY_MAP } from '$lib/server/catalog';
import { loadSessionIncentives } from '$lib/server/incentives/session';
import { getBrand } from '$lib/brand/config';
import { materializeKibbleCategory } from '$lib/brand/reference/kibble-runtime';

export const load: PageServerLoad = async ({ params, url, cookies, request, parent }) => {
	const slug = params.slug;
	const { devMode, renderMode } = await parent();

	const configuredCategory = renderMode === 'reference-preserve'
		? Object.hasOwn(CATEGORY_MAP, slug)
		: Boolean(CATEGORY_MAP[slug]);
	if (!configuredCategory) {
		throw error(404, `Category "${slug}" not found`);
	}

	// ─── Signal Store: preserve request-time signals and inference. ───
	const { store, visitCount } = await createStoreFromRequest({ url, request, cookies, category: slug });
	const inferenceContext = store.toInferenceContext();
	const inference = infer(inferenceContext);

	// ─── Load products with enrichment, sorted by persona-fit ──────
	const result = await loadCategoryProducts(slug, inference.primary);
	if (!result) {
		throw error(404, `Category "${slug}" not found in BigCommerce`);
	}

	let kibbleCategory = null;
	if (renderMode === 'reference-preserve') {
		try {
			kibbleCategory = materializeKibbleCategory(getBrand(), slug, result.products);
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
