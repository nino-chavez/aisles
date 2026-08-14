import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import {
	getContractSurfaceDecision,
	assertKibblePreserveRoutePolicy,
	getKibbleObserveHomeModelPolicyDescriptor,
} from '$lib/brand/composition-policy';
import { decideKibbleHome } from '$lib/brand/reference/kibble-home-decision';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { sanitizeInspectorInference } from '$lib/components/kibble/kibble-dev-inspector';
import { infer } from '$lib/signals/inference';
import { findSessionStore } from '$lib/signals/session';
import { loadReferenceHomeProducts } from '$lib/server/catalog';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';
import {
	KIBBLE_HOME_MODEL_PROMPT_VERSION,
	KIBBLE_HOME_MODEL_SCHEMA_VERSION,
	rankKibbleHomeWithModel,
} from '$lib/brand/reference/kibble-home-model.server';
import { MODEL_PROVIDER } from '$lib/server/model';
import { reserveKibbleDemoAiCall } from '$lib/server/kibble-demo-ai-budget';
import { logGeneration } from '$lib/server/generation-log';
import { executeKibbleHomeFeaturedZoneAdapters } from '$lib/brand/reference/kibble-zone-executor.server';
import { KIBBLE_HOME_PRESENTATION_POLICY } from '$lib/brand/reference/kibble-presentation-decisions';
import { buildKibbleHomePresentationContext } from '$lib/brand/reference/kibble-runtime';

const SESSION_COOKIE = 'aisles_session';
const PREVIEW_VERSION = 'kibble-live-home-preview-v3';

/** A public-demo, server-derived view of the bounded Kibble Preserve Home decision. */
export const POST: RequestHandler = async ({ url, cookies, request }) => {
	if (
		url.searchParams.get('observe') !== 'true' ||
		cookies.get('aisles_observe_demo') !== '1' ||
		getBrand().id !== 'kibble'
	) {
		return unavailable();
	}
	const mode = await parseMode(request);
	if (!mode) return json({ error: 'Invalid Kibble decision request' }, { status: 400, headers: noStoreHeaders() });

	const surfaceDecision = getContractSurfaceDecision('kibble', 'home');
	if (surfaceDecision.mode !== 'reference-preserve') return unavailable();

	try {
		assertKibblePreserveRoutePolicy(surfaceDecision.policy, 'home');
	} catch {
		return unavailable();
	}

	const sessionId = cookies.get(SESSION_COOKIE);
	if (!sessionId) return sessionUnavailable();

	try {
		// This is a lookup, not getSessionStore: a missing or foreign cookie must
		// never create a session just to preview a decision.
		// Prefer the durable session snapshot so a signal written by another
		// Cloudflare isolate cannot be hidden by this isolate's older hot cache.
		// The provider-free local showcase still falls back to its scoped cache.
		const store = await findSessionStore(sessionId, { fresh: true });
		if (!store) return sessionUnavailable();

		const inference = infer(store.toInferenceContext());
		const referenceProducts = await loadReferenceHomeProducts(9);
		const decision = decideKibbleHome(surfaceDecision.policy, inference, referenceProducts.products);
		if (mode === 'model') {
			const reservation = await reserveKibbleDemoAiCall(sessionId);
			if (!reservation.ok) return budgetUnavailable(reservation.reason);
			const startedAt = Date.now();
			const modelDecision = await rankKibbleHomeWithModel({
				inference,
				products: decision.products,
				presentationContext: buildKibbleHomePresentationContext(referenceProducts.source),
			});
			const products = modelDecision.products.map(({ personaFit: _personaFit, ...product }) => product);
			const rankedProductIds = products.map(({ entityId }) => entityId);
			const scenarioId = privateEnv.KIBBLE_SHOWCASE_SCENARIO_ID?.trim() || 'kibble-public-observe-demo';
			const provenance = buildContractedLayoutProvenance({
				policy: modelDecision.policy,
				surface: 'home',
				route: '/',
				persona: inference.primary,
				rendererComponentId: 'kibble.home',
				rendererVariantId: KIBBLE_REFERENCE_CONTRACT.recipes.home.id,
				decisionSource: 'model',
				promptVersion: KIBBLE_HOME_MODEL_PROMPT_VERSION,
				schemaVersion: KIBBLE_HOME_MODEL_SCHEMA_VERSION,
				contractInput: {
					zone: modelDecision.policy.provenance.zoneBinding,
					rankedProductIds,
					presentationPolicy: KIBBLE_HOME_PRESENTATION_POLICY,
					presentationDecision: modelDecision.presentationDecision,
					modelCallCount: modelDecision.modelCallCount,
				},
				catalogInput: { source: referenceProducts.source, candidates: referenceProducts.products, rankedProductIds },
				shopperContext: { persona: inference.primary, probabilities: inference.probabilities },
				scenarioId,
			});
			await logGeneration({
				type: 'preserve_render',
				persona: inference.primary,
				categorySlug: 'home',
				cacheHit: false,
				generationTimeMs: Date.now() - startedAt,
				productCount: products.length,
				inputTokens: modelDecision.inputTokens,
				outputTokens: modelDecision.outputTokens,
				model: `anthropic/${modelDecision.modelId}`,
				sessionId,
				provenance,
			});
			return previewJson({
				version: PREVIEW_VERSION,
				previewOnly: true,
				reference: decision.inspector.reference,
				policyVersion: modelDecision.policy.policyVersion,
				persona: inference.primary,
				products,
				featuredZoneAdapters: [modelDecision.zoneAdapter],
				presentationPolicy: KIBBLE_HOME_PRESENTATION_POLICY,
				presentationDecision: modelDecision.presentationDecision,
				provider: MODEL_PROVIDER,
				modelId: modelDecision.modelId,
				inspector: buildModelInspector({
					decision,
					inference,
					products,
					policyVersion: modelDecision.policy.policyVersion,
					modelId: modelDecision.modelId,
					modelCallCount: modelDecision.modelCallCount,
					provenance,
				}),
			});
		}

		const products = decision.products.map(({ personaFit: _personaFit, ...product }) => product);
		const featuredZoneAdapters = await executeKibbleHomeFeaturedZoneAdapters(products);
		const rankedProductIds = products.map(({ entityId }) => entityId);
		const scenarioId = privateEnv.KIBBLE_SHOWCASE_SCENARIO_ID?.trim() || 'kibble-public-observe-demo';
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
				decisionTrace: decision.inspector,
			},
			catalogInput: { source: referenceProducts.source, candidates: referenceProducts.products, rankedProductIds },
			shopperContext: { persona: inference.primary, probabilities: inference.probabilities },
			scenarioId,
		});

		return previewJson({
			version: PREVIEW_VERSION,
			previewOnly: true,
			reference: decision.inspector.reference,
			policyVersion: surfaceDecision.policy.policyVersion,
			persona: inference.primary,
			products,
			featuredZoneAdapters,
			inspector: {
				...decision.inspector,
				...(privateEnv.KIBBLE_DEMO_AI_ENABLED === 'true'
					? { availableModelDecision: getKibbleObserveHomeModelPolicyDescriptor() }
					: {}),
				inference: sanitizeInspectorInference(inference),
				dataSourceLabel: privateEnv.KIBBLE_SHOWCASE_DATA_SOURCE || decision.inspector.dataSourceLabel,
				zones: decision.inspector.zones.map(stripZoneScoreVariants),
				provenance,
			},
		});
	} catch (error) {
		console.error('[kibble-home-decision] operational failure:', error);
		return json({ error: 'Failed to preview Kibble Home decision' }, { status: 500, headers: noStoreHeaders() });
	}
};

