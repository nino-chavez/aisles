/**
 * Zone schemas — Zod unions per zone, one entry per family in `./zones.ts`.
 *
 * The discriminator on every zone is `component`, matching the convention
 * in `$lib/schema/layout.ts`. Two schemas below (`editorial-header`,
 * `product-grid`) mirror that file's shapes exactly — they are declared
 * locally rather than imported because `$lib/schema/layout.ts` does not
 * currently export its per-component schemas (only the combined
 * `SectionSchema` union), and it is out of this port's file scope.
 *
 * The other seven components (`editorial-hero`, `lifestyle-price-hero`,
 * `image-gallery`, `product-carousel`, `category-tile-grid`,
 * `service-callouts-grid`, `cluster-chip-row`) are forward references —
 * a parallel work stream is adding the Svelte components and will extend
 * `layout.ts`'s vocabulary to match. Until that lands, they are declared
 * here as stubs that check only the `component` discriminant and accept
 * any `props` shape. Tighten them to real per-prop schemas once `layout.ts`
 * exports the real definitions — this is intentionally the same technique
 * bealls-aisles used for blocks it hadn't built yet.
 *
 * `hero-product` and `category-header` (the two other components in
 * `layout.ts`'s current vocabulary) are not referenced by any zone below:
 * both are page-scaffold content (the category route's own sort/filter
 * header; a single-product hero treatment), not zone-composed insertion
 * points, mirroring how bealls-aisles keeps its PDP scaffold blocks out of
 * the zone system entirely.
 */

import { z } from 'zod';
import type { ZoneId } from './zones';

// ─── Schemas mirrored from $lib/schema/layout.ts ────────────────────

const ProductRef = z.object({
	productId: z.string(),
	role: z.enum(['hero', 'featured', 'standard', 'compact']),
});

const EditorialHeaderSection = z.object({
	component: z.literal('editorial-header'),
	props: z.object({
		eyebrow: z.string(),
		headline: z.string(),
		body: z.string(),
	}),
});

const ProductGridSection = z.object({
	component: z.literal('product-grid'),
	props: z.object({
		columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
		products: z.array(ProductRef),
		imageRatio: z.enum(['landscape', 'square']),
		showDescription: z.boolean(),
		showSpecs: z.boolean(),
		showQuickAdd: z.boolean(),
	}),
});

// ─── Stub schemas for the seven forward-referenced components ──────

function stubBlock<C extends string>(component: C) {
	return z.object({
		component: z.literal(component),
		props: z.looseObject({}),
	});
}

const EditorialHeroStub = stubBlock('editorial-hero');
const LifestylePriceHeroStub = stubBlock('lifestyle-price-hero');
const ImageGalleryStub = stubBlock('image-gallery');
const ProductCarouselStub = stubBlock('product-carousel');
const CategoryTileGridStub = stubBlock('category-tile-grid');
const ServiceCalloutsGridStub = stubBlock('service-callouts-grid');
const ClusterChipRowStub = stubBlock('cluster-chip-row');

// ─── Per-zone schemas ──────────────────────────────────────────────

/**
 * Schema per zone family. Indexed zones (e.g. `home.featured-row`) share
 * the schema for their family — the index is bookkeeping for ordering, not
 * a separate type. Multiplicity is encoded in the registry (`./zones.ts`),
 * not here; every schema below describes ONE item, and the resolver
 * validates array-multiplicity zones' elements independently.
 */
export const ZoneSchemas = {
	// Home
	'home.hero': z.union([EditorialHeroStub, LifestylePriceHeroStub, EditorialHeaderSection]),
	'home.featured-row': z.union([ProductGridSection, ProductCarouselStub, EditorialHeaderSection]),
	'home.editorial-strip': z.union([ImageGalleryStub, EditorialHeaderSection]),
	'home.below-fold': ServiceCalloutsGridStub,

	// PLP
	'plp.editorial-header': z.union([EditorialHeroStub, EditorialHeaderSection]),
	'plp.cluster-row': ClusterChipRowStub,
	'plp.below-grid': CategoryTileGridStub,

	// PDP
	'pdp.below-description': EditorialHeaderSection,
	'pdp.related': ProductCarouselStub,
	'pdp.cross-sell': ProductCarouselStub,
	'pdp.recently-viewed': ProductCarouselStub,

	// Cart
	'cart.above-checkout-cta': ProductCarouselStub,

	// Checkout
	'checkout.assurance-strip': ServiceCalloutsGridStub,
	'checkout.last-chance-upsell': ProductCarouselStub,

	// Search
	'search.empty-state': EditorialHeaderSection,

	// Error
	'error-404.rescue': EditorialHeaderSection,
	'error-empty.rescue': EditorialHeaderSection,
} as const satisfies Record<ZoneId, z.ZodTypeAny>;

export type ZoneContent<Z extends ZoneId> = z.infer<(typeof ZoneSchemas)[Z]>;
