import { generateText, Output } from 'ai';
import type { PersonaInference } from '$lib/signals/types';
import { model, withModelFallback } from '$lib/server/model';
import { createKibbleDemoProviderDeadline } from '$lib/server/kibble-demo-ai-deadline.server';
import { KIBBLE_DEMO_MAX_OUTPUT_TOKENS } from '$lib/kibble-demo-ai-boundary';
import { executeKibbleBoundedCopyModelZone } from './kibble-zone-executor.server';
import {
	KIBBLE_CART_DEFAULT_PRESENTATION,
	KIBBLE_CART_PRESENTATION_IDS,
	KIBBLE_CHECKOUT_DEFAULT_PRESENTATION,
	KIBBLE_CHECKOUT_PRESENTATION_IDS,
	KIBBLE_SEARCH_DEFAULT_PRESENTATION,
	KIBBLE_SEARCH_PRESENTATION_IDS,
	kibbleCartPresentationPromptOptions,
	kibbleCheckoutPresentationPromptOptions,
	kibbleSearchPresentationPromptOptions,
	materializeKibbleCartPresentation,
	materializeKibbleCheckoutPresentation,
	materializeKibbleSearchPresentation,
	parseKibbleCartPresentationDecision,
	parseKibbleCheckoutPresentationDecision,
	parseKibbleSearchPresentationDecision,
	type KibbleCartPresentationDecision,
	type KibbleCheckoutPresentationDecision,
	type KibbleSearchPresentationDecision,
} from './kibble-presentation-decisions';

export const KIBBLE_BOUNDED_COPY_MODEL_PROMPT_VERSION = 'kibble-bounded-funnel-copy-v1';
export const KIBBLE_BOUNDED_COPY_MODEL_SCHEMA_VERSION = 'kibble-copy-variant-decision-v1';

type Input =
	| { surface: 'search'; routePath: '/search'; query: string; inference: PersonaInference }
	| { surface: 'cart'; routePath: '/cart'; inference: PersonaInference }
	| { surface: 'checkout'; routePath: '/checkout/gift' | '/checkout/prepaid'; subtype: 'gift' | 'prepaid'; inference: PersonaInference };

export async function chooseKibbleBoundedCopyWithModel(input: Input) {
	const deadline = createKibbleDemoProviderDeadline();
	let modelCallCount = 0;
	let modelId = '';
	let inputTokens: number | undefined;
	let outputTokens: number | undefined;
	try {
		const execution = await executeForSurface(input, async (outputSchema, prompt) => {
			const generated = await withModelFallback(async (candidateModelId) => {
				modelCallCount += 1;
				return generateText({
					model: model(candidateModelId), abortSignal: deadline.signal,
					maxOutputTokens: KIBBLE_DEMO_MAX_OUTPUT_TOKENS,
					output: Output.object({ schema: outputSchema }), prompt,
				});
			}, deadline.signal);
			modelId = generated.modelId;
			inputTokens = generated.result.usage?.inputTokens;
			outputTokens = generated.result.usage?.outputTokens;
			return generated.result.output;
		});
		if (!modelId || modelCallCount < 1) throw new Error(`Kibble ${input.surface} model runner returned no provider evidence.`);
		return {
			...execution,
			adapter: { ...execution.adapter, modelCallCount },
			modelId, modelCallCount,
			...(inputTokens === undefined ? {} : { inputTokens }),
			...(outputTokens === undefined ? {} : { outputTokens }),
		};
	} finally {
		deadline.dispose();
	}
}

