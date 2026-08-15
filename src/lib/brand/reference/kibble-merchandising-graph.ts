import {
	KIBBLE_AISLES_CAPABILITY_DEMOS,
	KIBBLE_CANONICAL_STOREFRONT_REGISTRY_ENTITY_IDS,
	KIBBLE_CATALOG_ENTITY_IDS,
	KIBBLE_CATALOG_SOURCE_CATEGORY_IDS,
	KIBBLE_CATEGORY_JOB_PROFILES,
	KIBBLE_SOURCE_CAPABILITIES_OUTSIDE_KIBBLE,
	KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS,
	getKibbleCatalogCapabilities,
	type KibbleCatalogCategorySlug,
	type KibbleSubscriptionCapability,
} from './kibble-catalog-enrichment';

/**
 * Merchant meaning for the fixed 49-product Kibble catalog.
 *
 * This module separates four evidence classes that must not be flattened:
 *
 * 1. merchant-authored routine membership from bundle-contents.json;
 * 2. complements derived from co-membership in those routines;
 * 3. alternatives derived from exact catalog names and categories; and
 * 4. disclosed category-sibling fallback, which is not a merchant relation.
 *
 * Subscription references are evidence only. They do not create a cart,
 * subscription, account, order, price authority, or provider authorization.
 */
export const KIBBLE_MERCHANDISING_GRAPH_SOURCES = Object.freeze({
	catalogIdentity: {
		path: 'bc-subscriptions/scripts/kibble-demo/data/seed-output.json',
		sha256: '833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49',
		use: 'Product keys, SKUs, names, brands, product roles, and the original offer flags. Its category IDs are superseded by the channel-one mapping.',
	},
	currentCategoryMapping: {
		path: 'bc-subscriptions/scripts/kibble-demo/data/channel1-seed-output.json',
		sha256: '97ddb5f9df38ab0f7372d16b93fd466c5888a0e7f61d72dcf7fec1ded6a0943c',
		use: 'Exact current product ID to category ID mapping for all 49 rows.',
	},
	pinnedOffers: {
		path: 'bc-subscriptions/apps/storefront-svelte/src/lib/subscriptions/eligible-products.json',
		sha256: 'affd8b0092d249e328683af00207e510248033d1cd5593c8134b956499b5a6da',
		use: 'Thirty-four display offer rows. This file alone is not provider-plan proof.',
	},
	canonicalRegistry: {
		path: 'bc-subscriptions/apps/storefront-svelte/src/lib/catalog.ts',
		sha256: '76f1ff49ac117fff785df80444883cb580d0f088e22c46767a86d69cc6a00997',
		use: 'Ten canonical storefront products and three named PDP capabilities.',
	},
	marketingCapabilities: {
		path: 'bc-subscriptions/apps/marketing/src/data/capabilities.json',
		sha256: '407efaf0e9c33b948bde28c162f18d4fe3630ba7be9a3c7870045d48326b4a13',
		use: 'Source capability registry, including the seven configurable models explicitly not claimed for Kibble.',
	},
	bundleContents: {
		path: 'bc-subscriptions/apps/storefront-svelte/src/lib/brand/bundle-contents.json',
		sha256: '84eeb73ac2d81e2b796b530c876ab334ec6d613e74ff59e7ecffb6f20086bcdd',
		use: 'Merchant-authored bundle membership, component roles, and subscribable flags for eight routines.',
	},
	providerPlans: {
		path: 'bc-subscriptions/apps/api/migrations/seed/0009_kibble_demo_seed.sql',
		sha256: 'b8a6197715158e7f944595dd19f5480717a42a7ae1b593b0d14960bbef27bcd3',
		use: 'Exact provider plan IDs for 32 monthly product families plus one annual plan; explicitly deletes Gift Bundle and Surf & Turf monthly plans.',
	},
	providerExtensions: {
		path: 'bc-subscriptions/apps/api/migrations/seed/0010_demo_extensions_seed.sql',
		sha256: 'e769cdb718ac68d52bc758f26a99aa2f54baab4cb50449221a04af4c8e707e42',
		use: 'Portal-only prepaid, gift, and build-a-box demo references, including the six build-a-box eligible SKUs.',
	},
	demoState: {
		path: 'bc-subscriptions/apps/marketing/src/data/demo-state.json',
		sha256: 'a3554da7d7509c9b9fbdef6cd9a24102d05ca34f7da593e8abfc804bf942161f',
		use: 'Seven live-in-snapshot capability records and their sample provider plan IDs.',
	},
	workLibrarySignals: {
		path: 'work-library/app/generated/library.json',
		sha256: '7e61789e2775022008d3be3c5a41a0f76ec5f62ac7655f983031381d442d1f58',
		sourceRevision: '23ec6ca446e6269035bf0b7c90e78477b9c87d25',
		use: 'Aisles-versus-Behamics evidence that signal meanings can invert by retail category; shopper jobs remain category-specific.',
	},
} as const);

export const KIBBLE_COMPARISON_DIMENSIONS = [
	'protein-source', 'food-format', 'recipe-positioning', 'variety', 'life-stage',
	'wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence',
	'treat-purpose', 'chew-duration', 'care-area', 'application-format',
	'play-style', 'durability', 'supervision', 'size-fit', 'handling-system',
	'travel-mode', 'portability', 'rest-context', 'weather', 'washability',
	'included-products', 'routine-goal', 'subscription-status', 'giftability',
	'box-customization',
] as const;

export type KibbleComparisonDimension = typeof KIBBLE_COMPARISON_DIMENSIONS[number];

export type KibbleProductRole =
	| 'complete-dry-food'
	| 'complete-air-dried-food'
	| 'complete-wet-food'
	| 'food-variety-pack'
	| 'meal-topper'
	| 'digestive-supplement'
	| 'mobility-supplement'
	| 'calming-supplement'
	| 'skin-coat-supplement'
	| 'daily-multivitamin'
	| 'dental-chew'
	| 'broth-topper'
	| 'training-treat'
	| 'long-lasting-chew'
	| 'coat-care'
	| 'coat-spray'
	| 'paw-care'
	| 'puzzle-toy'
	| 'toy-set'
	| 'tether-toy'
	| 'chew-toy'
	| 'harness'
	| 'leash'
	| 'collar'
	| 'travel-bowl'
	| 'pet-backpack'
	| 'pet-carrier'
	| 'bed'
	| 'crate-mat'
	| 'jacket'
	| 'feeding-set'
	| 'curated-bundle';

export type KibbleNeedState =
	| 'daily-feeding'
	| 'protein-preference'
	| 'format-variety'
	| 'meal-enhancement'
	| 'digestive-support'
	| 'mobility-support'
	| 'calm-support'
	| 'skin-coat-care'
	| 'daily-wellness'
	| 'dental-care'
	| 'training-reward'
	| 'long-lasting-chew'
	| 'coat-maintenance'
	| 'paw-maintenance'
	| 'mental-enrichment'
	| 'toy-variety'
	| 'interactive-play'
	| 'chew-play'
	| 'daily-walk'
	| 'outdoor-weather'
	| 'on-the-go-water'
	| 'hands-free-travel'
	| 'enclosed-travel'
	| 'home-rest'
	| 'crate-rest'
	| 'cold-weather'
	| 'mealtime-organization'
	| 'puppy-start'
	| 'daily-essentials'
	| 'multi-need-care'
	| 'senior-care'
	| 'snack-variety'
	| 'gifting'
	| 'limited-edition-variety'
	| 'customizable-box';

