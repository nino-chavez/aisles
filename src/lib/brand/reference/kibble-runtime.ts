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
import { getContractSurfaceDecision } from '$lib/brand/composition-policy';
import type { Surface } from '$lib/foundation/zones';

export type MerchantRenderMode = 'reference-preserve' | 'legacy-generated';
export type KibbleFeaturedSource = 'featured' | 'newest' | 'deterministic-catalog';

export function selectMerchantRenderMode(brandId: unknown, surface: Surface | null): MerchantRenderMode {
	return getContractSurfaceDecision(brandId, surface).mode;
}

export function buildKibbleChrome(brand: BrandConfig): {
	navItems: KibbleNavItem[];
	copy: KibbleChromeCopy;
	statusLabel: string;
	statusItems: [];
	searchAction: string;
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
		searchAction: KIBBLE_PRESERVE_MANIFEST.display.chrome.searchAction,
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
	const featuredProducts = selectReferenceProducts(products, featuredBundle.entityId, 8);
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
		productHrefs: Object.fromEntries(featuredProducts.flatMap((product) => {
			const href = supportedProductHref(product);
			return href ? [[product.id, href]] : [];
		})),
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

export function materializeKibbleCategory(brand: BrandConfig, slug: string, products: Product[]) {
	assertKibbleBrand(brand);
	assertCategory(brand, slug);
	const manifestCategory = KIBBLE_PRESERVE_MANIFEST.display.categories.find((item) => item.configSlug === slug);
	if (!manifestCategory) throw new Error(`Kibble Preserve has no pinned category mapping for "${slug}".`);
	return {
		eyebrow: KIBBLE_PRESERVE_MANIFEST.display.plp.eyebrow,
		title: brand.categories[slug].displayName,
		productCount: products.length,
		productSingular: KIBBLE_PRESERVE_MANIFEST.display.plp.productSingular,
		productPlural: KIBBLE_PRESERVE_MANIFEST.display.plp.productPlural,
		emptyMessage: KIBBLE_PRESERVE_MANIFEST.display.plp.emptyMessage,
		products,
		productHrefs: Object.fromEntries(products.flatMap((product) => {
			const href = supportedProductHref(product);
			return href ? [[product.id, href]] : [];
		})),
	};
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
		['route id', product.id, expected.id],
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
		subscribePrice: expected.subscribePrice,
		oneTimePrice: expected.oneTimePrice,
		savingsPercent: expected.savingsPercent,
		contents: expected.contents.map((item) => ({ ...item })),
		eyebrow: expected.eyebrow,
		autoRefillLabel: expected.autoRefillLabel,
		savingsLabel: expected.savingsLabel,
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

function supportedProductHref(product: Product): string | null {
	return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(product.id) ? `/product/${product.id}` : null;
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
