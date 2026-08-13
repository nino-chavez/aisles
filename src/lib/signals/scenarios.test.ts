import { afterEach, describe, expect, it } from 'vitest';
import { KIBBLE_SCENARIOS, replayKibbleScenario } from './scenarios';
import { getSessionStore, replaceSessionStore } from './session';

describe('Kibble synthetic scenarios', () => {
	const previousBrand = process.env.BRAND_ID;
	afterEach(() => {
		if (previousBrand === undefined) delete process.env.BRAND_ID;
		else process.env.BRAND_ID = previousBrand;
	});
	for (const id of Object.keys(KIBBLE_SCENARIOS) as Array<keyof typeof KIBBLE_SCENARIOS>) {
		it(`${id} replays deterministically with explicit provenance`, () => {
			const first = replayKibbleScenario(id);
			const second = replayKibbleScenario(id);
			expect(first.store.getCrossSessionContext().scenarioId).toBe(id);
			expect(first.store.getEvents()).toEqual(second.store.getEvents());
			expect(first.inference).toMatchObject({ primary: second.inference.primary, probabilities: second.inference.probabilities });
		});
	}

	it('replaces an existing seeded session instead of appending events', async () => {
		process.env.BRAND_ID = 'kibble';
		const first = replayKibbleScenario('first-time-puppy-owner');
		await replaceSessionStore(first.store);
		const second = replayKibbleScenario('first-time-puppy-owner');
		await replaceSessionStore(second.store);
		const restored = await getSessionStore(first.store.sessionId);
		expect(restored.getEvents()).toEqual(second.store.getEvents());
		expect(restored.eventCount).toBe(second.store.eventCount);
	});
});
