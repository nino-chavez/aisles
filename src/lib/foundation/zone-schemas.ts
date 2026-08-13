/** Strict content schemas for every Aisles zone family. */

import { z } from 'zod';
import type { ZoneId } from './zones';

const text = (max: number) => z.string().trim().min(1).max(max);
const assetId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const productRef = z.object({ productId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/), role: z.enum(['hero', 'featured', 'standard', 'compact']) }).strict();
const editorialHeader = z.object({
	component: z.literal('editorial-header'),
	props: z.object({ eyebrow: text(80), headline: text(140), body: text(600) }).strict(),
}).strict();
const editorialHero = z.object({
	component: z.literal('editorial-hero'),
	props: z.object({ imageAssetId: assetId, eyebrow: text(80), headline: text(140), body: text(600), textPosition: z.enum(['start', 'center', 'end']) }).strict(),
}).strict();
const lifestylePriceHero = z.object({
	component: z.literal('lifestyle-price-hero'),
	props: z.object({ imageAssetId: assetId, category: text(80), priceLabel: text(40) }).strict(),
}).strict();
const productGrid = z.object({
	component: z.literal('product-grid'),
	props: z.object({ columns: z.union([z.literal(2), z.literal(3), z.literal(4)]), products: z.array(productRef).min(1).max(12), imageRatio: z.enum(['landscape', 'square']), showDescription: z.boolean(), showSpecs: z.boolean(), showQuickAdd: z.boolean() }).strict(),
}).strict();
const productCarousel = z.object({
	component: z.literal('product-carousel'),
	props: z.object({ title: text(100), products: z.array(productRef).min(1).max(12) }).strict(),
}).strict();
const imageGallery = z.object({
	component: z.literal('image-gallery'),
	props: z.object({ images: z.array(z.object({ assetId, alt: text(160) }).strict()).min(1).max(6) }).strict(),
}).strict();
const categoryTileGrid = z.object({
	component: z.literal('category-tile-grid'),
	props: z.object({ sectionLabel: text(100), columns: z.union([z.literal(2), z.literal(3), z.literal(4)]), tiles: z.array(z.object({ label: text(80), imageAssetId: assetId, destinationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/) }).strict()).min(1).max(8) }).strict(),
}).strict();
const serviceCalloutsGrid = z.object({
	component: z.literal('service-callouts-grid'),
	props: z.object({ columns: z.union([z.literal(2), z.literal(3), z.literal(4)]), callouts: z.array(z.object({ icon: z.enum(['shipping', 'returns', 'rewards', 'secure', 'quality', 'support']), label: text(80), body: text(240) }).strict()).min(1).max(4) }).strict(),
}).strict();
const clusterChipRow = z.object({
	component: z.literal('cluster-chip-row'),
	props: z.object({ sectionLabel: text(100), chips: z.array(z.object({ label: text(60), destinationId: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/) }).strict()).min(1).max(12) }).strict(),
}).strict();

/** No schema contains arbitrary props, CSS/classes, URLs, or executable fields. */
export const ZoneSchemas = {
	'home.hero': z.union([editorialHero, lifestylePriceHero, editorialHeader]),
	'home.featured-row': z.union([productGrid, productCarousel, editorialHeader]),
	'home.editorial-strip': z.union([imageGallery, editorialHeader]),
	'home.below-fold': serviceCalloutsGrid,
	'plp.editorial-header': z.union([editorialHero, editorialHeader]),
	'plp.cluster-row': clusterChipRow,
	'plp.below-grid': categoryTileGrid,
	'pdp.below-description': editorialHeader,
	'pdp.related': productCarousel,
	'pdp.cross-sell': productCarousel,
	'pdp.recently-viewed': productCarousel,
	'cart.above-checkout-cta': productCarousel,
	'checkout.assurance-strip': serviceCalloutsGrid,
	'checkout.last-chance-upsell': productCarousel,
	'search.empty-state': editorialHeader,
	'error-404.rescue': editorialHeader,
	'error-empty.rescue': editorialHeader,
} as const satisfies Record<ZoneId, z.ZodTypeAny>;

export type ZoneContent<Z extends ZoneId> = z.infer<(typeof ZoneSchemas)[Z]>;
