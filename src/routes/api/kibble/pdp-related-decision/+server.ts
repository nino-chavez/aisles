import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import {
	KIBBLE_OBSERVE_PDP_RELATED_ROUTE,
	KIBBLE_OBSERVE_PDP_RELATED_SLUG,
	getKibbleObservePdpRelatedModelPolicyDescriptor,
} from '$lib/brand/composition-policy';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import {
	KIBBLE_PDP_RELATED_MODEL_PROMPT_VERSION,
	KIBBLE_PDP_RELATED_MODEL_SCHEMA_VERSION,
	rankKibblePdpRelatedWithModel,
	type KibblePdpRelatedCandidate,
} from '$lib/brand/reference/kibble-pdp-related-model.server';
import { getKibbleProductDetailByPath, type BCKibbleProductDetail, type BCProduct } from '$lib/server/bigcommerce';
import { reserveKibbleDemoAiCall } from '$lib/server/kibble-demo-ai-budget';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';
import { logGeneration } from '$lib/server/generation-log';
import { infer } from '$lib/signals/inference';
import { findSessionStore } from '$lib/signals/session';

const SESSION_COOKIE = 'aisles_session';
const PREVIEW_VERSION = 'kibble-pdp-related-preview-v1';

/** An exact-route, prospect-triggered model action with no browser-owned facts. */
export const POST: RequestHandler = async ({ url, cookies, request }) => {
	if (
		url.searchParams.get('observe') !== 'true' ||
		cookies.get('aisles_observe_demo') !== '1' ||
		getBrand().id !== 'kibble'
	) return unavailable();
	if (!await parseModelMode(request)) return invalidRequest();
	const sessionId = cookies.get(SESSION_COOKIE);
	if (!sessionId) return sessionUnavailable();

	try {
		const store = await findSessionStore(sessionId, { fresh: true });
		if (!store) return sessionUnavailable();
		const detail = await getKibbleProductDetailByPath(`/${KIBBLE_OBSERVE_PDP_RELATED_SLUG}/`);
		if (!detail) return unavailable();
		const products = serverRelatedCandidates(detail, detail.entityId);
		if (products.length < 3) return ineligible();
		const reservation = await reserveKibbleDemoAiCall(sessionId);
		if (!reservation.ok) return budgetUnavailable(reservation.reason);
		const inference = infer(store.toInferenceContext());
		const startedAt = Date.now();
		const modelDecision = await rankKibblePdpRelatedWithModel({
			inference,
			products,
			routePath: KIBBLE_OBSERVE_PDP_RELATED_ROUTE,
			heading: KIBBLE_PRESERVE_MANIFEST.display.pdp.relatedHeading,
		});
		const scenarioId = privateEnv.KIBBLE_SHOWCASE_SCENARIO_ID?.trim() || 'kibble-public-observe-demo';
		const provenance = buildContractedLayoutProvenance({
			policy: modelDecision.policy,
			surface: 'pdp',
			route: KIBBLE_OBSERVE_PDP_RELATED_ROUTE,
			persona: inference.primary,
			rendererComponentId: 'kibble.product-detail',
			rendererVariantId: KIBBLE_REFERENCE_CONTRACT.recipes.pdp.variantId,
			decisionSource: 'model',
			promptVersion: KIBBLE_PDP_RELATED_MODEL_PROMPT_VERSION,
			schemaVersion: KIBBLE_PDP_RELATED_MODEL_SCHEMA_VERSION,
			contractInput: { zone: modelDecision.policy.provenance.zoneBinding, rankedProductIds: modelDecision.rankedProductIds, modelCallCount: modelDecision.modelCallCount },
			catalogInput: { source: 'server-reloaded-pdp-related', candidates: products, rankedProductIds: modelDecision.rankedProductIds },
			shopperContext: { persona: inference.primary, probabilities: inference.probabilities },
			scenarioId,
		});
		await logGeneration({
			type: 'preserve_render', persona: inference.primary, categorySlug: 'puppy-starter-kit', cacheHit: false,
			generationTimeMs: Date.now() - startedAt, productCount: products.length,
			inputTokens: modelDecision.inputTokens, outputTokens: modelDecision.outputTokens,
			model: `anthropic/${modelDecision.modelId}`, sessionId, provenance,
		});
		return json({
			version: PREVIEW_VERSION,
			previewOnly: true,
			routePath: KIBBLE_OBSERVE_PDP_RELATED_ROUTE,
			policyVersion: modelDecision.policy.policyVersion,
			persona: inference.primary,
			rankedProductIds: modelDecision.rankedProductIds,
			zoneAdapter: modelDecision.adapter,
			modelCallCount: modelDecision.modelCallCount,
			provenance,
		}, { headers: noStoreHeaders() });
	} catch (error) {
		console.error('[kibble-pdp-related-decision] operational failure:', error);
		return json({ error: 'Failed to preview Kibble PDP related-products decision' }, { status: 500, headers: noStoreHeaders() });
	}
};