export const KIBBLE_CATEGORY_SHOPPER_JOBS = Object.freeze([
	{ id: 'dog-food.everyday-nutrition', categorySlug: 'dog-food', job: 'Choose an everyday food routine.', comparisonDimensions: ['protein-source', 'food-format', 'recipe-positioning', 'provider-plan-cadence'] },
	{ id: 'dog-food.protein-or-recipe', categorySlug: 'dog-food', job: 'Compare protein and recipe positioning without inventing a health result.', comparisonDimensions: ['protein-source', 'recipe-positioning', 'food-format'] },
	{ id: 'dog-food.change-format', categorySlug: 'dog-food', job: 'Choose dry, air-dried, wet, or variety-pack presentation.', comparisonDimensions: ['food-format', 'variety', 'provider-plan-cadence'] },
	{ id: 'dog-food.add-meal-variety', categorySlug: 'dog-food', job: 'Add a topper or rotating format to an existing meal routine.', comparisonDimensions: ['food-format', 'variety', 'routine-frequency'] },
	{ id: 'supplements.digestive-routine', categorySlug: 'supplements', job: 'Compare catalog-labeled digestive support formats.', comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ id: 'supplements.mobility-routine', categorySlug: 'supplements', job: 'Compare catalog-labeled mobility support options.', comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ id: 'supplements.calming-routine', categorySlug: 'supplements', job: 'Compare catalog-labeled calming formats.', comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ id: 'supplements.skin-coat-routine', categorySlug: 'supplements', job: 'Choose a catalog-labeled skin and coat routine.', comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ id: 'supplements.daily-wellness', categorySlug: 'supplements', job: 'Choose a general daily wellness routine.', comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ id: 'treats.dental-routine', categorySlug: 'treats', job: 'Choose a dental-chew routine.', comparisonDimensions: ['treat-purpose', 'chew-duration', 'routine-frequency'] },
	{ id: 'treats.training-reward', categorySlug: 'treats', job: 'Choose a repeatable reward or training treat.', comparisonDimensions: ['treat-purpose', 'routine-frequency'] },
	{ id: 'treats.long-chew', categorySlug: 'treats', job: 'Choose a longer-lasting chew format.', comparisonDimensions: ['treat-purpose', 'chew-duration', 'supervision'] },
	{ id: 'treats.meal-topper', categorySlug: 'treats', job: 'Add a broth-style meal topper.', comparisonDimensions: ['treat-purpose', 'delivery-format', 'routine-frequency'] },
	{ id: 'grooming.coat-care', categorySlug: 'grooming', job: 'Choose a coat-care product by use and application.', comparisonDimensions: ['care-area', 'application-format', 'routine-frequency'] },
	{ id: 'grooming.coat-freshening', categorySlug: 'grooming', job: 'Choose a topical coat-freshening step.', comparisonDimensions: ['care-area', 'application-format', 'routine-frequency'] },
	{ id: 'grooming.paw-care', categorySlug: 'grooming', job: 'Choose a paw-care step.', comparisonDimensions: ['care-area', 'application-format', 'routine-frequency'] },
	{ id: 'toys.puzzle-play', categorySlug: 'toys', job: 'Choose puzzle-style enrichment.', comparisonDimensions: ['play-style', 'durability', 'supervision'] },
	{ id: 'toys.variety-set', categorySlug: 'toys', job: 'Choose a multi-toy set.', comparisonDimensions: ['play-style', 'variety', 'durability'] },
	{ id: 'toys.tethered-play', categorySlug: 'toys', job: 'Choose tethered interactive play.', comparisonDimensions: ['play-style', 'durability', 'supervision'] },
	{ id: 'toys.chew-play', categorySlug: 'toys', job: 'Choose a chew-oriented toy.', comparisonDimensions: ['play-style', 'durability', 'supervision'] },
	{ id: 'walk-gear.walking-system', categorySlug: 'walk-gear', job: 'Build a fitted walking and handling system.', comparisonDimensions: ['size-fit', 'handling-system', 'weather'] },
	{ id: 'walk-gear.travel-hydration', categorySlug: 'walk-gear', job: 'Carry food or water while away from home.', comparisonDimensions: ['travel-mode', 'portability'] },
	{ id: 'walk-gear.hands-free-travel', categorySlug: 'walk-gear', job: 'Carry a pet in a backpack format.', comparisonDimensions: ['size-fit', 'travel-mode', 'portability'] },
	{ id: 'walk-gear.enclosed-travel', categorySlug: 'walk-gear', job: 'Choose an enclosed travel carrier.', comparisonDimensions: ['size-fit', 'travel-mode', 'portability'] },
	{ id: 'beds-apparel.home-rest', categorySlug: 'beds-apparel', job: 'Choose a home rest surface.', comparisonDimensions: ['size-fit', 'rest-context', 'washability'] },
	{ id: 'beds-apparel.crate-rest', categorySlug: 'beds-apparel', job: 'Choose a crate rest surface.', comparisonDimensions: ['size-fit', 'rest-context', 'washability'] },
	{ id: 'beds-apparel.weather-layer', categorySlug: 'beds-apparel', job: 'Choose an apparel layer by fit and weather.', comparisonDimensions: ['size-fit', 'weather', 'washability'] },
	{ id: 'beds-apparel.feeding-station', categorySlug: 'beds-apparel', job: 'Organize bowls and the feeding area.', comparisonDimensions: ['included-products', 'washability'] },
	{ id: 'bundles.puppy-start', categorySlug: 'bundles', job: 'Choose the merchant-authored puppy starter routine.', comparisonDimensions: ['life-stage', 'included-products', 'routine-goal', 'subscription-status'] },
	{ id: 'bundles.daily-essentials', categorySlug: 'bundles', job: 'Choose the merchant-authored daily essentials routine.', comparisonDimensions: ['included-products', 'routine-goal', 'subscription-status'] },
	{ id: 'bundles.multi-need-care', categorySlug: 'bundles', job: 'Choose the broader multi-need care routine.', comparisonDimensions: ['included-products', 'routine-goal', 'subscription-status'] },
	{ id: 'bundles.senior-care', categorySlug: 'bundles', job: 'Choose the merchant-authored senior routine.', comparisonDimensions: ['life-stage', 'included-products', 'routine-goal', 'subscription-status'] },
	{ id: 'bundles.treat-variety', categorySlug: 'bundles', job: 'Choose the merchant-authored treat and snack routine.', comparisonDimensions: ['included-products', 'routine-goal', 'subscription-status'] },
	{ id: 'bundles.gift', categorySlug: 'bundles', job: 'Choose the one-time gift bundle without implying a gift subscription.', comparisonDimensions: ['included-products', 'giftability', 'subscription-status'] },
	{ id: 'bundles.limited-edition', categorySlug: 'bundles', job: 'Choose the one-time limited-edition routine.', comparisonDimensions: ['included-products', 'routine-goal', 'subscription-status'] },
] as const satisfies readonly {
	id: string;
	categorySlug: KibbleCatalogCategorySlug;
	job: string;
	comparisonDimensions: readonly KibbleComparisonDimension[];
}[]);

export type KibbleShopperJobId = typeof KIBBLE_CATEGORY_SHOPPER_JOBS[number]['id'];

type KibbleProductSeed = {
	readonly entityId: number;
	readonly sourceKey: string;
	readonly sku: string;
	readonly name: string;
	readonly brand: string;
	readonly categorySlug: KibbleCatalogCategorySlug;
	readonly role: KibbleProductRole;
	readonly shopperJobIds: readonly KibbleShopperJobId[];
	readonly needStates: readonly KibbleNeedState[];
	readonly comparisonDimensions: readonly KibbleComparisonDimension[];
};

