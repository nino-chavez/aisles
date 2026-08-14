import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env as privateEnv } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import {
	KIBBLE_BOUNDED_COPY_MODEL_PROMPT_VERSION,
	KIBBLE_BOUNDED_COPY_MODEL_SCHEMA_VERSION,
	chooseKibbleBoundedCopyWithModel,
	decisionFromCopyVariant,
} from '$lib/brand/reference/kibble-bounded-copy-model.server';
import {
	KIBBLE_CART_PRESENTATION_POLICY,
	KIBBLE_CHECKOUT_PRESENTATION_POLICY,
	KIBBLE_SEARCH_PRESENTATION_POLICY,
} from '$lib/brand/reference/kibble-presentation-decisions';
import { getKibbleObserveCopyModelPolicyDescriptor } from '$lib/brand/composition-policy';
import { searchKibbleCatalog } from '$lib/brand/reference/kibble-search.server';
import { reserveKibbleDemoAiCall } from '$lib/server/kibble-demo-ai-budget';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';
import { logGeneration } from '$lib/server/generation-log';
import { infer } from '$lib/signals/inference';
import { findSessionStore } from '$lib/signals/session';
import { MODEL_PROVIDER } from '$lib/server/model';

const VERSION = 'kibble-bounded-copy-preview-v1';
type DecisionRequest =
	| { mode: 'model'; surface: 'search'; query: string }
	| { mode: 'model'; surface: 'cart' }
	| { mode: 'model'; surface: 'checkout'; subtype: 'gift' | 'prepaid' };

export const POST: RequestHandler = async ({ url, cookies, request }) => {
	if (url.searchParams.get('observe') !== 'true' || cookies.get('aisles_observe_demo') !== '1' || getBrand().id !== 'kibble') return unavailable();
	const body = await parseRequest(request);
	if (!body) return invalidRequest();
	const sessionId = cookies.get('aisles_session');
	if (!sessionId) return sessionUnavailable();
	try {
		const store = await findSessionStore(sessionId, { fresh: true });
		if (!store) return sessionUnavailable();
		if (body.surface === 'search') {
			const search = await searchKibbleCatalog({ query: body.query, after: null });
			if (search.products.length > 0) return ineligible('Search AI is available on the zero-results recovery zone.');
		}
		const reservation = await reserveKibbleDemoAiCall(sessionId);
		if (!reservation.ok) return budgetUnavailable(reservation.reason);
		const inference = infer(store.toInferenceContext());
		const input = body.surface === 'search'
			? { surface: 'search' as const, routePath: '/search' as const, query: body.query, inference }
			: body.surface === 'cart'
				? { surface: 'cart' as const, routePath: '/cart' as const, inference }
				: { surface: 'checkout' as const, routePath: `/checkout/${body.subtype}` as '/checkout/gift' | '/checkout/prepaid', subtype: body.subtype, inference };
		const startedAt = Date.now();
		const result = await chooseKibbleBoundedCopyWithModel(input);
		const presentationDecision = decisionFromCopyVariant(body.surface, result.copyVariantId);
		if (!presentationDecision) throw new Error('Kibble bounded copy decision left the merchant allow-list.');
		const presentationPolicy = body.surface === 'search' ? KIBBLE_SEARCH_PRESENTATION_POLICY
			: body.surface === 'cart' ? KIBBLE_CART_PRESENTATION_POLICY : KIBBLE_CHECKOUT_PRESENTATION_POLICY;
		const descriptor = body.surface === 'search'
			? getKibbleObserveCopyModelPolicyDescriptor({ surface: 'search', familyId: 'search.empty-state', instanceId: 'search.empty-state', routePath: '/search' })
			: body.surface === 'cart'
				? getKibbleObserveCopyModelPolicyDescriptor({ surface: 'cart', familyId: 'cart.empty-state', instanceId: 'cart.empty-state', routePath: '/cart' })
				: getKibbleObserveCopyModelPolicyDescriptor({ surface: 'checkout', familyId: 'checkout.assurance-strip', instanceId: 'checkout.assurance-strip', routePath: `/checkout/${body.subtype}` });
		const scenarioId = privateEnv.KIBBLE_SHOWCASE_SCENARIO_ID?.trim() || 'kibble-public-observe-demo';
		const provenance = buildContractedLayoutProvenance({
			policy: result.policy, surface: body.surface, route: input.routePath, persona: inference.primary,
			rendererComponentId: body.surface === 'search' ? 'kibble.search' : body.surface === 'cart' ? 'kibble.cart' : 'kibble.checkout',
			rendererVariantId: body.surface === 'search' ? KIBBLE_REFERENCE_CONTRACT.recipes.search.variantId
				: body.surface === 'cart' ? KIBBLE_REFERENCE_CONTRACT.recipes.cart.variantId : KIBBLE_REFERENCE_CONTRACT.recipes.checkout.variantId,
			decisionSource: 'model', promptVersion: KIBBLE_BOUNDED_COPY_MODEL_PROMPT_VERSION, schemaVersion: KIBBLE_BOUNDED_COPY_MODEL_SCHEMA_VERSION,
			contractInput: { zone: result.policy.provenance.zoneBinding, presentationPolicy, presentationDecision, modelCallCount: result.modelCallCount },
			catalogInput: { source: 'merchant-approved-presentation-variants', resultCount: body.surface === 'search' ? 0 : undefined },
			shopperContext: { persona: inference.primary, probabilities: inference.probabilities }, scenarioId,
		});
		await logGeneration({
			type: 'preserve_render', persona: inference.primary, categorySlug: body.surface, cacheHit: false,
			generationTimeMs: Date.now() - startedAt, productCount: 0, inputTokens: result.inputTokens, outputTokens: result.outputTokens,
			model: `anthropic/${result.modelId}`, sessionId, provenance,
		});
		return json({
			version: VERSION, previewOnly: true, surface: body.surface, routePath: input.routePath,
			...(body.surface === 'search' ? { query: body.query } : {}),
			...(body.surface === 'checkout' ? { subtype: body.subtype } : {}),
			policyVersion: result.policy.policyVersion, persona: inference.primary,
			presentationPolicy, presentationDecision, zoneAdapter: result.adapter,
			modelCallCount: result.modelCallCount, provider: MODEL_PROVIDER, modelId: result.modelId,
			descriptor, provenance,
		}, { headers: noStoreHeaders() });
	} catch (error) {
		console.error('[kibble-bounded-copy-decision] operational failure:', error);
		return json({ error: 'Failed to preview Kibble bounded presentation decision' }, { status: 500, headers: noStoreHeaders() });
	}
};

