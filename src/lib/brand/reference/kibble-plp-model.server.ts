import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { PersonaInference } from '$lib/signals/types';
import { model, withModelFallback } from '$lib/server/model';
import { getTrustedKibbleObservePlpProductRankingZonePolicy } from '$lib/brand/composition-policy';
import { SHOPPER_ROUTE_MANIFEST_DIGEST, SHOPPER_ROUTE_MANIFEST_VERSION } from '$lib/foundation/autonomy-zone-route';
import type { TrustedZoneFieldCatalog } from '$lib/foundation/zone-decision-schema';
import { executeZoneDecision, type TrustedBoundZoneCatalog, type TrustedZoneExecutionIdentity, type ZoneModelRunner } from '$lib/server/zone-decision-executor';
import { KIBBLE_REFERENCE_CONTRACT } from './kibble';
import {
	hashKibblePlpCandidateCatalog,
	hashKibblePlpRankingInput,
	KIBBLE_PLP_RANKING_ROUTE,
	type KibblePlpRankableCandidate,
} from './kibble-plp-ranking-boundary.server';

export const KIBBLE_PLP_MODEL_PROMPT_VERSION = 'kibble-plp-first-eight-rank-v1';
export const KIBBLE_PLP_MODEL_SCHEMA_VERSION = 'kibble-plp-first-eight-zone-decision-v1';
const ROUTE_PATH = KIBBLE_PLP_RANKING_ROUTE;

export type KibblePlpCandidate = KibblePlpRankableCandidate;

/**
 * The only PLP model boundary. The tail is carried as provenance, never passed
 * to the provider, and never materialized from model output.
 */
export async function rankKibblePlpFirstEightWithModel(input: {
	inference: PersonaInference;
	prefix: KibblePlpCandidate[];
	tail: KibblePlpCandidate[];
}) {
	if (input.prefix.length < 3 || input.prefix.length > 8) throw new Error('Kibble PLP ranking requires three to eight approved prefix products.');
	if (new Set(input.prefix.map(({ entityId }) => entityId)).size !== input.prefix.length) throw new Error('Kibble PLP ranking received duplicate prefix identities.');
	const prefixIds = input.prefix.map(({ entityId }) => String(entityId));
	const tailIds = input.tail.map(({ entityId }) => String(entityId));
	const productCatalogVersion = hashKibblePlpCandidateCatalog([...input.prefix, ...input.tail]);
	if (new Set([...prefixIds, ...tailIds]).size !== prefixIds.length + tailIds.length) throw new Error('Kibble PLP page contains duplicate catalog identities.');
	const policy = getTrustedKibbleObservePlpProductRankingZonePolicy({ origin: 'aisles', familyId: 'plp.product-ranking', instanceId: 'plp.product-ranking', routePath: ROUTE_PATH });
	const identity: TrustedZoneExecutionIdentity = {
		organizationId: 'kibble-demo-merchant', brandId: 'kibble', referenceId: KIBBLE_REFERENCE_CONTRACT.id,
		referenceVersion: KIBBLE_REFERENCE_CONTRACT.version, policyVersion: policy.policyVersion,
		routeSource: 'pathname', routePath: ROUTE_PATH, surface: 'plp', routeManifestVersion: SHOPPER_ROUTE_MANIFEST_VERSION,
		routeManifestDigest: SHOPPER_ROUTE_MANIFEST_DIGEST, zoneOrigin: 'aisles', familyId: 'plp.product-ranking', instanceId: 'plp.product-ranking',
		productCatalogId: 'kibble-live-category-candidates', productCatalogVersion,
		allowedDecisionModes: policy.provenance.zoneBinding?.allowedDecisionModes ?? [],
	};
	if (identity.allowedDecisionModes.length === 0) throw new Error('Kibble observe PLP policy lacks an attested zone binding.');
	const fields: TrustedZoneFieldCatalog = {
		registeredComponentVariantIds: ['kibble.category-listing.ranked-prefix'], registeredCssVariantIds: [], registeredCopyVariantIds: [], registeredRecipeIds: [],
		registeredProductIds: prefixIds, registeredPlacementIds: [],
		completeComponentVariants: [{ componentVariantId: 'kibble.category-listing.ranked-prefix', compatibleCopyVariantIds: [] }],
		allowedRecipeIds: [], allowedProductIds: prefixIds, allowedPlacementIds: [], boundedCopyFields: [],
		fixed: { componentVariantId: 'kibble.category-listing.ranked-prefix', productIds: prefixIds },
	};
	const catalog: TrustedBoundZoneCatalog = {
		identity, fields,
		products: { organizationId: identity.organizationId, brandId: identity.brandId, referenceId: identity.referenceId, referenceVersion: identity.referenceVersion, catalogId: identity.productCatalogId, catalogVersion: identity.productCatalogVersion, productIds: prefixIds },
		materialize: ({ decision }) => {
			const raw = decision?.envelope.rawModelContent;
			const ranked = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).rankedProductIds : null;
			return productGridContent(Array.isArray(ranked) ? ranked.filter(isString) : prefixIds);
		},
	};
	const prompt = buildKibblePlpModelPrompt(input.inference, input.prefix);
	const providerOutputSchema = buildKibblePlpProviderOutputSchema(input.prefix);
	let modelCallCount = 0;
	let modelId = '';
	let inputTokens: number | undefined;
	let outputTokens: number | undefined;
	const runModel: ZoneModelRunner = async ({ outputSchema }) => {
		const generated = await withModelFallback(async (candidateModelId) => {
			modelCallCount += 1;
			return generateText({ model: model(candidateModelId), output: Output.object({ schema: providerOutputSchema }), prompt });
		});
		modelId = generated.modelId;
		inputTokens = generated.result.usage?.inputTokens;
		outputTokens = generated.result.usage?.outputTokens;
		return outputSchema.parse(generated.result.output);
	};
	const execution = await executeZoneDecision({ policy, catalog, fallback: { identity, kind: 'content', content: productGridContent(prefixIds) }, runModel });
	if (execution.status !== 'live' || execution.decisionMode !== 'model' || execution.render.kind !== 'content' || !modelId || modelCallCount < 1) {
		throw new Error(`Kibble PLP model ranking did not publish: ${execution.status === 'fallback' ? execution.reason : execution.status}.`);
	}
	const raw = execution.decision?.envelope.rawModelContent;
	const rankedValue = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).rankedProductIds : null;
	const rankedPrefixIds: string[] = Array.isArray(rankedValue) ? rankedValue.filter(isString) : [];
	if (!sameExactSet(rankedPrefixIds, prefixIds)) throw new Error('Kibble PLP model output was not an exact approved prefix permutation.');
	return {
		policy, execution, prefixIds, tailIds, rankedPrefixIds, modelId, modelCallCount, prompt,
		productCatalogId: identity.productCatalogId, productCatalogVersion: identity.productCatalogVersion,
		...(inputTokens === undefined ? {} : { inputTokens }), ...(outputTokens === undefined ? {} : { outputTokens }),
		zoneAdapter: {
			instanceId: 'plp.product-ranking', sharedStatus: 'live' as const, sharedContentKind: 'content' as const, decisionMode: 'model' as const,
			modelCallCount, adapterId: 'kibble.zone.plp.product-ranking', componentVariantId: 'kibble.category-listing.ranked-prefix',
			// The adapter hash binds the immutable server input, not the model's
			// result: route/sort/cursor and the exact original prefix and tail.
			inputSha256: hashKibblePlpRankingInput(prefixIds, tailIds),
			content: execution.render.content,
		},
	};
}

