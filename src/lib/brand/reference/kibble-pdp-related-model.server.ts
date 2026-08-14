import { z } from 'zod';
import type { PersonaInference } from '$lib/signals/types';
import type { KibbleCatalogSignals } from './kibble-catalog-enrichment';
import { describeKibbleCatalogSignalsForPrompt } from './kibble-catalog-enrichment';
import { KIBBLE_DEMO_MAX_OUTPUT_TOKENS, KIBBLE_DEMO_PROVIDER_DEADLINE_MS } from '$lib/kibble-demo-ai-boundary';
import { BoundedModelActionError, runBoundedModelAction } from '$lib/server/bounded-model-action.server';
import { bindExistingKibbleModelZoneAdapter, executeKibblePdpRelatedModelShelf, executeKibblePresentationModelZone } from './kibble-zone-executor.server';
import {
	KIBBLE_PDP_DEFAULT_PRESENTATION,
	KIBBLE_PDP_PRESENTATION_IDS,
	kibblePdpPresentationPromptOptions,
	materializeKibblePdpPresentation,
	parseKibblePdpPresentationDecision,
	type KibblePdpPresentationDecision,
} from './kibble-presentation-decisions';

export const KIBBLE_PDP_RELATED_MODEL_PROMPT_VERSION = 'kibble-pdp-related-presentation-v2';
export const KIBBLE_PDP_RELATED_MODEL_SCHEMA_VERSION = 'kibble-pdp-presentation-decision-v2';

export type KibblePdpRelatedCandidate = {
	entityId: number;
	name: string;
	category: string;
	price: number;
	catalogSignals?: KibbleCatalogSignals;
};

export async function rankKibblePdpRelatedWithModel(input: {
	inference: PersonaInference;
	products: KibblePdpRelatedCandidate[];
	routePath: string;
	heading: string;
}) {
	if (input.products.length < 3 || input.products.length > 4) {
		throw new Error('Kibble PDP model ranking requires three to four approved related products.');
	}
	const prompt = buildKibblePdpRelatedModelPrompt(input.inference, input.products);
	const providerOutputSchema = buildKibblePdpRelatedProviderOutputSchema(input.products);
	let modelCallCount = 0;
	let servedModelId = '';
	let inputTokens: number | undefined;
	let outputTokens: number | undefined;
	let presentationDecision: KibblePdpPresentationDecision | null = null;
	const result = await (async () => {
		try {
			return await executeKibblePdpRelatedModelShelf({
		relatedProducts: input.products,
		heading: input.heading,
		relatedCopyVariantIds: KIBBLE_PDP_PRESENTATION_IDS.relatedCopyVariantIds,
		baselineRelatedCopyVariantId: KIBBLE_PDP_DEFAULT_PRESENTATION.relatedCopyVariantId,
		headingForCopyVariant: (copyVariantId) => materializeKibblePdpPresentation({
			...KIBBLE_PDP_DEFAULT_PRESENTATION,
			relatedCopyVariantId: copyVariantId as KibblePdpPresentationDecision['relatedCopyVariantId'],
		}).relatedHeading,
		routePath: input.routePath,
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
			const providerResult = generated.output;
			const { rankedProductIds, ...presentationFields } = providerResult;
			presentationDecision = parseKibblePdpPresentationDecision(presentationFields);
			if (!presentationDecision) throw new Error('Kibble PDP presentation decision left the merchant allow-list.');
			return outputSchema.parse({ rankedProductIds, copyVariantId: presentationDecision.relatedCopyVariantId });
		},
			});
		} catch (cause) {
			return rethrowModelPublicationFailure(cause, modelCallCount);
		}
	})();
	if (!servedModelId || modelCallCount < 1 || !presentationDecision) {
		rethrowModelPublicationFailure(new Error('Kibble PDP model runner returned no provider evidence.'), modelCallCount);
	}
	const validatedPresentationDecision = presentationDecision as KibblePdpPresentationDecision;
	const selectedPresentation = materializeKibblePdpPresentation(validatedPresentationDecision);
	let marketingZoneAdapter: Awaited<ReturnType<typeof executeKibblePresentationModelZone>>['adapter'];
	try {
		const marketingZone = await executeKibblePresentationModelZone({
		surface: 'pdp', familyId: 'pdp.below-description', instanceId: 'pdp.below-description', routePath: input.routePath,
		componentVariantIds: ['kibble.hero.zone-editorial-header'], baselineComponentVariantId: 'kibble.hero.zone-editorial-header',
		copyVariantIds: KIBBLE_PDP_PRESENTATION_IDS.marketingBlockVariantIds,
		baselineCopyVariantId: KIBBLE_PDP_DEFAULT_PRESENTATION.marketingBlockVariantId,
			modelOutput: {
			copyVariantId: validatedPresentationDecision.marketingBlockVariantId,
			visible: validatedPresentationDecision.marketingBlockVariantId !== 'none',
			},
			modelCallCount,
		fallbackContent: null,
		contentForDecision: (decision) => decision.visible === true && selectedPresentation.marketingBlock
			? marketingContent(selectedPresentation.marketingBlock)
			: null,
		});
		marketingZoneAdapter = marketingZone.adapter;
	} catch (cause) {
		rethrowModelPublicationFailure(cause, modelCallCount);
	}
	if (result.rankedProductIds.length !== input.products.length || new Set(result.rankedProductIds).size !== input.products.length) {
		rethrowModelPublicationFailure(new Error('Kibble PDP model output was not an exact approved product permutation.'), modelCallCount);
	}
	const relatedZoneAdapter = bindExistingKibbleModelZoneAdapter(result.adapter, result.execution, modelCallCount);
	return {
		...result,
		adapter: relatedZoneAdapter,
		zoneArtifacts: { related: relatedZoneAdapter, marketing: marketingZoneAdapter },
		modelId: servedModelId,
		modelCallCount,
		presentationDecision: validatedPresentationDecision,
		...(inputTokens === undefined ? {} : { inputTokens }),
		...(outputTokens === undefined ? {} : { outputTokens }),
		prompt,
	};
}

