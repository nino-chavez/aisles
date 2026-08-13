import type { BrandConfig } from '$lib/brand/config';
import type { Product } from '$lib/types';
import type {
	KibbleChromeCopy,
	KibbleFeaturedBundle,
	KibbleFeaturedCopy,
	KibbleNavItem,
	KibbleServiceProofItem,
	KibbleVisualTile,
} from '$lib/components/kibble/types';
import { KIBBLE_PRESERVE_MANIFEST } from './kibble-manifest';
import { KIBBLE_REFERENCE_CONTRACT } from './kibble';
import {
	buildKibblePlpHref,
	KIBBLE_PLP_SORT_OPTIONS,
	type KibblePlpSort,
} from './kibble-plp';
import { assertKibblePreserveRoutePolicy, getContractSurfaceDecision } from '$lib/brand/composition-policy';
import type { Surface } from '$lib/foundation/zones';

export type MerchantRenderMode =
	| 'reference-preserve'
	| 'reference-review'
	| 'reference-unavailable'
	| 'legacy-generated';
export type KibbleFeaturedSource = 'featured' | 'newest' | 'deterministic-catalog';

export function selectMerchantRenderMode(
	brandId: unknown,
	surface: Surface | null,
	options: { allowPendingReview?: boolean } = {},
): MerchantRenderMode {
	if (surface === null) return 'legacy-generated';
	const decision = getContractSurfaceDecision(brandId, surface);
	if (decision.mode !== 'reference-preserve') return decision.mode;
	assertKibblePreserveRoutePolicy(decision.policy, surface);
	if (surface === 'pdp' && !isPdpPublicationApproved(decision.policy.publicationMode)) {
		return options.allowPendingReview === true ? 'reference-review' : 'reference-unavailable';
	}
	return decision.mode;
}

export function buildKibbleChrome(brand: BrandConfig): {
	navItems: KibbleNavItem[];
	copy: KibbleChromeCopy;
	statusLabel: string;
	statusItems: [];
	searchAction?: string;
	accountHref?: string;
	cartHref?: string;
	footer: {
		brandName: string;
		tagline: string;
		footerNote: string;
		groups: Array<{ label: string; links: KibbleNavItem[] }>;
	};
} {
	assertKibbleBrand(brand);
	return {
		navItems: Object.entries(brand.categories).map(([slug, category]) => ({
			label: category.displayName,
			href: `/category/${slug}`,
		})),
		copy: { ...KIBBLE_PRESERVE_MANIFEST.display.chrome },
		statusLabel: KIBBLE_PRESERVE_MANIFEST.display.chrome.statusLabel,
		statusItems: [],
		searchAction: '/search',
		accountHref: '/account',
		cartHref: '/cart',
		footer: {
			brandName: brand.name,
			tagline: KIBBLE_PRESERVE_MANIFEST.display.chrome.footerTagline,
			footerNote: brand.footerNote,
			groups: KIBBLE_PRESERVE_MANIFEST.display.chrome.footerGroups.map((group) => ({
				label: group.label,
				links: group.categorySlugs.map((slug) => {
					assertCategory(brand, slug);
					return { label: brand.categories[slug].displayName, href: `/category/${slug}` };
				}),
			})),
		},
	};
}

export function buildKibbleHomeReference(
	brand: BrandConfig,
	products: Product[],
	featuredSource: KibbleFeaturedSource,
	bundleProduct: Product | null,
) {
	assertKibbleBrand(brand);
	const manifest = KIBBLE_PRESERVE_MANIFEST.display;
	const featuredBundle = verifyAndMaterializeBundle(bundleProduct);
	const categories = materializeCategoryTiles(brand);
	assertExactHomeShelf(products, featuredBundle.entityId);
	const featuredProducts = products;
	if (featuredProducts.length === 0) {
		throw new Error('Kibble Preserve requires at least one live catalog product for the featured shelf.');
	}

	return {
		hero: {
			eyebrow: manifest.home.hero.eyebrow,
			headline: manifest.home.hero.headline,
			body: manifest.home.hero.body,
			ctas: manifest.home.hero.ctas.map((cta) => {
				assertCategory(brand, cta.categorySlug);
				return { label: cta.label, href: `/category/${cta.categorySlug}`, primary: cta.primary };
			}),
			featured: featuredBundle,
			proofItems: [],
		},
		products: featuredProducts,
		// PDP publication is still approval-gated. Home cards remain inert until
		// the recipe and its policy both move to an approved live state.
		productHrefs: isKibblePdpPublished() ? materializeKibblePdpHrefs(featuredProducts) : {},
		categories,
		serviceProof: manifest.home.serviceProof.map((item): KibbleServiceProofItem => ({ ...item })),
		featuredCopy: {
			eyebrow: manifest.home.featured.eyebrow,
			title: featuredSource === 'featured'
				? manifest.home.featured.titleWhenFeatured
				: featuredSource === 'newest'
					? manifest.home.featured.titleWhenNewest
					: manifest.home.featured.titleWhenDeterministic,
			browseAllLabel: manifest.home.featured.browseAllLabel,
		} satisfies KibbleFeaturedCopy,
		browseHref: '/category/dog-food',
		categoryTitle: manifest.home.categories.title,
		categoryEyebrow: manifest.home.categories.eyebrow,
	};
}