function serverRelatedCandidates(detail: BCKibbleProductDetail, productEntityId: number): KibblePdpRelatedCandidate[] {
	const relatedEdges = detail.relatedProducts?.edges;
	if (!Number.isInteger(productEntityId) || productEntityId <= 0 || !Array.isArray(relatedEdges)) return [];
	const candidates: KibblePdpRelatedCandidate[] = relatedEdges.map(({ node }: { node: BCProduct }): KibblePdpRelatedCandidate => {
		const entityId = node?.entityId;
		const price = node?.prices?.price?.value;
		const category = node?.categories?.edges?.[0]?.node?.name ?? '';
		if (!Number.isInteger(entityId) || entityId <= 0 || entityId === productEntityId
			|| typeof node?.name !== 'string' || node.name.length < 1 || node.name.length > 96
			|| typeof price !== 'number' || !Number.isFinite(price) || price < 0
			|| typeof category !== 'string' || category.length > 96) throw new Error('Kibble PDP related catalog data is invalid.');
		return { entityId, name: node.name, category, price };
	});
	if (candidates.length > 4 || new Set(candidates.map(({ entityId }) => entityId)).size !== candidates.length) {
		throw new Error('Kibble PDP related catalog identities are invalid.');
	}
	return candidates;
}

async function parseModelMode(request: Request): Promise<boolean> {
	const raw = await request.text();
	if (!raw || raw.length > 128) return false;
	try {
		const value = JSON.parse(raw);
		return !!value && typeof value === 'object' && !Array.isArray(value)
			&& Object.keys(value).length === 1 && Object.prototype.hasOwnProperty.call(value, 'mode') && value.mode === 'model';
	} catch { return false; }
}

function budgetUnavailable(reason: 'disabled' | 'cooldown' | 'session_limit' | 'global_limit' | 'unavailable') {
	const retryable = reason === 'cooldown' || reason === 'session_limit' || reason === 'global_limit';
	return json({ error: retryable ? 'Kibble AI demo budget is temporarily exhausted' : 'Kibble AI demo is unavailable' }, { status: retryable ? 429 : 503, headers: noStoreHeaders() });
}
function unavailable() { return json({ error: 'Not found' }, { status: 404, headers: noStoreHeaders() }); }
function ineligible() { return json({ error: 'Kibble PDP related-products model action is unavailable' }, { status: 409, headers: noStoreHeaders() }); }
function invalidRequest() { return json({ error: 'Invalid Kibble decision request' }, { status: 400, headers: noStoreHeaders() }); }
function sessionUnavailable() { return json({ error: 'Kibble preview session is unavailable' }, { status: 409, headers: noStoreHeaders() }); }
function noStoreHeaders() { return { 'Cache-Control': 'no-store' }; }

export const _test = { serverRelatedCandidates, PREVIEW_VERSION, descriptor: getKibbleObservePdpRelatedModelPolicyDescriptor };
