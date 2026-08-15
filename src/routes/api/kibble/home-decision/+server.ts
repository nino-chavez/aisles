import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import {
	getContractSurfaceDecision,
	assertKibblePreserveRoutePolicy,
	getKibbleObserveHomeModelPolicyDescriptor,
	getTrustedKibbleObserveHomePresentationPolicy,
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
	type KibbleHomeModelResult,
} from '$lib/brand/reference/kibble-home-model.server';
import { MODEL_PROVIDER } from '$lib/server/model';
import { reserveKibbleDemoAiCall } from '$lib/server/kibble-demo-ai-budget';
import { logGeneration } from '$lib/server/generation-log';
import { executeKibbleHomeFeaturedZoneAdapters } from '$lib/brand/reference/kibble-zone-executor.server';
import { KIBBLE_HOME_DEFAULT_PRESENTATION, KIBBLE_HOME_PRESENTATION_POLICY } from '$lib/brand/reference/kibble-presentation-decisions';
import { buildKibbleHomePresentationContext } from '$lib/brand/reference/kibble-runtime';
import { BoundedModelActionError } from '$lib/server/bounded-model-action.server';

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

	let modelSurfacePolicy: ReturnType<typeof getTrustedKibbleObserveHomePresentationPolicy> | null = null;
	try {
		assertKibblePreserveRoutePolicy(surfaceDecision.policy, 'home');
		if (mode === 'model') modelSurfacePolicy = getTrustedKibbleObserveHomePresentationPolicy();
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
			if (!modelSurfacePolicy) return unavailable();
			const reservation = await reserveKibbleDemoAiCall(sessionId);
			if (!reservation.ok) return budgetUnavailable(reservation.reason);
			const startedAt = Date.now();
			const presentationContext = buildKibbleHomePresentationContext(referenceProducts.source);
			const modelDecision = await rankKibbleHomeWithModel({
				inference,
				products: decision.products,
				presentationContext,
			});
			const products = modelDecision.products.map(({ personaFit: _personaFit, catalogSignals: _catalogSignals, ...product }) => product);
			const rankedProductIds = products.map(({ entityId }) => entityId);
			const scenarioId = privateEnv.KIBBLE_SHOWCASE_SCENARIO_ID?.trim() || 'kibble-public-observe-demo';
			const provenance = buildContractedLayoutProvenance({
				policy: modelSurfacePolicy,
				surface: 'home',
				route: '/',
				persona: inference.primary,
				rendererComponentId: 'kibble.home',
				rendererVariantId: KIBBLE_REFERENCE_CONTRACT.recipes.home.id,
				decisionSource: 'model',
				promptVersion: KIBBLE_HOME_MODEL_PROMPT_VERSION,
				schemaVersion: KIBBLE_HOME_MODEL_SCHEMA_VERSION,
				contractInput: {
					zones: KIBBLE_HOME_PRESENTATION_POLICY.zoneIds,
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
				policyVersion: modelSurfacePolicy.policyVersion,
				persona: inference.primary,
				products,
				zoneArtifacts: modelDecision.zoneArtifacts,
				presentationPolicy: KIBBLE_HOME_PRESENTATION_POLICY,
				provider: MODEL_PROVIDER,
				modelId: modelDecision.modelId,
				modelCallCount: modelDecision.modelCallCount,
				inspector: buildModelInspector({
					decision,
					inference,
					products,
					policyVersion: modelSurfacePolicy.policyVersion,
					modelId: modelDecision.modelId,
					modelCallCount: modelDecision.modelCallCount,
					presentationDecision: modelDecision.presentationDecision,
					zoneArtifacts: modelDecision.zoneArtifacts,
					provenance,
				}),
			});
		}

		const products = decision.products.map(({ personaFit: _personaFit, catalogSignals: _catalogSignals, ...product }) => product);
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
		return json({ error: 'Failed to preview Kibble Home decision', modelCallCount: attemptedModelCalls(error) }, { status: 500, headers: noStoreHeaders() });
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
	presentationDecision: KibbleHomeModelResult['presentationDecision'];
	zoneArtifacts: KibbleHomeModelResult['zoneArtifacts'];
	provenance: ReturnType<typeof buildContractedLayoutProvenance>;
}) {
	const inputProducts = input.decision.products.map(({ id, name }) => ({ id, name }));
	const outputProducts = input.products.map(({ id, name }) => ({ id, name }));
	const productOrderChanged = !sameProductOrder(inputProducts, outputProducts);
	const modelCallStatus = { calls: input.modelCallCount, authorized: true } as const;
	return {
		...input.decision.inspector,
		availableModelDecision: getKibbleObserveHomeModelPolicyDescriptor(),
		preset: 'compose' as const,
		policyVersion: input.policyVersion,
		inference: sanitizeInspectorInference(input.inference),
		dataSourceLabel: 'bounded-model-presentation',
		zones: input.decision.inspector.zones.map((zone) => {
			const safeZone = stripZoneScoreVariants(zone);
			if (zone.id === 'opening-merchandising') return {
				...safeZone,
				id: input.zoneArtifacts.hero.instanceId,
				label: 'Opening hero',
				authority: 'model' as const,
				componentVariant: input.zoneArtifacts.hero.componentVariantId,
				capabilities: ['select_copy_variant'],
				decisionSummary: `Selected the approved ${input.presentationDecision.heroCopyVariantId} copy variant for home.hero.`,
				changed: input.presentationDecision.heroCopyVariantId !== KIBBLE_HOME_DEFAULT_PRESENTATION.heroCopyVariantId,
				modelCallStatus,
			};
			if (zone.id === 'ranked-products') return {
				...safeZone,
				id: input.zoneArtifacts.featured.instanceId,
				label: 'Featured product shelf',
				authority: 'model' as const,
				componentVariant: input.zoneArtifacts.featured.componentVariantId,
				capabilities: ['rank_products', 'select_copy_variant', 'reorder_zones'],
				decisionSummary: `Selected an exact product permutation, the approved ${input.presentationDecision.featuredCopyVariantId} copy variant, and the approved ${input.presentationDecision.sectionOrderId} section order.`,
				changed: productOrderChanged
					|| input.presentationDecision.featuredCopyVariantId !== KIBBLE_HOME_DEFAULT_PRESENTATION.featuredCopyVariantId
					|| input.presentationDecision.sectionOrderId !== KIBBLE_HOME_DEFAULT_PRESENTATION.sectionOrderId,
				inputProducts,
				outputProducts,
				modelCallStatus,
				decision: { model: input.modelId, outputField: 'rankedProductIds', productCount: outputProducts.length },
			};
			if (zone.id === 'catalog-entry') return {
				...safeZone,
				id: input.zoneArtifacts.editorial.instanceId,
				label: 'Catalog entry',
				authority: 'model' as const,
				componentVariant: input.zoneArtifacts.editorial.componentVariantId,
				capabilities: ['select_copy_variant', 'select_component_variant'],
				decisionSummary: `Selected the approved ${input.presentationDecision.catalogCopyVariantId} copy and ${input.presentationDecision.catalogComponentVariantId} component variants for home.editorial-strip.`,
				changed: input.presentationDecision.catalogCopyVariantId !== KIBBLE_HOME_DEFAULT_PRESENTATION.catalogCopyVariantId
					|| input.presentationDecision.catalogComponentVariantId !== KIBBLE_HOME_DEFAULT_PRESENTATION.catalogComponentVariantId,
				modelCallStatus,
			};
			return safeZone;
		}),
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

function attemptedModelCalls(error: unknown): number {
	return error instanceof BoundedModelActionError ? error.callCount : 0;
}
