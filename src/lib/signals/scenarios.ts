import { infer } from './inference';
import { SignalStore } from './store';
import { getBrandById } from '$lib/brand/config';
import type { SignalEvent, SignalEventType, SignalSource } from './types';

export const KIBBLE_SCENARIOS = {
	'first-time-puppy-owner': {
		name: 'First-time puppy owner',
		description: 'New shopper researching a puppy starter order.',
		events: [
			['request.search_landing', 'request', { query: 'best puppy food starter kit' }],
			['nav.product_view', 'navigation', {}],
			['interact.dwell_time', 'interaction', { dwellMs: 18000 }],
			['subscription.cadence_selected', 'interaction', { months: 1 }],
		],
	},
	'lapsed-subscriber-returning': {
		name: 'Lapsed subscriber returning',
		description: 'Known subscriber reopens a paused Auto-Refill order.',
		events: [
			['subscription.tenure', 'external', { months: 14 }],
			['subscription.pause', 'interaction', {}],
			['subscription.due_proximity', 'external', { days: 5 }],
			['commerce.autoship_mix', 'commerce', { mix: 1 }],
		],
	},
	'price-checking-reorder': {
		name: 'Price-checking reorder',
		description: 'Returning shopper compares a known reorder before the next shipment.',
		events: [
			['request.search_landing', 'request', { query: 'dog food discount deal' }],
			['subscription.tenure', 'external', { months: 8 }],
			['subscription.due_proximity', 'external', { days: 3 }],
			['subscription.swap', 'interaction', {}],
			['commerce.autoship_mix', 'commerce', { mix: 0.75 }],
		],
	},
} as const satisfies Record<string, { name: string; description: string; events: readonly (readonly [SignalEventType, SignalSource, Record<string, unknown>])[] }>;

export type KibbleScenarioId = keyof typeof KIBBLE_SCENARIOS;

export function replayKibbleScenario(id: KibbleScenarioId, sessionId = `synthetic:${id}`) {
	const scenario = KIBBLE_SCENARIOS[id];
	const store = new SignalStore(sessionId);
	store.setBrandId('kibble');
	store.setOrganizationId(getBrandById('kibble')!.organizationId);
	store.setScenarioId(id);
	store.setCrossSessionContext({ storedPersona: null, storedCategory: null, visitCount: 1, currentCategory: 'dog-food' });
	const baseTimestamp = 1_735_689_600_000;
	for (const [sequence, [type, source, data]] of scenario.events.entries()) {
		const event: SignalEvent = {
			id: `${id}:${sequence}`,
			sessionId,
			timestamp: baseTimestamp + sequence * 1000,
			sequence,
			type,
			source,
			data: { ...data },
			context: { page: '/synthetic-scenario', category: 'dog-food', viewport: 'desktop' },
		};
		store.restore(event);
	}
	return { scenario, store, inference: infer(store.toInferenceContext()) };
}

export function scenarioLabel(id: string | null | undefined): string | null {
	return id && id in KIBBLE_SCENARIOS ? KIBBLE_SCENARIOS[id as KibbleScenarioId].name : null;
}
