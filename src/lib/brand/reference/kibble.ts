import { z } from 'zod';

const RequiredString = z.string().trim().min(1);
const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

const ReferenceComponentSchema = z.object({
	id: RequiredString,
	implementation: RequiredString,
	variants: z.array(RequiredString).min(1),
	permittedProps: z.array(RequiredString).min(1),
	referenceOwned: z.array(RequiredString).min(1),
	aislesOwned: z.array(RequiredString).min(1),
}).strict();

const ReferenceRecipeSlotSchema = z.object({
	slot: RequiredString,
	component: RequiredString,
	variant: RequiredString,
	required: z.boolean(),
}).strict();

export const KibbleReferenceContractSchema = z.object({
	id: z.literal('kibble-shelf-native'),
	version: z.literal('1.0.0'),
	status: z.literal('approved-reference'),
	source: z.object({
		repository: z.literal('bc-subscriptions'),
		remote: z.literal('git@github.com:nino-chavez/bc-subscriptions.git'),
		commit: z.string().regex(/^[0-9a-f]{40}$/),
		applicationPath: RequiredString,
		brandKitPath: RequiredString,
		tokensPath: RequiredString,
		canonicalBoundary: RequiredString,
	}).strict(),
	tokens: z.object({
		colors: z.object({
			identity: HexColor,
			action: HexColor,
			actionHover: HexColor,
			autoRefill: HexColor,
			autoRefillText: HexColor,
			autoRefillInk: HexColor,
			savings: HexColor,
			premium: HexColor,
			page: HexColor,
			surface: HexColor,
			mutedSurface: HexColor,
			panel: HexColor,
			autoRefillPanel: HexColor,
			mutedText: HexColor,
			border: HexColor,
			borderStrong: HexColor,
		}).strict(),
		typography: z.object({
			display: RequiredString,
			body: RequiredString,
			machinery: RequiredString,
			displayWeight: z.literal(800),
			displayTracking: z.literal('-0.035em'),
			baseSizePx: z.literal(16),
			machineryUses: z.array(RequiredString).min(4),
		}).strict(),
		geometry: z.object({
			containerMaxPx: z.literal(1200),
			spacingBasePx: z.literal(4),
			radiiPx: z.object({
				xs: z.literal(4),
				sm: z.literal(6),
				md: z.literal(8),
				lg: z.literal(12),
				xl: z.literal(18),
			}).strict(),
			shadows: z.object({
				card: RequiredString,
				lifted: RequiredString,
				hero: RequiredString,
			}).strict(),
		}).strict(),
		density: z.object({
			name: z.literal('clinical-warm'),
			controlShape: z.literal('squared'),
			cardBorderPx: z.literal(1),
			motion: z.literal('instrument-calm'),
		}).strict(),
	}).strict(),
	chrome: z.object({
		required: z.array(z.enum([
			'engine-status-bar',
			'merchant-wordmark',
			'catalog-navigation',
			'search-control',
			'account-control',
			'cart-control',
			'mobile-drawer',
		])).min(7),
		mobileDrawerBreakpointPx: z.literal(768),
		stickyHeader: z.literal(true),
	}).strict(),
	components: z.array(ReferenceComponentSchema).min(6),
	recipes: z.object({
		home: z.object({
			id: z.literal('kibble-home-reference-v1'),
			implementation: z.literal('KibbleHomeReference.svelte'),
			orderedAnatomy: z.array(ReferenceRecipeSlotSchema).min(5),
			invariants: z.array(RequiredString).min(5),
		}).strict(),
	}).strict(),
	viewports: z.object({
		mobile: z.object({ minPx: z.literal(320), maxPx: z.literal(767), columns: z.literal(1) }).strict(),
		tablet: z.object({ minPx: z.literal(768), maxPx: z.literal(1023), columns: z.literal(2) }).strict(),
		desktop: z.object({ minPx: z.literal(1024), contentMaxPx: z.literal(1200), productColumns: z.literal(4) }).strict(),
		comparison: z.object({ widthsPx: z.tuple([z.literal(390), z.literal(768), z.literal(1280), z.literal(1440)]) }).strict(),
	}).strict(),
	ownership: z.object({
		referenceOwns: z.array(RequiredString).min(5),
		aislesOwns: z.array(RequiredString).min(4),
		forbiddenAtRuntime: z.array(RequiredString).min(4),
	}).strict(),
}).strict().superRefine((contract, ctx) => {
	const componentIds = new Set(contract.components.map((component) => component.id));
	const componentsById = new Map(contract.components.map((component) => [component.id, component]));
	if (componentIds.size !== contract.components.length) {
		ctx.addIssue({ code: 'custom', message: 'Reference component ids must be unique', path: ['components'] });
	}

	for (const [index, slot] of contract.recipes.home.orderedAnatomy.entries()) {
		if (!componentIds.has(slot.component)) {
			ctx.addIssue({
				code: 'custom',
				message: `Recipe component ${slot.component} is not registered`,
				path: ['recipes', 'home', 'orderedAnatomy', index, 'component'],
			});
			continue;
		}

		const component = componentsById.get(slot.component)!;
		const requestedVariants = slot.variant.split('+');
		if (requestedVariants.some((variant) => !component.variants.includes(variant))) {
			ctx.addIssue({
				code: 'custom',
				message: `Recipe variant ${slot.variant} is not registered for ${slot.component}`,
				path: ['recipes', 'home', 'orderedAnatomy', index, 'variant'],
			});
		}
	}
});

