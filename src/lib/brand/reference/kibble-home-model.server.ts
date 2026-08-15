import { z } from 'zod';
import type { PersonaInference } from '$lib/signals/types';
import { KIBBLE_DEMO_MAX_OUTPUT_TOKENS, KIBBLE_DEMO_PROVIDER_DEADLINE_MS } from '$lib/kibble-demo-ai-boundary';
import { BoundedModelActionError, runBoundedModelAction } from '$lib/server/bounded-model-action.server';
import type { KibbleHomeCandidateProduct } from './kibble-home-decision';
import { describeKibbleCatalogSignalsForPrompt } from './kibble-catalog-enrichment';
import { bindExistingKibbleModelZoneAdapter, executeKibbleHomeModelShelf, executeKibblePresentationModelZone } from './kibble-zone-executor.server';
import {
	KIBBLE_HOME_DEFAULT_PRESENTATION,
	KIBBLE_HOME_PRESENTATION_IDS,
	kibbleHomePresentationPromptOptions,
	materializeKibbleHomePresentation,
	parseKibbleHomePresentationDecision,
	type KibbleHomePresentationDecision,
	type KibbleHomePresentationContext,
} from './kibble-presentation-decisions';

export const KIBBLE_HOME_MODEL_PROMPT_VERSION = 'kibble-home-bounded-presentation-v2';
export const KIBBLE_HOME_MODEL_SCHEMA_VERSION = 'kibble-home-presentation-decision-v2';

export type KibbleHomeModelResult = {
	products: KibbleHomeCandidateProduct[];
	zoneAdapter: ReturnType<typeof bindExistingKibbleModelZoneAdapter>;
	zoneArtifacts: {
		hero: Awaited<ReturnType<typeof executeKibblePresentationModelZone>>['adapter'];
		featured: ReturnType<typeof bindExistingKibbleModelZoneAdapter>;
		editorial: Awaited<ReturnType<typeof executeKibblePresentationModelZone>>['adapter'];
	};
	policy: Awaited<ReturnType<typeof executeKibbleHomeModelShelf>>['policy'];
	modelId: string;
	modelCallCount: number;
	presentationDecision: KibbleHomePresentationDecision;
	inputTokens?: number;
	outputTokens?: number;
	prompt: string;
};

/**
 * Ask the configured model for one strict permutation of the approved shelf.
 * No model-authored prose or arbitrary props cross this boundary.
 */
