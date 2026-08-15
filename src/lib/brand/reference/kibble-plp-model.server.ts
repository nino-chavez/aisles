import { z } from 'zod';
import type { PersonaInference } from '$lib/signals/types';
import { KIBBLE_DEMO_MAX_OUTPUT_TOKENS, KIBBLE_DEMO_PROVIDER_DEADLINE_MS } from '$lib/kibble-demo-ai-boundary';
import { BoundedModelActionError, runBoundedModelAction } from '$lib/server/bounded-model-action.server';
import { getTrustedKibbleObservePlpProductRankingZonePolicy } from '$lib/brand/composition-policy';
import { SHOPPER_ROUTE_MANIFEST_DIGEST, SHOPPER_ROUTE_MANIFEST_VERSION } from '$lib/foundation/autonomy-zone-route';
import type { TrustedZoneFieldCatalog } from '$lib/foundation/zone-decision-schema';
import { executeZoneDecision, type TrustedBoundZoneCatalog, type TrustedZoneExecutionIdentity, type ZoneModelRunner } from '$lib/server/zone-decision-executor';
import { KIBBLE_REFERENCE_CONTRACT } from './kibble';
import {
	KIBBLE_PLP_DEFAULT_PRESENTATION,
	KIBBLE_PLP_PRESENTATION_IDS,
	kibblePlpPresentationPromptOptions,
	materializeKibblePlpPresentation,
	parseKibblePlpPresentationDecision,
	type KibblePlpPresentationDecision,
} from './kibble-presentation-decisions';
import { bindExistingKibbleModelZoneAdapter, executeKibblePresentationModelZone } from './kibble-zone-executor.server';
import {
	hashKibblePlpCandidateCatalog,
	hashKibblePlpRankingInput,
	type KibblePlpRankableCandidate,
} from './kibble-plp-ranking-boundary.server';

export const KIBBLE_PLP_MODEL_PROMPT_VERSION = 'kibble-plp-first-eight-presentation-v2';
export const KIBBLE_PLP_MODEL_SCHEMA_VERSION = 'kibble-plp-presentation-decision-v2';

export type KibblePlpCandidate = KibblePlpRankableCandidate;

/**
 * The only PLP model boundary. The tail is carried as provenance, never passed
 * to the provider, and never materialized from model output.
 */
