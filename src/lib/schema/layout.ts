import { z } from 'zod';

/**
 * Layout Schema — the contract between the AI and the renderer.
 * Descriptions kept concise to minimize prompt token usage.
 */

const ProductRef = z.object({
	productId: z.string().describe('Product ID from catalog'),
	role: z.enum(['hero', 'featured', 'standard', 'compact']).describe('Display treatment'),
});

const EditorialHeaderSection = z.object({
	component: z.literal('editorial-header'),
	props: z.object({
		eyebrow: z.string().describe('Uppercase label, e.g. "THE OFFICE EDIT"'),
		headline: z.string().describe('Editorial heading, not generic'),
		body: z.string().describe('1-2 sentences, warm and specific'),
	}),
});

const HeroProductSection = z.object({
	component: z.literal('hero-product'),
	props: z.object({
		product: ProductRef,
		showSpecs: z.boolean().describe('Show specs grid below description'),
	}),
});

const ProductGridSection = z.object({
	component: z.literal('product-grid'),
	props: z.object({
		columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).describe('2=editorial, 3-4=dense'),
		products: z.array(ProductRef).describe('Products in display order'),
		imageRatio: z.enum(['landscape', 'square']).describe('landscape=4:3, square=1:1'),
		showDescription: z.boolean().describe('Show product description'),
		showSpecs: z.boolean().describe('Show specs line'),
		showQuickAdd: z.boolean().describe('Show Add to Cart button'),
	}),
});

const CategoryHeaderSection = z.object({
	component: z.literal('category-header'),
	props: z.object({
		title: z.string().describe('Category title'),
		subtitle: z.string().optional().describe('Subtitle or count'),
		showSort: z.boolean().describe('Show sort dropdown'),
		showFilter: z.boolean().describe('Show filter button'),
	}),
});

// New section variants below. Every single-product section takes a
// ProductRef rather than a raw image URL or href: the prompt never gives
// the model real asset URLs or subcategory routes (only /product/[slug]
// and /category/[slug] exist), so image and link targets are resolved
// from the product record server-side, not authored by the model.

const EditorialHeroSection = z.object({
	component: z.literal('editorial-hero'),
	props: z.object({
		product: ProductRef.describe('Product supplying the hero image'),
		eyebrow: z.string().optional().describe('Small caps label above the headline'),
		headline: z.string().describe('Editorial heading, not generic'),
		body: z.string().optional().describe('1-2 sentences of editorial copy'),
		ctaLabel: z.string().optional().describe('Link text, e.g. "Shop the edit" — links to the product'),
		textPosition: z
			.enum(['left', 'center', 'right'])
			.optional()
			.describe('Text placement over the image, defaults to center'),
	}),
});

const LifestylePriceHeroSection = z.object({
	component: z.literal('lifestyle-price-hero'),
	props: z.object({
		product: ProductRef.describe('Product supplying the hero image'),
		category: z.string().describe('Campaign framing label, e.g. "WOMEN\'S SHOES"'),
		priceLabel: z
			.string()
			.describe(
				'Bold price callout built from the product\'s real price/salePrice, e.g. "$29.99" or "Up to 40% Off" — never invent a number',
			),
		ctaLabel: z.string().describe('Button text, e.g. "Shop Now"'),
	}),
});

const ImageGallerySection = z.object({
	component: z.literal('image-gallery'),
	props: z.object({
		product: ProductRef.describe(
			'Product to feature — catalog supplies one image per product, so the gallery thumbnail rail reuses it',
		),
	}),
});

const ProductCarouselSection = z.object({
	component: z.literal('product-carousel'),
	props: z
		.object({
			title: z.string().describe('Carousel heading, e.g. "You Might Also Like"'),
			products: z.array(ProductRef).describe('Products in scroll order'),
			showQuickAdd: z.boolean().describe('Show quick-view button'),
		})
		// Anthropic structured outputs reject minItems/maxItems in the JSON
		// schema; a refinement keeps the bound as client-side validation
		// without entering the wire schema (same pattern as the sections bound below).
		.refine((p) => p.products.length >= 3 && p.products.length <= 10, {
			message: 'product-carousel needs 3-10 products to justify horizontal scroll',
		}),
});

