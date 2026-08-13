import { describe, expect, it, vi } from 'vitest';
import { FALLBACK_MODEL, PRIMARY_MODEL, withModelFallback } from './model';

describe('model fallback deadline', () => {
	it('allows a primary failure to fall back while its shared deadline is live', async () => {
		const controller = new AbortController();
		const run = vi.fn()
			.mockRejectedValueOnce(new Error('primary unavailable'))
			.mockResolvedValueOnce('fallback result');
		await expect(withModelFallback(run, controller.signal)).resolves.toEqual({ result: 'fallback result', modelId: FALLBACK_MODEL });
		expect(run.mock.calls.map(([modelId]) => modelId)).toEqual([PRIMARY_MODEL, FALLBACK_MODEL]);
	});

	it('does not initiate a fallback after the shared deadline aborts', async () => {
		const controller = new AbortController();
		const run = vi.fn(async () => { controller.abort(new Error('deadline')); throw new Error('primary aborted'); });
		await expect(withModelFallback(run, controller.signal)).rejects.toThrow('primary aborted');
		expect(run).toHaveBeenCalledTimes(1);
	});
});