export async function rankKibblePlpFirstEightWithModel(input: {
	inference: PersonaInference;
	prefix: KibblePlpCandidate[];
	tail: KibblePlpCandidate[];
	routePath: string;
}) {
	if (input.prefix.length < 3 || input.prefix.length > 8) throw new Error('Kibble PLP ranking requires three to eight approved prefix products.');
	if (new Set(input.prefix.map(({ entityId }) => entityId)).size !== input.prefix.length) throw new Error('Kibble PLP ranking received duplicate prefix identities.');
	const prefixIds = input.prefix.map(({ entityId }) => String(entityId));
	const tailIds = input.tail.map(({ entityId }) => String(entityId));
	const productCatalogVersion = hashKibblePlpCandidateCatalog([...input.prefix, ...input.tail]);
	if (new Set([...prefixIds, ...tailIds]).size !== prefixIds.length + tailIds.length) throw new Error('Kibble PLP page contains duplicate catalog identities.');
	const policy = getTrustedKibbleObservePlpProductRankingZonePolicy({ origin: 'aisles', familyId: 'plp.product-ranking', instanceId: 'plp.product-ranking', routePath: input.routePath });
	const identity: TrustedZoneExecutionIdentity = {
		organizationId: 'kibble-demo-merchant', brandId: 'kibble', referenceId: KIBBLE_REFERENCE_CONTRACT.id,
		referenceVersion: KIBBLE_REFERENCE_CONTRACT.version, policyVersion: policy.policyVersion,
		routeSource: 'pathname', routePath: input.routePath, surface: 'plp', routeManifestVersion: SHOPPER_ROUTE_MANIFEST_VERSION,
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
	let presentationDecision: KibblePlpPresentationDecision | null = null;
	const runModel: ZoneModelRunner = async ({ outputSchema }) => {
		const generated = await runBoundedModelAction({
			outputSchema: providerOutputSchema,
			prompt,
			maxOutputTokens: KIBBLE_DEMO_MAX_OUTPUT_TOKENS,
			timeoutMs: KIBBLE_DEMO_PROVIDER_DEADLINE_MS,
		}).catch((error: unknown) => {
			if (error instanceof BoundedModelActionError) modelCallCount = error.callCount;
			throw error;
		});
		modelCallCount = generated.callCount;
		modelId = generated.modelId;
		inputTokens = generated.inputTokens;
		outputTokens = generated.outputTokens;
		const providerResult = generated.output;
		const { rankedProductIds, ...presentationFields } = providerResult;
		presentationDecision = parseKibblePlpPresentationDecision(presentationFields);
		if (!presentationDecision) throw new Error('Kibble PLP presentation decision left the merchant allow-list.');
		return outputSchema.parse({ rankedProductIds });
	};
	const execution = await (async () => {
		try {
			const published = await executeZoneDecision({ policy, catalog, fallback: { identity, kind: 'content', content: productGridContent(prefixIds) }, runModel });
			if (published.status !== 'live' || published.decisionMode !== 'model' || published.render.kind !== 'content' || !modelId || modelCallCount < 1 || !presentationDecision) {
				throw new Error(`Kibble PLP model ranking did not publish: ${published.status === 'fallback' ? published.reason : published.status}.`);
			}
			return published;
		} catch (cause) {
			return rethrowModelPublicationFailure(cause, modelCallCount);
		}
	})();
	const validatedPresentationDecision = parseKibblePlpPresentationDecision(presentationDecision);
	if (!validatedPresentationDecision) rethrowModelPublicationFailure(new Error('Kibble PLP presentation evidence is unavailable.'), modelCallCount);
	const presentationContext = {
		title: input.prefix[0]?.category ?? 'Catalog',
		productCount: input.prefix.length + input.tail.length,
		productSingular: 'product',
		productPlural: 'products',
	};
	const baselinePresentation = materializeKibblePlpPresentation(KIBBLE_PLP_DEFAULT_PRESENTATION, presentationContext);
	const selectedPresentation = materializeKibblePlpPresentation(validatedPresentationDecision, presentationContext);
	let presentationZoneAdapters: {
		header: Awaited<ReturnType<typeof executeKibblePresentationModelZone>>['adapter'];
		marketing: Awaited<ReturnType<typeof executeKibblePresentationModelZone>>['adapter'];
	};
	try {
		const [headerZone, marketingZone] = await Promise.all([
		executeKibblePresentationModelZone({
			surface: 'plp', familyId: 'plp.editorial-header', instanceId: 'plp.editorial-header', routePath: input.routePath,
			componentVariantIds: ['kibble.category-listing.editorial-header'], baselineComponentVariantId: 'kibble.category-listing.editorial-header',
			copyVariantIds: KIBBLE_PLP_PRESENTATION_IDS.headerCopyVariantIds,
			baselineCopyVariantId: KIBBLE_PLP_DEFAULT_PRESENTATION.headerCopyVariantId,
			modelOutput: { copyVariantId: validatedPresentationDecision.headerCopyVariantId },
			modelCallCount,
			fallbackContent: editorialHeaderContent(baselinePresentation.header),
			contentForDecision: () => editorialHeaderContent(selectedPresentation.header),
		}),
		executeKibblePresentationModelZone({
			surface: 'plp', familyId: 'plp.marketing-block', instanceId: 'plp.marketing-block', routePath: input.routePath,
			componentVariantIds: ['kibble.hero.zone-editorial-header'], baselineComponentVariantId: 'kibble.hero.zone-editorial-header',
			copyVariantIds: KIBBLE_PLP_PRESENTATION_IDS.marketingBlockVariantIds,
			baselineCopyVariantId: KIBBLE_PLP_DEFAULT_PRESENTATION.marketingBlockVariantId,
			modelOutput: {
				copyVariantId: validatedPresentationDecision.marketingBlockVariantId,
				visible: validatedPresentationDecision.marketingBlockVariantId !== 'none',
			},
			modelCallCount,
			fallbackContent: null,
			contentForDecision: (decision) => decision.visible === true && selectedPresentation.marketingBlock
				? editorialHeaderContent(selectedPresentation.marketingBlock)
				: null,
		}),
		]);
		presentationZoneAdapters = { header: headerZone.adapter, marketing: marketingZone.adapter };
	} catch (cause) {
		rethrowModelPublicationFailure(cause, modelCallCount);
	}
	const raw = execution.decision?.envelope.rawModelContent;
	const rankedValue = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).rankedProductIds : null;
	const rankedPrefixIds: string[] = Array.isArray(rankedValue) ? rankedValue.filter(isString) : [];
	if (!sameExactSet(rankedPrefixIds, prefixIds)) {
		rethrowModelPublicationFailure(new Error('Kibble PLP model output was not an exact approved prefix permutation.'), modelCallCount);
	}
	if (execution.status !== 'live' || execution.render.kind !== 'content') {
		rethrowModelPublicationFailure(new Error('Kibble PLP model render evidence is unavailable.'), modelCallCount);
	}
	const rankedAdapter = bindExistingKibbleModelZoneAdapter({
		instanceId: 'plp.product-ranking', sharedStatus: 'live' as const, sharedContentKind: 'content' as const, decisionMode: 'model' as const,
		modelCallCount, adapterId: 'kibble.zone.plp.product-ranking', componentVariantId: 'kibble.category-listing.ranked-prefix',
		inputSha256: hashKibblePlpRankingInput(prefixIds, tailIds, input.routePath), content: execution.render.content,
	}, execution, modelCallCount);
	return {
		policy, execution, prefixIds, tailIds, rankedPrefixIds, modelId, modelCallCount, prompt, presentationDecision: validatedPresentationDecision,
		zoneArtifacts: { header: presentationZoneAdapters.header, ranking: rankedAdapter, marketing: presentationZoneAdapters.marketing },
		productCatalogId: identity.productCatalogId, productCatalogVersion: identity.productCatalogVersion,
		...(inputTokens === undefined ? {} : { inputTokens }), ...(outputTokens === undefined ? {} : { outputTokens }),
		zoneAdapter: rankedAdapter,
	};
}

