import { json } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import { getContractSurfaceDecision, assertKibblePreserveRoutePolicy } from '$lib/brand/composition-policy';
import { decideKibbleHome } from '$lib/brand/reference/kibble-home-decision';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { sanitizeInspectorInference } from '$lib/components/kibble/kibble-dev-inspector';
import { infer } from '$lib/signals/inference';
import { findSessionStore } from '$lib/signals/session';
import { loadReferenceHomeProducts } from '$lib/server/catalog';
import { buildContractedLayoutProvenance } from '$lib/server/layout-provenance';

const SESSION_COOKIE = 'aisles_session';
const PREVIEW_VERSION = 'kibble-live-home-preview-v1';

/** A public-demo, server-derived view of the bounded Kibble Preserve Home decision. */
export const POST: RequestHandler = async ({ url, cookies }) => {
	if (url.searchParams.get('observe') !== 'true' || getBrand().id !== 'kibble') {
		return unavailable();
	}

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
		const store = await findSessionStore(sessionId);
		if (!store) return sessionUnavailable();

		const inference = infer(store.toInferenceContext());
		const referenceProducts = await loadReferenceHomeProducts(9);
		const decision = decideKibbleHome(surfaceDecision.policy, inference, referenceProducts.products);
		const products = decision.products.map(({ personaFit: _personaFit, ...product }) => product);
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
			inspector: {
				...decision.inspector,
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
