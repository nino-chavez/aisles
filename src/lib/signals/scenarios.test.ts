import { describe, expect, it } from 'vitest';
import { KIBBLE_SCENARIOS, replayKibbleScenario } from './scenarios';

describe('Kibble synthetic scenarios', () => {
	for (const id of Object.keys(KIBBLE_SCENARIOS) as Array<keyof typeof KIBBLE_SCENARIOS>) {
		it(`${id} replays deterministically with explicit provenance`, () => {
			const first = replayKibbleScenario(id);
			const second = replayKibbleScenario(id);
			expect(first.store.getCrossSessionContext().scenarioId).toBe(id);
			expect(first.store.getEvents()).toEqual(second.store.getEvents());
			expect(first.inference).toMatchObject({ primary: second.inference.primary, probabilities: second.inference.probabilities });
		});
	}
});
