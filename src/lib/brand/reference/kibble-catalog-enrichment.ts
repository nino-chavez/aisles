import type { KibbleAutoRefillOffer } from '$lib/components/kibble/types';
import type { Product } from '$lib/types';

/**
 * Server-owned projection of the Kibble catalog's repeat-purchase capability.
 *
 * BigCommerce currently returns the 49 Kibble products with no custom fields.
 * The subscription service still has the authoritative plan records, so this
 * projection is deliberately limited to display-safe demo metadata. It is
 * not a cart-intent or plan-authority substitute. A transaction slice must
 * replace the prices below with a server-side plan lookup before purchase.
 *
 * Source snapshot:
 * - bc-subscriptions/apps/storefront-svelte/src/lib/subscriptions/eligible-products.json
 *   sha256 affd8b0092d249e328683af00207e510248033d1cd5593c8134b956499b5a6da
 * - bc-subscriptions/apps/storefront-svelte/src/lib/catalog.ts
 *   sha256 76f1ff49ac117fff785df80444883cb580d0f088e22c46767a86d69cc6a00997
 */
export const KIBBLE_CATALOG_ENRICHMENT_SOURCE = {
	service: 'bc-subscriptions',
	eligibleProductsSha256: 'affd8b0092d249e328683af00207e510248033d1cd5593c8134b956499b5a6da',
	capabilityRegistrySha256: '76f1ff49ac117fff785df80444883cb580d0f088e22c46767a86d69cc6a00997',
	mode: 'display-safe-demo-projection',
} as const;

export type KibbleSubscriptionCapability =
	| 'subscribe-and-save'
	| 'free-trial'
	| 'intro-offer'
	| 'annual'
	| 'prepaid'
	| 'gift'
	| 'build-a-box';

export const KIBBLE_CATALOG_ENTITY_IDS = Object.freeze(
	Array.from({ length: 49 }, (_, index) => 3023 + index),
);

export const KIBBLE_SUBSCRIPTION_CAPABILITY_LABELS = Object.freeze({
	'subscribe-and-save': 'Auto-Refill',
	'free-trial': 'Free trial',
	'intro-offer': 'Intro offer',
	annual: 'Annual billing',
	prepaid: 'Prepaid',
	gift: 'Gift a subscription',
	'build-a-box': 'Build-a-box',
} satisfies Record<KibbleSubscriptionCapability, string>);

/**
 * Capabilities with no product-page URL are still part of the source
 * contract. Their customer flow belongs to the subscription portal, so the
 * storefront must describe them as portal capabilities rather than inventing
 * a product action.
 */
export const KIBBLE_SUBSCRIPTION_CAPABILITY_SURFACES = Object.freeze({
	'subscribe-and-save': 'storefront',
	'free-trial': 'storefront',
	'intro-offer': 'storefront',
	annual: 'storefront',
	prepaid: 'portal',
	gift: 'portal',
	'build-a-box': 'portal',
} satisfies Record<KibbleSubscriptionCapability, 'storefront' | 'portal'>);

type KibbleCatalogCapability = {
	readonly subscription: {
		readonly price: number;
		readonly savingsPercent: number;
		readonly cadenceMonths: readonly [1, 2, 3];
		readonly capabilities: readonly KibbleSubscriptionCapability[];
	} | null;
};