export function buildKibblePlpProviderOutputSchema(products: readonly Pick<KibblePlpCandidate, 'entityId'>[]) {
	const ids = products.map(({ entityId }) => String(entityId));
	if (ids.length < 3 || ids.length > 8 || new Set(ids).size !== ids.length) throw new Error('Kibble PLP provider schema requires three to eight unique approved IDs.');
	return z.object({ rankedProductIds: z.array(z.enum([ids[0]!, ...ids.slice(1)])) }).strict();
}

export function buildKibblePlpModelPrompt(inference: PersonaInference, products: readonly KibblePlpCandidate[]) {
	return [
		'Rank only the first eight already-approved Kibble & Co. category products for the inferred shopper.',
		'Your only authority is rankedProductIds. Return every supplied product ID exactly once.',
		'Do not add or remove products. Do not write copy. Do not choose the category, sort, cursor, layout, CSS, prices, links, or actions.',
		`Primary persona: ${inference.primary}`,
		`Persona probabilities: ${Object.entries(inference.probabilities).map(([key, value]) => `${key}=${value.toFixed(3)}`).join(', ')}`,
		'Approved prefix products:',
		...products.map((product) => `- ${product.entityId} | ${product.name} | ${product.category} | USD ${product.price.toFixed(2)}`),
	].join('\n');
}

/** Stable provenance binding for the server-owned page state, never model output. */
function productGridContent(productIds: readonly string[]) { return { component: 'product-grid' as const, props: { columns: 4 as const, products: productIds.map((productId) => ({ productId, role: 'standard' as const })), imageRatio: 'square' as const, showDescription: false as const, showSpecs: false as const, showQuickAdd: false as const } }; }
function isString(value: unknown): value is string { return typeof value === 'string'; }
function sameExactSet(actual: readonly string[], expected: readonly string[]) { return actual.length === expected.length && new Set(actual).size === actual.length && actual.every((id) => expected.includes(id)); }
