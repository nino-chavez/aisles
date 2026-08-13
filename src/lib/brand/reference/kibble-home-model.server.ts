import { generateText, Output } from 'ai';
import type { PersonaInference } from '$lib/signals/types';
import { model, withModelFallback } from '$lib/server/model';
import type { KibbleHomeCandidateProduct } from './kibble-home-decision';
import { executeKibbleHomeModelShelf } from './kibble-zone-executor.server';

export const KIBBLE_HOME_MODEL_PROMPT_VERSION = 'kibble-home-bounded-rank-v1';
export const KIBBLE_HOME_MODEL_SCHEMA_VERSION = 'kibble-home-zone-decision-v1';

export type KibbleHomeModelResult = {
	products: KibbleHomeCandidateProduct[];
	zoneAdapter: Awaited<ReturnType<typeof executeKibbleHomeModelShelf>>['adapter'];
	policy: Awaited<ReturnType<typeof executeKibbleHomeModelShelf>>['policy'];
	modelId: string;
	modelCallCount: number;
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
}): Promise<KibbleHomeModelResult> {
	const prompt = buildKibbleHomeModelPrompt(input.inference, input.products);
	let modelCallCount = 0;
	let servedModelId = '';
	let inputTokens: number | undefined;
	let outputTokens: number | undefined;
	const result = await executeKibbleHomeModelShelf({
		products: input.products,
		runModel: async ({ outputSchema }) => {
			const generated = await withModelFallback(async (modelId) => {
				modelCallCount += 1;
				return generateText({
					model: model(modelId),
					output: Output.object({ schema: outputSchema }),
					prompt,
				});
			});
			servedModelId = generated.modelId;
			inputTokens = generated.result.usage?.inputTokens;
			outputTokens = generated.result.usage?.outputTokens;
			return generated.result.output;
		},
	});
	if (!servedModelId || modelCallCount < 1) throw new Error('Kibble Home model runner returned no provider evidence.');
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
		...(inputTokens === undefined ? {} : { inputTokens }),
		...(outputTokens === undefined ? {} : { outputTokens }),
		prompt,
	};
}

export function buildKibbleHomeModelPrompt(
	inference: PersonaInference,
	products: readonly KibbleHomeCandidateProduct[],
): string {
	const probabilities = Object.entries(inference.probabilities)
		.map(([persona, probability]) => `${persona}=${probability.toFixed(3)}`)
		.join(', ');
	const candidates = products.map((product) => {
		const fit = product.personaFit?.[inference.primary];
		const fitLabel = typeof fit === 'number' && Number.isFinite(fit) ? fit.toFixed(3) : 'unavailable';
		return `- ${product.entityId} | ${product.name} | ${product.category} | USD ${product.price.toFixed(2)} | ${inference.primary} fit ${fitLabel}`;
	}).join('\n');
	return [
		'Rank one already-approved Kibble & Co. product shelf for the inferred shopper.',
		'Your only authority is rankedProductIds. Return every supplied product ID exactly once.',
		'Do not add or remove products. Do not write copy. Do not choose layout, components, CSS, prices, claims, links, or actions.',
		`Primary persona: ${inference.primary}`,
		`Persona probabilities: ${probabilities}`,
		`Price sensitivity: ${inference.modifiers.priceSensitivity.toFixed(3)}`,
		`Urgency: ${inference.modifiers.urgency.toFixed(3)}`,
		'Approved products:',
		candidates,
	].join('\n');
}