const contractInput = {
	id: 'kibble-shelf-native',
	version: '1.0.0',
	status: 'approved-reference',
	source: {
		repository: 'bc-subscriptions',
		remote: 'git@github.com:nino-chavez/bc-subscriptions.git',
		commit: 'a5c9555b89d72e7898d6bc1c38c7157a1c415b06',
		applicationPath: 'apps/storefront-svelte',
		brandKitPath: 'scripts/kibble-demo/data/brand/brand-kit.md',
		tokensPath: 'scripts/kibble-demo/data/brand/tokens.css',
		canonicalBoundary: 'The pinned storefront source and locked Shelf-Native kit govern this package. Screenshots are comparison evidence, not a replacement source of truth.',
	},
	tokens: {
		colors: {
			identity: '#1e2150',
			action: '#3b5bd0',
			actionHover: '#2f49b0',
			autoRefill: '#37bfa2',
			autoRefillText: '#1f9e86',
			autoRefillInk: '#0e2b25',
			savings: '#ef7a52',
			premium: '#e0a33a',
			page: '#f3f6fc',
			surface: '#ffffff',
			mutedSurface: '#e9eef7',
			panel: '#e4edfb',
			autoRefillPanel: '#dbf2eb',
			mutedText: '#5c6486',
			border: '#d6deee',
			borderStrong: '#c2cce2',
		},
		typography: {
			display: 'Plus Jakarta Sans',
			body: 'Plus Jakarta Sans',
			machinery: 'IBM Plex Mono',
			displayWeight: 800,
			displayTracking: '-0.035em',
			baseSizePx: 16,
			machineryUses: ['prices', 'percentages', 'cadence', 'savings', 'spec labels', 'eyebrows'],
		},
		geometry: {
			containerMaxPx: 1200,
			spacingBasePx: 4,
			radiiPx: { xs: 4, sm: 6, md: 8, lg: 12, xl: 18 },
			shadows: {
				card: '0 1px 3px rgba(30, 33, 80, 0.07)',
				lifted: '0 16px 40px rgba(59, 91, 208, 0.14)',
				hero: '0 24px 60px rgba(30, 33, 80, 0.16)',
			},
		},
		density: {
			name: 'clinical-warm',
			controlShape: 'squared',
			cardBorderPx: 1,
			motion: 'instrument-calm',
		},
	},
	chrome: {
		required: [
			'engine-status-bar',
			'merchant-wordmark',
			'catalog-navigation',
			'search-control',
			'account-control',
			'cart-control',
			'mobile-drawer',
		],
		mobileDrawerBreakpointPx: 768,
		stickyHeader: true,
	},
	components: [
		{
			id: 'kibble.header',
			implementation: 'KibbleHeader.svelte',
			variants: ['desktop', 'mobile-drawer'],
			permittedProps: ['brandName', 'navItems', 'autoRefillState', 'statusItems', 'cartCount', 'picksCount', 'searchAction', 'accountHref', 'cartHref', 'picksHref', 'onCartClick', 'onPicksClick'],
			referenceOwned: ['status-bar anatomy', 'wordmark treatment', 'navigation density', 'control shape', 'mobile drawer structure'],
			aislesOwned: ['navigation labels and hrefs', 'live counts', 'drawer callbacks', 'search query'],
		},
		{
			id: 'kibble.hero',
			implementation: 'KibbleHero.svelte',
			variants: ['flagship-bundle'],
			permittedProps: ['eyebrow', 'headline', 'body', 'ctas', 'featured', 'proofItems'],
			referenceOwned: ['two-column composition', 'headline measure', 'flagship bundle anatomy', 'proof-strip anatomy', 'primary and secondary CTA treatments'],
			aislesOwned: ['approved copy values', 'CTA destinations', 'featured product data', 'proof values backed by merchant data'],
		},
		{
			id: 'kibble.product-card',
			implementation: 'KibbleProductCard.svelte',
			variants: ['catalog-card', 'featured-tile', 'sale', 'auto-refill'],
			permittedProps: ['product', 'hrefPrefix', 'merchantBrand', 'autoRefill', 'presentation'],
			referenceOwned: ['square media', 'one-pixel border', 'mono price treatment', 'mint Auto-Refill seal', 'coral savings semantics'],
			aislesOwned: ['product identity', 'product imagery', 'vendor brand', 'prices', 'subscription eligibility'],
		},
		{
			id: 'kibble.featured-grid',
			implementation: 'KibbleFeaturedGrid.svelte',
			variants: ['four-column'],
			permittedProps: ['title', 'eyebrow', 'products', 'browseHref', 'subscriptionOffers'],
			referenceOwned: ['section spacing', 'four-column desktop grid', 'heading hierarchy', 'card density'],
			aislesOwned: ['ranked product set', 'section copy', 'browse destination', 'subscription offer data'],
		},
		{
			id: 'kibble.visual-module',
			implementation: 'KibbleVisualModule.svelte',
			variants: ['routine', 'category'],
			permittedProps: ['variant', 'title', 'eyebrow', 'tiles', 'columns'],
			referenceOwned: ['image-first tiles', 'solid copy band', 'card border and lift', 'responsive column behavior'],
			aislesOwned: ['approved tile set', 'tile labels', 'tile descriptions', 'image and destination'],
		},
		{
			id: 'kibble.service-proof',
			implementation: 'KibbleServiceProof.svelte',
			variants: ['three-column'],
			permittedProps: ['items'],
			referenceOwned: ['three-column anatomy', 'quiet hierarchy', 'section rule and spacing'],
			aislesOwned: ['approved proof copy', 'substantiated service claims'],
		},
	],
	recipes: {
		home: {
			id: 'kibble-home-reference-v1',
			implementation: 'KibbleHomeReference.svelte',
			orderedAnatomy: [
				{ slot: 'merchant-chrome', component: 'kibble.header', variant: 'desktop+mobile-drawer', required: true },
				{ slot: 'opening-merchandising', component: 'kibble.hero', variant: 'flagship-bundle', required: true },
				{ slot: 'ranked-products', component: 'kibble.featured-grid', variant: 'four-column', required: true },
				{ slot: 'catalog-entry', component: 'kibble.visual-module', variant: 'category', required: true },
				{ slot: 'service-proof', component: 'kibble.service-proof', variant: 'three-column', required: true },
			],
			invariants: [
				'Auto-Refill status appears before merchant navigation.',
				'The hero contains one flagship bundle, not an arbitrary collage.',
				'The segmented proof strip stays inside the hero text column.',
				'Product imagery remains uncropped enough to preserve packaging labels.',
				'Category or routine copy sits below imagery, never over product labels.',
				'Mint appears only for Auto-Refill status or the ampersand wordmark exception.',
			],
		},
	},
	viewports: {
		mobile: { minPx: 320, maxPx: 767, columns: 1 },
		tablet: { minPx: 768, maxPx: 1023, columns: 2 },
		desktop: { minPx: 1024, contentMaxPx: 1200, productColumns: 4 },
		comparison: { widthsPx: [390, 768, 1280, 1440] },
	},
	ownership: {
		referenceOwns: ['semantic token meanings', 'required chrome', 'component anatomy', 'home recipe order', 'responsive density', 'visual fallbacks'],
		aislesOwns: ['catalog and subscription data', 'ranking within approved slots', 'approved bounded copy values', 'navigation destinations', 'interaction callbacks'],
		forbiddenAtRuntime: ['inventing CSS', 'inventing component variants', 'reordering Preserve recipe slots', 'using mint outside Auto-Refill status and the wordmark exception', 'overlaying copy on packaging labels'],
	},
} as const;

export type KibbleReferenceContract = z.infer<typeof KibbleReferenceContractSchema>;

/**
 * Parsed at module load so an incomplete edit fails before a route can select
 * the reference. This package is data-only until route integration lands.
 */
export const KIBBLE_REFERENCE_CONTRACT: KibbleReferenceContract =
	KibbleReferenceContractSchema.parse(contractInput);
