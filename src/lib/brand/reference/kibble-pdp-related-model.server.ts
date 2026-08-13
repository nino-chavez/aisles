import { generateText, Output } from 'ai';
import { z } from 'zod';
import type { PersonaInference } from '$lib/signals/types';
import { model, withModelFallback } from '$lib/server/model';
import { createKibbleDemoProviderDeadline } from '$lib/server/kibble-demo-ai-deadline.server';
import { executeKibblePdpRelatedModelShelf } from './kibble-zone-executor.server';

export const KIBBLE_PDP_RELATED_MODEL_PROMPT_VERSION = 'kibble-pdp-related-bounded-rank-v1';
export const KIBBLE_PDP_RELATED_MODEL_SCHEMA_VERSION = 'kibble-pdp-related-zone-decision-v1';

export type KibblePdpRelatedCandidate = {
	entityId: number;
	name: string;
	category: string;
	price: number;
};

export async function rankKibblePdpRelatedWithModel(input: {
	inference: PersonaInference;
	products: KibblePdpRelatedCandidate[];
	routePath: '/product/puppy-starter-kit';
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
	const deadline = createKibbleDemoProviderDeadline();
	try {
		const result = await executeKibblePdpRelatedModelShelf({
			relatedProducts: input.products,
			heading: input.heading,
			routePath: input.routePath,
			runModel: async ({ outputSchema }) => {
				const generated = await withModelFallback(async (modelId) => {
					modelCallCount += 1;
					return generateText({
						model: model(modelId),
						abortSignal: deadline.signal,
						// Anthropic's schema subset cannot carry the generic array bounds.
						// The generic contract parses this response here and revalidates it
						// again before the adapter can publish it.
						output: Output.object({ schema: providerOutputSchema }),
						prompt,
					});
				}, deadline.signal);
				servedModelId = generated.modelId;
				inputTokens = generated.result.usage?.inputTokens;
				outputTokens = generated.result.usage?.outputTokens;
				return outputSchema.parse(generated.result.output);
			},
		});
		if (!servedModelId || modelCallCount < 1) throw new Error('Kibble PDP model runner returned no provider evidence.');
		if (result.rankedProductIds.length !== input.products.length || new Set(result.rankedProductIds).size !== input.products.length) {
			throw new Error('Kibble PDP model output was not an exact approved product permutation.');
		}
		return {
			...result,
			adapter: withKibblePdpRelatedModelCallCount(result.adapter, modelCallCount),
			modelId: servedModelId,
			modelCallCount,
			...(inputTokens === undefined ? {} : { inputTokens }),
			...(outputTokens === undefined ? {} : { outputTokens }),
			prompt,
		};
	} finally {
		deadline.dispose();
	}
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
	return z.object({ rankedProductIds: z.array(z.enum([first, ...productIds.slice(1)])) }).strict();
}

export function buildKibblePdpRelatedModelPrompt(
	inference: PersonaInference,
	products: readonly KibblePdpRelatedCandidate[],
): string {
	const probabilities = Object.entries(inference.probabilities)
		.map(([persona, probability]) => `${persona}=${probability.toFixed(3)}`).join(', ');
	const candidates = products
		.map((product) => `- ${product.entityId} | ${product.name} | ${product.category} | USD ${product.price.toFixed(2)}`).join('\n');
	return [
		'Rank one already-approved Kibble & Co. related-products rail for the inferred shopper.',
		'Your only authority is rankedProductIds. Return every supplied product ID exactly once.',
		'Do not add or remove products. Do not write copy. Do not choose layout, components, CSS, prices, claims, links, or actions.',
		`Primary persona: ${inference.primary}`,
		`Persona probabilities: ${probabilities}`,
		`Price sensitivity: ${inference.modifiers.priceSensitivity.toFixed(3)}`,
		`Urgency: ${inference.modifiers.urgency.toFixed(3)}`,
		'Approved related products:',
		candidates,
	].join('\n');
}
