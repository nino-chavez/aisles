import { describe, expect, it } from 'vitest';
import { SectionSchema } from '$lib/schema/layout';
import type { Product } from '$lib/types';
import { materializeZoneComponent } from './autonomy-zone-materializer';
import { parseZoneContent, ZONE_COMPONENT_IDS, ZONE_COMPONENT_SCHEMAS, ZoneSchemas } from './zone-schemas';
import { ZONE_IDS } from './zones';

const product = (productId: string, role: 'hero' | 'featured' | 'standard' | 'compact' = 'standard') => ({ productId, role });
const fixtures = {
	'editorial-header': { component: 'editorial-header', props: { eyebrow: 'NEW', headline: 'A real headline', body: 'Grounded copy.' } },
	'editorial-hero': { component: 'editorial-hero', props: { product: product('product.a', 'hero'), eyebrow: 'NEW', headline: 'A real headline', body: 'Grounded copy.', ctaLabel: 'View product', textPosition: 'left' } },
	'lifestyle-price-hero': { component: 'lifestyle-price-hero', props: { product: product('product.a', 'hero'), category: 'DOG FOOD', priceLabel: '$29.99', ctaLabel: 'View product' } },
	'product-grid': { component: 'product-grid', props: { columns: 3, products: [product('product.a'), product('product.b'), product('product.c')], imageRatio: 'square', showDescription: false, showSpecs: false, showQuickAdd: true } },
	'product-carousel': { component: 'product-carousel', props: { title: 'Recommended', products: [product('product.a'), product('product.b'), product('product.c')], showQuickAdd: false } },
	'image-gallery': { component: 'image-gallery', props: { product: product('product.a', 'hero') } },
	'category-tile-grid': { component: 'category-tile-grid', props: { sectionLabel: 'Shop the shelf', columns: 2, tiles: [{ label: 'A', product: product('product.a') }, { label: 'B', product: product('product.b') }] } },
	'service-callouts-grid': { component: 'service-callouts-grid', props: { columns: 3, callouts: [{ icon: 'shipping', label: 'Free shipping', body: 'Every order.' }, { icon: 'returns', label: 'Easy returns' }, { icon: 'secure', label: 'Secure checkout' }] } },
	'cluster-chip-row': { component: 'cluster-chip-row', props: { sectionLabel: 'Browse', chips: [{ label: 'A', product: product('product.a') }, { label: 'B', product: product('product.b') }, { label: 'C', product: product('product.c') }] } },
} as const;

const trustedProducts: Product[] = ['a', 'b', 'c'].map((suffix, index) => ({
	id: `product.${suffix}`,
	entityId: index + 1,
	name: `Trusted product ${suffix.toUpperCase()}`,
	price: 10 + index,
	image: `https://catalog.example/product-${suffix}.jpg`,
	imageAlt: `Trusted product ${suffix.toUpperCase()}`,
	description: 'Catalog description',
	specs: {},
	tags: [],
	category: 'Trusted category',
}));