const CategoryTileGridSection = z.object({
	component: z.literal('category-tile-grid'),
	props: z
		.object({
			sectionLabel: z.string().optional().describe('Optional heading above the tiles'),
			columns: z.union([z.literal(2), z.literal(3), z.literal(4), z.literal(5)]).describe('Grid column count'),
			tiles: z
				.array(
					z.object({
						label: z.string().describe('Tile caption, uppercase tracking applied by the component'),
						description: z.string().optional(),
						product: ProductRef.describe('Product supplying the tile image and link target'),
					}),
				)
				.describe('One tile per product theme'),
		})
		.refine((p) => p.tiles.length >= p.columns && p.tiles.length <= p.columns * 2, {
			message: 'category-tile-grid tile count must fill 1-2 full rows at the declared column count',
		}),
});

// Fixed icon set the component recognizes; any other string renders a blank
// placeholder circle, so it is enum-constrained rather than free text.
const SERVICE_CALLOUT_ICONS = [
	'shipping',
	'returns',
	'rewards',
	'store',
	'gift',
	'quality',
	'secure',
	'support',
] as const;

const ServiceCalloutsGridSection = z.object({
	component: z.literal('service-callouts-grid'),
	props: z
		.object({
			columns: z.union([z.literal(3), z.literal(4)]).describe('Callout count must equal this column count'),
			callouts: z.array(
				z.object({
					icon: z.enum(SERVICE_CALLOUT_ICONS).describe('Fixed icon key — unknown keys render a blank placeholder'),
					label: z.string(),
					body: z.string().optional(),
				}),
			),
		})
		.refine((p) => p.callouts.length === p.columns, {
			message: 'service-callouts-grid callout count must exactly match columns (3 or 4) — a partial row leaves a visible gap',
		}),
});

const ClusterChipRowSection = z.object({
	component: z.literal('cluster-chip-row'),
	props: z
		.object({
			sectionLabel: z.string().optional().describe('Optional lowercase intro line, e.g. "outfit collections"'),
			chips: z
				.array(
					z.object({
						label: z.string().describe('Chip label — rendered uppercase by the component'),
						product: ProductRef.describe('Representative product this themed bin links to'),
					}),
				)
				.describe('Themed merchandising bins'),
		})
		.refine((p) => p.chips.length >= 3 && p.chips.length <= 8, {
			message: 'cluster-chip-row needs 3-8 themed chips',
		}),
});

// Components that show multiple products at once. A layout with none of
// these is a detail page wearing a category page's URL, not a browse surface.
const BROWSING_COMPONENTS = new Set(['product-grid', 'product-carousel', 'category-tile-grid']);

// z.union rather than z.discriminatedUnion: the discriminated form emits
// JSON-schema oneOf, which Anthropic structured outputs reject; a plain
// union emits anyOf, which is supported. Validation semantics are the same
// for these shapes.
export const SectionSchema = z.union([
	EditorialHeaderSection,
	HeroProductSection,
	ProductGridSection,
	CategoryHeaderSection,
	EditorialHeroSection,
	LifestylePriceHeroSection,
	ImageGallerySection,
	ProductCarouselSection,
	CategoryTileGridSection,
	ServiceCalloutsGridSection,
	ClusterChipRowSection,
]);

export type Section = z.infer<typeof SectionSchema>;

export const LayoutSchema = z.object({
	persona: z.enum(['gatherer', 'hunter', 'researcher', 'gifter']).describe('Detected persona'),
	reasoning: z.string().describe('Why this layout was chosen (1-2 sentences)'),
	sections: z
		.array(SectionSchema)
		// Anthropic structured outputs reject minItems/maxItems in the JSON
		// schema; refinements keep these bounds as client-side validation
		// without entering the wire schema.
		.refine((s) => s.length >= 2 && s.length <= 8, { message: 'Between 2 and 8 sections' })
		.refine((s) => s.every((section, i) => i === 0 || section.component !== s[i - 1].component), {
			message: 'No two adjacent sections may use the same component',
		})
		.refine((s) => s.some((section) => BROWSING_COMPONENTS.has(section.component)), {
			message: 'Layout must include at least one browsing section: product-grid, product-carousel, or category-tile-grid',
		})
		.describe('Ordered UI sections (2-8, varied, must include a browsing section)'),
	productOrder: z.array(z.string()).describe('Product IDs in display order'),
});

export type Layout = z.infer<typeof LayoutSchema>;
