import { createHash } from 'node:crypto';
import { KIBBLE_REFERENCE_CONTRACT } from './kibble';

/**
 * Authored inputs copied from the approved Kibble reference revision.
 *
 * `display` contains only reference copy and demo commerce data that the
 * Preserve adapter is allowed to materialize. Operational claims from the
 * source storefront remain documented under `withheldSourceClaims`; they are
 * deliberately not runtime inputs because Aisles cannot verify them.
 */
export const KIBBLE_PRESERVE_MANIFEST = {
	id: 'kibble-preserve-home-v1',
	version: '1.0.0',
	source: {
		commit: KIBBLE_REFERENCE_CONTRACT.source.commit,
		paths: [
			'apps/storefront-svelte/src/routes/+page.svelte',
			'apps/storefront-svelte/src/lib/brand/home-media.json',
			...KIBBLE_REFERENCE_CONTRACT.recipes.pdp.source.dependencyClosure.adapted.map(({ path }) => path),
			KIBBLE_REFERENCE_CONTRACT.source.fixturePath,
		] as const,
	},
	recipe: [
		'opening-merchandising',
		'ranked-products',
		'catalog-entry',
		'service-proof',
	] as const,
	copyProvenance: {
		exactSourceCopy: ['home.ctas', 'home.featured', 'home.categories', 'pdp.bundleContents'] as const,
		approvedBoundedDivergences: [
			{ field: 'home.hero.eyebrow', reason: 'Removes the unverified kept-in-stock operational claim.' },
			{ field: 'home.hero.headline', reason: 'Removes the unimplemented never-lapses refill promise while retaining the reference brand position.' },
			{ field: 'home.hero.body', reason: 'Retains the pinned brand and category framing without shipping, savings, cadence, or control claims.' },
			{ field: 'home.serviceProof', reason: 'Replaces unverified commerce promises with bounded merchant-facing copy derived from the pinned category framing and current catalog configuration.' },
			{ field: 'pdp.purchaseUnavailable', reason: 'The pinned source provides purchase controls. Aisles cannot transact, so the contracted difference states that boundary instead of imitating a purchasable flow.' },
		] as const,
	},
	display: {
		chrome: {
			skipLabel: 'Skip to main content',
			statusLabel: 'Repeat-purchase catalog',
			catalogLabel: 'Catalog navigation',
			catalogEmptyLabel: 'Catalog unavailable',
			searchLabel: 'Search',
			searchPlaceholder: 'Search products',
			searchUnavailableLabel: 'Search unavailable in this preview',
			accountLabel: 'Account',
			savedPicksLabel: 'Saved picks',
			cartLabel: 'Cart',
			cartUnavailableLabel: 'Cart unavailable',
			browseAllLabel: 'Browse all',
			footerTagline: 'Independent pet brands, organized for repeat-purchase routines.',
			footerGroups: [
				{ label: 'Food & wellness', categorySlugs: ['dog-food', 'supplements', 'treats'] },
				{ label: 'Care & gear', categorySlugs: ['grooming', 'toys', 'walk-gear', 'beds-apparel'] },
				{ label: 'Bundles', categorySlugs: ['bundles'] },
			],
		},
		home: {
			hero: {
				eyebrow: 'The brands on your shelf · kept in view',
				headline: 'The brands worth trusting, organized around your routine.',
				body: 'Open Farm, Native Pet, Wild One, and Finn — organized around food, wellness, care, gear, and repeat-purchase routines.',
				ctas: [
					{ label: 'Shop Bundles', categorySlug: 'bundles', primary: true },
					{ label: 'Browse the catalog', categorySlug: 'dog-food', primary: false },
				],
			},
			featured: {
				eyebrow: 'Catalog',
				titleWhenFeatured: 'Featured',
				titleWhenNewest: 'New arrivals',
				titleWhenDeterministic: 'Catalog shelf',
				browseAllLabel: 'Browse Dog Food',
			},
			categories: {
				eyebrow: 'Browse',
				title: 'Shop by category',
			},
			serviceProof: [
				{ title: 'Independent brands', body: 'Browse pet brands across food, wellness, care, gear, and bundles.' },
				{ title: 'Clear shopping paths', body: 'Each category opens a focused shelf for the products you came to find.' },
				{ title: 'Current catalog', body: 'Product names, prices, and images come from the current storefront catalog.' },
			],
		},
		featuredBundle: {
			entityId: 3065,
			name: 'Essential Bundle',
			category: 'Bundles',
			image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/PLP-Images_GoodGut_Beef_1.png',
			oneTimePrice: 109,
			contents: [
				{ brand: 'Open Farm', role: 'Premium dry food' },
				{ brand: 'Open Farm', role: 'Wet food variety pack' },
				{ brand: 'Finn', role: 'Dental chews' },
			],
			eyebrow: 'Featured bundle',
			ctaLabel: 'Browse bundles',
			target: '/category/bundles',
		},
		categories: [
			{ configSlug: 'dog-food', sourceSlug: 'dog-food', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/PLP-Images_GoodGut_Beef_1.png' },
			{ configSlug: 'supplements', sourceSlug: 'supplements-wellness', image: 'https://cdn.shopify.com/s/files/1/2715/7980/files/NP-DTC-MainImages_Format-GutWell-PowerPoop_ef2ee5fc-babf-4b40-8996-19cfa08d26ec.png' },
			{ configSlug: 'treats', sourceSlug: 'treats-chews', image: 'https://cdn.shopify.com/s/files/1/0268/9649/8770/files/Finn_Plaque_Patrol_Chew_M_L_Final.png' },
			{ configSlug: 'grooming', sourceSlug: 'grooming-care', image: 'https://cdn.shopify.com/s/files/1/0268/9649/8770/files/Finn_Fur_Hero_Listing_Image_Front-1.png' },
			{ configSlug: 'toys', sourceSlug: 'toys', image: 'https://cdn.shopify.com/s/files/1/0011/7532/2687/products/WO_VM_Studio_PDP_Toys_TennisTumble_4-Pack_Blush_01_4x5_Web.jpg' },
			{ configSlug: 'walk-gear', sourceSlug: 'walk-gear', image: 'https://cdn.shopify.com/s/files/1/0011/7532/2687/files/WO_VM_Harness_Bubblegum_PDP_01_4x5_Web_d053bc97-f3b3-420b-bc06-87f46c179ed2.jpg' },
			{ configSlug: 'beds-apparel', sourceSlug: 'beds-apparel', image: 'https://cdn.shopify.com/s/files/1/0389/5389/products/davos-bed-694644.png' },
			{ configSlug: 'bundles', sourceSlug: 'bundles', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/PLP-Images_GoodGut_Beef_1.png' },
		] as const,
		plp: {
			eyebrow: 'Catalog',
			breadcrumbHomeLabel: 'Home',
			sortLabel: 'Sort:',
			loadMoreLabel: 'Load more',
			productSingular: 'product',
			productPlural: 'products',
			emptyMessage: 'No products are currently available in this category.',
		},
		pdp: {
			breadcrumbHomeLabel: 'Home',
			purchaseUnavailableLabel: 'Purchase unavailable in this preview',
			purchaseUnavailableBody: 'This reference-preserved catalog can show verified product details, but ordering, cart, and subscription services are not available here.',
			relatedHeading: 'You may also like',
			copy: {
				breadcrumbLabel: 'Breadcrumb', galleryLabel: 'images', galleryImagesLabel: 'Product images', viewImageLabel: 'View image', imageUnavailableLabel: 'Product image unavailable', priceLabel: 'Catalog price', skuLabel: 'SKU', inStockLabel: 'In stock', outOfStockLabel: 'Out of stock', availabilityUnavailableLabel: 'Availability not provided', bundleEyebrow: 'Curated kit', bundleProductSingular: 'product', bundleProductPlural: 'products', bundleContentsHeading: "What's in this kit", optionsLegend: 'Catalog options', requiredSuffix: '(required)', detailsHeading: 'Details',
			},
			// Safe projection of the pinned canonical bundle manifest. Unsupported
			// subscription, subscribe-price, and savings fields are intentionally absent.
			bundles: {
				'essential-bundle-kns4': {
					name: 'Essential Bundle',
					contents: [
						{ brand: 'Open Farm', title: 'GoodGut Grass-Fed Beef Dog Kibble', role: 'Premium dry food', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/PLP-Images_GoodGut_Beef_1.png' },
						{ brand: 'Open Farm', title: 'Rustic Stew Variety Pack for Dogs', role: 'Wet food variety pack', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/OFP-Dog-PLP-RustucStew-VarietyPack_548x768copy.png' },
						{ brand: 'Finn', title: 'Plaque Patrol Dental Chews', role: 'Dental chews', image: 'https://cdn.shopify.com/s/files/1/0268/9649/8770/files/Finn_Plaque_Patrol_Chew_M_L_Final.png' },
					],
				},
				'advanced-bundle-8kfv': {
					name: 'Advanced Bundle',
					contents: [
						{ brand: 'Open Farm', title: 'GoodGut Wild-Caught Salmon Dog Kibble', role: 'Complete nutrition base', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/PLP-Images_GoodGut_Salmon.png' },
						{ brand: 'Native Pet', title: 'POWER POOP', role: 'Digestive supplement', image: 'https://cdn.shopify.com/s/files/1/2715/7980/files/NP-DTC-MainImages_Format-GutWell-PowerPoop_ef2ee5fc-babf-4b40-8996-19cfa08d26ec.png' },
						{ brand: 'Finn', title: 'Multivitamin', role: 'Daily multivitamin', image: 'https://cdn.shopify.com/s/files/1/0268/9649/8770/files/Finn_Multivitamin_Supplement.png' },
						{ brand: 'Native Pet', title: 'SOCKEYE SALMON OIL', role: 'Omega-3 skin & coat oil', image: 'https://cdn.shopify.com/s/files/1/2715/7980/files/NP-DTC-MainImages_Format-SSO_066d9a18-3fea-4f4a-9e99-4f9240cd4d54.png' },
					],
				},
				'puppy-starter-kit': {
					name: 'Puppy Starter Kit',
					contents: [
						{ brand: 'Open Farm', title: 'Chicken & Salmon Freeze Dried Raw Morsels for Puppies', role: 'Breed-appropriate puppy formula', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/PDPImages-Puppy-FDRMeal_Mixer-ChickenSalmon-2024_6d017541-42e7-43fb-bfe8-0ea9054804c2.png' },
						{ brand: 'Wild One', title: 'Tennis Tumble', role: 'Interactive puzzle feeder', image: 'https://cdn.shopify.com/s/files/1/0011/7532/2687/products/WO_VM_Studio_PDP_Toys_TennisTumble_4-Pack_Blush_01_4x5_Web.jpg' },
					],
				},
				'starter-bundle-wqw9': {
					name: 'Starter Bundle',
					contents: [
						{ brand: 'Open Farm', title: 'GoodGut Harvest Chicken Dog Kibble', role: 'Everyday dry food', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/PLP-Images_GoodGut_Chicken_1.png' },
						{ brand: 'Finn', title: 'Bone Broth Plus', role: 'Meal topper', image: 'https://cdn.shopify.com/s/files/1/0268/9649/8770/files/Finn_Bone_Broth_Plus_Powder.png' },
						{ brand: 'Wild One', title: 'Organic Baked Treats', role: 'Training treats', image: 'https://cdn.shopify.com/s/files/1/0011/7532/2687/products/WO_VM_Studio_PDP_Treats_FruitSalad_Web_FlavorCopy.png' },
					],
				},
				'senior-pet-growth-bundle': {
					name: 'Senior Pet Growth Bundle',
					contents: [
						{ brand: 'Open Farm', title: 'Harvest Chicken Hearty Stew Wet Dog Food', role: 'Easy-to-eat wet food', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/OFP-Dog-PLP-Hearty_Stews-Harvest_Chicken-RENDER_548x768_5dec7b7f-640e-4e28-b395-c7225a36f8b2.png' },
						{ brand: 'Native Pet', title: 'Senior Daily', role: 'Senior daily multi-support', image: 'https://cdn.shopify.com/s/files/1/2715/7980/files/SD_main_image.jpg' },
						{ brand: 'Finn', title: 'Hip & Joint', role: 'Hip & joint support', image: 'https://cdn.shopify.com/s/files/1/0268/9649/8770/files/Finn_Hip_Joint_Supplement.png' },
					],
				},
				'treat-snack-power-set': {
					name: 'Treat & Snack Power Set',
					contents: [
						{ brand: 'Finn', title: 'Plaque Patrol Dental Chews', role: 'Dental chews', image: 'https://cdn.shopify.com/s/files/1/0268/9649/8770/files/Finn_Plaque_Patrol_Chew_M_L_Final.png' },
						{ brand: 'Native Pet', title: 'YAK CHEWS', role: 'Long-lasting yak chews', image: 'https://cdn.shopify.com/s/files/1/2715/7980/files/NP-DTC-MainImages_Format-YakChews_a7b73a7c-d9b5-461e-818e-3cd32fcef793.png' },
						{ brand: 'Wild One', title: 'Organic Baked Treats', role: 'Organic baked treats', image: 'https://cdn.shopify.com/s/files/1/0011/7532/2687/products/WO_VM_Studio_PDP_Treats_FruitSalad_Web_FlavorCopy.png' },
						{ brand: 'Finn', title: 'Bone Broth Plus', role: 'Bone broth topper', image: 'https://cdn.shopify.com/s/files/1/0268/9649/8770/files/Finn_Bone_Broth_Plus_Powder.png' },
					],
				},
				'gift-bundle': {
					name: 'Gift Bundle',
					contents: [
						{ brand: 'Open Farm', title: 'GoodGut Grass-Fed Beef Dog Kibble', role: 'Premium dry food', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/PLP-Images_GoodGut_Beef_1.png' },
						{ brand: 'Native Pet', title: 'YAK CHEWS', role: 'Yak chews', image: 'https://cdn.shopify.com/s/files/1/2715/7980/files/NP-DTC-MainImages_Format-YakChews_a7b73a7c-d9b5-461e-818e-3cd32fcef793.png' },
						{ brand: 'Finn', title: 'Bone Broth Plus', role: 'Bone broth topper', image: 'https://cdn.shopify.com/s/files/1/0268/9649/8770/files/Finn_Bone_Broth_Plus_Powder.png' },
						{ brand: 'maxbone', title: 'Enrichment Tether Toy', role: 'Play toy', image: 'https://cdn.shopify.com/s/files/1/0389/5389/files/enrichment-tether-toy-359922.jpg' },
					],
				},
				'surf-turf-limited-reserve': {
					name: 'Surf & Turf Limited Reserve',
					contents: [
						{ brand: 'Open Farm', title: 'Surf & Turf Air Dried Recipe for Dogs', role: 'Air-dried surf & turf food', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/PDPImages-Dog-Airdried-Food-SurfTurf-Hero-2024.png' },
						{ brand: 'Open Farm', title: 'Salmon & Cod Topper for Dogs', role: 'Salmon & cod topper', image: 'https://cdn.shopify.com/s/files/1/0016/2509/6305/files/PDPImages-FishToppers-SalmonCod-Dog_2024.png' },
						{ brand: 'Native Pet', title: 'SOCKEYE SALMON OIL', role: 'Sockeye salmon oil', image: 'https://cdn.shopify.com/s/files/1/2715/7980/files/NP-DTC-MainImages_Format-SSO_066d9a18-3fea-4f4a-9e99-4f9240cd4d54.png' },
						{ brand: 'Finn', title: 'Bone Broth Plus', role: 'Bone broth topper', image: 'https://cdn.shopify.com/s/files/1/0268/9649/8770/files/Finn_Bone_Broth_Plus_Powder.png' },
					],
				},
			} as const,
		},
		error: {
			eyebrow: 'Shelf status',
			headline: 'This shelf needs a moment.',
			returnLabel: 'Return to Kibble & Co.',
		},
	},
	withheldSourceClaims: [
		'Subscription GMV',
		'subscription SKU count',
		'vetted brand count',
		'engine health',
		'member savings range',
		'free US shipping',
		'30-day guarantee',
	] as const,
} as const;

/** Stable digest input for the safe eight-bundle copy, independent of object key order. */
export function hashKibblePdpBundleProjection(value: unknown): string {
	return createHash('sha256').update(JSON.stringify(toCanonicalJson(value))).digest('hex');
}

/** Fails module initialization if the copied projection drifts from its contract pin. */
export function assertKibblePdpBundleProjection(value: unknown): string {
	if (!isRecord(value) || Object.keys(value).length !== KIBBLE_REFERENCE_CONTRACT.recipes.pdp.bundleProjection.bundleCount) {
		throw new Error(`Kibble PDP bundle projection must contain exactly ${KIBBLE_REFERENCE_CONTRACT.recipes.pdp.bundleProjection.bundleCount} bundles.`);
	}
	const digest = hashKibblePdpBundleProjection(value);
	const expected = KIBBLE_REFERENCE_CONTRACT.recipes.pdp.bundleProjection.sha256;
	if (digest !== expected) {
		throw new Error(`Kibble PDP bundle projection SHA mismatch: expected ${expected}, received ${digest}.`);
	}
	return digest;
}

export const KIBBLE_PDP_BUNDLE_PROJECTION_VERIFIED_SHA256 = assertKibblePdpBundleProjection(
	KIBBLE_PRESERVE_MANIFEST.display.pdp.bundles,
);

function toCanonicalJson(value: unknown): unknown {
	if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
	if (typeof value === 'number' && Number.isFinite(value)) return value;
	if (Array.isArray(value)) return value.map(toCanonicalJson);
	if (isRecord(value)) {
		return Object.fromEntries(
			Object.keys(value)
				.sort()
				.map((key) => [key, toCanonicalJson(value[key])]),
		);
	}
	throw new Error('Kibble PDP bundle projection contains a non-JSON value.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
	if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
	const prototype = Object.getPrototypeOf(value);
	return prototype === Object.prototype || prototype === null;
}