async function parseRequest(request: Request): Promise<DecisionRequest | null> {
	const raw = await request.text();
	if (!raw || raw.length > 512) return null;
	try {
		const value = JSON.parse(raw);
		if (!value || typeof value !== 'object' || Array.isArray(value) || value.mode !== 'model') return null;
		const keys = Object.keys(value);
		if (value.surface === 'search' && keys.length === 3 && typeof value.query === 'string' && value.query.length <= 160) return { mode: 'model', surface: 'search', query: value.query.trim() };
		if (value.surface === 'cart' && keys.length === 2) return { mode: 'model', surface: 'cart' };
		if (value.surface === 'checkout' && keys.length === 3 && (value.subtype === 'gift' || value.subtype === 'prepaid')) return { mode: 'model', surface: 'checkout', subtype: value.subtype };
		return null;
	} catch { return null; }
}

function budgetUnavailable(reason: 'disabled' | 'cooldown' | 'session_limit' | 'global_limit' | 'unavailable') {
	const retryable = reason === 'cooldown' || reason === 'session_limit' || reason === 'global_limit';
	return json({ error: retryable ? 'Kibble AI demo budget is temporarily exhausted' : 'Kibble AI demo is unavailable' }, { status: retryable ? 429 : 503, headers: noStoreHeaders() });
}
function unavailable() { return json({ error: 'Not found' }, { status: 404, headers: noStoreHeaders() }); }
function invalidRequest() { return json({ error: 'Invalid Kibble decision request' }, { status: 400, headers: noStoreHeaders() }); }
function sessionUnavailable() { return json({ error: 'Kibble preview session is unavailable' }, { status: 409, headers: noStoreHeaders() }); }
function ineligible(message: string) { return json({ error: message }, { status: 409, headers: noStoreHeaders() }); }
function noStoreHeaders() { return { 'Cache-Control': 'no-store' }; }

export const _test = { parseRequest, VERSION };