describe('zone renderer contracts', () => {
	it('covers the complete zone component union with actual LayoutRenderer props', () => {
		expect(Object.keys(fixtures)).toEqual(ZONE_COMPONENT_IDS);
		for (const componentId of ZONE_COMPONENT_IDS) {
			const fixture = fixtures[componentId];
			expect(ZONE_COMPONENT_SCHEMAS[componentId].safeParse(fixture).success, componentId).toBe(true);
			expect(SectionSchema.safeParse(fixture).success, componentId).toBe(true);
			expect(ZONE_IDS.some((zoneId) => ZoneSchemas[zoneId].safeParse(fixture).success), componentId).toBe(true);
		}
	});

	it('gives every declared Aisles zone at least one renderer-valid fixture', () => {
		for (const zoneId of ZONE_IDS) {
			expect(Object.values(fixtures).some((fixture) => ZoneSchemas[zoneId].safeParse(fixture).success), zoneId).toBe(true);
		}
	});

	it('materializes editorial heroes, galleries, tiles, and chips only through product references', () => {
		for (const componentId of ['editorial-hero', 'lifestyle-price-hero', 'image-gallery', 'category-tile-grid', 'cluster-chip-row'] as const) {
			const json = JSON.stringify(fixtures[componentId]);
			expect(json).toContain('productId');
			expect(json).not.toContain('imageAssetId');
			expect(json).not.toContain('destinationId');
			expect(json).not.toContain('http');
		}
	});

	it('materializes the complete component union to actual renderer props', () => {
		for (const componentId of ZONE_COMPONENT_IDS) {
			const materialized = materializeZoneComponent(fixtures[componentId], trustedProducts);
			expect(materialized, componentId).not.toBeNull();
			expect(materialized?.component, componentId).toBe(componentId);
		}

		expect(materializeZoneComponent(fixtures['editorial-hero'], trustedProducts)).toMatchObject({
			props: { image: 'https://catalog.example/product-a.jpg', ctaHref: '/product/product.a' },
		});
		expect(materializeZoneComponent(fixtures['image-gallery'], trustedProducts)).toMatchObject({
			props: { images: [{ url: 'https://catalog.example/product-a.jpg' }], productName: 'Trusted product A' },
		});
		const tiles = materializeZoneComponent(fixtures['category-tile-grid'], trustedProducts);
		expect(tiles?.component === 'category-tile-grid' ? tiles.props.tiles[0] : null).toMatchObject({
			image: 'https://catalog.example/product-a.jpg', href: '/product/product.a',
		});
		const chips = materializeZoneComponent(fixtures['cluster-chip-row'], trustedProducts);
		expect(chips?.component === 'cluster-chip-row' ? chips.props.chips[0] : null).toEqual({
			label: 'A', href: '/product/product.a',
		});
	});

	it('hides the full component when product materialization is incomplete or ambiguous', () => {
		expect(materializeZoneComponent(fixtures['product-carousel'], trustedProducts.slice(0, 2))).toBeNull();
		expect(materializeZoneComponent(fixtures['editorial-hero'], [{ ...trustedProducts[0], image: '' }])).toBeNull();
		expect(materializeZoneComponent(fixtures['image-gallery'], [trustedProducts[0], { ...trustedProducts[1], entityId: trustedProducts[0].entityId }])).toBeNull();
	});

	it('rejects asset, destination, URL, CSS, class, and arbitrary prop lookalikes', () => {
		expect(ZoneSchemas['home.hero'].safeParse({ component: 'editorial-hero', props: { imageAssetId: 'asset.a', headline: 'No' } }).success).toBe(false);
		expect(ZoneSchemas['home.editorial-strip'].safeParse({ component: 'image-gallery', props: { images: [{ url: 'https://example.com/a.jpg' }] } }).success).toBe(false);
		expect(ZoneSchemas['plp.below-grid'].safeParse({ ...fixtures['category-tile-grid'], props: { ...fixtures['category-tile-grid'].props, href: '/invented', css: 'x', class: 'x' } }).success).toBe(false);
		expect(ZoneSchemas['search.empty-state'].safeParse({ ...fixtures['editorial-header'], props: { ...fixtures['editorial-header'].props, headline: 'https://invented.example' } }).success).toBe(false);
		expect(ZoneSchemas['search.empty-state'].safeParse({ ...fixtures['editorial-header'], props: { ...fixtures['editorial-header'].props, body: '<style>body{display:none}</style>' } }).success).toBe(false);
	});

	it('extracts every trusted product reference after strict parsing', () => {
		const parsed = parseZoneContent('home.featured-row', fixtures['product-carousel']);
		expect(parsed).toMatchObject({ ok: true, productIds: ['product.a', 'product.b', 'product.c'] });
	});

	it.each(['unknown.zone', 'constructor', '__proto__'])('fails closed for unknown or prototype zone ID %s', (zoneId) => {
		expect(parseZoneContent(zoneId as never, fixtures['editorial-header'])).toEqual({ ok: false });
	});
});
