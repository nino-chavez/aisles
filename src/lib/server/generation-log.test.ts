import { describe, expect, it } from 'vitest';
import { estimateCost } from './generation-log';

describe('generation-log model cost estimates', () => {
	it.each([
		['anthropic/claude-haiku-4-5', 1_000_000, 1_000_000, 4.8],
		['anthropic/claude-sonnet-4-6', 1_000_000, 1_000_000, 18],
	])('uses the actual model identifier for %s', (model, input, output, expected) => {
		expect(estimateCost(model, input, output)).toBe(expected);
	});

	it('does not price an unknown or incomplete model record', () => {
		expect(estimateCost('anthropic/claude-haiku-4.5', 1_000_000, 1_000_000)).toBeNull();
		expect(estimateCost('anthropic/claude-haiku-4-5', undefined, 1_000_000)).toBeNull();
	});
});
