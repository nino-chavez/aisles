import { generateText, Output } from 'ai';
import { z } from 'zod';
import { model, withModelFallback } from './model';

export type BoundedModelActionFailure = 'aborted' | 'timeout' | 'provider_failed' | 'invalid_output';

export class BoundedModelActionError extends Error {
	readonly reason: BoundedModelActionFailure;

	constructor(reason: BoundedModelActionFailure, message: string) {
		super(`bounded model action: ${message}`);
		this.name = 'BoundedModelActionError';
		this.reason = reason;
	}
}

export interface BoundedModelActionResult<T> {
	output: T;
	provider: 'anthropic';
	modelId: string;
	callCount: number;
	inputTokens?: number;
	outputTokens?: number;
}

type AttemptResult<T> = {
	output: unknown;
	usage?: { inputTokens?: number; outputTokens?: number };
	modelId?: string;
};

export async function runBoundedModelAction<T>(input: {
	prompt: string;
	outputSchema: z.ZodType<T>;
	maxOutputTokens: number;
	timeoutMs: number;
	signal?: AbortSignal;
	/** Test seam; production uses the real provider call below. */
	runAttempt?: (modelId: string, signal: AbortSignal) => Promise<AttemptResult<T>>;
}): Promise<BoundedModelActionResult<T>> {
	if (!Number.isInteger(input.maxOutputTokens) || input.maxOutputTokens < 1) {
		throw new BoundedModelActionError('provider_failed', 'output token bound must be positive');
	}
	if (!Number.isInteger(input.timeoutMs) || input.timeoutMs < 1) {
		throw new BoundedModelActionError('provider_failed', 'timeout must be positive');
	}

	const controller = new AbortController();
	let timedOut = false;
	const timeout = setTimeout(() => {
		timedOut = true;
		controller.abort(new BoundedModelActionError('timeout', 'provider deadline exceeded'));
	}, input.timeoutMs);
	const onAbort = () => controller.abort(input.signal?.reason ?? new BoundedModelActionError('aborted', 'action was aborted'));
	if (input.signal?.aborted) onAbort();
	else input.signal?.addEventListener('abort', onAbort, { once: true });

	let callCount = 0;
	try {
		const attempt = input.runAttempt ?? ((modelId: string, signal: AbortSignal) => runProviderAttempt({
			modelId,
			signal,
			maxOutputTokens: input.maxOutputTokens,
			outputSchema: input.outputSchema,
			prompt: input.prompt,
		}));
		const fallbackResult = await withModelFallback(async (modelId) => {
			callCount += 1;
			return attempt(modelId, controller.signal);
		}, controller.signal) as unknown;
		// The normal fallback helper returns { result, modelId }. Keeping the
		// direct-attempt branch makes this seam compatible with older test and
		// provider adapters that returned the attempt payload directly.
		const generated = isFallbackEnvelope<T>(fallbackResult)
			? fallbackResult
			: { result: fallbackResult as AttemptResult<T>, modelId: (fallbackResult as AttemptResult<T>).modelId ?? 'claude-haiku-4-5' };
		let output: T;
		try {
			output = input.outputSchema.parse(generated.result.output);
		} catch (cause) {
			throw new BoundedModelActionError('invalid_output', cause instanceof Error ? cause.message : 'provider output was invalid');
		}
		return {
			output,
			provider: 'anthropic',
			modelId: generated.modelId,
			callCount,
			...(generated.result.usage?.inputTokens === undefined ? {} : { inputTokens: generated.result.usage.inputTokens }),
			...(generated.result.usage?.outputTokens === undefined ? {} : { outputTokens: generated.result.usage.outputTokens }),
		};
	} catch (cause) {
		if (cause instanceof BoundedModelActionError) throw cause;
		if (timedOut || controller.signal.aborted && input.signal?.aborted !== true) {
			throw new BoundedModelActionError('timeout', 'provider deadline exceeded');
		}
		if (input.signal?.aborted || controller.signal.aborted) {
			throw new BoundedModelActionError('aborted', 'action was aborted');
		}
		throw new BoundedModelActionError('provider_failed', cause instanceof Error ? cause.message : 'provider call failed');
	} finally {
		clearTimeout(timeout);
		input.signal?.removeEventListener('abort', onAbort);
	}
}

function isFallbackEnvelope<T>(value: unknown): value is { result: AttemptResult<T>; modelId: string } {
	return !!value && typeof value === 'object' && 'result' in value && 'modelId' in value
		&& typeof (value as { modelId?: unknown }).modelId === 'string';
}

async function runProviderAttempt<T>(input: {
	modelId: string;
	signal: AbortSignal;
	maxOutputTokens: number;
	outputSchema: z.ZodType<T>;
	prompt: string;
}): Promise<AttemptResult<T>> {
	const result = await generateText({
		model: model(input.modelId),
		abortSignal: input.signal,
		maxOutputTokens: input.maxOutputTokens,
		output: Output.object({ schema: input.outputSchema }),
		prompt: input.prompt,
	});
	// The first-party AI SDK shape is { output, usage }. The nested branch is
	// retained for older test/provider adapters while they migrate to this seam.
	const value = result as unknown as {
		output?: unknown;
		usage?: { inputTokens?: number; outputTokens?: number };
		result?: { output?: unknown; usage?: { inputTokens?: number; outputTokens?: number } };
		modelId?: string;
	};
	return {
		output: value.output ?? value.result?.output,
		usage: value.usage ?? value.result?.usage,
		...(typeof value.modelId === 'string' ? { modelId: value.modelId } : {}),
	};
}