const KIBBLE_CATALOG_CAPABILITIES: Readonly<Record<number, KibbleCatalogCapability>> = {
	3023: { subscription: { price: 29.74, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save', 'intro-offer'] } },
	3024: { subscription: { price: 28.89, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3025: { subscription: { price: 29.74, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3026: { subscription: { price: 31.44, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3027: { subscription: { price: 29.74, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3028: { subscription: { price: 24.64, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3029: { subscription: { price: 45.80, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3030: { subscription: { price: 47.50, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3031: { subscription: { price: 41.04, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3032: { subscription: { price: 25.40, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3033: { subscription: { price: 46.74, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3034: { subscription: { price: 21.24, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3035: { subscription: { price: 21.24, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save', 'free-trial', 'gift'] } },
	3036: { subscription: { price: 21.24, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3037: { subscription: { price: 8.50, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3038: { subscription: { price: 28.90, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save', 'annual'] } },
	3039: { subscription: { price: 28.90, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3040: { subscription: { price: 28.90, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3041: { subscription: { price: 28.90, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3042: { subscription: { price: 27.20, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3043: { subscription: { price: 27.20, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3044: { subscription: { price: 7.65, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3045: { subscription: { price: 16.99, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3046: { subscription: { price: 24.65, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3047: { subscription: { price: 13.60, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3048: { subscription: { price: 17.00, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3064: { subscription: { price: 47.00, savingsPercent: 22, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3065: { subscription: { price: 97.00, savingsPercent: 11, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3066: { subscription: { price: 115.00, savingsPercent: 11, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save', 'prepaid'] } },
	3067: { subscription: { price: 52.00, savingsPercent: 12, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3068: { subscription: { price: 99.00, savingsPercent: 12, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3069: { subscription: { price: 64.00, savingsPercent: 11, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3070: { subscription: { price: 85.00, savingsPercent: 11, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
	3071: { subscription: { price: 79.00, savingsPercent: 11, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
};

export const KIBBLE_SUBSCRIPTION_CAPABILITY_PRODUCT_IDS = Object.freeze({
	'subscribe-and-save': 3023,
	'free-trial': 3035,
	'intro-offer': 3023,
	'annual': 3038,
	'prepaid': 3066,
	'gift': 3035,
	'build-a-box': null,
} satisfies Record<KibbleSubscriptionCapability, number | null>);

export const KIBBLE_ONE_TIME_ONLY_ENTITY_IDS = Object.freeze(
	KIBBLE_CATALOG_ENTITY_IDS.filter((entityId) => !KIBBLE_CATALOG_CAPABILITIES[entityId]),
);

export function getKibbleCatalogCapabilities(entityId: number): KibbleCatalogCapability | null {
	return KIBBLE_CATALOG_CAPABILITIES[entityId] ?? null;
}

/**
 * Materialize only the display-safe card contract. Product ids remain the
 * server-reloaded catalog ids; no browser value becomes a plan or cart input.
 */
export function materializeKibbleSubscriptionOffers(
	products: readonly Pick<Product, 'id' | 'entityId'>[],
): Record<string, KibbleAutoRefillOffer> {
	return Object.fromEntries(products.flatMap((product) => {
		const subscription = getKibbleCatalogCapabilities(product.entityId)?.subscription;
		if (!subscription) return [];
		return [[product.id, {
			price: subscription.price,
			savingsPercent: subscription.savingsPercent,
			label: 'Auto-Refill',
			savingsLabel: 'Save',
			cadenceLabel: 'every 1, 2, or 3 months',
			capabilityLabels: subscription.capabilities
				.filter((capability) => capability !== 'subscribe-and-save')
				.map((capability) => KIBBLE_SUBSCRIPTION_CAPABILITY_LABELS[capability]),
		} satisfies KibbleAutoRefillOffer]];
	}));
}

export function kibbleCatalogCapabilityCount(): number {
	return Object.keys(KIBBLE_CATALOG_CAPABILITIES).length;
}

export function kibbleCatalogCoverage(): {
	totalProducts: number;
	subscriptionEligibleProducts: number;
	oneTimeOnlyProducts: number;
	capabilities: number;
} {
	return {
		totalProducts: KIBBLE_CATALOG_ENTITY_IDS.length,
		subscriptionEligibleProducts: kibbleCatalogCapabilityCount(),
		oneTimeOnlyProducts: KIBBLE_ONE_TIME_ONLY_ENTITY_IDS.length,
		capabilities: Object.keys(KIBBLE_SUBSCRIPTION_CAPABILITY_PRODUCT_IDS).length,
	};
}