function assertExactHomeShelf(products: Product[], featuredBundleEntityId: number): void {
	if (products.length > 8) throw new Error('Kibble Preserve Home shelf exceeds its eight-product capacity.');
	if (products.some(({ entityId }) => entityId === featuredBundleEntityId)) {
		throw new Error('Kibble Preserve Home shelf must not duplicate the featured bundle.');
	}
	if (new Set(products.map(({ entityId }) => entityId)).size !== products.length) {
		throw new Error('Kibble Preserve Home shelf must contain unique merchant product ids.');
	}
}

export function materializeKibbleCategory(
	brand: BrandConfig,
	slug: string,
	products: Product[],
	state: {
		sort: KibblePlpSort;
		pageInfo: { hasNextPage: boolean; endCursor: string | null };
	},
) {
	assertKibbleBrand(brand);
	assertCategory(brand, slug);
	const manifestCategory = KIBBLE_PRESERVE_MANIFEST.display.categories.find((item) => item.configSlug === slug);
	if (!manifestCategory) throw new Error(`Kibble Preserve has no pinned category mapping for "${slug}".`);
	const plp = KIBBLE_PRESERVE_MANIFEST.display.plp;
	return {
		eyebrow: plp.eyebrow,
		title: brand.categories[slug].displayName,
		breadcrumbs: [
			{ label: plp.breadcrumbHomeLabel, href: '/' },
			{ label: brand.categories[slug].displayName },
		],
		sortLabel: plp.sortLabel,
		sortOptions: KIBBLE_PLP_SORT_OPTIONS.map(({ value, label }) => ({ value, label })),
		selectedSort: state.sort,
		productCount: products.length,
		productSingular: plp.productSingular,
		productPlural: plp.productPlural,
		emptyMessage: plp.emptyMessage,
		products,
		loadMoreLabel: plp.loadMoreLabel,
		loadMoreHref: state.pageInfo.hasNextPage && state.pageInfo.endCursor
			? buildKibblePlpHref(state.sort, state.pageInfo.endCursor)
			: null,
		productHrefs: isKibblePdpPublished() ? materializeKibblePdpHrefs(products) : {},
	};
}

/** Validated PDP destinations. Publication callers must also pass the approval gate. */
export function materializeKibblePdpHrefs(products: Product[]): Record<string, string> {
	const hrefs: Record<string, string> = {};
	for (const product of products) {
		if (/^[a-z0-9][a-z0-9-]*$/.test(product.id)) hrefs[product.id] = `/product/${product.id}`;
	}
	return hrefs;
}

export function isKibblePdpPublished(): boolean {
	const decision = getContractSurfaceDecision('kibble', 'pdp');
	return decision.mode === 'reference-preserve' && isPdpPublicationApproved(decision.policy.publicationMode);
}

function isPdpPublicationApproved(publicationMode: string): boolean {
	const acceptance: string = KIBBLE_REFERENCE_CONTRACT.recipes.pdp.acceptance;
	return acceptance === 'approved' && publicationMode === 'live';
}

export function selectReferenceProducts(products: Product[], excludedEntityId: number, limit: number): Product[] {
	const unique = new Map<number, Product>();
	for (const product of products) {
		if (product.entityId !== excludedEntityId && !unique.has(product.entityId)) unique.set(product.entityId, product);
	}
	return [...unique.values()].slice(0, limit);
}

export function verifyAndMaterializeBundle(product: Product | null): KibbleFeaturedBundle & { entityId: number } {
	const expected = KIBBLE_PRESERVE_MANIFEST.display.featuredBundle;
	if (!product) throw new Error(`Kibble Preserve requires live BigCommerce product ${expected.entityId} (${expected.name}).`);
	const checks: Array<[string, unknown, unknown]> = [
		['entity id', product.entityId, expected.entityId],
		['name', product.name, expected.name],
		['category', product.category, expected.category],
		['list price', product.price, expected.oneTimePrice],
	];
	const mismatch = checks.find(([, actual, wanted]) => actual !== wanted);
	if (mismatch) {
		const [field, actual, wanted] = mismatch;
		throw new Error(`Kibble Preserve bundle mismatch for ${field}: expected ${String(wanted)}, received ${String(actual)}.`);
	}
	return {
		entityId: product.entityId,
		name: expected.name,
		href: expected.target,
		image: expected.image,
		imageAlt: product.imageAlt || expected.name,
		oneTimePrice: expected.oneTimePrice,
		contents: expected.contents.map((item) => ({ ...item })),
		eyebrow: expected.eyebrow,
		ctaLabel: expected.ctaLabel,
	};
}

function materializeCategoryTiles(brand: BrandConfig): KibbleVisualTile[] {
	return KIBBLE_PRESERVE_MANIFEST.display.categories.map((item) => {
		assertCategory(brand, item.configSlug);
		const category = brand.categories[item.configSlug];
		return {
			label: category.displayName,
			href: `/category/${item.configSlug}`,
			image: item.image,
			imageAlt: category.displayName,
		};
	});
}

function assertKibbleBrand(brand: BrandConfig): void {
	if (brand.id !== 'kibble') {
		throw new Error(`Kibble Preserve adapter cannot materialize brand "${brand.id}".`);
	}
}

function assertCategory(brand: BrandConfig, slug: string): void {
	if (!Object.hasOwn(brand.categories, slug)) {
		throw new Error(`Kibble Preserve requires configured category "${slug}".`);
	}
}