export async function rankKibbleHomeWithModel(input: {
	inference: PersonaInference;
	products: KibbleHomeCandidateProduct[];
	presentationContext?: KibbleHomePresentationContext;
}): Promise<KibbleHomeModelResult> {
	const prompt = buildKibbleHomeModelPrompt(input.inference, input.products, input.presentationContext);
	const providerOutputSchema = buildKibbleHomeProviderOutputSchema(input.products);
	let modelCallCount = 0;
	let servedModelId = '';
	let inputTokens: number | undefined;
	let outputTokens: number | undefined;
	let presentationDecision: KibbleHomePresentationDecision | null = null;
	const result = await (async () => {
		try {
			return await executeKibbleHomeModelShelf({
		products: input.products,
		featuredCopyVariantIds: KIBBLE_HOME_PRESENTATION_IDS.featuredCopyVariantIds,
		baselineFeaturedCopyVariantId: KIBBLE_HOME_DEFAULT_PRESENTATION.featuredCopyVariantId,
		sectionOrderIds: KIBBLE_HOME_PRESENTATION_IDS.sectionOrderIds,
		baselineSectionOrderId: KIBBLE_HOME_DEFAULT_PRESENTATION.sectionOrderId,
		runModel: async ({ outputSchema }) => {
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
			servedModelId = generated.modelId;
			inputTokens = generated.inputTokens;
			outputTokens = generated.outputTokens;
			const { rankedProductIds, ...presentationFields } = generated.output;
			presentationDecision = parseKibbleHomePresentationDecision(presentationFields);
			if (!presentationDecision) throw new Error('Kibble Home presentation decision left the merchant allow-list.');
			return outputSchema.parse({
				rankedProductIds,
				copyVariantId: presentationDecision.featuredCopyVariantId,
				placementId: presentationDecision.sectionOrderId,
			});
		},
			});
		} catch (cause) {
			return rethrowModelPublicationFailure(cause, modelCallCount);
		}
	})();
	if (!servedModelId || modelCallCount < 1 || !presentationDecision) {
		rethrowModelPublicationFailure(new Error('Kibble Home model runner returned no provider evidence.'), modelCallCount);
	}
	const validatedPresentationDecision = presentationDecision as KibbleHomePresentationDecision;
	const baselinePresentation = materializeKibbleHomePresentation(KIBBLE_HOME_DEFAULT_PRESENTATION, input.presentationContext);
	const selectedPresentation = materializeKibbleHomePresentation(validatedPresentationDecision, input.presentationContext);
	const catalogComponentVariantId = validatedPresentationDecision.catalogComponentVariantId === 'four-column'
		? 'kibble.visual-module.category'
		: 'kibble.visual-module.routine';
	let zoneArtifacts: KibbleHomeModelResult['zoneArtifacts'];
	try {
		const [heroZone, editorialZone] = await Promise.all([
		executeKibblePresentationModelZone({
			surface: 'home', familyId: 'home.hero', instanceId: 'home.hero', routePath: '/',
			componentVariantIds: ['kibble.hero.zone-editorial-header'], baselineComponentVariantId: 'kibble.hero.zone-editorial-header',
			copyVariantIds: KIBBLE_HOME_PRESENTATION_IDS.heroCopyVariantIds,
			baselineCopyVariantId: KIBBLE_HOME_DEFAULT_PRESENTATION.heroCopyVariantId,
			modelOutput: { copyVariantId: validatedPresentationDecision.heroCopyVariantId },
			modelCallCount,
			fallbackContent: editorialHeaderContent(baselinePresentation.hero),
			contentForDecision: () => editorialHeaderContent(selectedPresentation.hero),
		}),
		executeKibblePresentationModelZone({
			surface: 'home', familyId: 'home.editorial-strip', instanceId: 'home.editorial-strip', routePath: '/',
			componentVariantIds: ['kibble.visual-module.category', 'kibble.visual-module.routine'],
			baselineComponentVariantId: 'kibble.visual-module.category',
			copyVariantIds: KIBBLE_HOME_PRESENTATION_IDS.catalogCopyVariantIds,
			baselineCopyVariantId: KIBBLE_HOME_DEFAULT_PRESENTATION.catalogCopyVariantId,
			modelOutput: { copyVariantId: validatedPresentationDecision.catalogCopyVariantId, componentVariantId: catalogComponentVariantId },
			modelCallCount,
			fallbackContent: editorialHeaderContent({ eyebrow: baselinePresentation.catalogCopy.eyebrow, headline: baselinePresentation.catalogCopy.title, body: 'Browse the current storefront catalog by category.' }),
			contentForDecision: () => editorialHeaderContent({ eyebrow: selectedPresentation.catalogCopy.eyebrow, headline: selectedPresentation.catalogCopy.title, body: 'Browse the current storefront catalog by category.' }),
		}),
		]);
		const featured = bindExistingKibbleModelZoneAdapter(result.adapter, result.execution, modelCallCount);
		zoneArtifacts = { hero: heroZone.adapter, featured, editorial: editorialZone.adapter };
	} catch (cause) {
		rethrowModelPublicationFailure(cause, modelCallCount);
	}
	const byId = new Map(input.products.map((product) => [String(product.entityId), product]));
	const products: KibbleHomeCandidateProduct[] = result.rankedProductIds
		.map((id: string) => byId.get(id))
		.filter((product: KibbleHomeCandidateProduct | undefined): product is KibbleHomeCandidateProduct => !!product);
	if (products.length !== input.products.length || new Set(products.map(({ entityId }) => entityId)).size !== input.products.length) {
		rethrowModelPublicationFailure(new Error('Kibble Home model output was not an exact approved product permutation.'), modelCallCount);
	}
	return {
		products,
		zoneAdapter: zoneArtifacts.featured,
		zoneArtifacts,
		policy: result.policy,
		modelId: servedModelId,
		modelCallCount,
		presentationDecision: validatedPresentationDecision,
		...(inputTokens === undefined ? {} : { inputTokens }),
		...(outputTokens === undefined ? {} : { outputTokens }),
		prompt,
	};
}

