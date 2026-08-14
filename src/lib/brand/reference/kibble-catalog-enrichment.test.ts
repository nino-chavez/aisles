import { describe, expect, it } from 'vitest';
import {
	KIBBLE_CATALOG_ENTITY_IDS,
	KIBBLE_ONE_TIME_ONLY_ENTITY_IDS,
	KIBBLE_SUBSCRIPTION_CAPABILITY_PRODUCT_IDS,
	KIBBLE_SUBSCRIPTION_CAPABILITY_SURFACES,
	getKibbleCatalogCapabilities,
	kibbleCatalogCapabilityCount,
	kibbleCatalogCoverage,
	materializeKibbleSubscriptionOffers,
} from './kibble-catalog-enrichment';

describe('Kibble catalog capability projection', () => {
	it('accounts for every pinned BigCommerce catalog row', () => {
		expect(KIBBLE_CATALOG_ENTITY_IDS).toHaveLength(49);
		expect(kibbleCatalogCoverage()).toEqual({
			totalProducts: 49,
			subscriptionEligibleProducts: 34,
			oneTimeOnlyProducts: 15,
			capabilities: 7,
		});
		expect(kibbleCatalogCapabilityCount()).toBe(34);
		expect(KIBBLE_ONE_TIME_ONLY_ENTITY_IDS).toEqual(Array.from({ length: 15 }, (_, index) => 3049 + index));
	});

	it('keeps the capability matrix explicit about storefront versus portal ownership', () => {
		expect(KIBBLE_SUBSCRIPTION_CAPABILITY_PRODUCT_IDS).toEqual({
		'subscribe-and-save': 3023,
		'free-trial': 3035,
		'intro-offer': 3023,
		annual: 3038,
		prepaid: 3066,
		gift: 3035,
		'build-a-box': null,
	});
		expect(KIBBLE_SUBSCRIPTION_CAPABILITY_SURFACES).toMatchObject({
		'subscribe-and-save': 'storefront',
		'free-trial': 'storefront',
		'intro-offer': 'storefront',
		annual: 'storefront',
		prepaid: 'portal',
		gift: 'portal',
		'build-a-box': 'portal',
	});
	});

	it('materializes visible offer and capability labels only for eligible products', () => {
		const offers = materializeKibbleSubscriptionOffers([
			{ id: 'goodgut', entityId: 3023 },
			{ id: 'calm-chews', entityId: 3035 },
			{ id: 'harness', entityId: 3049 },
		]);

		expect(offers.goodgut).toMatchObject({
			price: 29.74,
			savingsPercent: 15,
			label: 'Auto-Refill',
			capabilityLabels: ['Intro offer'],
		});
		expect(offers['calm-chews']).toMatchObject({
			capabilityLabels: ['Free trial', 'Gift a subscription'],
		});
		expect(offers.harness).toBeUndefined();
		expect(getKibbleCatalogCapabilities(3049)).toBeNull();
	});

	it('keeps source prices and savings within a display-safe range', () => {
		for (const entityId of KIBBLE_CATALOG_ENTITY_IDS) {
			const subscription = getKibbleCatalogCapabilities(entityId)?.subscription;
			if (!subscription) continue;
			expect(subscription.price).toBeGreaterThan(0);
			expect(subscription.savingsPercent).toBeGreaterThanOrEqual(0);
			expect(subscription.savingsPercent).toBeLessThanOrEqual(100);
			expect(subscription.cadenceMonths).toEqual([1, 2, 3]);
		}
	});
	});
