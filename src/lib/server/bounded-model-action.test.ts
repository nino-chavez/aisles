import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const generateText = vi.hoisted(() => vi.fn());
vi.mock('ai', async (importOriginal) => ({ ...await importOriginal<typeof import('ai')>(), generateText }));

import { runBoundedModelAction } from './bounded-model-action.server';

const outputSchema = z.object({ decision: z.enum(['keep', 'change']) }).strict();
const input = {
	prompt: 'Select one approved presentation decision.',
	outputSchema,
	maxOutputTokens: 512,
	timeoutMs: 50,
};

describe('runBoundedModelAction', () => {
	beforeEach(() => generateText.mockReset());

	it('uses the real provider call path and returns exact provider evidence', async () => {
		generateText.mockResolvedValueOnce({ output: { decision: 'change' }, usage: { inputTokens: 11, outputTokens: 7 } });

		await expect(runBoundedModelAction(input)).resolves.toEqual({
			output: { decision: 'change' }, provider: 'anthropic', modelId: 'claude-haiku-4-5', callCount: 1,
			inputTokens: 11, outputTokens: 7,
		});
		expect(generateText).toHaveBeenCalledWith(expect.objectContaining({ maxOutputTokens: 512, prompt: input.prompt, abortSignal: expect.any(AbortSignal) }));
	});

	it('retries once on the configured fallback model and reports both calls', async () => {
		generateText
			.mockRejectedValueOnce(new Error('primary unavailable'))
			.mockResolvedValueOnce({ output: { decision: 'keep' }, usage: {} });

		await expect(runBoundedModelAction(input)).resolves.toMatchObject({ output: { decision: 'keep' }, modelId: 'claude-sonnet-4-6', callCount: 2 });
		expect(generateText).toHaveBeenCalledTimes(2);
	});

	it('maps a provider deadline to timeout and does not start a fallback attempt', async () => {
		generateText.mockImplementationOnce(({ abortSignal }: { abortSignal: AbortSignal }) => new Promise((_, reject) => {
			abortSignal.addEventListener('abort', () => reject(abortSignal.reason), { once: true });
		}));

		await expect(runBoundedModelAction({ ...input, timeoutMs: 5 })).rejects.toMatchObject({ reason: 'timeout', callCount: 1 });
		expect(generateText).toHaveBeenCalledTimes(1);
	});

	it('maps caller cancellation and schema rejection without publishing output', async () => {
		const controller = new AbortController();
		controller.abort();
		await expect(runBoundedModelAction({ ...input, signal: controller.signal })).rejects.toMatchObject({ reason: 'aborted', callCount: 0 });

		generateText.mockResolvedValueOnce({ output: { decision: 'outside-allow-list' }, usage: {} });
		await expect(runBoundedModelAction(input)).rejects.toMatchObject({ reason: 'invalid_output', callCount: 1 });
	});

	it('retains both failed provider attempts in the sanitized error evidence', async () => {
		generateText.mockRejectedValueOnce(new Error('primary unavailable')).mockRejectedValueOnce(new Error('fallback unavailable'));
		await expect(runBoundedModelAction(input)).rejects.toMatchObject({ reason: 'provider_failed', callCount: 2 });
		expect(generateText).toHaveBeenCalledTimes(2);
	});

	it('rejects unbounded action parameters before a provider call', async () => {
		await expect(runBoundedModelAction({ ...input, maxOutputTokens: 0 })).rejects.toMatchObject({ reason: 'provider_failed', callCount: 0 });
		expect(generateText).not.toHaveBeenCalled();
	});
});
