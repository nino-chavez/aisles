import { describe, expect, it } from 'vitest';
import { infer } from '$lib/signals/inference';
import { SignalStore } from '$lib/signals/store';
import { KIBBLE_SYNTHETIC_BEHAVIORS, summarizeBehaviorSignalTypes } from './kibble-synthetic-behaviors.dev';

describe('Kibble synthetic shopper behaviors', () => {
	it('uses recognizable typed behaviors rather than direct persona assignments', () => {
		expect(KIBBLE_SYNTHETIC_BEHAVIORS.map(({ id }) => id)).toEqual(['explore', 'compare', 'deal', 'gift']);
		for (const behavior of KIBBLE_SYNTHETIC_BEHAVIORS) {
			expect(behavior.events.length).toBeGreaterThan(0);
			expect(JSON.stringify(behavior.events)).not.toMatch(/persona|primary|probabilit/i);
		}
	});

	it('drives four distinct inference outcomes through the real store and rules', () => {
		const primaryByBehavior = Object.fromEntries(KIBBLE_SYNTHETIC_BEHAVIORS.map((behavior) => {
			const store = new SignalStore(`behavior-${behavior.id}`);
			store.setBrandId('kibble');
			for (const event of behavior.events) {
				const source = event.type.startsWith('nav.') ? 'navigation' : 'interaction';
				store.emit(event.type, source, event.data);
			}
			return [behavior.id, infer(store.toInferenceContext()).primary];
		}));
		expect(primaryByBehavior).toEqual({ explore: 'gatherer', compare: 'researcher', deal: 'hunter', gift: 'gifter' });
	});

	it('summarizes repeated event types for the visible simulator trace', () => {
		const compare = KIBBLE_SYNTHETIC_BEHAVIORS.find(({ id }) => id === 'compare')!;
		expect(summarizeBehaviorSignalTypes(compare.events)).toEqual([
			'nav.product_view ×4',
			'nav.back ×2',
			'interact.dwell_time',
		]);
	});
});