const KIBBLE_PRODUCT_DEFINITIONS = [
	{ entityId: 3023, sourceKey: 'openfarm-goodgut-grass-fed-beef-dog-kibble', sku: 'KC_OPENFARM_GOODGUT_GRASS_FED_BEEF_DOG_KIBB', name: 'GoodGut Grass-Fed Beef Dog Kibble', brand: 'Open Farm', categorySlug: 'dog-food', role: 'complete-dry-food', shopperJobIds: ['dog-food.everyday-nutrition', 'dog-food.protein-or-recipe'], needStates: ['daily-feeding', 'protein-preference'], comparisonDimensions: ['protein-source', 'food-format', 'recipe-positioning', 'provider-plan-cadence'] },
	{ entityId: 3024, sourceKey: 'openfarm-goodgut-harvest-chicken-dog-kibble', sku: 'KC_OPENFARM_GOODGUT_HARVEST_CHICKEN_DOG_KIB', name: 'GoodGut Harvest Chicken Dog Kibble', brand: 'Open Farm', categorySlug: 'dog-food', role: 'complete-dry-food', shopperJobIds: ['dog-food.everyday-nutrition', 'dog-food.protein-or-recipe'], needStates: ['daily-feeding', 'protein-preference'], comparisonDimensions: ['protein-source', 'food-format', 'recipe-positioning', 'provider-plan-cadence'] },
	{ entityId: 3025, sourceKey: 'openfarm-goodgut-wild-caught-salmon-dog-kibble', sku: 'KC_OPENFARM_GOODGUT_WILD_CAUGHT_SALMON_DOG_', name: 'GoodGut Wild-Caught Salmon Dog Kibble', brand: 'Open Farm', categorySlug: 'dog-food', role: 'complete-dry-food', shopperJobIds: ['dog-food.everyday-nutrition', 'dog-food.protein-or-recipe'], needStates: ['daily-feeding', 'protein-preference'], comparisonDimensions: ['protein-source', 'food-format', 'recipe-positioning', 'provider-plan-cadence'] },
	{ entityId: 3026, sourceKey: 'openfarm-rawmix-great-plains-ancient-grains-dog-kibble', sku: 'KC_OPENFARM_RAWMIX_GREAT_PLAINS_ANCIENT_GRA', name: 'RawMix Great Plains Ancient Grains Dog Kibble', brand: 'Open Farm', categorySlug: 'dog-food', role: 'complete-dry-food', shopperJobIds: ['dog-food.everyday-nutrition', 'dog-food.protein-or-recipe'], needStates: ['daily-feeding', 'protein-preference'], comparisonDimensions: ['protein-source', 'food-format', 'recipe-positioning', 'provider-plan-cadence'] },
	{ entityId: 3027, sourceKey: 'openfarm-epic-blend-salmon-superfood-grain-free-dog-kibble', sku: 'KC_OPENFARM_EPIC_BLEND_SALMON_SUPERFOOD_GRA', name: 'Epic Blend Salmon & Superfood Grain-Free Dog Kibble', brand: 'Open Farm', categorySlug: 'dog-food', role: 'complete-dry-food', shopperJobIds: ['dog-food.everyday-nutrition', 'dog-food.protein-or-recipe'], needStates: ['daily-feeding', 'protein-preference'], comparisonDimensions: ['protein-source', 'food-format', 'recipe-positioning', 'provider-plan-cadence'] },
	{ entityId: 3028, sourceKey: 'openfarm-air-dried-chicken-dog-food', sku: 'KC_OPENFARM_AIR_DRIED_CHICKEN_DOG_FOOD', name: 'Harvest Chicken Air Dried Recipe for Dogs', brand: 'Open Farm', categorySlug: 'dog-food', role: 'complete-air-dried-food', shopperJobIds: ['dog-food.everyday-nutrition', 'dog-food.change-format'], needStates: ['daily-feeding', 'format-variety'], comparisonDimensions: ['protein-source', 'food-format', 'provider-plan-cadence'] },
	{ entityId: 3029, sourceKey: 'openfarm-harvest-chicken-hearty-stew-wet-dog-food', sku: 'KC_OPENFARM_HARVEST_CHICKEN_HEARTY_STEW_WET', name: 'Harvest Chicken Hearty Stew Wet Dog Food', brand: 'Open Farm', categorySlug: 'dog-food', role: 'complete-wet-food', shopperJobIds: ['dog-food.change-format', 'dog-food.add-meal-variety'], needStates: ['daily-feeding', 'format-variety'], comparisonDimensions: ['protein-source', 'food-format', 'variety', 'provider-plan-cadence'] },
	{ entityId: 3030, sourceKey: 'openfarm-rustic-stew-variety-pack-for-dogs', sku: 'KC_OPENFARM_RUSTIC_STEW_VARIETY_PACK_FOR_DO', name: 'Rustic Stew Variety Pack for Dogs', brand: 'Open Farm', categorySlug: 'dog-food', role: 'food-variety-pack', shopperJobIds: ['dog-food.change-format', 'dog-food.add-meal-variety'], needStates: ['daily-feeding', 'format-variety'], comparisonDimensions: ['food-format', 'variety', 'provider-plan-cadence'] },
	{ entityId: 3031, sourceKey: 'openfarm-goodbowl-variety-pack-for-dogs', sku: 'KC_OPENFARM_GOODBOWL_VARIETY_PACK_FOR_DOGS', name: 'Goodbowl Variety Pack for Dogs', brand: 'Open Farm', categorySlug: 'dog-food', role: 'food-variety-pack', shopperJobIds: ['dog-food.change-format', 'dog-food.add-meal-variety'], needStates: ['daily-feeding', 'format-variety'], comparisonDimensions: ['food-format', 'variety', 'provider-plan-cadence'] },
	{ entityId: 3032, sourceKey: 'openfarm-salmon-cod-topper-for-dogs', sku: 'KC_OPENFARM_SALMON_COD_TOPPER_FOR_DOGS', name: 'Salmon & Cod Topper for Dogs', brand: 'Open Farm', categorySlug: 'dog-food', role: 'meal-topper', shopperJobIds: ['dog-food.add-meal-variety'], needStates: ['meal-enhancement'], comparisonDimensions: ['protein-source', 'food-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3033, sourceKey: 'nativepet-power-poop', sku: 'KC_NATIVEPET_POWER_POOP', name: 'POWER POOP', brand: 'Native Pet', categorySlug: 'supplements', role: 'digestive-supplement', shopperJobIds: ['supplements.digestive-routine'], needStates: ['digestive-support'], comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3034, sourceKey: 'nativepet-hip-joint-mobility-care-chews', sku: 'KC_NATIVEPET_HIP_JOINT_MOBILITY_CARE_CHEWS', name: 'HIP+JOINT MOBILITY CARE', brand: 'Native Pet', categorySlug: 'supplements', role: 'mobility-supplement', shopperJobIds: ['supplements.mobility-routine'], needStates: ['mobility-support'], comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3035, sourceKey: 'nativepet-advanced-calm-chews', sku: 'KC_NATIVEPET_ADVANCED_CALM_CHEWS', name: 'Advanced Calm Chews', brand: 'Native Pet', categorySlug: 'supplements', role: 'calming-supplement', shopperJobIds: ['supplements.calming-routine'], needStates: ['calm-support'], comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3036, sourceKey: 'nativepet-sockeye-salmon-oil', sku: 'KC_NATIVEPET_SOCKEYE_SALMON_OIL', name: 'SOCKEYE SALMON OIL', brand: 'Native Pet', categorySlug: 'supplements', role: 'skin-coat-supplement', shopperJobIds: ['supplements.skin-coat-routine'], needStates: ['skin-coat-care'], comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3037, sourceKey: 'nativepet-probiotics', sku: 'KC_NATIVEPET_PROBIOTICS', name: 'PROBIOTIC', brand: 'Native Pet', categorySlug: 'supplements', role: 'digestive-supplement', shopperJobIds: ['supplements.digestive-routine'], needStates: ['digestive-support'], comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3038, sourceKey: 'finn-multivitamin', sku: 'KC_FINN_MULTIVITAMIN', name: 'Multivitamin', brand: 'Finn', categorySlug: 'supplements', role: 'daily-multivitamin', shopperJobIds: ['supplements.daily-wellness'], needStates: ['daily-wellness'], comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3039, sourceKey: 'finn-hip-and-joint', sku: 'KC_FINN_HIP_AND_JOINT', name: 'Hip & Joint', brand: 'Finn', categorySlug: 'supplements', role: 'mobility-supplement', shopperJobIds: ['supplements.mobility-routine'], needStates: ['mobility-support'], comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3040, sourceKey: 'finn-calming-aid', sku: 'KC_FINN_CALMING_AID', name: 'Calming Aid', brand: 'Finn', categorySlug: 'supplements', role: 'calming-supplement', shopperJobIds: ['supplements.calming-routine'], needStates: ['calm-support'], comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3041, sourceKey: 'finn-digestive-probiotics', sku: 'KC_FINN_DIGESTIVE_PROBIOTICS', name: 'Digestive Probiotics', brand: 'Finn', categorySlug: 'supplements', role: 'digestive-supplement', shopperJobIds: ['supplements.digestive-routine'], needStates: ['digestive-support'], comparisonDimensions: ['wellness-focus', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3042, sourceKey: 'finn-plaque-patrol-dental-chews-large', sku: 'KC_FINN_PLAQUE_PATROL_DENTAL_CHEWS_LARGE', name: 'Plaque Patrol Dental Chews', brand: 'Finn', categorySlug: 'treats', role: 'dental-chew', shopperJobIds: ['treats.dental-routine'], needStates: ['dental-care'], comparisonDimensions: ['treat-purpose', 'chew-duration', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3043, sourceKey: 'finn-bone-broth-plus', sku: 'KC_FINN_BONE_BROTH_PLUS', name: 'Bone Broth Plus', brand: 'Finn', categorySlug: 'treats', role: 'broth-topper', shopperJobIds: ['treats.meal-topper'], needStates: ['meal-enhancement'], comparisonDimensions: ['treat-purpose', 'delivery-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3044, sourceKey: 'wildone-organic-baked-dog-treats', sku: 'KC_WILDONE_ORGANIC_BAKED_DOG_TREATS', name: 'Organic Baked Treats', brand: 'Wild One', categorySlug: 'treats', role: 'training-treat', shopperJobIds: ['treats.training-reward'], needStates: ['training-reward'], comparisonDimensions: ['treat-purpose', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3045, sourceKey: 'nativepet-yak-chews', sku: 'KC_NATIVEPET_YAK_CHEWS', name: 'YAK CHEWS', brand: 'Native Pet', categorySlug: 'treats', role: 'long-lasting-chew', shopperJobIds: ['treats.long-chew'], needStates: ['long-lasting-chew'], comparisonDimensions: ['treat-purpose', 'chew-duration', 'supervision', 'provider-plan-cadence'] },
	{ entityId: 3046, sourceKey: 'finn-fur-hero', sku: 'KC_FINN_FUR_HERO', name: 'Fur Hero', brand: 'Finn', categorySlug: 'grooming', role: 'coat-care', shopperJobIds: ['grooming.coat-care'], needStates: ['coat-maintenance'], comparisonDimensions: ['care-area', 'application-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3047, sourceKey: 'maxbone-smellin-good-body-and-coat-spray', sku: 'KC_MAXBONE_SMELLIN_GOOD_BODY_AND_COAT_SPRAY', name: "Smellin' Good Coat Spray", brand: 'maxbone', categorySlug: 'grooming', role: 'coat-spray', shopperJobIds: ['grooming.coat-freshening'], needStates: ['coat-maintenance'], comparisonDimensions: ['care-area', 'application-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3048, sourceKey: 'finn-paw-hero', sku: 'KC_FINN_PAW_HERO', name: 'Paw Hero', brand: 'Finn', categorySlug: 'grooming', role: 'paw-care', shopperJobIds: ['grooming.paw-care'], needStates: ['paw-maintenance'], comparisonDimensions: ['care-area', 'application-format', 'routine-frequency', 'provider-plan-cadence'] },
	{ entityId: 3049, sourceKey: 'wildone-tennis-tumble-dog-puzzle-toy', sku: 'KC_WILDONE_TENNIS_TUMBLE_DOG_PUZZLE_TOY', name: 'Tennis Tumble', brand: 'Wild One', categorySlug: 'toys', role: 'puzzle-toy', shopperJobIds: ['toys.puzzle-play'], needStates: ['mental-enrichment'], comparisonDimensions: ['play-style', 'durability', 'supervision'] },
	{ entityId: 3050, sourceKey: 'wildone-dog-toy-set', sku: 'KC_WILDONE_DOG_TOY_SET', name: 'Dog Toy Kit', brand: 'Wild One', categorySlug: 'toys', role: 'toy-set', shopperJobIds: ['toys.variety-set'], needStates: ['toy-variety'], comparisonDimensions: ['play-style', 'variety', 'durability'] },
	{ entityId: 3051, sourceKey: 'maxbone-maxbone-tether-toy', sku: 'KC_MAXBONE_MAXBONE_TETHER_TOY', name: 'Enrichment Tether Toy', brand: 'maxbone', categorySlug: 'toys', role: 'tether-toy', shopperJobIds: ['toys.tethered-play'], needStates: ['interactive-play'], comparisonDimensions: ['play-style', 'durability', 'supervision'] },
	{ entityId: 3052, sourceKey: 'wildone-bolt-bite-chew-toy', sku: 'KC_WILDONE_BOLT_BITE_CHEW_TOY', name: 'Bolt Bite', brand: 'Wild One', categorySlug: 'toys', role: 'chew-toy', shopperJobIds: ['toys.chew-play'], needStates: ['chew-play'], comparisonDimensions: ['play-style', 'durability', 'supervision'] },
	{ entityId: 3053, sourceKey: 'wildone-cushioned-dog-harness', sku: 'KC_WILDONE_CUSHIONED_DOG_HARNESS', name: 'Cushioned Dog Harness', brand: 'Wild One', categorySlug: 'walk-gear', role: 'harness', shopperJobIds: ['walk-gear.walking-system'], needStates: ['daily-walk'], comparisonDimensions: ['size-fit', 'handling-system', 'weather'] },
	{ entityId: 3054, sourceKey: 'wildone-waterproof-dog-leash', sku: 'KC_WILDONE_WATERPROOF_DOG_LEASH', name: 'Waterproof Dog Leash', brand: 'Wild One', categorySlug: 'walk-gear', role: 'leash', shopperJobIds: ['walk-gear.walking-system'], needStates: ['daily-walk', 'outdoor-weather'], comparisonDimensions: ['handling-system', 'weather'] },
	{ entityId: 3055, sourceKey: 'wildone-quick-release-dog-collar', sku: 'KC_WILDONE_QUICK_RELEASE_DOG_COLLAR', name: 'Quick-Release Dog Collar', brand: 'Wild One', categorySlug: 'walk-gear', role: 'collar', shopperJobIds: ['walk-gear.walking-system'], needStates: ['daily-walk'], comparisonDimensions: ['size-fit', 'handling-system'] },
	{ entityId: 3056, sourceKey: 'wildone-travel-bowl-duo', sku: 'KC_WILDONE_TRAVEL_BOWL_DUO', name: 'Travel Bowl Duo', brand: 'Wild One', categorySlug: 'walk-gear', role: 'travel-bowl', shopperJobIds: ['walk-gear.travel-hydration'], needStates: ['on-the-go-water'], comparisonDimensions: ['travel-mode', 'portability', 'included-products'] },
	{ entityId: 3057, sourceKey: 'maxbone-go-everywhere-pet-backpack', sku: 'KC_MAXBONE_GO_EVERYWHERE_PET_BACKPACK', name: 'Go Everywhere Backpack', brand: 'maxbone', categorySlug: 'walk-gear', role: 'pet-backpack', shopperJobIds: ['walk-gear.hands-free-travel'], needStates: ['hands-free-travel'], comparisonDimensions: ['size-fit', 'travel-mode', 'portability'] },
	{ entityId: 3058, sourceKey: 'wildone-pet-travel-carrier', sku: 'KC_WILDONE_PET_TRAVEL_CARRIER', name: 'Travel Carrier', brand: 'Wild One', categorySlug: 'walk-gear', role: 'pet-carrier', shopperJobIds: ['walk-gear.enclosed-travel'], needStates: ['enclosed-travel'], comparisonDimensions: ['size-fit', 'travel-mode', 'portability'] },
	{ entityId: 3059, sourceKey: 'maxbone-davos-bed', sku: 'KC_MAXBONE_DAVOS_BED', name: 'Davos Bed', brand: 'maxbone', categorySlug: 'beds-apparel', role: 'bed', shopperJobIds: ['beds-apparel.home-rest'], needStates: ['home-rest'], comparisonDimensions: ['size-fit', 'rest-context', 'washability'] },
	{ entityId: 3060, sourceKey: 'maxbone-unwind-lounger-chill-grey', sku: 'KC_MAXBONE_UNWIND_LOUNGER_CHILL_GREY', name: 'Unwind Crate Mat - Chill Grey', brand: 'maxbone', categorySlug: 'beds-apparel', role: 'crate-mat', shopperJobIds: ['beds-apparel.crate-rest'], needStates: ['crate-rest'], comparisonDimensions: ['size-fit', 'rest-context', 'washability'] },
	{ entityId: 3061, sourceKey: 'maxbone-easy-fit-jacket', sku: 'KC_MAXBONE_EASY_FIT_JACKET', name: 'Easy Fit Jacket', brand: 'maxbone', categorySlug: 'beds-apparel', role: 'jacket', shopperJobIds: ['beds-apparel.weather-layer'], needStates: ['cold-weather'], comparisonDimensions: ['size-fit', 'weather', 'washability'] },
	{ entityId: 3062, sourceKey: 'maxbone-puffer-jacket', sku: 'KC_MAXBONE_PUFFER_JACKET', name: 'Glossy Puffer Jacket', brand: 'maxbone', categorySlug: 'beds-apparel', role: 'jacket', shopperJobIds: ['beds-apparel.weather-layer'], needStates: ['cold-weather'], comparisonDimensions: ['size-fit', 'weather', 'washability'] },
	{ entityId: 3063, sourceKey: 'wildone-dog-bowl-and-placemat-kit', sku: 'KC_WILDONE_DOG_BOWL_AND_PLACEMAT_KIT', name: 'Mealtime Kit', brand: 'Wild One', categorySlug: 'beds-apparel', role: 'feeding-set', shopperJobIds: ['beds-apparel.feeding-station'], needStates: ['mealtime-organization'], comparisonDimensions: ['included-products', 'washability'] },
	{ entityId: 3064, sourceKey: 'puppy-starter-kit', sku: 'KC_BUNDLE_PUPPY_STARTER_KIT', name: 'Puppy Starter Kit', brand: 'Kibble & Co.', categorySlug: 'bundles', role: 'curated-bundle', shopperJobIds: ['bundles.puppy-start'], needStates: ['puppy-start'], comparisonDimensions: ['life-stage', 'included-products', 'routine-goal', 'subscription-status'] },
	{ entityId: 3065, sourceKey: 'essential-bundle', sku: 'KC_BUNDLE_ESSENTIAL_BUNDLE', name: 'Essential Bundle', brand: 'Kibble & Co.', categorySlug: 'bundles', role: 'curated-bundle', shopperJobIds: ['bundles.daily-essentials'], needStates: ['daily-essentials'], comparisonDimensions: ['included-products', 'routine-goal', 'subscription-status'] },
	{ entityId: 3066, sourceKey: 'advanced-bundle', sku: 'KC_BUNDLE_ADVANCED_BUNDLE', name: 'Advanced Bundle', brand: 'Kibble & Co.', categorySlug: 'bundles', role: 'curated-bundle', shopperJobIds: ['bundles.multi-need-care'], needStates: ['multi-need-care'], comparisonDimensions: ['included-products', 'routine-goal', 'subscription-status'] },
	{ entityId: 3067, sourceKey: 'starter-bundle', sku: 'KC_BUNDLE_STARTER_BUNDLE', name: 'Starter Bundle', brand: 'Kibble & Co.', categorySlug: 'bundles', role: 'curated-bundle', shopperJobIds: ['bundles.daily-essentials'], needStates: ['daily-essentials'], comparisonDimensions: ['included-products', 'routine-goal', 'subscription-status'] },
	{ entityId: 3068, sourceKey: 'senior-pet-growth-bundle', sku: 'KC_BUNDLE_SENIOR_PET_GROWTH_BUNDLE', name: 'Senior Pet Growth Bundle', brand: 'Kibble & Co.', categorySlug: 'bundles', role: 'curated-bundle', shopperJobIds: ['bundles.senior-care'], needStates: ['senior-care'], comparisonDimensions: ['life-stage', 'included-products', 'routine-goal', 'subscription-status'] },
	{ entityId: 3069, sourceKey: 'treat-snack-power-set', sku: 'KC_BUNDLE_TREAT_SNACK_POWER_SET', name: 'Treat & Snack Power Set', brand: 'Kibble & Co.', categorySlug: 'bundles', role: 'curated-bundle', shopperJobIds: ['bundles.treat-variety'], needStates: ['snack-variety'], comparisonDimensions: ['included-products', 'routine-goal', 'subscription-status'] },
	{ entityId: 3070, sourceKey: 'gift-bundle', sku: 'KC_BUNDLE_GIFT_BUNDLE', name: 'Gift Bundle', brand: 'Kibble & Co.', categorySlug: 'bundles', role: 'curated-bundle', shopperJobIds: ['bundles.gift'], needStates: ['gifting'], comparisonDimensions: ['included-products', 'giftability', 'subscription-status'] },
	{ entityId: 3071, sourceKey: 'surf-turf-limited-reserve', sku: 'KC_BUNDLE_SURF_TURF_LIMITED_RESERVE', name: 'Surf & Turf Limited Reserve', brand: 'Kibble & Co.', categorySlug: 'bundles', role: 'curated-bundle', shopperJobIds: ['bundles.limited-edition'], needStates: ['limited-edition-variety'], comparisonDimensions: ['included-products', 'routine-goal', 'subscription-status'] },
] as const satisfies readonly KibbleProductSeed[];

export type KibbleProductId = typeof KIBBLE_PRODUCT_DEFINITIONS[number]['entityId'];
export type KibbleStorefrontSubscriptionCapability = Extract<KibbleSubscriptionCapability, 'subscribe-and-save' | 'free-trial' | 'intro-offer' | 'annual'>;
export type KibblePortalSubscriptionCapability = Extract<KibbleSubscriptionCapability, 'prepaid' | 'gift' | 'build-a-box'>;

export type KibbleProviderPlanReference = {
	readonly planId: string;
	readonly cadence: 'month' | 'year';
	readonly intervalCount: number;
	readonly capabilityIds: readonly KibbleStorefrontSubscriptionCapability[];
	readonly sourceId: 'providerPlans';
	readonly evidenceUse: 'catalog-purchase-evidence';
};

export type KibbleProductSubscriptionEvidence = {
	readonly pinnedOfferStatus: 'none' | 'provider-plan-backed' | 'source-conflict-no-monthly-provider-plan';
	readonly providerPlans: readonly KibbleProviderPlanReference[];
	readonly catalogPurchaseAllowed: boolean;
	readonly contradiction: string | null;
};

export type KibbleMerchandisingProduct = Omit<KibbleProductSeed, 'entityId'> & {
	readonly entityId: KibbleProductId;
	readonly sourceCategoryId: number;
	readonly canonicalRegistryListed: boolean;
	readonly subscription: KibbleProductSubscriptionEvidence;
	readonly provenance: {
		readonly identitySourceId: 'catalogIdentity';
		readonly categorySourceId: 'currentCategoryMapping';
	};
};

export const KIBBLE_PROVIDER_MONTHLY_PLAN_PRODUCT_IDS = Object.freeze([
	3023, 3024, 3025, 3026, 3027, 3028, 3029, 3030, 3031, 3032,
	3033, 3034, 3035, 3036, 3037, 3038, 3039, 3040, 3041,
	3042, 3043, 3044, 3045, 3046, 3047, 3048,
	3064, 3065, 3066, 3067, 3068, 3069,
] as const satisfies readonly KibbleProductId[]);

export const KIBBLE_PINNED_OFFER_WITHOUT_PROVIDER_PLAN_IDS = Object.freeze([
	3070, 3071,
] as const satisfies readonly KibbleProductId[]);

const MONTHLY_PROVIDER_PRODUCT_SET = new Set<KibbleProductId>(KIBBLE_PROVIDER_MONTHLY_PLAN_PRODUCT_IDS);
const CONFLICTING_PINNED_OFFER_SET = new Set<KibbleProductId>(KIBBLE_PINNED_OFFER_WITHOUT_PROVIDER_PLAN_IDS);

export const KIBBLE_MERCHANDISING_PRODUCTS: readonly KibbleMerchandisingProduct[] = Object.freeze(
	KIBBLE_PRODUCT_DEFINITIONS.map((product) => ({
		...product,
		entityId: product.entityId as KibbleProductId,
		sourceCategoryId: KIBBLE_CATALOG_SOURCE_CATEGORY_IDS[product.entityId],
		canonicalRegistryListed: KIBBLE_CANONICAL_STOREFRONT_REGISTRY_ENTITY_IDS.includes(product.entityId),
		subscription: buildSubscriptionEvidence(product.entityId, product.sourceKey),
		provenance: { identitySourceId: 'catalogIdentity' as const, categorySourceId: 'currentCategoryMapping' as const },
	})),
);

const PRODUCT_BY_ID = new Map(KIBBLE_MERCHANDISING_PRODUCTS.map((product) => [product.entityId, product]));

function buildSubscriptionEvidence(entityId: KibbleProductId, sourceKey: string): KibbleProductSubscriptionEvidence {
	if (CONFLICTING_PINNED_OFFER_SET.has(entityId)) return {
		pinnedOfferStatus: 'source-conflict-no-monthly-provider-plan',
		providerPlans: [],
		catalogPurchaseAllowed: false,
		contradiction: 'The pinned offer file marks this row eligible, while bundle contents marks it one-time and the provider seed deletes its monthly plans.',
	};
	if (!MONTHLY_PROVIDER_PRODUCT_SET.has(entityId)) return {
		pinnedOfferStatus: 'none',
		providerPlans: [],
		catalogPurchaseAllowed: false,
		contradiction: null,
	};

	const monthlyCapabilityIds: KibbleStorefrontSubscriptionCapability[] = ['subscribe-and-save'];
	if (entityId === 3023) monthlyCapabilityIds.push('intro-offer');
	if (entityId === 3035) monthlyCapabilityIds.push('free-trial');
	const providerPlans: KibbleProviderPlanReference[] = [1, 2, 3].map((intervalCount) => ({
		planId: `plan_kibble_${sourceKey}_${intervalCount}mo`,
		cadence: 'month',
		intervalCount,
		capabilityIds: monthlyCapabilityIds,
		sourceId: 'providerPlans',
		evidenceUse: 'catalog-purchase-evidence',
	}));
	if (entityId === 3038) providerPlans.push({
		planId: 'plan_kibble_finn-multivitamin_annual',
		cadence: 'year',
		intervalCount: 1,
		capabilityIds: ['annual'],
		sourceId: 'providerPlans',
		evidenceUse: 'catalog-purchase-evidence',
	});
	return {
		pinnedOfferStatus: 'provider-plan-backed',
		providerPlans,
		catalogPurchaseAllowed: true,
		contradiction: null,
	};
}

export type KibbleCatalogRoutineMember = {
	readonly kind: 'catalog-product';
	readonly productId: KibbleProductId;
	readonly sourceRole: string;
};

export type KibbleEmbeddedRoutineMember = {
	readonly kind: 'embedded-bundle-component';
	readonly componentKey: 'openfarm-puppy-morsels' | 'nativepet-senior-daily' | 'openfarm-surf-turf-air-dried';
	readonly name: string;
	readonly sourceRole: string;
	readonly catalogProductId: null;
	readonly boundary: 'No matching product ID exists in the fixed 49-product catalog; do not invent a SKU.';
};

export type KibbleRoutineMember = KibbleCatalogRoutineMember | KibbleEmbeddedRoutineMember;

export type KibbleRoutineSet = {
	readonly id: string;
	readonly bundleProductId: KibbleProductId;
	readonly sourceKey: string;
	readonly name: string;
	readonly subscribable: boolean;
	readonly members: readonly KibbleRoutineMember[];
	readonly provenance: {
		readonly sourceId: 'bundleContents';
		readonly sourceLocator: string;
	};
};

const catalogMember = (productId: KibbleProductId, sourceRole: string): KibbleCatalogRoutineMember => ({ kind: 'catalog-product', productId, sourceRole });
const embeddedMember = (
	componentKey: KibbleEmbeddedRoutineMember['componentKey'],
	name: string,
	sourceRole: string,
): KibbleEmbeddedRoutineMember => ({
	kind: 'embedded-bundle-component', componentKey, name, sourceRole, catalogProductId: null,
	boundary: 'No matching product ID exists in the fixed 49-product catalog; do not invent a SKU.',
});

export const KIBBLE_ROUTINE_SETS: readonly KibbleRoutineSet[] = Object.freeze([
	{ id: 'routine.essential-bundle', bundleProductId: 3065, sourceKey: 'essential-bundle-kns4', name: 'Essential Bundle', subscribable: true, members: [catalogMember(3023, 'Premium dry food'), catalogMember(3030, 'Wet food variety pack'), catalogMember(3042, 'Dental chews')], provenance: { sourceId: 'bundleContents', sourceLocator: 'bundles.essential-bundle-kns4' } },
	{ id: 'routine.advanced-bundle', bundleProductId: 3066, sourceKey: 'advanced-bundle-8kfv', name: 'Advanced Bundle', subscribable: true, members: [catalogMember(3025, 'Complete nutrition base'), catalogMember(3033, 'Digestive supplement'), catalogMember(3038, 'Daily multivitamin'), catalogMember(3036, 'Omega-3 skin & coat oil')], provenance: { sourceId: 'bundleContents', sourceLocator: 'bundles.advanced-bundle-8kfv' } },
	{ id: 'routine.puppy-starter-kit', bundleProductId: 3064, sourceKey: 'puppy-starter-kit', name: 'Puppy Starter Kit', subscribable: true, members: [embeddedMember('openfarm-puppy-morsels', 'Chicken & Salmon Freeze Dried Raw Morsels for Puppies', 'Breed-appropriate puppy formula'), catalogMember(3049, 'Interactive puzzle feeder')], provenance: { sourceId: 'bundleContents', sourceLocator: 'bundles.puppy-starter-kit' } },
	{ id: 'routine.starter-bundle', bundleProductId: 3067, sourceKey: 'starter-bundle-wqw9', name: 'Starter Bundle', subscribable: true, members: [catalogMember(3024, 'Everyday dry food'), catalogMember(3043, 'Meal topper'), catalogMember(3044, 'Training treats')], provenance: { sourceId: 'bundleContents', sourceLocator: 'bundles.starter-bundle-wqw9' } },
	{ id: 'routine.senior-pet-growth-bundle', bundleProductId: 3068, sourceKey: 'senior-pet-growth-bundle', name: 'Senior Pet Growth Bundle', subscribable: true, members: [catalogMember(3029, 'Easy-to-eat wet food'), embeddedMember('nativepet-senior-daily', 'Senior Daily', 'Senior daily multi-support'), catalogMember(3039, 'Hip & joint support')], provenance: { sourceId: 'bundleContents', sourceLocator: 'bundles.senior-pet-growth-bundle' } },
	{ id: 'routine.treat-snack-power-set', bundleProductId: 3069, sourceKey: 'treat-snack-power-set', name: 'Treat & Snack Power Set', subscribable: true, members: [catalogMember(3042, 'Dental chews'), catalogMember(3045, 'Long-lasting yak chews'), catalogMember(3044, 'Organic baked treats'), catalogMember(3043, 'Bone broth topper')], provenance: { sourceId: 'bundleContents', sourceLocator: 'bundles.treat-snack-power-set' } },
	{ id: 'routine.gift-bundle', bundleProductId: 3070, sourceKey: 'gift-bundle', name: 'Gift Bundle', subscribable: false, members: [catalogMember(3023, 'Premium dry food'), catalogMember(3045, 'Yak chews'), catalogMember(3043, 'Bone broth topper'), catalogMember(3051, 'Play toy')], provenance: { sourceId: 'bundleContents', sourceLocator: 'bundles.gift-bundle' } },
	{ id: 'routine.surf-turf-limited-reserve', bundleProductId: 3071, sourceKey: 'surf-turf-limited-reserve', name: 'Surf & Turf Limited Reserve', subscribable: false, members: [embeddedMember('openfarm-surf-turf-air-dried', 'Surf & Turf Air Dried Recipe for Dogs', 'Air-dried surf & turf food'), catalogMember(3032, 'Salmon & cod topper'), catalogMember(3036, 'Sockeye salmon oil'), catalogMember(3043, 'Bone broth topper')], provenance: { sourceId: 'bundleContents', sourceLocator: 'bundles.surf-turf-limited-reserve' } },
]);

export type KibbleRelationEndpoint =
	| { readonly kind: 'catalog-product'; readonly productId: KibbleProductId }
	| { readonly kind: 'embedded-bundle-component'; readonly componentKey: KibbleEmbeddedRoutineMember['componentKey']; readonly name: string };

export type KibbleRelationAuthority =
	| 'merchant-authored'
	| 'derived-from-merchant-authored-routine'
	| 'merchant-catalog-derived';

export type KibbleMerchandisingEdge = {
	readonly id: string;
	readonly kind: 'routine-member' | 'complement' | 'alternative';
	readonly direction: 'directed' | 'undirected';
	readonly from: KibbleRelationEndpoint;
	readonly to: KibbleRelationEndpoint;
	readonly authority: KibbleRelationAuthority;
	readonly provenance: {
		readonly sourceId: 'bundleContents' | 'currentCategoryMapping';
		readonly sourcePath: string;
		readonly sourceSha256: string;
		readonly sourceLocator: string;
		readonly interpretation: string;
	};
};

const endpointForMember = (member: KibbleRoutineMember): KibbleRelationEndpoint => member.kind === 'catalog-product'
	? { kind: 'catalog-product', productId: member.productId }
	: { kind: 'embedded-bundle-component', componentKey: member.componentKey, name: member.name };

const endpointKey = (endpoint: KibbleRelationEndpoint): string => endpoint.kind === 'catalog-product'
	? String(endpoint.productId)
	: endpoint.componentKey;

export const KIBBLE_MERCHANT_AUTHORED_ROUTINE_EDGES: readonly KibbleMerchandisingEdge[] = Object.freeze(
	KIBBLE_ROUTINE_SETS.flatMap((routine) => routine.members.map((member, memberIndex) => ({
		id: `${routine.id}.member.${memberIndex + 1}`,
		kind: 'routine-member' as const,
		direction: 'directed' as const,
		from: { kind: 'catalog-product' as const, productId: routine.bundleProductId },
		to: endpointForMember(member),
		authority: 'merchant-authored' as const,
		provenance: {
			sourceId: 'bundleContents' as const,
			sourcePath: KIBBLE_MERCHANDISING_GRAPH_SOURCES.bundleContents.path,
			sourceSha256: KIBBLE_MERCHANDISING_GRAPH_SOURCES.bundleContents.sha256,
			sourceLocator: `${routine.provenance.sourceLocator}.contents[${memberIndex}]`,
			interpretation: 'The merchant-authored bundle source explicitly includes this component.',
		},
	}))),
);

export const KIBBLE_DERIVED_COMPLEMENT_EDGES: readonly KibbleMerchandisingEdge[] = Object.freeze(
	KIBBLE_ROUTINE_SETS.flatMap((routine) => routine.members.flatMap((member, index) =>
		routine.members.slice(index + 1).map((other, offset) => {
			const from = endpointForMember(member);
			const to = endpointForMember(other);
			return {
				id: `${routine.id}.complement.${endpointKey(from)}.${endpointKey(to)}`,
				kind: 'complement' as const,
				direction: 'undirected' as const,
				from,
				to,
				authority: 'derived-from-merchant-authored-routine' as const,
				provenance: {
					sourceId: 'bundleContents' as const,
					sourcePath: KIBBLE_MERCHANDISING_GRAPH_SOURCES.bundleContents.path,
					sourceSha256: KIBBLE_MERCHANDISING_GRAPH_SOURCES.bundleContents.sha256,
					sourceLocator: `${routine.provenance.sourceLocator}.contents[${index}] + contents[${index + offset + 1}]`,
					interpretation: 'The two items are sold together in a merchant-authored routine. Complement status is derived from co-membership, not a native related-product edge.',
				},
			};
		}),
	)),
);

export const KIBBLE_ALTERNATIVE_GROUPS = Object.freeze([
	{ id: 'alternative.goodgut-protein', productIds: [3023, 3024, 3025], basis: 'The exact catalog names share the GoodGut dry-food family and differ by protein.' },
	{ id: 'alternative.wet-food-variety', productIds: [3029, 3030, 3031], basis: 'The exact catalog names place these products in wet or variety-pack meal formats.' },
	{ id: 'alternative.digestive-support', productIds: [3033, 3037, 3041], basis: 'The exact catalog names and supplement category identify digestive or probiotic roles.' },
	{ id: 'alternative.mobility-support', productIds: [3034, 3039], basis: 'The exact catalog names identify hip, joint, and mobility roles.' },
	{ id: 'alternative.calming-support', productIds: [3035, 3040], basis: 'The exact catalog names identify calming roles.' },
	{ id: 'alternative.rest-surface', productIds: [3059, 3060], basis: 'The exact catalog names identify bed and crate-mat rest surfaces.' },
	{ id: 'alternative.weather-layer', productIds: [3061, 3062], basis: 'The exact catalog names identify jacket alternatives.' },
	{ id: 'alternative.pet-carrier', productIds: [3057, 3058], basis: 'The exact catalog names identify backpack and carrier travel formats.' },
] as const satisfies readonly { id: string; productIds: readonly KibbleProductId[]; basis: string }[]);

export const KIBBLE_CATALOG_DERIVED_ALTERNATIVE_EDGES: readonly KibbleMerchandisingEdge[] = Object.freeze(
	KIBBLE_ALTERNATIVE_GROUPS.flatMap((group) => group.productIds.flatMap((productId, index) =>
		group.productIds.slice(index + 1).map((otherProductId) => ({
			id: `${group.id}.${productId}.${otherProductId}`,
			kind: 'alternative' as const,
			direction: 'undirected' as const,
			from: { kind: 'catalog-product' as const, productId },
			to: { kind: 'catalog-product' as const, productId: otherProductId },
			authority: 'merchant-catalog-derived' as const,
			provenance: {
				sourceId: 'currentCategoryMapping' as const,
				sourcePath: KIBBLE_MERCHANDISING_GRAPH_SOURCES.currentCategoryMapping.path,
				sourceSha256: KIBBLE_MERCHANDISING_GRAPH_SOURCES.currentCategoryMapping.sha256,
				sourceLocator: `products[bc_product_id=${productId}] + products[bc_product_id=${otherProductId}]`,
				interpretation: `${group.basis} This is a catalog-derived comparison set, not a merchant-authored related-product edge.`,
			},
		})),
	)),
);

export const KIBBLE_MERCHANDISING_EDGES: readonly KibbleMerchandisingEdge[] = Object.freeze([
	...KIBBLE_MERCHANT_AUTHORED_ROUTINE_EDGES,
	...KIBBLE_DERIVED_COMPLEMENT_EDGES,
	...KIBBLE_CATALOG_DERIVED_ALTERNATIVE_EDGES,
]);

export type KibbleMerchandisingCandidate = {
	readonly product: KibbleMerchandisingProduct;
	readonly relationKinds: readonly KibbleMerchandisingEdge['kind'][];
	readonly authorities: readonly KibbleRelationAuthority[];
	readonly candidateSource: 'merchant_merchandising_graph';
};

export type KibbleCategorySiblingFallbackCandidate = {
	readonly product: KibbleMerchandisingProduct;
	readonly candidateSource: 'category_sibling';
	readonly relationAuthority: 'fallback-only';
	readonly relationKind: null;
	readonly disclosure: 'Same-category fallback; no merchant-authored product relationship is claimed.';
};

export function getKibbleMerchandisingProduct(entityId: number): KibbleMerchandisingProduct | null {
	return PRODUCT_BY_ID.get(entityId as KibbleProductId) ?? null;
}

export function getKibbleProductsForShopperJob(jobId: KibbleShopperJobId): readonly KibbleMerchandisingProduct[] {
	return KIBBLE_MERCHANDISING_PRODUCTS.filter((product) => product.shopperJobIds.includes(jobId));
}

export function getKibbleMerchandisingCandidates(entityId: KibbleProductId): readonly KibbleMerchandisingCandidate[] {
	const grouped = new Map<KibbleProductId, { kinds: Set<KibbleMerchandisingEdge['kind']>; authorities: Set<KibbleRelationAuthority> }>();
	for (const edge of KIBBLE_MERCHANDISING_EDGES) {
		const fromId = edge.from.kind === 'catalog-product' ? edge.from.productId : null;
		const toId = edge.to.kind === 'catalog-product' ? edge.to.productId : null;
		// Candidate traversal is bidirectional even when the underlying relation is
		// directed. A bundle contains a component, while the component may still
		// truthfully point back to the bundle that contains it.
		const candidateId = fromId === entityId ? toId : toId === entityId ? fromId : null;
		if (candidateId === null || candidateId === entityId) continue;
		const entry = grouped.get(candidateId) ?? { kinds: new Set(), authorities: new Set() };
		entry.kinds.add(edge.kind);
		entry.authorities.add(edge.authority);
		grouped.set(candidateId, entry);
	}
	return [...grouped.entries()].map(([productId, relation]) => ({
		product: PRODUCT_BY_ID.get(productId)!,
		relationKinds: [...relation.kinds],
		authorities: [...relation.authorities],
		candidateSource: 'merchant_merchandising_graph',
	}));
}

export function getKibbleCategorySiblingFallbackCandidates(
	entityId: KibbleProductId,
	limit = 4,
): readonly KibbleCategorySiblingFallbackCandidate[] {
	const product = PRODUCT_BY_ID.get(entityId);
	if (!product || limit <= 0) return [];
	return KIBBLE_MERCHANDISING_PRODUCTS
		.filter((candidate) => candidate.entityId !== entityId && candidate.categorySlug === product.categorySlug)
		.slice(0, Math.floor(limit))
		.map((candidate) => ({
			product: candidate,
			candidateSource: 'category_sibling',
			relationAuthority: 'fallback-only',
			relationKind: null,
			disclosure: 'Same-category fallback; no merchant-authored product relationship is claimed.',
		}));
}

export type KibbleCatalogPurchaseEvidence = {
	readonly productId: KibbleProductId;
	readonly providerPlans: readonly KibbleProviderPlanReference[];
	readonly capabilityIds: readonly KibbleStorefrontSubscriptionCapability[];
	readonly sourceOwner: 'bc-subscriptions';
	readonly evidenceUse: 'catalog-purchase-evidence';
	readonly portalCapabilitiesExcluded: readonly KibblePortalSubscriptionCapability[];
};

export function getKibbleCatalogPurchaseEvidence(entityId: number): KibbleCatalogPurchaseEvidence | null {
	const product = getKibbleMerchandisingProduct(entityId);
	if (!product?.subscription.catalogPurchaseAllowed || product.subscription.providerPlans.length === 0) return null;
	return {
		productId: product.entityId,
		providerPlans: product.subscription.providerPlans,
		capabilityIds: [...new Set(product.subscription.providerPlans.flatMap(({ capabilityIds }) => capabilityIds))],
		sourceOwner: 'bc-subscriptions',
		evidenceUse: 'catalog-purchase-evidence',
		portalCapabilitiesExcluded: ['prepaid', 'gift', 'build-a-box'],
	};
}

export type KibbleSubscriptionScenarioCandidate = {
	readonly productId: KibbleProductId;
	readonly sku: string;
	readonly providerPlanIds: readonly string[];
	readonly candidateUse: 'catalog-purchase-evidence' | 'portal-plan-reference' | 'portal-box-selection';
	readonly catalogPurchaseAllowed: boolean;
};

export type KibbleSubscriptionScenario = {
	readonly id: KibbleSubscriptionCapability;
	readonly surface: 'storefront' | 'portal';
	readonly sourceStatus: 'live-in-pinned-snapshot';
	readonly candidates: readonly KibbleSubscriptionScenarioCandidate[];
	readonly boundary: string;
	readonly provenance: readonly ('demoState' | 'providerPlans' | 'providerExtensions')[];
};

const catalogScenarioCandidates = (capabilityId: KibbleStorefrontSubscriptionCapability): KibbleSubscriptionScenarioCandidate[] =>
	KIBBLE_MERCHANDISING_PRODUCTS.flatMap((product) => {
		const planIds = product.subscription.providerPlans
			.filter(({ capabilityIds }) => capabilityIds.includes(capabilityId))
			.map(({ planId }) => planId);
		return planIds.length === 0 ? [] : [{
			productId: product.entityId,
			sku: product.sku,
			providerPlanIds: planIds,
			candidateUse: 'catalog-purchase-evidence' as const,
			catalogPurchaseAllowed: true,
		}];
	});

const portalPlanCandidate = (productId: KibbleProductId, providerPlanId: string): KibbleSubscriptionScenarioCandidate => ({
	productId,
	sku: PRODUCT_BY_ID.get(productId)!.sku,
	providerPlanIds: [providerPlanId],
	candidateUse: 'portal-plan-reference',
	catalogPurchaseAllowed: false,
});

export const KIBBLE_SUBSCRIPTION_SCENARIOS: readonly KibbleSubscriptionScenario[] = Object.freeze([
	{ id: 'subscribe-and-save', surface: 'storefront', sourceStatus: 'live-in-pinned-snapshot', candidates: catalogScenarioCandidates('subscribe-and-save'), boundary: 'Only products with provider-seed plan IDs qualify as catalog purchase evidence; pinned offer rows alone do not.', provenance: ['demoState', 'providerPlans'] },
	{ id: 'free-trial', surface: 'storefront', sourceStatus: 'live-in-pinned-snapshot', candidates: catalogScenarioCandidates('free-trial'), boundary: 'Trial evidence stays attached to the exact provider plan family for product 3035.', provenance: ['demoState', 'providerPlans'] },
	{ id: 'intro-offer', surface: 'storefront', sourceStatus: 'live-in-pinned-snapshot', candidates: catalogScenarioCandidates('intro-offer'), boundary: 'Intro evidence stays attached to the exact provider plan family for product 3023.', provenance: ['demoState', 'providerPlans'] },
	{ id: 'annual', surface: 'storefront', sourceStatus: 'live-in-pinned-snapshot', candidates: catalogScenarioCandidates('annual'), boundary: 'Annual evidence uses the exact yearly provider plan for product 3038.', provenance: ['demoState', 'providerPlans'] },
	{ id: 'prepaid', surface: 'portal', sourceStatus: 'live-in-pinned-snapshot', candidates: [portalPlanCandidate(3066, 'plan_kibble_advanced-bundle_3mo')], boundary: 'This is a portal service reference. It must never appear as PDP or catalog purchase evidence.', provenance: ['demoState', 'providerExtensions'] },
	{ id: 'gift', surface: 'portal', sourceStatus: 'live-in-pinned-snapshot', candidates: [portalPlanCandidate(3035, 'plan_kibble_nativepet-advanced-calm-chews_1mo')], boundary: 'This is a portal service reference. It does not turn the Gift Bundle or Calm Chews PDP into a gift-subscription purchase surface.', provenance: ['demoState', 'providerExtensions'] },
	{ id: 'build-a-box', surface: 'portal', sourceStatus: 'live-in-pinned-snapshot', candidates: [3023, 3024, 3025, 3026, 3027, 3028].map((productId) => ({ productId: productId as KibbleProductId, sku: PRODUCT_BY_ID.get(productId as KibbleProductId)!.sku, providerPlanIds: ['plan_kibble_build-a-box_1mo'], candidateUse: 'portal-box-selection' as const, catalogPurchaseAllowed: false })), boundary: 'The six SKUs are portal selection candidates. Product 3071 is only the provider seed host and is not catalog purchase evidence for build-a-box.', provenance: ['demoState', 'providerExtensions'] },
]);

const SCENARIO_BY_ID = new Map(KIBBLE_SUBSCRIPTION_SCENARIOS.map((scenario) => [scenario.id, scenario]));

export function getKibbleSubscriptionScenario(
	id: KibbleSubscriptionCapability,
): KibbleSubscriptionScenario | null {
	return SCENARIO_BY_ID.get(id) ?? null;
}

export const KIBBLE_CATEGORY_SIGNAL_GUARD = Object.freeze({
	sourceId: 'workLibrarySignals',
	finding: 'Three of ten testable Aisles rules pointed the wrong way in one cross-category offline calibration.',
	application: 'Shopper jobs, need states, and comparison dimensions are assigned per catalog category. A global persona or behavioral signal may rank only within a merchant-approved candidate set; it may not redefine product meaning.',
	behamicsMapping: {
		exploring: 'gatherer',
		comparing: 'researcher',
		deciding: 'hunter',
		'hesitating-or-price-sensitive': 'behavioral-modifier',
	},
	merchantOutcomeProof: 'not-measured',
} as const);

export const KIBBLE_CAPABILITY_MANIFEST_ALIGNMENT = Object.freeze({
	version: 'kibble-merchant-capability-manifest-v1',
	presentationCapabilityIds: KIBBLE_AISLES_CAPABILITY_DEMOS.map(({ id }) => id),
	sourceCapabilitiesOutsideKibble: KIBBLE_SOURCE_CAPABILITIES_OUTSIDE_KIBBLE.map(({ id }) => id),
	boundary: 'Presentation capabilities may rank or present an approved candidate set. They may not create product roles, merchant relationships, provider eligibility, plans, or portal purchase authority.',
} as const);

export const KIBBLE_PRODUCT_COVERAGE_DECISION = Object.freeze({
	additionalProductsNeededNow: false,
	reason: 'All 35 intended shopper jobs and all seven live-in-snapshot subscription scenarios resolve to truthful candidates without inventing a product ID.',
	conditionalEvidenceForANewProduct: [
		'The provider extension seed explicitly requests a dedicated Build Your Box product if the storefront composition flow ships; its current plan borrows product 3071 only to avoid polluting a browsable PDP.',
		'The Puppy Starter, Senior, and Surf & Turf routines each name one embedded component with no matching product ID in the fixed 49-product catalog. Add a raw product only if the merchant wants one of those components sold or compared independently and supplies its real catalog record.',
	],
	falsifiers: [
		'A merchant-approved shopper job has zero current candidates.',
		'A provider-backed storefront scenario requires a dedicated purchasable product rather than a portal-only reference.',
		'The live merchant catalog supplies a real product ID for an embedded-only routine component and authorizes it for independent sale.',
		'The provider plan seed changes so a currently conflicted offer row gains an active, product-matched plan family.',
	],
} as const);

export type KibbleMerchandisingGraphCoverage = {
	readonly products: number;
	readonly categories: number;
	readonly shopperJobs: number;
	readonly routineSets: number;
	readonly routineMembershipEdges: number;
	readonly complementEdges: number;
	readonly alternativeEdges: number;
	readonly embeddedRoutineComponents: number;
	readonly pinnedOfferRows: number;
	readonly providerPlanBackedProducts: number;
	readonly conflictedPinnedOfferRows: number;
	readonly canonicalRegistryProducts: number;
	readonly subscriptionScenarios: number;
	readonly storefrontSubscriptionScenarios: number;
	readonly portalSubscriptionScenarios: number;
	readonly aislesPresentationCapabilities: number;
	readonly sourceCapabilitiesOutsideKibble: number;
};

export function kibbleMerchandisingGraphCoverage(): KibbleMerchandisingGraphCoverage {
	return {
		products: KIBBLE_MERCHANDISING_PRODUCTS.length,
		categories: new Set(KIBBLE_MERCHANDISING_PRODUCTS.map(({ categorySlug }) => categorySlug)).size,
		shopperJobs: KIBBLE_CATEGORY_SHOPPER_JOBS.length,
		routineSets: KIBBLE_ROUTINE_SETS.length,
		routineMembershipEdges: KIBBLE_MERCHANT_AUTHORED_ROUTINE_EDGES.length,
		complementEdges: KIBBLE_DERIVED_COMPLEMENT_EDGES.length,
		alternativeEdges: KIBBLE_CATALOG_DERIVED_ALTERNATIVE_EDGES.length,
		embeddedRoutineComponents: KIBBLE_ROUTINE_SETS.flatMap(({ members }) => members).filter(({ kind }) => kind === 'embedded-bundle-component').length,
		pinnedOfferRows: KIBBLE_MERCHANDISING_PRODUCTS.filter(({ entityId }) => getKibbleCatalogCapabilities(entityId)?.subscription).length,
		providerPlanBackedProducts: KIBBLE_PROVIDER_MONTHLY_PLAN_PRODUCT_IDS.length,
		conflictedPinnedOfferRows: KIBBLE_PINNED_OFFER_WITHOUT_PROVIDER_PLAN_IDS.length,
		canonicalRegistryProducts: KIBBLE_MERCHANDISING_PRODUCTS.filter(({ canonicalRegistryListed }) => canonicalRegistryListed).length,
		subscriptionScenarios: KIBBLE_SUBSCRIPTION_SCENARIOS.length,
		storefrontSubscriptionScenarios: KIBBLE_SUBSCRIPTION_SCENARIOS.filter(({ surface }) => surface === 'storefront').length,
		portalSubscriptionScenarios: KIBBLE_SUBSCRIPTION_SCENARIOS.filter(({ surface }) => surface === 'portal').length,
		aislesPresentationCapabilities: KIBBLE_AISLES_CAPABILITY_DEMOS.length,
		sourceCapabilitiesOutsideKibble: KIBBLE_SOURCE_CAPABILITIES_OUTSIDE_KIBBLE.length,
	};
}

export function assertKibbleMerchandisingGraph(): void {
	const productIds = KIBBLE_MERCHANDISING_PRODUCTS.map(({ entityId }) => entityId);
	const expectedIds = [...KIBBLE_CATALOG_ENTITY_IDS].sort((a, b) => a - b);
	const actualIds = [...productIds].sort((a, b) => a - b);
	assert(productIds.length === 49, `Expected 49 product nodes; received ${productIds.length}`);
	assert(new Set(productIds).size === 49, 'Every Kibble product ID must occur exactly once in the product registry');
	assert(JSON.stringify(actualIds) === JSON.stringify(expectedIds), 'The merchandising graph product IDs must exactly match the capability manifest');
	assert(new Set(KIBBLE_MERCHANDISING_PRODUCTS.map(({ sourceKey }) => sourceKey)).size === 49, 'Product source keys must be unique');
	assert(new Set(KIBBLE_MERCHANDISING_PRODUCTS.map(({ sku }) => sku)).size === 49, 'Product SKUs must be unique');

	for (const product of KIBBLE_MERCHANDISING_PRODUCTS) {
		assert(product.sourceCategoryId === KIBBLE_CATALOG_SOURCE_CATEGORY_IDS[product.entityId], `Category mapping drift for ${product.entityId}`);
		assert(product.sourceCategoryId === KIBBLE_CATEGORY_JOB_PROFILES[product.categorySlug].sourceCategoryId, `Category profile drift for ${product.entityId}`);
		assert(product.shopperJobIds.length > 0, `Product ${product.entityId} needs a shopper job`);
		assert(product.needStates.length > 0, `Product ${product.entityId} needs a need state`);
		assert(product.comparisonDimensions.length > 0, `Product ${product.entityId} needs comparison dimensions`);
	}

	for (const job of KIBBLE_CATEGORY_SHOPPER_JOBS) {
		assert(getKibbleProductsForShopperJob(job.id).length > 0, `Shopper job ${job.id} has no candidate`);
	}

	for (const routine of KIBBLE_ROUTINE_SETS) {
		assert(PRODUCT_BY_ID.get(routine.bundleProductId)?.categorySlug === 'bundles', `Routine ${routine.id} must use a bundle product`);
		assert(routine.members.length >= 2, `Routine ${routine.id} needs at least two members`);
		for (const member of routine.members) {
			if (member.kind === 'catalog-product') assert(PRODUCT_BY_ID.has(member.productId), `Routine ${routine.id} references unknown product ${member.productId}`);
			else assert(member.catalogProductId === null, `Embedded component ${member.componentKey} must not invent a product ID`);
		}
	}

	for (const edge of KIBBLE_MERCHANDISING_EDGES) {
		assert(edge.provenance.sourcePath.length > 0 && /^[0-9a-f]{64}$/.test(edge.provenance.sourceSha256), `Edge ${edge.id} needs source provenance`);
		for (const endpoint of [edge.from, edge.to]) {
			if (endpoint.kind === 'catalog-product') assert(PRODUCT_BY_ID.has(endpoint.productId), `Edge ${edge.id} references unknown product ${endpoint.productId}`);
		}
	}
	assert(KIBBLE_MERCHANT_AUTHORED_ROUTINE_EDGES.every(({ authority, kind }) => authority === 'merchant-authored' && kind === 'routine-member'), 'Only explicit routine membership may be labeled merchant-authored');
	assert(KIBBLE_DERIVED_COMPLEMENT_EDGES.every(({ authority }) => authority === 'derived-from-merchant-authored-routine'), 'Complement edges must disclose their derived authority');
	assert(KIBBLE_CATALOG_DERIVED_ALTERNATIVE_EDGES.every(({ authority }) => authority === 'merchant-catalog-derived'), 'Alternative edges must disclose their catalog-derived authority');

	const scenarioIds = KIBBLE_SUBSCRIPTION_SCENARIOS.map(({ id }) => id);
	assert(new Set(scenarioIds).size === 7 && scenarioIds.length === 7, 'The graph must represent seven unique live-in-snapshot subscription scenarios');
	assert(JSON.stringify([...scenarioIds].sort()) === JSON.stringify(KIBBLE_SUBSCRIPTION_CAPABILITY_DEMOS.map(({ id }) => id).sort()), 'Subscription scenarios must align with the capability manifest');
	assert(KIBBLE_CAPABILITY_MANIFEST_ALIGNMENT.presentationCapabilityIds.length === 6, 'The graph boundary must align with six Aisles presentation capabilities');
	assert(KIBBLE_CAPABILITY_MANIFEST_ALIGNMENT.sourceCapabilitiesOutsideKibble.length === 7, 'The graph boundary must preserve seven explicitly not-claimed source capabilities');
	for (const scenario of KIBBLE_SUBSCRIPTION_SCENARIOS) {
		assert(scenario.candidates.length > 0, `Subscription scenario ${scenario.id} has no truthful candidate`);
		if (scenario.surface === 'portal') assert(scenario.candidates.every(({ catalogPurchaseAllowed }) => !catalogPurchaseAllowed), `Portal scenario ${scenario.id} leaked into catalog purchase evidence`);
		else assert(scenario.candidates.every(({ catalogPurchaseAllowed }) => catalogPurchaseAllowed), `Storefront scenario ${scenario.id} lacks purchase evidence`);
	}
	for (const productId of KIBBLE_PINNED_OFFER_WITHOUT_PROVIDER_PLAN_IDS) {
		assert(getKibbleCatalogPurchaseEvidence(productId) === null, `Conflicted offer product ${productId} must not become purchase evidence`);
	}
	for (const product of KIBBLE_MERCHANDISING_PRODUCTS) {
		const purchaseEvidence = getKibbleCatalogPurchaseEvidence(product.entityId);
		if (!purchaseEvidence) continue;
		assert(!purchaseEvidence.capabilityIds.some((capability) => capability === ('prepaid' as KibbleStorefrontSubscriptionCapability) || capability === ('gift' as KibbleStorefrontSubscriptionCapability) || capability === ('build-a-box' as KibbleStorefrontSubscriptionCapability)), `Portal capability leaked for ${product.entityId}`);
	}
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(`[kibble-merchandising-graph] ${message}`);
}

assertKibbleMerchandisingGraph();