async function executeForSurface(
	input: Input,
	run: (outputSchema: Parameters<Parameters<typeof executeKibbleBoundedCopyModelZone>[0]['runModel']>[0]['outputSchema'], prompt: string) => Promise<unknown>,
) {
	const prompt = buildPrompt(input);
	if (input.surface === 'search') {
		return executeKibbleBoundedCopyModelZone({
			surface: 'search', instanceId: 'search.empty-state', routePath: '/search',
			copyVariantIds: KIBBLE_SEARCH_PRESENTATION_IDS.emptyCopyVariantIds,
			baselineCopyVariantId: KIBBLE_SEARCH_DEFAULT_PRESENTATION.emptyCopyVariantId,
			contentForCopyVariant: (copyVariantId) => {
				const decision = parseKibbleSearchPresentationDecision({ emptyCopyVariantId: copyVariantId });
				if (!decision) throw new Error('Kibble search copy variant is not approved.');
				return editorialHeader(materializeKibbleSearchPresentation(decision, input.query).copy);
			},
			runModel: ({ outputSchema }) => run(outputSchema, prompt),
		});
	}
	if (input.surface === 'cart') {
		return executeKibbleBoundedCopyModelZone({
			surface: 'cart', instanceId: 'cart.empty-state', routePath: '/cart',
			copyVariantIds: KIBBLE_CART_PRESENTATION_IDS.emptyCopyVariantIds,
			baselineCopyVariantId: KIBBLE_CART_DEFAULT_PRESENTATION.emptyCopyVariantId,
			contentForCopyVariant: (copyVariantId) => {
				const decision = parseKibbleCartPresentationDecision({ emptyCopyVariantId: copyVariantId });
				if (!decision) throw new Error('Kibble cart copy variant is not approved.');
				return editorialHeader(materializeKibbleCartPresentation(decision).copy);
			},
			runModel: ({ outputSchema }) => run(outputSchema, prompt),
		});
	}
	return executeKibbleBoundedCopyModelZone({
		surface: 'checkout', instanceId: 'checkout.assurance-strip', routePath: input.routePath,
		copyVariantIds: KIBBLE_CHECKOUT_PRESENTATION_IDS.assuranceCopyVariantIds,
		baselineCopyVariantId: KIBBLE_CHECKOUT_DEFAULT_PRESENTATION.assuranceCopyVariantId,
		contentForCopyVariant: (copyVariantId) => {
			const decision = parseKibbleCheckoutPresentationDecision({ assuranceCopyVariantId: copyVariantId });
			if (!decision) throw new Error('Kibble checkout copy variant is not approved.');
			const assurance = materializeKibbleCheckoutPresentation(decision).assurance;
			return { component: 'service-callouts-grid' as const, props: { columns: 3 as const, callouts: assurance.callouts.map((item) => ({ ...item })) } };
		},
		runModel: ({ outputSchema }) => run(outputSchema, prompt),
	});
}

function buildPrompt(input: Input): string {
	const options = input.surface === 'search' ? kibbleSearchPresentationPromptOptions()
		: input.surface === 'cart' ? kibbleCartPresentationPromptOptions()
			: kibbleCheckoutPresentationPromptOptions();
	const context = input.surface === 'search'
		? `Search state: zero results for ${input.query ? 'a non-empty query' : 'an empty query'}; the raw query is intentionally omitted.`
		: input.surface === 'checkout' ? `Checkout presentation subtype: ${input.subtype}`
			: 'Cart state: unavailable; do not infer or invent cart contents.';
	return [
		`Select one bounded ${input.surface} presentation for the inferred shopper.`,
		'Return exactly one approved copyVariantId. Select only an ID below; do not write prose, invent commerce state, change links, or create a transaction.',
		`Primary persona: ${input.inference.primary}`,
		`Persona probabilities: ${Object.entries(input.inference.probabilities).map(([key, value]) => `${key}=${value.toFixed(3)}`).join(', ')}`,
		`Urgency: ${input.inference.modifiers.urgency.toFixed(3)}`,
		context,
		'Approved presentation choices:',
		...options,
	].join('\n');
}

function editorialHeader(copy: { eyebrow: string; headline: string; body: string }) {
	return { component: 'editorial-header' as const, props: copy };
}

export function decisionFromCopyVariant(surface: Input['surface'], copyVariantId: string):
	KibbleSearchPresentationDecision | KibbleCartPresentationDecision | KibbleCheckoutPresentationDecision | null {
	if (surface === 'search') return parseKibbleSearchPresentationDecision({ emptyCopyVariantId: copyVariantId });
	if (surface === 'cart') return parseKibbleCartPresentationDecision({ emptyCopyVariantId: copyVariantId });
	return parseKibbleCheckoutPresentationDecision({ assuranceCopyVariantId: copyVariantId });
}
