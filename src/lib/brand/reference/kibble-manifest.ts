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
			'apps/storefront-svelte/src/lib/brand/bundle-contents.json',
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
		exactSourceCopy: ['home.ctas', 'home.featured', 'home.categories'] as const,
		approvedBoundedDivergences: [
			{ field: 'home.hero.eyebrow', reason: 'Removes the unverified kept-in-stock operational claim.' },
			{ field: 'home.hero.headline', reason: 'Removes the unimplemented never-lapses refill promise while retaining the reference brand position.' },
			{ field: 'home.hero.body', reason: 'Retains the pinned brand and category framing without shipping, savings, cadence, or control claims.' },
			{ field: 'home.serviceProof', reason: 'Replaces unverified commerce promises with bounded merchant-facing copy derived from the pinned category framing and current catalog configuration.' },
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
			id: 'essential-bundle-kns4',
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
