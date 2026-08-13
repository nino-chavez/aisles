import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import { KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_ROUTE, KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_SORT, getKibbleObservePlpProductRankingModelPolicyDescriptor } from '$lib/brand/composition-policy';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { KIBBLE_PLP_MODEL_PROMPT_VERSION, KIBBLE_PLP_MODEL_SCHEMA_VERSION, rankKibblePlpFirstEightWithModel, type KibblePlpCandidate } from '$lib/brand/reference/kibble-plp-model.server';
import { loadReferenceCategoryProducts } from '$lib/server/catalog';
import { reserveKibbleDemoAiCall } from '$lib/server/kibble-demo-ai-budget';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';
import { logGeneration } from '$lib/server/generation-log';
import { infer } from '$lib/signals/inference';
import { findSessionStore } from '$lib/signals/session';

const SESSION_COOKIE = 'aisles_session';
const VERSION = 'kibble-plp-first-eight-preview-v1';

/** Browser input contains no route, catalog, product, persona, policy, or cursor authority. */
export const POST: RequestHandler = async ({ url, cookies, request }) => {
	if (url.searchParams.get('observe') !== 'true' || cookies.get('aisles_observe_demo') !== '1' || getBrand().id !== 'kibble') return unavailable();
	if (!await parseModelMode(request)) return invalidRequest();
	const sessionId = cookies.get(SESSION_COOKIE);
	if (!sessionId) return sessionUnavailable();
	try {
		const store = await findSessionStore(sessionId, { fresh: true });
		if (!store) return sessionUnavailable();
		// The route, selected BigCommerce sort, cursor, and full current page are
		// reloaded here. No browser payload can swap any of those bindings.
		const page = await loadReferenceCategoryProducts('dog-food', { sort: KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_SORT, after: null });
		if (!page) return unavailable();
		const candidates = page.products.map(toCandidate);
		const prefix = candidates.slice(0, Math.min(8, candidates.length));
		const tail = candidates.slice(prefix.length);
		if (prefix.length < 3 || prefix.length > 8) return ineligible();
		const reservation = await reserveKibbleDemoAiCall(sessionId);
		if (!reservation.ok) return budgetUnavailable(reservation.reason);
		const inference = infer(store.toInferenceContext());
		const startedAt = Date.now();
		const result = await rankKibblePlpFirstEightWithModel({ inference, prefix, tail });
		const scenarioId = privateEnv.KIBBLE_SHOWCASE_SCENARIO_ID?.trim() || 'kibble-public-observe-demo';
		const provenance = buildContractedLayoutProvenance({
			policy: result.policy, surface: 'plp', route: KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_ROUTE, persona: inference.primary,
			rendererComponentId: 'kibble.category-listing', rendererVariantId: KIBBLE_REFERENCE_CONTRACT.recipes.plp.id,
			decisionSource: 'model', promptVersion: KIBBLE_PLP_MODEL_PROMPT_VERSION, schemaVersion: KIBBLE_PLP_MODEL_SCHEMA_VERSION,
			contractInput: { zone: result.policy.provenance.zoneBinding, rankedPrefixIds: result.rankedPrefixIds, prefixIds: result.prefixIds, tailIds: result.tailIds, modelCallCount: result.modelCallCount },
			catalogInput: { source: 'server-reloaded-category-page', routePath: KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_ROUTE, sort: KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_SORT, cursor: null, prefix, tail },
			shopperContext: { persona: inference.primary, probabilities: inference.probabilities }, scenarioId,
		});
		await logGeneration({ type: 'preserve_render', persona: inference.primary, categorySlug: 'dog-food', cacheHit: false, generationTimeMs: Date.now() - startedAt, productCount: page.products.length, inputTokens: result.inputTokens, outputTokens: result.outputTokens, model: `anthropic/${result.modelId}`, sessionId, provenance });
		return json({ version: VERSION, previewOnly: true, routePath: KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_ROUTE, sort: KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_SORT, cursor: null, policyVersion: result.policy.policyVersion, reference: { id: KIBBLE_REFERENCE_CONTRACT.id, version: KIBBLE_REFERENCE_CONTRACT.version }, prefixIds: result.prefixIds, tailIds: result.tailIds, rankedPrefixIds: result.rankedPrefixIds, zoneAdapter: result.zoneAdapter, modelCallCount: result.modelCallCount, provenance }, { headers: noStoreHeaders() });
	} catch (error) {
		console.error('[kibble-plp-product-ranking-decision] operational failure:', error);
		return json({ error: 'Failed to preview Kibble PLP product ranking' }, { status: 500, headers: noStoreHeaders() });
	}
};

function toCandidate(product: { entityId: number; name: string; category: string; price: number }): KibblePlpCandidate {
	if (!Number.isInteger(product.entityId) || product.entityId <= 0 || typeof product.name !== 'string' || !product.name || typeof product.category !== 'string' || !Number.isFinite(product.price) || product.price < 0) throw new Error('Kibble PLP catalog data is invalid.');
	return { entityId: product.entityId, name: product.name, category: product.category, price: product.price };
}
async function parseModelMode(request: Request) { const raw = await request.text(); if (!raw || raw.length > 128) return false; try { const value = JSON.parse(raw); return !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === 1 && Object.prototype.hasOwnProperty.call(value, 'mode') && value.mode === 'model'; } catch { return false; } }
function budgetUnavailable(reason: 'disabled' | 'cooldown' | 'session_limit' | 'global_limit' | 'unavailable') { const retryable = reason === 'cooldown' || reason === 'session_limit' || reason === 'global_limit'; return json({ error: retryable ? 'Kibble AI demo budget is temporarily exhausted' : 'Kibble AI demo is unavailable' }, { status: retryable ? 429 : 503, headers: noStoreHeaders() }); }
function unavailable() { return json({ error: 'Not found' }, { status: 404, headers: noStoreHeaders() }); }
function invalidRequest() { return json({ error: 'Invalid Kibble decision request' }, { status: 400, headers: noStoreHeaders() }); }
function sessionUnavailable() { return json({ error: 'Kibble preview session is unavailable' }, { status: 409, headers: noStoreHeaders() }); }
function ineligible() { return json({ error: 'Kibble PLP product-ranking model action is unavailable' }, { status: 409, headers: noStoreHeaders() }); }
function noStoreHeaders() { return { 'Cache-Control': 'no-store' }; }
export const _test = { parseModelMode, toCandidate, descriptor: getKibbleObservePlpProductRankingModelPolicyDescriptor };
