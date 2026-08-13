import type { SignalEventType } from '$lib/signals/types';

export interface KibbleSyntheticBehaviorEvent {
	type: SignalEventType;
	data: Record<string, unknown>;
}

export interface KibbleSyntheticBehavior {
	id: 'explore' | 'compare' | 'deal' | 'gift';
	label: string;
	description: string;
	signalSummary: string;
	delivery: 'deferred-batch' | 'immediate';
	events: readonly KibbleSyntheticBehaviorEvent[];
}

export const KIBBLE_SYNTHETIC_BEHAVIORS: readonly KibbleSyntheticBehavior[] = [
	{
		id: 'explore',
		label: 'Browse several departments',
		description: 'The shopper opens three categories and reaches the end of the assortment.',
		signalSummary: '3 category views + 90% scroll',
		delivery: 'deferred-batch',
		events: [
			{ type: 'nav.category_view', data: { category: 'dog-food' } },
			{ type: 'nav.category_view', data: { category: 'treats-chews' } },
			{ type: 'nav.category_view', data: { category: 'walk-gear' } },
			{ type: 'interact.scroll_depth', data: { depth: 90 } },
		],
	},
	{
		id: 'compare',
		label: 'Compare products carefully',
		description: 'The shopper opens four products, returns to the shelf twice, and reads for 18 seconds.',
		signalSummary: '4 product views + 2 returns + 18s dwell',
		delivery: 'deferred-batch',
		events: [
			...['beef-kibble', 'salmon-kibble', 'variety-pack', 'chicken-kibble'].map((productId) => ({
				type: 'nav.product_view' as const,
				data: { productId },
			})),
			{ type: 'nav.back', data: { fromProduct: 'salmon-kibble', toCategory: 'dog-food' } },
			{ type: 'nav.back', data: { fromProduct: 'variety-pack', toCategory: 'dog-food' } },
			{ type: 'interact.dwell_time', data: { dwellMs: 18_000 } },
		],
	},
	{
		id: 'deal',
		label: 'Search for a deal',
		description: 'The shopper searches for a discounted option instead of browsing.',
		signalSummary: '1 search: “budget sale discount”',
		delivery: 'immediate',
		events: [
			{ type: 'nav.search', data: { query: 'budget sale discount' } },
		],
	},
	{
		id: 'gift',
		label: 'Shop for a birthday gift',
		description: 'The shopper searches for a present instead of browsing the catalog.',
		signalSummary: '1 search: “birthday gift present”',
		delivery: 'immediate',
		events: [
			{ type: 'nav.search', data: { query: 'birthday gift present' } },
		],
	},
];

export function summarizeBehaviorSignalTypes(events: readonly KibbleSyntheticBehaviorEvent[]): string[] {
	const counts = new Map<SignalEventType, number>();
	for (const event of events) counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
	return [...counts].map(([type, count]) => `${type}${count > 1 ? ` ×${count}` : ''}`);
}
