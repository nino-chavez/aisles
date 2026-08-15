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
 * - bc-subscriptions/apps/marketing/src/data/capabilities.json
 *   sha256 407efaf0e9c33b948bde28c162f18d4fe3630ba7be9a3c7870045d48326b4a13
 * - bc-subscriptions/apps/marketing/src/data/demo-state.json
 *   sha256 a3554da7d7509c9b9fbdef6cd9a24102d05ca34f7da593e8abfc804bf942161f
 * - bc-subscriptions/scripts/kibble-demo/data/channel1-seed-output.json
 *   sha256 97ddb5f9df38ab0f7372d16b93fd466c5888a0e7f61d72dcf7fec1ded6a0943c
 */
export const KIBBLE_CATALOG_ENRICHMENT_SOURCE = {
	service: 'bc-subscriptions',
	demoStateGeneratedAt: '2026-06-29T17:57:15.349Z',
	demoStateCommit: '0d8f0e0d',
	canonicalRegistryVerifiedAt: '2026-06-28',
	eligibleProductsSha256: 'affd8b0092d249e328683af00207e510248033d1cd5593c8134b956499b5a6da',
	capabilityRegistrySha256: '76f1ff49ac117fff785df80444883cb580d0f088e22c46767a86d69cc6a00997',
	marketingCapabilitiesSha256: '407efaf0e9c33b948bde28c162f18d4fe3630ba7be9a3c7870045d48326b4a13',
	demoStateSha256: 'a3554da7d7509c9b9fbdef6cd9a24102d05ca34f7da593e8abfc804bf942161f',
	seedOutputSha256: '97ddb5f9df38ab0f7372d16b93fd466c5888a0e7f61d72dcf7fec1ded6a0943c',
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

export type KibbleSourceCapabilityOutsideKibble =
	| 'bundle'
	| 'membership'
	| 'usage-based'
	| 'curation'
	| 'allotment'
	| 'multi-actor'
	| 'calendar-anchored';

export type KibbleCatalogCategorySlug =
	| 'dog-food'
	| 'supplements'
	| 'treats'
	| 'grooming'
	| 'toys'
	| 'walk-gear'
	| 'beds-apparel'
	| 'bundles';

export type KibbleProductRole = 'consumable' | 'durable' | 'bundle' | 'unclassified';
export type KibbleOfferProjection = 'pinned-auto-refill' | 'suppressed-price-drift' | 'none' | 'unclassified';
export type KibbleCanonicalRegistryStatus = 'listed' | 'not-listed' | 'unclassified';
export type KibbleCategorySource = 'pinned-seed' | 'live-catalog-match' | 'live-catalog-override' | 'unclassified';

export type KibbleCategoryJobProfile = {
	readonly slug: KibbleCatalogCategorySlug;
	readonly sourceCategoryId: number;
	readonly sourceCategoryName: string;
	readonly shopperJob: string;
	readonly decisionDimensions: readonly string[];
	readonly defaultProductRole: Exclude<KibbleProductRole, 'unclassified'>;
	readonly repeatPurchaseFit: 'routine' | 'situational' | 'durable';
};

export type KibbleCatalogSignals = {
	readonly productRole: KibbleProductRole;
	readonly offerProjection: KibbleOfferProjection;
	readonly canonicalRegistryStatus: KibbleCanonicalRegistryStatus;
	readonly categorySlug: KibbleCatalogCategorySlug | null;
	readonly categorySource: KibbleCategorySource;
	readonly categoryJob: string | null;
	readonly decisionDimensions: readonly string[];
	readonly subscriptionCapabilities: readonly KibbleSubscriptionCapability[];
	readonly subscriptionSavingsPercent: number | null;
	readonly subscriptionCadenceMonths: readonly [1, 2, 3] | null;
};

export type KibbleSubscriptionCapabilityDemo = {
	readonly id: KibbleSubscriptionCapability;
	readonly label: string;
	readonly shopperOutcome: string;
	readonly sourceSurface: 'storefront' | 'portal';
	readonly sourceStatus: 'live-in-pinned-snapshot';
	readonly owner: 'subscription-service';
	readonly aislesMode: 'catalog-offer-projection' | 'fixed-service-preview';
	readonly demoHref: string;
	readonly demoLabel: string;
	readonly reviewSource: 'capability-map' | 'live-catalog-pdp';
	readonly productEntityId: number | null;
	readonly canonicalRegistryDisposition: 'listed' | 'not-listed' | 'roadmap' | 'absent' | 'portal-only';
	readonly canonicalRegistryEvidence: string;
};

export type KibbleExcludedSourceCapability = {
	readonly id: KibbleSourceCapabilityOutsideKibble;
	readonly label: string;
	readonly sourceTier: 'configurable';
	readonly demoStateStatus: 'absent' | 'not-listed';
	readonly disposition: 'not-claimed-for-kibble';
	readonly reason: string;
};

export type KibbleAislesCapabilityId =
	| 'rank_products'
	| 'select_products'
	| 'select_copy_variant'
	| 'select_component_variant'
	| 'toggle_zone'
	| 'reorder_zones';

export type KibbleFixedCommerceFact =
	| 'product-facts'
	| 'price'
	| 'eligibility'
	| 'cadence'
	| 'inventory'
	| 'links'
	| 'cart'
	| 'checkout'
	| 'account'
	| 'payment'
	| 'order'
	| 'subscription';

export type KibbleObserveCountExpectation =
	| { readonly kind: 'exact'; readonly value: number; readonly note: string }
	| { readonly kind: 'range'; readonly min: number; readonly max: number; readonly note: string };

export type KibbleAislesCapabilitySurface = 'home' | 'plp' | 'pdp' | 'search' | 'cart' | 'checkout';

export type KibbleAislesCapabilityProof = {
	readonly route: {
		readonly surface: KibbleAislesCapabilitySurface;
		readonly href: string;
		readonly stableProof: string;
	};
	readonly trigger: {
		readonly label: string;
		readonly execution: 'explicit-rules' | 'explicit-observe-model';
		readonly requiresUserAction: boolean;
	};
	readonly namedZoneInstances: readonly string[];
	readonly candidatePrerequisites: readonly string[];
	readonly before: {
		readonly presentation: string;
		readonly observe: {
			readonly aiZones: KibbleObserveCountExpectation;
			readonly aiCalls: KibbleObserveCountExpectation;
		};
	};
	readonly result: {
		readonly changed: string;
		readonly kept: string;
		readonly observe: {
			readonly aiZones: KibbleObserveCountExpectation;
			readonly aiCalls: KibbleObserveCountExpectation;
		};
	};
	readonly failClosedReason: string;
};

export type KibbleAislesCapabilityDemo = {
	/** An action type is a decision vocabulary entry, not a rendered zone identity. */
	readonly id: KibbleAislesCapabilityId;
	readonly label: string;
	readonly authority: readonly ('rules' | 'model')[];
	readonly surfaces: readonly KibbleAislesCapabilitySurface[];
	/** Compact-list link only; proofs is the complete action-by-surface matrix. */
	readonly demoHref: string;
	readonly boundary: string;
	readonly fixedFacts: readonly KibbleFixedCommerceFact[];
	readonly proofs: readonly KibbleAislesCapabilityProof[];
};

export type KibbleMerchantCapabilityCoverage = {
	readonly version: 'kibble-merchant-capability-manifest-v1';
	readonly source: typeof KIBBLE_CATALOG_ENRICHMENT_SOURCE;
	readonly catalog: ReturnType<typeof kibbleCatalogCoverage>;
	readonly categoryProfiles: readonly KibbleCategoryJobProfile[];
	readonly subscriptionCapabilities: readonly KibbleSubscriptionCapabilityDemo[];
	readonly sourceCapabilitiesOutsideKibble: readonly KibbleExcludedSourceCapability[];
	readonly aislesCapabilities: readonly KibbleAislesCapabilityDemo[];
	readonly sourceRegistryNote: string;
	readonly commerceBoundary: string;
	readonly outcomeProof: 'not-measured';
};

export const KIBBLE_CATALOG_ENTITY_IDS = Object.freeze(
	Array.from({ length: 49 }, (_, index) => 3023 + index),
);

export const KIBBLE_CATEGORY_JOB_PROFILES = Object.freeze({
	'dog-food': {
		slug: 'dog-food',
		sourceCategoryId: 325,
		sourceCategoryName: 'Dog Food',
		shopperJob: 'Choose an everyday nutrition routine that fits the dog and household.',
		decisionDimensions: ['protein', 'life stage', 'food format', 'diet needs', 'replenishment'],
		defaultProductRole: 'consumable',
		repeatPurchaseFit: 'routine',
	},
	supplements: {
		slug: 'supplements',
		sourceCategoryId: 326,
		sourceCategoryName: 'Supplements & Wellness',
		shopperJob: 'Support a specific wellness need with a routine the shopper can maintain.',
		decisionDimensions: ['wellness need', 'format', 'daily routine', 'trial', 'replenishment'],
		defaultProductRole: 'consumable',
		repeatPurchaseFit: 'routine',
	},
	treats: {
		slug: 'treats',
		sourceCategoryId: 327,
		sourceCategoryName: 'Treats & Chews',
		shopperJob: 'Choose a reward, chew, or topper for a specific use and frequency.',
		decisionDimensions: ['purpose', 'texture', 'durability', 'ingredients', 'replenishment'],
		defaultProductRole: 'consumable',
		repeatPurchaseFit: 'routine',
	},
	grooming: {
		slug: 'grooming',
		sourceCategoryId: 328,
		sourceCategoryName: 'Grooming & Care',
		shopperJob: 'Build a care routine around the pet\'s coat, paws, and daily needs.',
		decisionDimensions: ['care need', 'application', 'routine frequency', 'coat or paw fit'],
		defaultProductRole: 'consumable',
		repeatPurchaseFit: 'situational',
	},
	toys: {
		slug: 'toys',
		sourceCategoryId: 329,
		sourceCategoryName: 'Toys',
		shopperJob: 'Match enrichment and play style without treating a durable item like a refill.',
		decisionDimensions: ['play style', 'dog size', 'durability', 'supervision'],
		defaultProductRole: 'durable',
		repeatPurchaseFit: 'durable',
	},
	'walk-gear': {
		slug: 'walk-gear',
		sourceCategoryId: 330,
		sourceCategoryName: 'Walk & Gear',
		shopperJob: 'Fit the dog and the household\'s movement, travel, and handling routine.',
		decisionDimensions: ['size', 'fit', 'use context', 'material', 'portability'],
		defaultProductRole: 'durable',
		repeatPurchaseFit: 'durable',
	},
	'beds-apparel': {
		slug: 'beds-apparel',
		sourceCategoryId: 331,
		sourceCategoryName: 'Beds & Apparel',
		shopperJob: 'Choose a durable rest or apparel product for size, season, and care needs.',
		decisionDimensions: ['size', 'use context', 'material', 'washability', 'season'],
		defaultProductRole: 'durable',
		repeatPurchaseFit: 'durable',
	},
	bundles: {
		slug: 'bundles',
		sourceCategoryId: 332,
		sourceCategoryName: 'Bundles',
		shopperJob: 'Choose a curated routine for a life stage, need state, or gift occasion.',
		decisionDimensions: ['life stage', 'routine goal', 'included products', 'subscription mode', 'giftability'],
		defaultProductRole: 'bundle',
		repeatPurchaseFit: 'routine',
	},
} satisfies Record<KibbleCatalogCategorySlug, KibbleCategoryJobProfile>);

/** Exact bc_product_id -> bc_category_id pairs from the hash-pinned seed output. */
export const KIBBLE_CATALOG_SOURCE_CATEGORY_IDS: Readonly<Record<number, number>> = Object.freeze({
	3023: 325, 3024: 325, 3025: 325, 3026: 325, 3027: 325, 3028: 325, 3029: 325, 3030: 325, 3031: 325, 3032: 325,
	3033: 326, 3034: 326, 3035: 326, 3036: 326, 3037: 326, 3038: 326, 3039: 326, 3040: 326, 3041: 326,
	3042: 327, 3043: 327, 3044: 327, 3045: 327,
	3046: 328, 3047: 328, 3048: 328,
	3049: 329, 3050: 329, 3051: 329, 3052: 329,
	3053: 330, 3054: 330, 3055: 330, 3056: 330, 3057: 330, 3058: 330,
	3059: 331, 3060: 331, 3061: 331, 3062: 331, 3063: 331,
	3065: 332, 3066: 332, 3064: 332, 3067: 332, 3068: 332, 3069: 332, 3070: 332, 3071: 332,
});

export const KIBBLE_SUBSCRIPTION_CAPABILITY_LABELS = Object.freeze({
	'subscribe-and-save': 'Auto-Refill',
	'free-trial': 'Free trial',
	'intro-offer': 'Intro offer',
	annual: 'Annual billing',
	prepaid: 'Prepaid',
	gift: 'Gift a subscription',
	'build-a-box': 'Build-a-box',
} satisfies Record<KibbleSubscriptionCapability, string>);

const KIBBLE_SUBSCRIPTION_CAPABILITY_EVIDENCE = Object.freeze({
	'subscribe-and-save': 'The pinned offer row includes a recurring price and monthly cadence options.',
	'free-trial': 'The canonical storefront registry records a 14-day trial for this product.',
	'intro-offer': 'The pinned demo-state reports a first-cycle offer. Its live discount and term still require a provider lookup.',
	annual: 'The pinned demo-state reports one yearly plan. Its live term and price still require a provider lookup.',
	prepaid: 'The pinned demo-state reports a portal-owned prepaid flow. This product evidence does not create a prepaid checkout.',
	gift: 'The pinned demo-state reports a portal-owned gift flow. This product evidence does not create a gift subscription.',
	'build-a-box': 'The pinned demo-state reports a portal customization flow with no storefront product URL.',
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

/** Product rows in catalog.ts, the source storefront's canonical PDP registry. */
export const KIBBLE_CANONICAL_STOREFRONT_REGISTRY_ENTITY_IDS = Object.freeze([
	3023, 3024, 3025, 3026, 3027, 3028, 3029, 3035, 3038, 3039,
]);

/**
 * Models in capabilities.json that are configurable but are not part of the
 * seven-capability Kibble demonstration. Keeping them explicit prevents a
 * "complete" demo claim from silently erasing source scope.
 */
export const KIBBLE_SOURCE_CAPABILITIES_OUTSIDE_KIBBLE = Object.freeze([
	{ id: 'bundle', label: 'Bundle plans', sourceTier: 'configurable', demoStateStatus: 'absent', disposition: 'not-claimed-for-kibble', reason: 'The pinned demo-state reports no live bundle-plan scenario.' },
	{ id: 'membership', label: 'Membership / access', sourceTier: 'configurable', demoStateStatus: 'absent', disposition: 'not-claimed-for-kibble', reason: 'The Kibble catalog contains physical retail products, not an access entitlement scenario.' },
	{ id: 'usage-based', label: 'Usage-based / metered', sourceTier: 'configurable', demoStateStatus: 'absent', disposition: 'not-claimed-for-kibble', reason: 'No Kibble product or provider flow reports metered usage.' },
	{ id: 'curation', label: 'Curation / surprise-me', sourceTier: 'configurable', demoStateStatus: 'absent', disposition: 'not-claimed-for-kibble', reason: 'No live-in-snapshot curation plan or renewal-selection flow is present.' },
	{ id: 'allotment', label: 'Allotment / wallet', sourceTier: 'configurable', demoStateStatus: 'absent', disposition: 'not-claimed-for-kibble', reason: 'No recurring quota or wallet exists in the pinned Kibble evidence.' },
	{ id: 'multi-actor', label: 'Multi-actor', sourceTier: 'configurable', demoStateStatus: 'absent', disposition: 'not-claimed-for-kibble', reason: 'Gift evidence does not prove a general owner, payer, and beneficiary role model.' },
	{ id: 'calendar-anchored', label: 'Calendar-anchored billing', sourceTier: 'configurable', demoStateStatus: 'not-listed', disposition: 'not-claimed-for-kibble', reason: 'The marketing registry lists this model, but the pinned demo-state does not include it.' },
] as const satisfies readonly KibbleExcludedSourceCapability[]);

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
	3035: { subscription: { price: 21.24, savingsPercent: 15, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save', 'free-trial'] } },
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
	3066: { subscription: { price: 115.00, savingsPercent: 11, cadenceMonths: [1, 2, 3], capabilities: ['subscribe-and-save'] } },
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

export const KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS = Object.freeze([
	{
		id: 'subscribe-and-save', label: 'Subscribe & save', sourceSurface: 'storefront', sourceStatus: 'live-in-pinned-snapshot', owner: 'subscription-service',
		shopperOutcome: 'Choose a recurring cadence and receive the merchant-configured subscription price.',
		aislesMode: 'catalog-offer-projection', demoHref: '/subscriptions#kibble-capability-subscribe-and-save', demoLabel: 'Review Auto-Refill evidence', reviewSource: 'capability-map', productEntityId: 3023,
		canonicalRegistryDisposition: 'listed', canonicalRegistryEvidence: 'The 2026-06-28 canonical registry lists subscribe-and-save as a PDP demo capability.',
	},
	{
		id: 'free-trial', label: 'Free trial', sourceSurface: 'storefront', sourceStatus: 'live-in-pinned-snapshot', owner: 'subscription-service',
		shopperOutcome: 'See a plan with a trial period before the first charge.',
		aislesMode: 'catalog-offer-projection', demoHref: '/subscriptions#kibble-capability-free-trial', demoLabel: 'Review trial evidence', reviewSource: 'capability-map', productEntityId: 3035,
		canonicalRegistryDisposition: 'listed', canonicalRegistryEvidence: 'The 2026-06-28 canonical registry lists free-trial as a PDP demo capability.',
	},
	{
		id: 'intro-offer', label: 'Intro offer', sourceSurface: 'storefront', sourceStatus: 'live-in-pinned-snapshot', owner: 'subscription-service',
		shopperOutcome: 'See a first-cycle offer that does not rewrite later recurring prices.',
		aislesMode: 'catalog-offer-projection', demoHref: '/subscriptions#kibble-capability-intro-offer', demoLabel: 'Review intro-offer evidence', reviewSource: 'capability-map', productEntityId: 3023,
		canonicalRegistryDisposition: 'listed', canonicalRegistryEvidence: 'The 2026-06-28 canonical registry lists intro-offer as a PDP demo capability.',
	},
	{
		id: 'annual', label: 'Annual billing', sourceSurface: 'storefront', sourceStatus: 'live-in-pinned-snapshot', owner: 'subscription-service',
		shopperOutcome: 'See a yearly plan alongside the product\'s recurring purchase context.',
		aislesMode: 'catalog-offer-projection', demoHref: '/subscriptions#kibble-capability-annual', demoLabel: 'Review annual evidence', reviewSource: 'capability-map', productEntityId: 3038,
		canonicalRegistryDisposition: 'not-listed', canonicalRegistryEvidence: 'Annual is live in the 2026-06-29 demo-state but is not a named capability in the 2026-06-28 canonical PDP registry.',
	},
	{
		id: 'prepaid', label: 'Prepaid', sourceSurface: 'portal', sourceStatus: 'live-in-pinned-snapshot', owner: 'subscription-service',
		shopperOutcome: 'Pay for several cycles up front while each delivery remains provider-managed.',
		aislesMode: 'fixed-service-preview', demoHref: '/checkout/prepaid', demoLabel: 'Open prepaid checkout boundary', reviewSource: 'capability-map', productEntityId: 3066,
		canonicalRegistryDisposition: 'roadmap', canonicalRegistryEvidence: 'The 2026-06-28 canonical registry calls prepaid roadmap; the 2026-06-29 demo-state reports one live portal scenario.',
	},
	{
		id: 'gift', label: 'Gift a subscription', sourceSurface: 'portal', sourceStatus: 'live-in-pinned-snapshot', owner: 'subscription-service',
		shopperOutcome: 'Separate the payer from the recipient and let the recipient manage the subscription.',
		aislesMode: 'fixed-service-preview', demoHref: '/checkout/gift', demoLabel: 'Open gift checkout boundary', reviewSource: 'capability-map', productEntityId: 3035,
		canonicalRegistryDisposition: 'absent', canonicalRegistryEvidence: 'The 2026-06-28 canonical registry says gift is absent because no gift_tokens table exists; the 2026-06-29 demo-state reports one live portal scenario.',
	},
	{
		id: 'build-a-box', label: 'Build-a-box', sourceSurface: 'portal', sourceStatus: 'live-in-pinned-snapshot', owner: 'subscription-service',
		shopperOutcome: 'Choose from a merchant-approved product set during the subscription customization window.',
		aislesMode: 'fixed-service-preview', demoHref: '/subscriptions#kibble-capability-build-a-box', demoLabel: 'Open portal capability boundary', reviewSource: 'capability-map', productEntityId: null,
		canonicalRegistryDisposition: 'portal-only', canonicalRegistryEvidence: 'The 2026-06-28 canonical registry describes build-a-box as portal-only with no PDP URL.',
	},
] as const satisfies readonly KibbleSubscriptionCapabilityDemo[]);

export const KIBBLE_FIXED_COMMERCE_FACTS = Object.freeze([
	'product-facts', 'price', 'eligibility', 'cadence', 'inventory', 'links',
	'cart', 'checkout', 'account', 'payment', 'order', 'subscription',
] as const satisfies readonly KibbleFixedCommerceFact[]);

export const KIBBLE_AISLES_PDP_PROOF = Object.freeze({
	href: '/product/puppy-starter-kit?observe=true',
	slug: 'puppy-starter-kit',
	productEntityId: 3064,
	fixtureSha256: '833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49',
	candidateCount: 4,
	candidateSource: 'category_sibling',
	relationKind: null,
} as const);

const beforeObserve = Object.freeze({
	aiZones: { kind: 'exact', value: 0, note: 'Eligibility is readiness, not rendered model output.' },
	aiCalls: { kind: 'exact', value: 0, note: 'No provider is called before the explicit model control.' },
} as const);

const providerCalls = Object.freeze({
	kind: 'range', min: 1, max: 2,
	note: 'Counts actual primary and optional fallback provider attempts.',
} as const satisfies KibbleObserveCountExpectation);

/**
 * Typed public proof matrix. The outer row is one decision action; every
 * inner proof is one surface on which that action is currently enabled.
 * Several action proofs can share one explicit provider run. That does not
 * turn an action type into another AI zone or provider call.
 */
export const KIBBLE_AISLES_CAPABILITY_DEMOS = Object.freeze([
	{
		id: 'select_products', label: 'Select approved products', authority: ['rules'], surfaces: ['home'],
		demoHref: '/?observe=true#kibble-signal-lab', boundary: 'Selects only from the merchant candidate set; catalog membership stays fixed.',
		fixedFacts: KIBBLE_FIXED_COMMERCE_FACTS,
		proofs: [{
			route: { surface: 'home', href: '/?observe=true#kibble-signal-lab', stableProof: 'The Home signal lab re-runs the deterministic rules decision against the server-loaded shelf.' },
			trigger: { label: 'Apply a synthetic shopper scenario', execution: 'explicit-rules', requiresUserAction: true },
			namedZoneInstances: ['home.featured-row.1', 'home.featured-row.2', 'home.featured-row.3'],
			candidatePrerequisites: ['At least three current, server-loaded catalog products.', 'Every selected product must already belong to the merchant candidate set.'],
			before: { presentation: 'The server-rendered merchant shelf order.', observe: beforeObserve },
			result: {
				changed: 'Rules may choose a different approved subset for the inferred shopper.',
				kept: 'The same approved subset remains when it already satisfies the rules.',
				observe: { aiZones: { kind: 'exact', value: 0, note: 'Rules-owned output is never counted as an AI zone.' }, aiCalls: { kind: 'exact', value: 0, note: 'Rules execute without a provider.' } },
			},
			failClosedReason: 'Too few or invalid server candidates retain the merchant shelf; no provider path exists for this trigger.',
		}],
	},
	{
		id: 'rank_products', label: 'Rank approved products', authority: ['rules', 'model'], surfaces: ['home', 'plp', 'pdp'],
		demoHref: KIBBLE_AISLES_PDP_PROOF.href, boundary: 'Changes order only; product facts, price, links, and actions stay fixed.',
		fixedFacts: KIBBLE_FIXED_COMMERCE_FACTS,
		proofs: [
			{
				route: { surface: 'home', href: '/?observe=true', stableProof: 'Home binds one current one-to-eight-product shelf to home.featured-row.1 and publishes only an exact permutation.' },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['home.featured-row.1'],
				candidatePrerequisites: ['One to eight unique current, server-loaded shelf products.', 'The returned order must be an exact permutation of those IDs.'],
				before: { presentation: 'The approved Home shelf order.', observe: beforeObserve },
				result: {
					changed: 'The same Home product IDs appear in a model-selected order.', kept: 'The original order remains as a valid model-selected result.',
					observe: { aiZones: { kind: 'exact', value: 3, note: 'The shared Home run renders three validated named-zone selections.' }, aiCalls: providerCalls },
				},
				failClosedReason: 'An invalid candidate set, permutation, route, or sibling zone result keeps the approved Home presentation and renders zero AI zones.',
			},
			{
				route: { surface: 'plp', href: '/category/dog-food?sort=FEATURED&observe=true', stableProof: 'The local showcase pins the Dog Food category; only the first three to eight unique server-loaded products are rankable.' },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['plp.product-ranking'],
				candidatePrerequisites: ['FEATURED sort with no cursor.', 'Three to eight unique current prefix products; any tail stays in merchant order.'],
				before: { presentation: 'Merchant PLP prefix order followed by its unchanged tail.', observe: beforeObserve },
				result: {
					changed: 'The same rankable prefix IDs appear in a model-selected order.', kept: 'The prefix and unchanged tail remain when the model agrees.',
					observe: { aiZones: { kind: 'range', min: 2, max: 3, note: 'Header and ranking render; optional PLP marketing counts only when visible.' }, aiCalls: providerCalls },
				},
				failClosedReason: 'A cursor, non-FEATURED sort, invalid prefix, adjacent artifact, or failed gate keeps the merchant PLP and renders zero AI zones.',
			},
			{
				route: { surface: 'pdp', href: KIBBLE_AISLES_PDP_PROOF.href, stableProof: `The local showcase preflights ${KIBBLE_AISLES_PDP_PROOF.candidateCount} unique ${KIBBLE_AISLES_PDP_PROOF.candidateSource} candidates from fixture ${KIBBLE_AISLES_PDP_PROOF.fixtureSha256}; a drifting live catalog still fails closed.` },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['pdp.related'],
				candidatePrerequisites: ['Exactly three or four unique current products.', 'Native related products are preferred; category siblings are labeled category_sibling with no merchant-related claim.'],
				before: { presentation: 'Merchant order and merchant-authored related heading.', observe: beforeObserve },
				result: {
					changed: 'The same PDP candidate IDs appear in a model-selected order.', kept: 'The original order remains as a valid model-selected result.',
					observe: { aiZones: { kind: 'range', min: 1, max: 2, note: 'The related rail counts; optional PDP marketing counts only when visible.' }, aiCalls: providerCalls },
				},
				failClosedReason: 'Fewer than three candidates, an unapproved route, invalid output, or a failed gate keeps the approved PDP rail and renders zero AI zones.',
			},
		],
	},
	{
		id: 'select_copy_variant', label: 'Select approved copy', authority: ['model'], surfaces: ['home', 'plp', 'pdp', 'search', 'cart', 'checkout'],
		demoHref: '/search?q=zzzz-kibble-no-match&observe=true', boundary: 'Selects a merchant-authored variant ID; the model does not write storefront claims.',
		fixedFacts: KIBBLE_FIXED_COMMERCE_FACTS,
		proofs: [
			{
				route: { surface: 'home', href: '/?observe=true', stableProof: 'Home binds copy IDs separately to hero, featured shelf, and catalog module instances.' },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['home.hero', 'home.featured-row.1', 'home.editorial-strip'],
				candidatePrerequisites: ['One to eight unique current shelf products.', 'Every copy ID must belong to the exact named Home zone.'],
				before: { presentation: 'Three merchant baseline Home copy variants.', observe: beforeObserve },
				result: { changed: 'One or more merchant-authored Home variants render.', kept: 'Any baseline variant remains valid when selected.', observe: { aiZones: { kind: 'exact', value: 3, note: 'All three validated Home selections render and count.' }, aiCalls: providerCalls } },
				failClosedReason: 'A missing, crossed, or unapproved Home copy ID keeps the complete merchant presentation and renders zero AI zones.',
			},
			{
				route: { surface: 'plp', href: '/category/dog-food?sort=FEATURED&observe=true', stableProof: 'The pinned Dog Food PLP binds separate header and optional-marketing copy catalogs.' },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['plp.editorial-header', 'plp.marketing-block'],
				candidatePrerequisites: ['An eligible pinned PLP ranking prefix.', 'Header and marketing IDs must validate in their own named catalogs.'],
				before: { presentation: 'Merchant PLP header copy and no optional marketing block.', observe: beforeObserve },
				result: { changed: 'Approved PLP header or visible marketing copy changes.', kept: 'Baseline header and a hidden marketing result remain valid.', observe: { aiZones: { kind: 'range', min: 2, max: 3, note: 'Header and ranking count; marketing counts only when visible.' }, aiCalls: providerCalls } },
				failClosedReason: 'Any crossed or unapproved PLP copy ID keeps the complete merchant PLP and renders zero AI zones.',
			},
			{
				route: { surface: 'pdp', href: KIBBLE_AISLES_PDP_PROOF.href, stableProof: 'The pinned proof PDP binds related-heading and optional-marketing variants to two exact instances.' },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['pdp.related', 'pdp.below-description'],
				candidatePrerequisites: ['Exactly three or four current PDP candidates.', 'Related and marketing IDs must validate in their own named catalogs.'],
				before: { presentation: 'Merchant related heading and no optional marketing block.', observe: beforeObserve },
				result: { changed: 'Approved related or visible marketing copy changes.', kept: 'Baseline related copy and a hidden marketing result remain valid.', observe: { aiZones: { kind: 'range', min: 1, max: 2, note: 'Related counts; marketing counts only when visible.' }, aiCalls: providerCalls } },
				failClosedReason: 'Any crossed or unapproved PDP copy ID keeps the complete merchant PDP and renders zero AI zones.',
			},
			{
				route: { surface: 'search', href: '/search?q=zzzz-kibble-no-match&observe=true', stableProof: 'A server-confirmed zero-result search exposes one copy-only recovery zone.' },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['search.empty-state'],
				candidatePrerequisites: ['The server must confirm the query has zero catalog results.', 'The returned ID must match one merchant-authored search variant.'],
				before: { presentation: 'Merchant baseline search-recovery copy.', observe: beforeObserve },
				result: { changed: 'A different merchant-authored recovery variant renders.', kept: 'The baseline variant remains a valid model-selected result.', observe: { aiZones: { kind: 'exact', value: 1, note: 'Only the rendered search recovery zone counts.' }, aiCalls: providerCalls } },
				failClosedReason: 'Any search result, unapproved copy ID, disabled gate, or provider failure keeps the baseline and renders zero AI zones.',
			},
			{
				route: { surface: 'cart', href: '/cart?observe=true', stableProof: 'The disconnected Kibble cart route is a stable empty shell with one copy-only recovery instance.' },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['cart.empty-state'],
				candidatePrerequisites: ['The server-owned cart shell must remain empty and disconnected.', 'The returned ID must match one merchant-authored cart variant.'],
				before: { presentation: 'Merchant baseline empty-cart copy.', observe: beforeObserve },
				result: { changed: 'A different merchant-authored empty-cart variant renders.', kept: 'The baseline variant remains valid.', observe: { aiZones: { kind: 'exact', value: 1, note: 'Only the rendered cart empty-state zone counts.' }, aiCalls: providerCalls } },
				failClosedReason: 'Any unapproved ID, non-empty state, disabled gate, or provider failure keeps the disconnected empty-cart shell and renders zero AI zones.',
			},
			{
				route: { surface: 'checkout', href: '/checkout/gift?observe=true', stableProof: 'The gift route is a stable unavailable shell with one reassurance-only presentation instance.' },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['checkout.assurance-strip'],
				candidatePrerequisites: ['The gift checkout shell must remain unavailable and transaction-free.', 'The returned ID must match one merchant-authored reassurance variant.'],
				before: { presentation: 'Merchant baseline checkout reassurance copy.', observe: beforeObserve },
				result: { changed: 'A different merchant-authored reassurance variant renders.', kept: 'The baseline variant remains valid.', observe: { aiZones: { kind: 'exact', value: 1, note: 'Only the rendered checkout assurance zone counts.' }, aiCalls: providerCalls } },
				failClosedReason: 'Any unapproved ID, executable checkout state, disabled gate, or provider failure keeps the unavailable shell and renders zero AI zones.',
			},
		],
	},
	{
		id: 'select_component_variant', label: 'Select an approved component', authority: ['model'], surfaces: ['home'],
		demoHref: '/?observe=true', boundary: 'Chooses from registered component variants inside the existing page recipe.',
		fixedFacts: KIBBLE_FIXED_COMMERCE_FACTS,
		proofs: [{
			route: { surface: 'home', href: '/?observe=true', stableProof: 'Home binds the catalog module to two registered complete component variants inside home.editorial-strip.' },
			trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
			namedZoneInstances: ['home.editorial-strip'],
			candidatePrerequisites: ['One to eight unique current shelf products.', 'The component ID must be one of the two registered Home catalog-module variants.'],
			before: { presentation: 'The four-column merchant catalog module.', observe: beforeObserve },
			result: { changed: 'The registered two-column module renders.', kept: 'The registered four-column baseline remains valid.', observe: { aiZones: { kind: 'exact', value: 3, note: 'The shared Home run renders three validated named-zone selections.' }, aiCalls: providerCalls } },
			failClosedReason: 'An unregistered component ID or any failed Home sibling validation keeps all three merchant-owned zones and renders zero AI zones.',
		}],
	},
	{
		id: 'toggle_zone', label: 'Show an approved marketing zone', authority: ['model'], surfaces: ['plp', 'pdp'],
		demoHref: KIBBLE_AISLES_PDP_PROOF.href, boundary: 'May show or hide only the named optional marketing block.',
		fixedFacts: KIBBLE_FIXED_COMMERCE_FACTS,
		proofs: [
			{
				route: { surface: 'plp', href: '/category/dog-food?sort=FEATURED&observe=true', stableProof: 'The pinned Dog Food PLP includes one named optional marketing slot hidden by default.' },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['plp.marketing-block'],
				candidatePrerequisites: ['An eligible pinned PLP ranking prefix.', 'Visibility and copy must validate together for plp.marketing-block.'],
				before: { presentation: 'No PLP marketing block is rendered.', observe: beforeObserve },
				result: { changed: 'One merchant-authored block renders in the PLP slot.', kept: 'A model-selected hidden result mounts no DOM and adds no AI zone.', observe: { aiZones: { kind: 'range', min: 2, max: 3, note: 'Header and ranking count; PLP marketing counts only when visible.' }, aiCalls: providerCalls } },
				failClosedReason: 'An invalid visibility/variant pairing, crossed binding, failed gate, or failed sibling execution keeps the merchant PLP and publishes no model zones; a valid hidden selection is an AI-kept result with two rendered zones.',
			},
			{
				route: { surface: 'pdp', href: KIBBLE_AISLES_PDP_PROOF.href, stableProof: `The pinned proof product ${KIBBLE_AISLES_PDP_PROOF.productEntityId} preflights four honest category siblings; pdp.below-description is hidden by default.` },
				trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
				namedZoneInstances: ['pdp.below-description'],
				candidatePrerequisites: ['The PDP action must be eligible with three or four bound candidates.', 'Visibility and copy must validate together for pdp.below-description.'],
				before: { presentation: 'No PDP marketing block is rendered.', observe: beforeObserve },
				result: { changed: 'One merchant-authored block renders in the PDP slot.', kept: 'A model-selected hidden result mounts no DOM and adds no AI zone.', observe: { aiZones: { kind: 'range', min: 1, max: 2, note: 'Related counts; PDP marketing counts only when visible.' }, aiCalls: providerCalls } },
				failClosedReason: 'An invalid visibility/variant pairing, crossed binding, failed gate, or failed sibling execution keeps the merchant PDP and publishes no model zones; a valid hidden selection is an AI-kept result with one rendered zone.',
			},
		],
	},
	{
		id: 'reorder_zones', label: 'Reorder approved Home sections', authority: ['model'], surfaces: ['home'],
		demoHref: '/?observe=true', boundary: 'Reorders only the approved Home section pair; checkout and account structure remain fixed.',
		fixedFacts: KIBBLE_FIXED_COMMERCE_FACTS,
		proofs: [{
			route: { surface: 'home', href: '/?observe=true', stableProof: 'home.featured-row.1 may choose only featured-then-catalog or catalog-then-featured for the existing pair.' },
			trigger: { label: 'Run bounded AI', execution: 'explicit-observe-model', requiresUserAction: true },
			namedZoneInstances: ['home.featured-row.1'],
			candidatePrerequisites: ['The featured and catalog sections must both be present.', 'The placement ID must be one of two merchant-approved orders.'],
			before: { presentation: 'Featured shelf, then category catalog module.', observe: beforeObserve },
			result: { changed: 'The two existing named sections exchange order.', kept: 'The merchant baseline order remains valid.', observe: { aiZones: { kind: 'exact', value: 3, note: 'The shared Home run renders three selections; action fields are not extra zones.' }, aiCalls: providerCalls } },
			failClosedReason: 'Any unapproved placement or missing section keeps the baseline Home order and renders zero AI zones.',
		}],
	},
] as const satisfies readonly KibbleAislesCapabilityDemo[]);

export const KIBBLE_ONE_TIME_ONLY_ENTITY_IDS = Object.freeze(
	KIBBLE_CATALOG_ENTITY_IDS.filter((entityId) => !KIBBLE_CATALOG_CAPABILITIES[entityId]),
);

export function getKibbleCatalogCapabilities(entityId: number): KibbleCatalogCapability | null {
	return KIBBLE_CATALOG_CAPABILITIES[entityId] ?? null;
}

export function getKibbleCatalogSignals(
	entityId: number,
	catalogCategoryName?: string,
	catalogPrice?: Pick<Product, 'price' | 'salePrice'>,
): KibbleCatalogSignals {
	const subscription = getKibbleCatalogCapabilities(entityId)?.subscription;
	const offerPriceConsistent = !subscription || catalogPrice === undefined || isKibblePinnedOfferPriceConsistent({ entityId, ...catalogPrice }, subscription);
	const visibleSubscription = offerPriceConsistent ? subscription : null;
	const pinnedCategorySlug = getKibbleCatalogCategorySlug(entityId);
	const liveCategorySlug = catalogCategoryName === undefined ? null : getKibbleCatalogCategorySlugFromName(catalogCategoryName);
	const categorySlug = catalogCategoryName === undefined ? pinnedCategorySlug : liveCategorySlug;
	const profile = categorySlug ? KIBBLE_CATEGORY_JOB_PROFILES[categorySlug] : null;
	const categorySource: KibbleCategorySource = catalogCategoryName === undefined
		? pinnedCategorySlug ? 'pinned-seed' : 'unclassified'
		: liveCategorySlug === null ? 'unclassified'
			: liveCategorySlug === pinnedCategorySlug ? 'live-catalog-match' : 'live-catalog-override';
	const knownCatalogProduct = KIBBLE_CATALOG_ENTITY_IDS.includes(entityId);
	return {
		productRole: profile?.defaultProductRole ?? 'unclassified',
		offerProjection: subscription ? offerPriceConsistent ? 'pinned-auto-refill' : 'suppressed-price-drift' : knownCatalogProduct ? 'none' : 'unclassified',
		canonicalRegistryStatus: knownCatalogProduct
			? KIBBLE_CANONICAL_STOREFRONT_REGISTRY_ENTITY_IDS.includes(entityId) ? 'listed' : 'not-listed'
			: 'unclassified',
		categorySlug,
		categorySource,
		categoryJob: profile?.shopperJob ?? null,
		decisionDimensions: profile?.decisionDimensions ?? [],
		subscriptionCapabilities: visibleSubscription?.capabilities ?? [],
		subscriptionSavingsPercent: visibleSubscription?.savingsPercent ?? null,
		subscriptionCadenceMonths: visibleSubscription?.cadenceMonths ?? null,
	};
}

export function getKibbleCatalogCategorySlug(entityId: number): KibbleCatalogCategorySlug | null {
	const sourceCategoryId = KIBBLE_CATALOG_SOURCE_CATEGORY_IDS[entityId];
	return Object.values(KIBBLE_CATEGORY_JOB_PROFILES).find((profile) => profile.sourceCategoryId === sourceCategoryId)?.slug ?? null;
}

export function getKibbleCatalogCategorySlugFromName(categoryName: string): KibbleCatalogCategorySlug | null {
	const normalized = categoryName.trim().toLocaleLowerCase('en-US');
	return Object.values(KIBBLE_CATEGORY_JOB_PROFILES).find(
		(profile) => profile.sourceCategoryName.toLocaleLowerCase('en-US') === normalized,
	)?.slug ?? null;
}

export function getKibbleCategoryJobProfile(slug: string): KibbleCategoryJobProfile | null {
	return Object.hasOwn(KIBBLE_CATEGORY_JOB_PROFILES, slug)
		? KIBBLE_CATEGORY_JOB_PROFILES[slug as KibbleCatalogCategorySlug]
		: null;
}

export function describeKibbleCatalogSignalsForPrompt(signals: KibbleCatalogSignals | undefined): string {
	if (!signals) return 'merchant category context: unavailable | offer projection: unavailable';
	const dimensions = signals.decisionDimensions.length ? signals.decisionDimensions.join(', ') : 'none supplied';
	const category = signals.productRole === 'unclassified'
		? 'merchant category context: unavailable'
		: `role: ${signals.productRole} | category source: ${signals.categorySource} | shopper job: ${signals.categoryJob} | compare: ${dimensions}`;
	const offer = signals.offerProjection === 'pinned-auto-refill'
		? `offer projection: pinned Auto-Refill | canonical storefront registry: ${signals.canonicalRegistryStatus} | capabilities: ${signals.subscriptionCapabilities.join(', ')} | save ${signals.subscriptionSavingsPercent}% | cadence ${signals.subscriptionCadenceMonths?.join('/')}`
		: `offer projection: ${signals.offerProjection} | canonical storefront registry: ${signals.canonicalRegistryStatus}`;
	return `${category} | ${offer}`;
}

export function buildKibbleMerchantCapabilityCoverage(): KibbleMerchantCapabilityCoverage {
	return {
		version: 'kibble-merchant-capability-manifest-v1',
		source: KIBBLE_CATALOG_ENRICHMENT_SOURCE,
		catalog: kibbleCatalogCoverage(),
		categoryProfiles: Object.values(KIBBLE_CATEGORY_JOB_PROFILES),
		subscriptionCapabilities: KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS,
		sourceCapabilitiesOutsideKibble: KIBBLE_SOURCE_CAPABILITIES_OUTSIDE_KIBBLE,
		aislesCapabilities: KIBBLE_AISLES_CAPABILITY_DEMOS,
		sourceRegistryNote: 'The canonical storefront registry verified on 2026-06-28 lists 10 products and three PDP capabilities. A separate generated offer file contains 34 product rows. The 2026-06-29 demo-state reports seven live capabilities, while the marketing registry lists seven more configurable models. Gift is a direct source contradiction: absent in the canonical registry because no gift_tokens table existed, then reported live by the next day\'s demo-state. This manifest shows both claims and does not resolve them as current provider truth.',
		commerceBoundary: 'Aisles displays merchant-approved evidence and presentation choices. BigCommerce and the subscription service remain transaction authorities.',
		outcomeProof: 'not-measured',
	};
}

/**
 * Materialize only the display-safe card contract. Product ids remain the
 * server-reloaded catalog ids; no browser value becomes a plan or cart input.
 */
export function materializeKibbleSubscriptionOffers(
	products: readonly Pick<Product, 'id' | 'entityId' | 'price' | 'salePrice'>[],
): Record<string, KibbleAutoRefillOffer> {
	return Object.fromEntries(products.flatMap((product) => {
		const subscription = getKibbleCatalogCapabilities(product.entityId)?.subscription;
		if (!subscription || !isKibblePinnedOfferPriceConsistent(product, subscription)) return [];
		const capabilityEvidence = subscription.capabilities
			.filter((capability) => capability !== 'subscribe-and-save' && KIBBLE_SUBSCRIPTION_CAPABILITY_SURFACES[capability] === 'storefront')
			.map((capability) => ({
				label: KIBBLE_SUBSCRIPTION_CAPABILITY_LABELS[capability],
				detail: KIBBLE_SUBSCRIPTION_CAPABILITY_EVIDENCE[capability],
			}));
		return [[product.id, {
			price: subscription.price,
			savingsPercent: subscription.savingsPercent,
			label: 'Auto-Refill',
			savingsLabel: 'Save',
			cadenceLabel: 'every 1, 2, or 3 months',
			capabilityLabels: capabilityEvidence.map(({ label }) => label),
			capabilityEvidence,
		} satisfies KibbleAutoRefillOffer]];
	}));
}

export function isKibblePinnedOfferPriceConsistent(
	product: Pick<Product, 'entityId' | 'price' | 'salePrice'>,
	offer: Pick<KibbleAutoRefillOffer, 'price' | 'savingsPercent'>,
): boolean {
	const subscription = getKibbleCatalogCapabilities(product.entityId)?.subscription;
	if (!subscription || offer.price !== subscription.price || offer.savingsPercent !== subscription.savingsPercent) return false;
	const effectiveOneTimePrice = product.salePrice ?? product.price;
	if (!Number.isFinite(effectiveOneTimePrice) || effectiveOneTimePrice <= 0 || offer.price >= effectiveOneTimePrice) return false;
	const actualSavingsPercent = ((effectiveOneTimePrice - offer.price) / effectiveOneTimePrice) * 100;
	return Math.round(actualSavingsPercent) === offer.savingsPercent;
}

export function kibbleCatalogCapabilityCount(): number {
	return Object.keys(KIBBLE_CATALOG_CAPABILITIES).length;
}

export function kibbleCatalogCoverage(): {
	totalProducts: number;
	pinnedOfferProducts: number;
	withoutPinnedOfferProducts: number;
	canonicalStorefrontRegistryProducts: number;
	liveCapabilitiesInPinnedSnapshot: number;
	sourceCapabilitiesOutsideKibble: number;
} {
	return {
		totalProducts: KIBBLE_CATALOG_ENTITY_IDS.length,
		pinnedOfferProducts: kibbleCatalogCapabilityCount(),
		withoutPinnedOfferProducts: KIBBLE_ONE_TIME_ONLY_ENTITY_IDS.length,
		canonicalStorefrontRegistryProducts: KIBBLE_CANONICAL_STOREFRONT_REGISTRY_ENTITY_IDS.length,
		liveCapabilitiesInPinnedSnapshot: KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS.length,
		sourceCapabilitiesOutsideKibble: KIBBLE_SOURCE_CAPABILITIES_OUTSIDE_KIBBLE.length,
	};
}
