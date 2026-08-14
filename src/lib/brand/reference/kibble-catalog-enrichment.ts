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

export type KibbleAislesCapabilityDemo = {
	readonly id: 'rank_products' | 'select_products' | 'select_copy_variant' | 'select_component_variant' | 'toggle_zone' | 'reorder_zones';
	readonly label: string;
	readonly authority: readonly ('rules' | 'model')[];
	readonly surfaces: readonly ('home' | 'plp' | 'pdp' | 'search' | 'cart' | 'checkout')[];
	readonly demoHref: string;
	readonly boundary: string;
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

export const KIBBLE_AISLES_CAPABILITY_DEMOS = Object.freeze([
	{ id: 'select_products', label: 'Select approved products', authority: ['rules'], surfaces: ['home'], demoHref: '/?observe=true', boundary: 'Selects only from the merchant candidate set; catalog membership stays fixed.' },
	{ id: 'rank_products', label: 'Rank approved products', authority: ['rules', 'model'], surfaces: ['home', 'plp', 'pdp'], demoHref: '/category/dog-food?observe=true', boundary: 'Changes order only; product facts, price, links, and actions stay fixed.' },
	{ id: 'select_copy_variant', label: 'Select approved copy', authority: ['model'], surfaces: ['home', 'plp', 'pdp', 'search', 'cart', 'checkout'], demoHref: '/search?q=zzzz-kibble-no-match&observe=true', boundary: 'Selects a merchant-authored variant ID; the model does not write storefront claims.' },
	{ id: 'select_component_variant', label: 'Select an approved component', authority: ['model'], surfaces: ['home'], demoHref: '/?observe=true', boundary: 'Chooses from registered component variants inside the existing page recipe.' },
	{ id: 'toggle_zone', label: 'Show an approved marketing zone', authority: ['model'], surfaces: ['plp', 'pdp'], demoHref: '/category/dog-food?observe=true', boundary: 'May show or hide only the named optional marketing block.' },
	{ id: 'reorder_zones', label: 'Reorder approved Home sections', authority: ['model'], surfaces: ['home'], demoHref: '/?observe=true', boundary: 'Reorders only the approved Home section pair; checkout and account structure remain fixed.' },
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