/** The executor owns the adapter; the model runner alone knows provider attempts. */
export function withKibblePdpRelatedModelCallCount<T extends { modelCallCount?: number }>(adapter: T, modelCallCount: number): T & { modelCallCount: number } {
	if (!Number.isInteger(modelCallCount) || modelCallCount < 1 || modelCallCount > 2) {
		throw new Error('Kibble PDP model call count must be one or two provider attempts.');
	}
	return { ...adapter, modelCallCount };
}

export function buildKibblePdpRelatedProviderOutputSchema(products: readonly Pick<KibblePdpRelatedCandidate, 'entityId'>[]) {
	const productIds = products.map(({ entityId }) => String(entityId));
	const first = productIds[0];
	if (!first || productIds.length < 3 || productIds.length > 4 || new Set(productIds).size !== productIds.length) {
		throw new Error('Kibble PDP provider schema requires three to four unique approved product IDs.');
	}
	return z.object({
		rankedProductIds: z.array(z.enum([first, ...productIds.slice(1)])),
		relatedCopyVariantId: z.enum(tuple(KIBBLE_PDP_PRESENTATION_IDS.relatedCopyVariantIds)),
		marketingBlockVariantId: z.enum(tuple(KIBBLE_PDP_PRESENTATION_IDS.marketingBlockVariantIds)),
	}).strict();
}

export function buildKibblePdpRelatedModelPrompt(
	inference: PersonaInference,
	products: readonly KibblePdpRelatedCandidate[],
): string {
	const probabilities = Object.entries(inference.probabilities)
		.map(([persona, probability]) => `${persona}=${probability.toFixed(3)}`).join(', ');
	const candidates = products
		.map((product) => `- ${product.entityId} | ${product.name} | ${product.category} | USD ${product.price.toFixed(2)} | ${describeKibbleCatalogSignalsForPrompt(product.catalogSignals)}`)
		.join('\n');
	return [
		'Compose one bounded Kibble & Co. related-products presentation for the inferred shopper.',
		'Return every supplied product ID exactly once, plus one ID for every approved presentation field.',
		'You may only select the listed merchant-owned IDs. Do not write prose, add products, change prices, claims, links, actions, CSS, or invent components.',
		`Primary persona: ${inference.primary}`,
		`Persona probabilities: ${probabilities}`,
		`Price sensitivity: ${inference.modifiers.priceSensitivity.toFixed(3)}`,
		`Urgency: ${inference.modifiers.urgency.toFixed(3)}`,
		'Approved related products:',
		candidates,
		'Approved presentation choices:',
		...kibblePdpPresentationPromptOptions(),
	].join('\n');
}

function tuple<T extends string>(values: readonly T[]): [T, ...T[]] { const first = values[0]; if (!first) throw new Error('Kibble PDP presentation allow-list is empty.'); return [first, ...values.slice(1)]; }

function marketingContent(block: { eyebrow: string; headline: string; body: string }) {
	return { component: 'editorial-header' as const, props: block };
}

function rethrowModelPublicationFailure(cause: unknown, callCount: number): never {
	if (cause instanceof BoundedModelActionError) throw cause;
	if (callCount > 0) throw new BoundedModelActionError('invalid_output', 'validated PDP presentation did not publish', callCount);
	throw cause;
}
