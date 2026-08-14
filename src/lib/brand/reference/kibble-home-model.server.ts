import { z } from 'zod';
import type { PersonaInference } from '$lib/signals/types';
import { KIBBLE_DEMO_MAX_OUTPUT_TOKENS, KIBBLE_DEMO_PROVIDER_DEADLINE_MS } from '$lib/kibble-demo-ai-boundary';
import { runBoundedModelAction } from '$lib/server/bounded-model-action.server';
import type { KibbleHomeCandidateProduct } from './kibble-home-decision';
import { describeKibbleCatalogSignalsForPrompt } from './kibble-catalog-enrichment';
import { executeKibbleHomeModelShelf } from './kibble-zone-executor.server';
import {
	KIBBLE_HOME_PRESENTATION_IDS,
	kibbleHomePresentationPromptOptions,
	parseKibbleHomePresentationDecision,
	type KibbleHomePresentationDecision,
	type KibbleHomePresentationContext,
} from './kibble-presentation-decisions';

export const KIBBLE_HOME_MODEL_PROMPT_VERSION = 'kibble-home-bounded-presentation-v2';
export const KIBBLE_HOME_MODEL_SCHEMA_VERSION = 'kibble-home-presentation-decision-v2';

export type KibbleHomeModelResult = {
	products: KibbleHomeCandidateProduct[];
	zoneAdapter: Awaited<ReturnType<typeof executeKibbleHomeModelShelf>>['adapter'];
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
	const result = await executeKibbleHomeModelShelf({
		products: input.products,
		runModel: async ({ outputSchema }) => {
			const generated = await runBoundedModelAction({
				outputSchema: providerOutputSchema,
				prompt,
				maxOutputTokens: KIBBLE_DEMO_MAX_OUTPUT_TOKENS,
				timeoutMs: KIBBLE_DEMO_PROVIDER_DEADLINE_MS,
			});
			modelCallCount = generated.callCount;
			servedModelId = generated.modelId;
			inputTokens = generated.inputTokens;
			outputTokens = generated.outputTokens;
			const { rankedProductIds, ...presentationFields } = generated.output;
			presentationDecision = parseKibbleHomePresentationDecision(presentationFields);
			if (!presentationDecision) throw new Error('Kibble Home presentation decision left the merchant allow-list.');
			return outputSchema.parse({ rankedProductIds });
		},
	});
	if (!servedModelId || modelCallCount < 1 || !presentationDecision) throw new Error('Kibble Home model runner returned no provider evidence.');
	const byId = new Map(input.products.map((product) => [String(product.entityId), product]));
	const products: KibbleHomeCandidateProduct[] = result.rankedProductIds
		.map((id: string) => byId.get(id))
		.filter((product: KibbleHomeCandidateProduct | undefined): product is KibbleHomeCandidateProduct => !!product);
	if (products.length !== input.products.length || new Set(products.map(({ entityId }) => entityId)).size !== input.products.length) {
		throw new Error('Kibble Home model output was not an exact approved product permutation.');
	}
	return {
		products,
		zoneAdapter: { ...result.adapter, modelCallCount },
		policy: result.policy,
		modelId: servedModelId,
		modelCallCount,
		presentationDecision,
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