export function buildKibblePlpProviderOutputSchema(products: readonly Pick<KibblePlpCandidate, 'entityId'>[]) {
	const ids = products.map(({ entityId }) => String(entityId));
	if (ids.length < 3 || ids.length > 8 || new Set(ids).size !== ids.length) throw new Error('Kibble PLP provider schema requires three to eight unique approved IDs.');
	return z.object({
		rankedProductIds: z.array(z.enum([ids[0]!, ...ids.slice(1)])),
		headerCopyVariantId: z.enum(tuple(KIBBLE_PLP_PRESENTATION_IDS.headerCopyVariantIds)),
		marketingBlockVariantId: z.enum(tuple(KIBBLE_PLP_PRESENTATION_IDS.marketingBlockVariantIds)),
	}).strict();
}

export function buildKibblePlpModelPrompt(inference: PersonaInference, products: readonly KibblePlpCandidate[]) {
	return [
		'Compose the bounded Kibble & Co. category presentation for the inferred shopper.',
		'Return every supplied product ID exactly once, plus one ID for every approved presentation field.',
		'You may only select the listed merchant-owned IDs. Do not write prose, add products, change the category, sort, cursor, prices, links, actions, CSS, or invent components.',
		`Primary persona: ${inference.primary}`,
		`Persona probabilities: ${Object.entries(inference.probabilities).map(([key, value]) => `${key}=${value.toFixed(3)}`).join(', ')}`,
		'Approved prefix products:',
		...products.map((product) => `- ${product.entityId} | ${product.name} | ${product.category} | USD ${product.price.toFixed(2)}`),
		'Approved presentation choices:',
		...kibblePlpPresentationPromptOptions(),
	].join('\n');
}

/** Stable provenance binding for the server-owned page state, never model output. */
function productGridContent(productIds: readonly string[]) { return { component: 'product-grid' as const, props: { columns: 4 as const, products: productIds.map((productId) => ({ productId, role: 'standard' as const })), imageRatio: 'square' as const, showDescription: false as const, showSpecs: false as const, showQuickAdd: false as const } }; }
function isString(value: unknown): value is string { return typeof value === 'string'; }
function sameExactSet(actual: readonly string[], expected: readonly string[]) { return actual.length === expected.length && new Set(actual).size === actual.length && actual.every((id) => expected.includes(id)); }
function tuple<T extends string>(values: readonly T[]): [T, ...T[]] { const first = values[0]; if (!first) throw new Error('Kibble PLP presentation allow-list is empty.'); return [first, ...values.slice(1)]; }
function editorialHeaderContent(copy: { eyebrow: string; title?: string; headline?: string; body: string }) { return { component: 'editorial-header' as const, props: { eyebrow: copy.eyebrow, headline: copy.headline ?? copy.title ?? '', body: copy.body } }; }
function rethrowModelPublicationFailure(cause: unknown, callCount: number): never {
	if (cause instanceof BoundedModelActionError) throw cause;
	if (callCount > 0) throw new BoundedModelActionError('invalid_output', 'validated PLP presentation did not publish', callCount);
	throw cause;
}
