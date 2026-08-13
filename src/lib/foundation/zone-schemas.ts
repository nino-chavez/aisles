/** Strict, renderer-compatible content schemas for every Aisles zone family. */

import { z } from 'zod';
import { ZONES, type ZoneId, type ZoneMetadata } from './zones';

const forbiddenAuthoredText = /(?:https?:\/\/|data:|javascript:|<style\b|\bstyle\s*=|\bclass\s*=|url\s*\()/i;
const text = (max: number) => z.string().trim().min(1).max(max).refine(
	(value) => !forbiddenAuthoredText.test(value),
	{ message: 'raw URLs, styles, and classes are not zone-authored text' },
);
const safeId = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/);
const productRef = z.object({
	productId: safeId,
	role: z.enum(['hero', 'featured', 'standard', 'compact']),
}).strict();

const editorialHeader = z.object({
	component: z.literal('editorial-header'),
	props: z.object({ eyebrow: text(80), headline: text(140), body: text(600) }).strict(),
}).strict();
const editorialHero = z.object({
	component: z.literal('editorial-hero'),
	props: z.object({
		product: productRef,
		eyebrow: text(80).optional(),
		headline: text(140),
		body: text(600).optional(),
		ctaLabel: text(80).optional(),
		textPosition: z.enum(['left', 'center', 'right']).optional(),
	}).strict(),
}).strict();
const lifestylePriceHero = z.object({
	component: z.literal('lifestyle-price-hero'),
	props: z.object({ product: productRef, category: text(80), priceLabel: text(40), ctaLabel: text(80) }).strict(),
}).strict();
const productGrid = z.object({
	component: z.literal('product-grid'),
	props: z.object({
		columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
		products: z.array(productRef).min(1).max(12),
		imageRatio: z.enum(['landscape', 'square']),
		showDescription: z.boolean(),
		showSpecs: z.boolean(),
		showQuickAdd: z.boolean(),
	}).strict(),
}).strict();
const productCarousel = z.object({
	component: z.literal('product-carousel'),
	props: z.object({
		title: text(100),
		products: z.array(productRef).min(3).max(10),
		showQuickAdd: z.boolean(),
	}).strict(),
}).strict();
const imageGallery = z.object({
	component: z.literal('image-gallery'),
	props: z.object({ product: productRef }).strict(),
}).strict();
const categoryTileGrid = z.object({
	component: z.literal('category-tile-grid'),
	props: z.object({
		sectionLabel: text(100).optional(),
		columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
		tiles: z.array(z.object({
			label: text(80),
			description: text(240).optional(),
			product: productRef,
		}).strict()).min(2).max(10),
	}).strict().superRefine((props, ctx) => {
		if (props.tiles.length < props.columns || props.tiles.length > props.columns * 2) {
			ctx.addIssue({ code: 'custom', message: 'tiles must fill one or two complete-width rows' });
		}
	}),
}).strict();
const serviceCalloutsGrid = z.object({
	component: z.literal('service-callouts-grid'),
	props: z.object({
		columns: z.union([z.literal(3), z.literal(4)]),
		callouts: z.array(z.object({
			icon: z.enum(['shipping', 'returns', 'rewards', 'store', 'gift', 'quality', 'secure', 'support']),
			label: text(80),
			body: text(240).optional(),
		}).strict()).min(3).max(4),
	}).strict().superRefine((props, ctx) => {
		if (props.callouts.length !== props.columns) {
			ctx.addIssue({ code: 'custom', message: 'callouts must exactly match columns' });
		}
	}),
}).strict();
const clusterChipRow = z.object({
	component: z.literal('cluster-chip-row'),
	props: z.object({
		sectionLabel: text(100).optional(),
		chips: z.array(z.object({ label: text(60), product: productRef }).strict()).min(3).max(8),
	}).strict(),
}).strict();

/** These are the complete component variants a zone may materialize. */
export const ZONE_COMPONENT_SCHEMAS = {
	'editorial-header': editorialHeader,
	'editorial-hero': editorialHero,
	'lifestyle-price-hero': lifestylePriceHero,
	'product-grid': productGrid,
	'product-carousel': productCarousel,
	'image-gallery': imageGallery,
	'category-tile-grid': categoryTileGrid,
	'service-callouts-grid': serviceCalloutsGrid,
	'cluster-chip-row': clusterChipRow,
} as const;

export type ZoneComponentId = keyof typeof ZONE_COMPONENT_SCHEMAS;
export const ZONE_COMPONENT_IDS = Object.keys(ZONE_COMPONENT_SCHEMAS) as ZoneComponentId[];

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
export type AnyZoneContent = ZoneContent<ZoneId>;

export type ParsedZoneContent =
	| { ok: true; content: AnyZoneContent | AnyZoneContent[] | null; productIds: readonly string[] }
	| { ok: false };

/** Shared executor/resolver validation, including multiplicity and trusted product references. */
export function parseZoneContent(zoneId: ZoneId, raw: unknown): ParsedZoneContent {
	if (
		!Object.prototype.hasOwnProperty.call(ZONES, zoneId) ||
		!Object.prototype.hasOwnProperty.call(ZoneSchemas, zoneId)
	) return { ok: false };
	if (raw === null) return { ok: true, content: null, productIds: [] };
	const metadata = ZONES[zoneId] as ZoneMetadata;
	const schema = ZoneSchemas[zoneId];
	if (metadata.multiplicity === 'array') {
		if (!Array.isArray(raw) || (metadata.maxItems !== undefined && raw.length > metadata.maxItems)) return { ok: false };
		const content: AnyZoneContent[] = [];
		for (const item of raw) {
			const parsed = schema.safeParse(item);
			if (!parsed.success) return { ok: false };
			content.push(parsed.data as AnyZoneContent);
		}
		return { ok: true, content, productIds: collectProductIds(content) };
	}
	const parsed = schema.safeParse(raw);
	return parsed.success
		? { ok: true, content: parsed.data as AnyZoneContent, productIds: collectProductIds(parsed.data) }
		: { ok: false };
}

function collectProductIds(value: unknown): string[] {
	const ids: string[] = [];
	const visit = (candidate: unknown): void => {
		if (Array.isArray(candidate)) {
			for (const item of candidate) visit(item);
			return;
		}
		if (!candidate || typeof candidate !== 'object') return;
		const record = candidate as Record<string, unknown>;
		if (typeof record.productId === 'string') ids.push(record.productId);
		for (const child of Object.values(record)) visit(child);
	};
	visit(value);
	return [...new Set(ids)];
}