function stripZoneScoreVariants(zone: ReturnType<typeof decideKibbleHome>['inspector']['zones'][number]) {
	const summarize = (products: typeof zone.inputProducts) => products?.map(({ id, name }) => ({ id, name }));
	return { ...zone, inputProducts: summarize(zone.inputProducts), outputProducts: summarize(zone.outputProducts) };
}

async function parseMode(request: Request): Promise<'rules' | 'model' | null> {
	const raw = await request.text();
	if (!raw) return 'rules';
	if (raw.length > 128) return null;
	try {
		const value = JSON.parse(raw);
		if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
		if (Object.keys(value).length !== 1 || !Object.prototype.hasOwnProperty.call(value, 'mode')) return null;
		return value.mode === 'rules' || value.mode === 'model' ? value.mode : null;
	} catch {
		return null;
	}
}

function buildModelInspector(input: {
	decision: ReturnType<typeof decideKibbleHome>;
	inference: ReturnType<typeof infer>;
	products: Array<{ id: string; name: string }>;
	policyVersion: string;
	modelId: string;
	modelCallCount: number;
	provenance: ReturnType<typeof buildContractedLayoutProvenance>;
}) {
	const outputProducts = input.products.map(({ id, name }) => ({ id, name }));
	return {
		...input.decision.inspector,
		availableModelDecision: getKibbleObserveHomeModelPolicyDescriptor(),
		preset: 'assist' as const,
		policyVersion: input.policyVersion,
		inference: sanitizeInspectorInference(input.inference),
		dataSourceLabel: 'bounded-model-presentation',
		zones: input.decision.inspector.zones.map((zone) => zone.id === 'ranked-products' ? {
			...stripZoneScoreVariants(zone),
			authority: 'model' as const,
			componentVariant: 'kibble.featured-grid.ranked-segment',
			capabilities: ['rank_products'],
			decisionSummary: `One provider call returned an exact product permutation and merchant-approved presentation IDs. Product facts, pricing, links, actions, and CSS remained fixed.`,
			changed: !sameProductOrder(zone.inputProducts, outputProducts),
			outputProducts,
			modelCallStatus: { calls: input.modelCallCount, authorized: true },
			decision: { model: input.modelId, outputField: 'rankedProductIds', productCount: outputProducts.length },
		} : stripZoneScoreVariants(zone)),
		provenance: input.provenance,
	};
}

function sameProductOrder(
	left: Array<{ id: string }> | undefined,
	right: Array<{ id: string }>,
): boolean {
	return !!left && left.length === right.length && left.every((product, index) => product.id === right[index]?.id);
}

function budgetUnavailable(reason: 'disabled' | 'cooldown' | 'session_limit' | 'global_limit' | 'unavailable') {
	const retryable = reason === 'cooldown' || reason === 'session_limit' || reason === 'global_limit';
	return json(
		{ error: retryable ? 'Kibble AI demo budget is temporarily exhausted' : 'Kibble AI demo is unavailable' },
		{ status: retryable ? 429 : 503, headers: noStoreHeaders() },
	);
}

function unavailable() {
	return json({ error: 'Not found' }, { status: 404, headers: noStoreHeaders() });
}

function sessionUnavailable() {
	return json({ error: 'Kibble preview session is unavailable' }, { status: 409, headers: noStoreHeaders() });
}

function previewJson(body: Record<string, unknown>) {
	return json(body, { headers: noStoreHeaders() });
}

function noStoreHeaders() {
	return { 'Cache-Control': 'no-store' };
}
