/** Pure conversion from strict zone content to actual section component props. */

import type { Product } from '$lib/types';
import { ZONE_COMPONENT_SCHEMAS, type AnyZoneContent, type ZoneComponentId } from './zone-schemas';

type ProductGridProps = {
	columns: 2 | 3 | 4;
	products: Product[];
	imageRatio: 'landscape' | 'square';
	showDescription: boolean;
	showSpecs: boolean;
	showQuickAdd: boolean;
};

export type MaterializedZoneComponent =
	| { component: 'editorial-header'; props: { eyebrow: string; headline: string; body: string } }
	| { component: 'editorial-hero'; props: { image: string; eyebrow?: string; headline: string; body?: string; ctaLabel?: string; ctaHref: string; textPosition?: 'left' | 'center' | 'right' } }
	| { component: 'lifestyle-price-hero'; props: { image: string; category: string; priceLabel: string; ctaLabel: string; ctaHref: string } }
	| { component: 'product-grid'; props: ProductGridProps }
	| { component: 'product-carousel'; props: { title: string; products: Product[]; showQuickAdd: boolean } }
	| { component: 'image-gallery'; props: { images: Array<{ url: string; alt: string }>; productName: string } }
	| { component: 'category-tile-grid'; props: { sectionLabel?: string; columns: 2 | 3 | 4 | 5; tiles: Array<{ label: string; description?: string; image: string; href: string }> } }
	| { component: 'service-callouts-grid'; props: { columns: 3 | 4; callouts: Array<{ icon: string; label: string; body?: string }> } }
	| { component: 'cluster-chip-row'; props: { sectionLabel?: string; chips: Array<{ label: string; href: string }> } };

/**
 * Converts product identities into trusted catalog assets, destinations, and
 * full Product props. Missing, duplicate, or incomplete products hide the
 * whole component instead of partially rendering a different decision.
 */
export function materializeZoneComponent(
	rawContent: AnyZoneContent | unknown,
	products: readonly Product[],
): MaterializedZoneComponent | null {
	if (!rawContent || typeof rawContent !== 'object') return null;
	const component = (rawContent as { component?: unknown }).component;
	if (typeof component !== 'string' || !hasOwnComponent(component)) return null;
	const parsed = ZONE_COMPONENT_SCHEMAS[component].safeParse(rawContent);
	if (!parsed.success || !catalogIsUnambiguous(products)) return null;
	const content = parsed.data as AnyZoneContent;

	switch (content.component) {
		case 'editorial-header':
			return { component: content.component, props: content.props };
		case 'editorial-hero': {
			const product = resolveProduct(content.props.product.productId, products);
			if (!hasRenderableImage(product)) return null;
			return {
				component: content.component,
				props: {
					image: product.image,
					...(content.props.eyebrow === undefined ? {} : { eyebrow: content.props.eyebrow }),
					headline: content.props.headline,
					...(content.props.body === undefined ? {} : { body: content.props.body }),
					...(content.props.ctaLabel === undefined ? {} : { ctaLabel: content.props.ctaLabel }),
					ctaHref: productHref(product),
					...(content.props.textPosition === undefined ? {} : { textPosition: content.props.textPosition }),
				},
			};
		}
		case 'lifestyle-price-hero': {
			const product = resolveProduct(content.props.product.productId, products);
			if (!hasRenderableImage(product)) return null;
			return {
				component: content.component,
				props: {
					image: product.image,
					category: content.props.category,
					priceLabel: content.props.priceLabel,
					ctaLabel: content.props.ctaLabel,
					ctaHref: productHref(product),
				},
			};
		}
		case 'product-grid': {
			const resolved = resolveAllProducts(content.props.products, products);
			if (!resolved) return null;
			return { component: content.component, props: { ...content.props, products: resolved } };
		}
		case 'product-carousel': {
			const resolved = resolveAllProducts(content.props.products, products);
			if (!resolved) return null;
			return { component: content.component, props: { ...content.props, products: resolved } };
		}
		case 'image-gallery': {
			const product = resolveProduct(content.props.product.productId, products);
			if (!hasRenderableImage(product)) return null;
			return {
				component: content.component,
				props: {
					images: [{ url: product.image, alt: product.imageAlt || product.name }],
					productName: product.name,
				},
			};
		}
		case 'category-tile-grid': {
			const tiles: Array<{ label: string; description?: string; image: string; href: string }> = [];
			for (const tile of content.props.tiles) {
				const product = resolveProduct(tile.product.productId, products);
				if (!hasRenderableImage(product)) return null;
				tiles.push({
					label: tile.label,
					...(tile.description === undefined ? {} : { description: tile.description }),
					image: product.image,
					href: productHref(product),
				});
			}
			return {
				component: content.component,
				props: {
					...(content.props.sectionLabel === undefined ? {} : { sectionLabel: content.props.sectionLabel }),
					columns: content.props.columns,
					tiles,
				},
			};
		}
		case 'service-callouts-grid':
			return { component: content.component, props: content.props };
		case 'cluster-chip-row': {
			const chips: Array<{ label: string; href: string }> = [];
			for (const chip of content.props.chips) {
				const product = resolveProduct(chip.product.productId, products);
				if (!product) return null;
				chips.push({ label: chip.label, href: productHref(product) });
			}
			return {
				component: content.component,
				props: {
					...(content.props.sectionLabel === undefined ? {} : { sectionLabel: content.props.sectionLabel }),
					chips,
				},
			};
		}
	}
}

function hasOwnComponent(value: string): value is ZoneComponentId {
	return Object.prototype.hasOwnProperty.call(ZONE_COMPONENT_SCHEMAS, value);
}

function catalogIsUnambiguous(products: readonly Product[]): boolean {
	const identities = new Set<string>();
	for (const product of products) {
		if (!product || typeof product.id !== 'string' || product.id.trim() === '' || !Number.isInteger(product.entityId)) return false;
		for (const identity of [product.id, String(product.entityId)]) {
			if (identities.has(identity)) return false;
			identities.add(identity);
		}
	}
	return true;
}

function resolveProduct(productId: string, products: readonly Product[]): Product | undefined {
	return products.find((product) => product.id === productId || String(product.entityId) === productId);
}

function resolveAllProducts(
	refs: readonly { productId: string }[],
	products: readonly Product[],
): Product[] | null {
	const resolved = refs.map(({ productId }) => resolveProduct(productId, products));
	return resolved.every((product): product is Product => product !== undefined) ? resolved : null;
}

function hasRenderableImage(product: Product | undefined): product is Product {
	return product !== undefined && typeof product.image === 'string' && product.image.trim().length > 0;
}

function productHref(product: Product): string {
	return `/product/${encodeURIComponent(product.id)}`;
}