export function buildKibbleHomeProviderOutputSchema(
	products: readonly Pick<KibbleHomeCandidateProduct, 'entityId'>[],
) {
	const productIds = products.map(({ entityId }) => String(entityId));
	const first = productIds[0];
	if (!first || productIds.length > 8 || new Set(productIds).size !== productIds.length) {
		throw new Error('Kibble Home provider schema requires one to eight unique approved product IDs.');
	}
	const ids: [string, ...string[]] = [first, ...productIds.slice(1)];
	return z.object({
		rankedProductIds: z.array(z.enum(ids)),
		heroCopyVariantId: z.enum(tuple(KIBBLE_HOME_PRESENTATION_IDS.heroCopyVariantIds)),
		featuredCopyVariantId: z.enum(tuple(KIBBLE_HOME_PRESENTATION_IDS.featuredCopyVariantIds)),
		catalogCopyVariantId: z.enum(tuple(KIBBLE_HOME_PRESENTATION_IDS.catalogCopyVariantIds)),
		catalogComponentVariantId: z.enum(tuple(KIBBLE_HOME_PRESENTATION_IDS.catalogComponentVariantIds)),
		sectionOrderId: z.enum(tuple(KIBBLE_HOME_PRESENTATION_IDS.sectionOrderIds)),
	}).strict();
}

export function buildKibbleHomeModelPrompt(
	inference: PersonaInference,
	products: readonly KibbleHomeCandidateProduct[],
	presentationContext?: KibbleHomePresentationContext,
): string {
	const probabilities = Object.entries(inference.probabilities)
		.map(([persona, probability]) => `${persona}=${probability.toFixed(3)}`)
		.join(', ');
	const candidates = products.map((product) => {
		const fit = product.personaFit?.[inference.primary];
		const fitLabel = typeof fit === 'number' && Number.isFinite(fit) ? fit.toFixed(3) : 'unavailable';
		const catalogContext = describeKibbleCatalogSignalsForPrompt(product.catalogSignals);
		return `- ${product.entityId} | ${product.name} | ${product.category} | USD ${product.price.toFixed(2)} | ${inference.primary} fit ${fitLabel} | ${catalogContext}`;
	}).join('\n');
	return [
		'Compose one bounded Kibble & Co. storefront presentation for the inferred shopper.',
		'Return every supplied product ID exactly once, plus one ID for every approved presentation field.',
		'You may only select the listed merchant-owned IDs. Do not write prose, add products, change prices, claims, links, actions, CSS, or invent components.',
		`Primary persona: ${inference.primary}`,
		`Persona probabilities: ${probabilities}`,
		`Price sensitivity: ${inference.modifiers.priceSensitivity.toFixed(3)}`,
		`Urgency: ${inference.modifiers.urgency.toFixed(3)}`,
		'Approved products:',
		candidates,
		'Approved presentation choices:',
		...kibbleHomePresentationPromptOptions(presentationContext),
	].join('\n');
}

function tuple<T extends string>(values: readonly T[]): [T, ...T[]] {
	const first = values[0];
	if (!first) throw new Error('Kibble Home presentation allow-list is empty.');
	return [first, ...values.slice(1)];
}

function editorialHeaderContent(copy: { eyebrow: string; headline: string; body: string }) {
	return { component: 'editorial-header' as const, props: copy };
}

function rethrowModelPublicationFailure(cause: unknown, callCount: number): never {
	if (cause instanceof BoundedModelActionError) throw cause;
	if (callCount > 0) throw new BoundedModelActionError('invalid_output', 'validated Home presentation did not publish', callCount);
	throw cause;
}
