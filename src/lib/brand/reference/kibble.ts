import { z } from 'zod';
import { KIBBLE_PLP_PAGE_SIZE, KIBBLE_PLP_SORT_OPTIONS } from './kibble-plp';

const RequiredString = z.string().trim().min(1);
const UniqueRequiredStrings = z.array(RequiredString).min(1).superRefine((values, ctx) => {
	if (new Set(values).size !== values.length) {
		ctx.addIssue({ code: 'custom', message: 'Entries must be unique' });
	}
});
const UniqueStrings = z.array(RequiredString).superRefine((values, ctx) => {
	if (new Set(values).size !== values.length) ctx.addIssue({ code: 'custom', message: 'Entries must be unique' });
});
const HexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

export const KIBBLE_PDP_BOUNDS = {
	arrays: {
		breadcrumbs: 3,
		images: 10,
		options: 10,
		optionValues: 25,
		relatedProducts: 4,
		customFields: 10,
		categories: 5,
		bundleContents: 4,
	},
	strings: {
		routeId: 128,
		assetUrl: 2048,
		imageAlt: 160,
		categoryPath: 256,
	},
} as const;

export const KIBBLE_PDP_RICH_DESCRIPTION_TAGS = [
	'p', 'br', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li', 'a',
] as const;
export const KIBBLE_PDP_SUPPORTED_CURRENCIES = ['USD'] as const;

const CopyFieldSchema = z.object({
	field: RequiredString,
	maxLength: z.number().int().positive(),
	sourceClasses: z.array(z.enum(['reference-copy', 'merchant-catalog', 'merchant-policy', 'computed-fact'])).min(1),
}).strict();

const ReferenceVariantSchema = z.object({
	id: z.string().regex(/^kibble\.[a-z0-9-]+\.[a-z0-9-]+$/),
	cssVariantIds: UniqueRequiredStrings,
	dynamicPropFields: UniqueRequiredStrings,
	assetSlots: UniqueStrings,
	linkTargets: UniqueStrings,
	actionTargets: UniqueStrings,
	copyFields: z.array(CopyFieldSchema).superRefine((values, ctx) => {
		if (new Set(values.map(({ field }) => field)).size !== values.length) ctx.addIssue({ code: 'custom', message: 'Copy fields must be unique' });
	}),
}).strict();

const ReferenceComponentSchema = z.object({
	id: z.string().regex(/^kibble\.[a-z0-9-]+$/),
	implementation: RequiredString,
	variants: z.array(ReferenceVariantSchema).min(1),
	referenceOwned: UniqueRequiredStrings,
	aislesOwned: UniqueRequiredStrings,
}).strict();

const ReferenceRecipeSlotSchema = z.object({
	slot: RequiredString,
	component: RequiredString,
	variantId: RequiredString,
	required: z.boolean(),
	owner: z.enum(['root-layout', 'home-recipe']),
}).strict();

const REQUIRED_CHROME = [
	'autorefill-status-bar',
	'merchant-wordmark',
	'catalog-navigation',
	'search-control',
	'account-control',
	'cart-control',
	'mobile-drawer',
	'merchant-footer',
] as const;

const REGISTRY = {
	cssVariantIds: [
		'kc.header.desktop', 'kc.header.mobile-drawer', 'kc.hero.flagship-bundle',
		'kc.product-card.catalog-card', 'kc.product-card.featured-tile', 'kc.product-card.sale',
		'kc.product-card.auto-refill', 'kc.featured-grid.four-column', 'kc.visual-module.routine',
		'kc.visual-module.category', 'kc.service-proof.three-column', 'kc.footer.four-column',
		'kc.category-listing.fixed-grid', 'kc.product-detail.catalog-display-only', 'kc.error.reference-shell',
	],
	assetSlots: ['featured.image', 'product.image', 'product.gallery', 'tile.image'],
	linkTargets: ['home', 'catalog-category', 'search-results', 'account', 'cart', 'saved-picks', 'product-detail', 'featured-bundle', 'browse-all', 'visual-tile'],
	actionTargets: ['open-mobile-navigation', 'close-mobile-navigation', 'open-search', 'close-search', 'open-cart-drawer', 'open-picks-tray'],
} as const;

export const KibbleReferenceContractSchema = z.object({
	id: z.literal('kibble-shelf-native'),
	version: z.literal('1.5.0'),
	status: z.literal('approved-reference'),
		source: z.object({
		repository: z.literal('bc-subscriptions'),
		remote: z.literal('git@github.com:nino-chavez/bc-subscriptions.git'),
		commit: z.string().regex(/^[0-9a-f]{40}$/),
		applicationPath: RequiredString,
		brandKitPath: RequiredString,
			tokensPath: RequiredString,
			fixturePath: RequiredString,
			fixtureSha256: z.string().regex(/^[0-9a-f]{64}$/),
		canonicalBoundary: RequiredString,
	}).strict(),
	tokens: z.object({
		colors: z.object({
			identity: HexColor, action: HexColor, actionHover: HexColor,
			autoRefill: HexColor, autoRefillText: HexColor, autoRefillInk: HexColor,
			savings: HexColor, premium: HexColor, page: HexColor, surface: HexColor,
			mutedSurface: HexColor, panel: HexColor, autoRefillPanel: HexColor,
			mutedText: HexColor, border: HexColor, borderStrong: HexColor,
		}).strict(),
		typography: z.object({
			display: RequiredString, body: RequiredString, machinery: RequiredString,
			displayWeight: z.literal(800), displayTracking: z.literal('-0.035em'),
			baseSizePx: z.literal(16), machineryUses: UniqueRequiredStrings,
		}).strict(),
		geometry: z.object({
			containerMaxPx: z.literal(1200), spacingBasePx: z.literal(4),
			radiiPx: z.object({ xs: z.literal(4), sm: z.literal(6), md: z.literal(8), lg: z.literal(12), xl: z.literal(18) }).strict(),
			shadows: z.object({ card: RequiredString, lifted: RequiredString, hero: RequiredString }).strict(),
		}).strict(),
		density: z.object({
			name: z.literal('clinical-warm'), controlShape: z.literal('squared'),
			cardBorderPx: z.literal(1), motion: z.literal('instrument-calm'),
		}).strict(),
	}).strict(),
	chrome: z.object({
		required: z.tuple(REQUIRED_CHROME.map((entry) => z.literal(entry)) as [z.ZodLiteral<'autorefill-status-bar'>, z.ZodLiteral<'merchant-wordmark'>, z.ZodLiteral<'catalog-navigation'>, z.ZodLiteral<'search-control'>, z.ZodLiteral<'account-control'>, z.ZodLiteral<'cart-control'>, z.ZodLiteral<'mobile-drawer'>, z.ZodLiteral<'merchant-footer'>]),
		owner: z.literal('root-layout'),
		mobileDrawerBreakpointPx: z.literal(1024),
		stickyHeader: z.literal(true),
	}).strict(),
	adapter: z.object({
		links: z.object({
			allowed: z.array(z.enum(REGISTRY.linkTargets)).length(REGISTRY.linkTargets.length),
			optional: z.tuple([z.literal('account'), z.literal('cart'), z.literal('saved-picks')]),
		}).strict(),
		actions: z.object({ allowed: z.array(z.enum(REGISTRY.actionTargets)).length(REGISTRY.actionTargets.length) }).strict(),
		failClosed: z.literal(true),
	}).strict(),
	registry: z.object({
		cssVariantIds: z.array(z.enum(REGISTRY.cssVariantIds)).length(REGISTRY.cssVariantIds.length),
		assetSlots: z.array(z.enum(REGISTRY.assetSlots)).length(REGISTRY.assetSlots.length),
		linkTargets: z.array(z.enum(REGISTRY.linkTargets)).length(REGISTRY.linkTargets.length),
		actionTargets: z.array(z.enum(REGISTRY.actionTargets)).length(REGISTRY.actionTargets.length),
	}).strict(),
	components: z.array(ReferenceComponentSchema).min(7),
	recipes: z.object({
		home: z.object({
			id: z.literal('kibble-home-reference-v1'),
			acceptance: z.literal('approved'),
			implementation: z.literal('KibbleHomeReference.svelte'),
			rootLayoutChrome: z.literal('kibble.header'),
			rootLayoutFooter: z.literal('kibble.footer'),
			orderedAnatomy: z.array(ReferenceRecipeSlotSchema).min(5),
			invariants: UniqueRequiredStrings,
		}).strict(),
		plp: z.object({
			id: z.literal('kibble-plp-reference-v1'),
			acceptance: z.literal('approved'),
			implementation: z.literal('KibbleCategoryReference.svelte'),
			variantId: z.literal('kibble.category-listing.fixed-grid'),
			source: z.object({
				commit: z.literal('ef122b8e17b9eb0b327c9d42491c44a61577ead4'),
				paths: z.tuple([
					z.literal('apps/storefront-svelte/src/routes/category/[slug]/+page.server.ts'),
					z.literal('apps/storefront-svelte/src/routes/category/[slug]/+page.svelte'),
					z.literal('apps/storefront-svelte/src/lib/server/catalog.ts'),
				]),
			}).strict(),
			orderedAnatomy: z.tuple([
				z.literal('breadcrumbs'),
				z.literal('category-header'),
				z.literal('sort-control'),
				z.literal('product-grid'),
				z.literal('cursor-continuation'),
			]),
			sortChoices: z.array(z.object({ value: RequiredString, label: RequiredString }).strict()).length(KIBBLE_PLP_SORT_OPTIONS.length),
			defaultSort: z.literal('FEATURED'),
			pageSize: z.literal(KIBBLE_PLP_PAGE_SIZE),
			pagination: z.object({ strategy: z.literal('forward-cursor'), cursorParam: z.literal('after'), actionLabel: z.literal('Load more') }).strict(),
			productCards: z.literal('noninteractive-until-pdp-approved'),
			modelLayoutRequest: z.literal(false),
			invariants: UniqueRequiredStrings,
		}).strict(),
		pdp: z.object({
			id: z.literal('kibble-pdp-reference-v1'),
			acceptance: z.literal('implemented-pending-visual-approval'),
			implementation: z.literal('KibbleProductDetailReference.svelte'),
			variantId: z.literal('kibble.product-detail.catalog-display-only'),
			source: z.object({
				commit: z.literal('ef122b8e17b9eb0b327c9d42491c44a61577ead4'),
				paths: z.tuple([
					z.literal('apps/storefront-svelte/src/routes/products/[slug]/+page.server.ts'),
					z.literal('apps/storefront-svelte/src/routes/products/[slug]/+page.svelte'),
					z.literal('apps/storefront-svelte/src/lib/components/ProductGallery.svelte'),
					z.literal('apps/storefront-svelte/src/lib/components/RelatedProducts.svelte'),
					z.literal('apps/storefront-svelte/src/lib/brand/bundle-contents.json'),
				]),
			}).strict(),
			orderedAnatomy: z.tuple([
				z.literal('breadcrumbs'), z.literal('media-gallery'), z.literal('product-identity'),
				z.literal('conditional-bundle-summary'), z.literal('catalog-price-and-availability'),
				z.literal('conditional-bundle-contents'), z.literal('catalog-options'),
				z.literal('merchant-approved-purchase-unavailable'), z.literal('description-and-specifications'),
				z.literal('related-products'),
			]),
			allowedCatalogFields: z.tuple([
				z.literal('name'), z.literal('sku'), z.literal('description'), z.literal('images'), z.literal('options'),
				z.literal('price'), z.literal('salePrice'), z.literal('currencyCode'), z.literal('inventory'),
				z.literal('category'), z.literal('breadcrumbs'), z.literal('relatedProducts'), z.literal('customFields'),
			]),
			commerce: z.object({
				mode: z.literal('catalog-display-only'),
				sourcePurchaseControls: z.literal('not-rendered-in-aisles'),
				visibleState: z.literal('merchant-approved-purchase-unavailable'),
				forbidden: z.tuple([z.literal('add-to-cart'), z.literal('cart'), z.literal('checkout'), z.literal('subscription'), z.literal('auto-refill-pricing'), z.literal('savings-claim'), z.literal('model-layout'), z.literal('generic-picks')]),
			}).strict(),
			publication: z.object({
				mode: z.literal('approval-required'),
				reviewAvailability: z.literal('development-build-only'),
				productLinks: z.literal('disabled-until-approved'),
			}).strict(),
			bounds: z.object({
				arrays: z.object({
					breadcrumbs: z.literal(KIBBLE_PDP_BOUNDS.arrays.breadcrumbs),
					images: z.literal(KIBBLE_PDP_BOUNDS.arrays.images),
					options: z.literal(KIBBLE_PDP_BOUNDS.arrays.options),
					optionValues: z.literal(KIBBLE_PDP_BOUNDS.arrays.optionValues),
					relatedProducts: z.literal(KIBBLE_PDP_BOUNDS.arrays.relatedProducts),
					customFields: z.literal(KIBBLE_PDP_BOUNDS.arrays.customFields),
					categories: z.literal(KIBBLE_PDP_BOUNDS.arrays.categories),
					bundleContents: z.literal(KIBBLE_PDP_BOUNDS.arrays.bundleContents),
				}).strict(),
				strings: z.object({
					routeId: z.literal(KIBBLE_PDP_BOUNDS.strings.routeId),
					assetUrl: z.literal(KIBBLE_PDP_BOUNDS.strings.assetUrl),
					imageAlt: z.literal(KIBBLE_PDP_BOUNDS.strings.imageAlt),
					categoryPath: z.literal(KIBBLE_PDP_BOUNDS.strings.categoryPath),
				}).strict(),
			}).strict(),
			richDescription: z.object({
				mode: z.literal('server-validated-html'),
				allowedTags: z.tuple(KIBBLE_PDP_RICH_DESCRIPTION_TAGS.map((tag) => z.literal(tag)) as [z.ZodLiteral<'p'>, z.ZodLiteral<'br'>, z.ZodLiteral<'strong'>, z.ZodLiteral<'b'>, z.ZodLiteral<'em'>, z.ZodLiteral<'i'>, z.ZodLiteral<'ul'>, z.ZodLiteral<'ol'>, z.ZodLiteral<'li'>, z.ZodLiteral<'a'>]),
				links: z.literal('https-only-with-noopener'),
			}).strict(),
			supportedCurrencies: z.tuple([z.literal('USD')]),
			responsive: z.object({ mobile: z.literal('gallery-thumbnails-follow-primary-image'), desktop: z.literal('two-column-gallery-and-details'), relatedProducts: z.literal('one-two-four-column-grid') }).strict(),
			modelLayoutRequest: z.literal(false),
			invariants: UniqueRequiredStrings,
		}).strict(),
		error: z.object({
			id: z.literal('kibble-error-reference-v1'),
			acceptance: z.literal('approved'),
			implementation: z.literal('KibbleErrorReference.svelte'),
			variantId: z.literal('kibble.error.reference-shell'),
			invariants: UniqueRequiredStrings,
		}).strict(),
	}).strict(),
	viewports: z.object({
		mobile: z.object({ minPx: z.literal(320), maxPx: z.literal(767), columns: z.literal(1) }).strict(),
		tablet: z.object({ minPx: z.literal(768), maxPx: z.literal(1023), columns: z.literal(2) }).strict(),
		desktop: z.object({ minPx: z.literal(1024), contentMaxPx: z.literal(1200), productColumns: z.literal(4) }).strict(),
		comparison: z.object({ widthsPx: z.tuple([z.literal(390), z.literal(768), z.literal(1280), z.literal(1440)]) }).strict(),
	}).strict(),
	ownership: z.object({
		referenceOwns: UniqueRequiredStrings,
		aislesOwns: UniqueRequiredStrings,
		forbiddenAtRuntime: UniqueRequiredStrings,
	}).strict(),
}).strict().superRefine((contract, ctx) => {
	const componentIds = new Set(contract.components.map((component) => component.id));
	if (componentIds.size !== contract.components.length) ctx.addIssue({ code: 'custom', message: 'Reference component ids must be unique', path: ['components'] });
	const componentsById = new Map(contract.components.map((component) => [component.id, component]));
	const allVariants = contract.components.flatMap((component) => component.variants.map((variant) => ({ ...variant, componentId: component.id })));
	if (new Set(allVariants.map(({ id }) => id)).size !== allVariants.length) ctx.addIssue({ code: 'custom', message: 'Full variant ids must be unique', path: ['components'] });
	const variantsById = new Map(allVariants.map((variant) => [variant.id, variant]));
	const cssRegistry = new Set<string>(contract.registry.cssVariantIds);
	const assetRegistry = new Set<string>(contract.registry.assetSlots);
	const linkRegistry = new Set<string>(contract.registry.linkTargets);
	const actionRegistry = new Set<string>(contract.registry.actionTargets);
	for (const [field, values] of Object.entries(contract.registry)) {
		if (new Set(values).size !== values.length) ctx.addIssue({ code: 'custom', message: `Registry ${field} entries must be unique`, path: ['registry', field] });
	}
	if (new Set(contract.adapter.links.allowed).size !== contract.adapter.links.allowed.length) ctx.addIssue({ code: 'custom', message: 'Adapter links must be unique', path: ['adapter', 'links', 'allowed'] });
	if (new Set(contract.adapter.actions.allowed).size !== contract.adapter.actions.allowed.length) ctx.addIssue({ code: 'custom', message: 'Adapter actions must be unique', path: ['adapter', 'actions', 'allowed'] });
	if (JSON.stringify(contract.recipes.plp.sortChoices) !== JSON.stringify(KIBBLE_PLP_SORT_OPTIONS.map(({ value, label }) => ({ value, label })))) {
		ctx.addIssue({ code: 'custom', message: 'PLP sort choices must match the canonical Kibble controls', path: ['recipes', 'plp', 'sortChoices'] });
	}

	for (const [componentIndex, component] of contract.components.entries()) {
		for (const [variantIndex, variant] of component.variants.entries()) {
			if (!variant.id.startsWith(`${component.id}.`)) ctx.addIssue({ code: 'custom', message: `Variant ${variant.id} does not belong to ${component.id}`, path: ['components', componentIndex, 'variants', variantIndex, 'id'] });
			for (const css of variant.cssVariantIds) if (!cssRegistry.has(css)) ctx.addIssue({ code: 'custom', message: `CSS variant ${css} is not registered`, path: ['components', componentIndex, 'variants', variantIndex, 'cssVariantIds'] });
			for (const asset of variant.assetSlots) if (!assetRegistry.has(asset)) ctx.addIssue({ code: 'custom', message: `Asset slot ${asset} is not registered`, path: ['components', componentIndex, 'variants', variantIndex, 'assetSlots'] });
			for (const link of variant.linkTargets) if (!linkRegistry.has(link)) ctx.addIssue({ code: 'custom', message: `Link target ${link} is not registered`, path: ['components', componentIndex, 'variants', variantIndex, 'linkTargets'] });
			for (const action of variant.actionTargets) if (!actionRegistry.has(action)) ctx.addIssue({ code: 'custom', message: `Action target ${action} is not registered`, path: ['components', componentIndex, 'variants', variantIndex, 'actionTargets'] });
		}
	}

	for (const [index, slot] of contract.recipes.home.orderedAnatomy.entries()) {
		const component = componentsById.get(slot.component);
		const variant = variantsById.get(slot.variantId);
		if (!component) ctx.addIssue({ code: 'custom', message: `Recipe component ${slot.component} is not registered`, path: ['recipes', 'home', 'orderedAnatomy', index, 'component'] });
		if (!variant || variant.componentId !== slot.component) ctx.addIssue({ code: 'custom', message: `Recipe variant ${slot.variantId} is not registered for ${slot.component}`, path: ['recipes', 'home', 'orderedAnatomy', index, 'variantId'] });
		const isRootChrome = slot.component === 'kibble.header' || slot.component === 'kibble.footer';
		if (isRootChrome && slot.owner !== 'root-layout') ctx.addIssue({ code: 'custom', message: 'Header and footer chrome must be owned by root-layout', path: ['recipes', 'home', 'orderedAnatomy', index, 'owner'] });
		if (!isRootChrome && slot.owner !== 'home-recipe') ctx.addIssue({ code: 'custom', message: 'Home content must be owned by home-recipe', path: ['recipes', 'home', 'orderedAnatomy', index, 'owner'] });
	}

	for (const [recipeName, recipe] of Object.entries({ plp: contract.recipes.plp, pdp: contract.recipes.pdp, error: contract.recipes.error })) {
		const component = contract.components.find(({ implementation }) => implementation === recipe.implementation);
		if (!component) {
			ctx.addIssue({ code: 'custom', message: `${recipeName} recipe implementation is not registered`, path: ['recipes', recipeName, 'implementation'] });
			continue;
		}
		if (!component.variants.some(({ id }) => id === recipe.variantId)) {
			ctx.addIssue({ code: 'custom', message: `${recipeName} recipe variant is not registered for its implementation`, path: ['recipes', recipeName, 'variantId'] });
		}
	}
});

const copy = (field: string, maxLength: number, sourceClasses: Array<'reference-copy' | 'merchant-catalog' | 'merchant-policy' | 'computed-fact'>) => ({ field, maxLength, sourceClasses });
const variant = (
	id: string, cssVariantIds: string[], dynamicPropFields: string[], assetSlots: string[], linkTargets: string[], actionTargets: string[], copyFields: ReturnType<typeof copy>[],
) => ({ id, cssVariantIds, dynamicPropFields, assetSlots, linkTargets, actionTargets, copyFields });

const contractInput = {
	id: 'kibble-shelf-native', version: '1.5.0', status: 'approved-reference',
	source: {
		repository: 'bc-subscriptions', remote: 'git@github.com:nino-chavez/bc-subscriptions.git',
		commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4', applicationPath: 'apps/storefront-svelte',
		brandKitPath: 'scripts/kibble-demo/data/brand/brand-kit.md', tokensPath: 'scripts/kibble-demo/data/brand/tokens.css',
		fixturePath: 'scripts/kibble-demo/data/seed-output.json', fixtureSha256: '833824a875f1fbe83a5d1d9164f521aa38e64e3902d22623a6af1b8cad84fe49',
		canonicalBoundary: 'The pinned storefront source and locked Shelf-Native kit govern this package. Screenshots are comparison evidence, not a replacement source of truth.',
	},
	tokens: {
		colors: { identity: '#1e2150', action: '#3b5bd0', actionHover: '#2f49b0', autoRefill: '#37bfa2', autoRefillText: '#1f9e86', autoRefillInk: '#0e2b25', savings: '#ef7a52', premium: '#e0a33a', page: '#f3f6fc', surface: '#ffffff', mutedSurface: '#e9eef7', panel: '#e4edfb', autoRefillPanel: '#dbf2eb', mutedText: '#5c6486', border: '#d6deee', borderStrong: '#c2cce2' },
		typography: { display: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans', machinery: 'IBM Plex Mono', displayWeight: 800, displayTracking: '-0.035em', baseSizePx: 16, machineryUses: ['prices', 'percentages', 'cadence', 'savings', 'spec labels', 'eyebrows'] },
		geometry: { containerMaxPx: 1200, spacingBasePx: 4, radiiPx: { xs: 4, sm: 6, md: 8, lg: 12, xl: 18 }, shadows: { card: '0 1px 3px rgba(30, 33, 80, 0.07)', lifted: '0 16px 40px rgba(59, 91, 208, 0.14)', hero: '0 24px 60px rgba(30, 33, 80, 0.16)' } },
		density: { name: 'clinical-warm', controlShape: 'squared', cardBorderPx: 1, motion: 'instrument-calm' },
	},
	chrome: { required: REQUIRED_CHROME, owner: 'root-layout', mobileDrawerBreakpointPx: 1024, stickyHeader: true },
	adapter: { links: { allowed: REGISTRY.linkTargets, optional: ['account', 'cart', 'saved-picks'] }, actions: { allowed: REGISTRY.actionTargets }, failClosed: true },
	registry: REGISTRY,
	components: [
		{
			id: 'kibble.header', implementation: 'KibbleHeader.svelte',
			variants: [variant('kibble.header.responsive-chrome', ['kc.header.desktop', 'kc.header.mobile-drawer'], ['brandName', 'navItems', 'autoRefillState', 'statusLabel', 'statusItems', 'copy', 'cartCount', 'picksCount'], [], ['home', 'catalog-category', 'search-results', 'account', 'cart', 'saved-picks'], ['open-mobile-navigation', 'close-mobile-navigation', 'open-search', 'close-search', 'open-cart-drawer', 'open-picks-tray'], [copy('brandName', 40, ['merchant-policy']), copy('statusLabel', 32, ['reference-copy']), copy('statusItems[].label', 56, ['computed-fact']), copy('navItems[].label', 32, ['merchant-policy']), copy('copy.*', 48, ['reference-copy'])])],
			referenceOwned: ['status-bar anatomy', 'wordmark treatment', 'navigation density', 'control shape', 'mobile drawer structure'],
			aislesOwned: ['navigation labels and named targets', 'verified status facts', 'live counts', 'supported callbacks'],
		},
		{
			id: 'kibble.hero', implementation: 'KibbleHero.svelte',
			variants: [variant('kibble.hero.flagship-bundle', ['kc.hero.flagship-bundle'], ['eyebrow', 'headline', 'body', 'ctas', 'featured', 'proofItems'], ['featured.image'], ['catalog-category', 'featured-bundle'], [], [copy('eyebrow', 72, ['reference-copy']), copy('headline', 88, ['reference-copy']), copy('body', 360, ['reference-copy']), copy('ctas[].label', 32, ['reference-copy']), copy('proofItems[].label', 28, ['merchant-policy']), copy('proofItems[].value', 24, ['computed-fact']), copy('featured.name', 72, ['merchant-catalog']), copy('featured.eyebrow', 32, ['reference-copy']), copy('featured.ctaLabel', 32, ['reference-copy'])])],
			referenceOwned: ['two-column composition', 'headline measure', 'flagship bundle anatomy', 'proof-strip anatomy when substantiated facts are supplied', 'CTA treatments'],
			aislesOwned: ['approved bounded copy', 'named CTA targets', 'featured catalog data', 'substantiated proof values'],
		},
		{
			id: 'kibble.product-card', implementation: 'KibbleProductCard.svelte',
			variants: [
				variant('kibble.product-card.catalog-card', ['kc.product-card.catalog-card'], ['product', 'productHref', 'merchantBrand'], ['product.image'], ['product-detail'], [], [copy('product.name', 96, ['merchant-catalog']), copy('merchantBrand', 48, ['merchant-catalog'])]),
				variant('kibble.product-card.featured-tile', ['kc.product-card.featured-tile'], ['product', 'productHref', 'merchantBrand'], ['product.image'], ['product-detail'], [], [copy('product.name', 96, ['merchant-catalog']), copy('merchantBrand', 48, ['merchant-catalog'])]),
				variant('kibble.product-card.sale', ['kc.product-card.sale'], ['product', 'productHref'], ['product.image'], ['product-detail'], [], [copy('product.name', 96, ['merchant-catalog'])]),
				variant('kibble.product-card.auto-refill', ['kc.product-card.auto-refill'], ['product', 'productHref', 'autoRefill'], ['product.image'], ['product-detail'], [], [copy('product.name', 96, ['merchant-catalog']), copy('autoRefill.label', 24, ['reference-copy']), copy('autoRefill.savingsLabel', 16, ['reference-copy']), copy('autoRefill.cadenceLabel', 28, ['merchant-policy'])]),
			],
			referenceOwned: ['square media', 'one-pixel border', 'mono price treatment', 'mint Auto-Refill seal', 'coral savings semantics'],
			aislesOwned: ['product identity', 'product imagery', 'vendor brand', 'prices', 'subscription eligibility'],
		},
		{
			id: 'kibble.featured-grid', implementation: 'KibbleFeaturedGrid.svelte',
			variants: [variant('kibble.featured-grid.four-column', ['kc.featured-grid.four-column'], ['copy', 'products', 'productHrefs', 'subscriptionOffers'], [], ['browse-all', 'product-detail'], [], [copy('copy.title', 64, ['reference-copy']), copy('copy.eyebrow', 24, ['reference-copy']), copy('copy.browseAllLabel', 24, ['reference-copy'])])],
			referenceOwned: ['section spacing', 'four-column desktop grid', 'heading hierarchy', 'card density'],
			aislesOwned: ['ranked product set', 'section copy', 'named browse target', 'subscription offers'],
		},
		{
			id: 'kibble.visual-module', implementation: 'KibbleVisualModule.svelte',
			variants: [
				variant('kibble.visual-module.routine', ['kc.visual-module.routine'], ['title', 'eyebrow', 'tiles', 'columns'], ['tile.image'], ['visual-tile'], [], [copy('title', 64, ['reference-copy']), copy('eyebrow', 24, ['reference-copy']), copy('tiles[].label', 48, ['merchant-policy']), copy('tiles[].description', 100, ['merchant-policy'])]),
				variant('kibble.visual-module.category', ['kc.visual-module.category'], ['title', 'eyebrow', 'tiles', 'columns'], ['tile.image'], ['visual-tile'], [], [copy('title', 64, ['reference-copy']), copy('eyebrow', 24, ['reference-copy']), copy('tiles[].label', 48, ['merchant-policy']), copy('tiles[].description', 100, ['merchant-policy'])]),
			],
			referenceOwned: ['image-first tiles', 'solid copy band', 'card border and lift', 'responsive columns'],
			aislesOwned: ['approved tile set', 'bounded tile copy', 'asset and named destination'],
		},
		{
			id: 'kibble.service-proof', implementation: 'KibbleServiceProof.svelte',
			variants: [variant('kibble.service-proof.three-column', ['kc.service-proof.three-column'], ['items'], [], [], [], [copy('items[].title', 56, ['merchant-policy']), copy('items[].body', 260, ['merchant-policy'])])],
			referenceOwned: ['three-column anatomy', 'quiet hierarchy', 'section rule and spacing'],
			aislesOwned: ['approved bounded proof copy', 'substantiated service claims'],
		},
		{
			id: 'kibble.footer', implementation: 'KibbleFooter.svelte',
			variants: [variant('kibble.footer.four-column', ['kc.footer.four-column'], ['brandName', 'tagline', 'footerNote', 'groups'], [], ['home', 'catalog-category'], [], [copy('brandName', 40, ['merchant-policy']), copy('tagline', 120, ['merchant-policy']), copy('footerNote', 240, ['merchant-policy']), copy('groups[].label', 32, ['merchant-policy']), copy('groups[].links[].label', 48, ['merchant-policy'])])],
			referenceOwned: ['four-column anatomy', 'quiet navigation hierarchy', 'disclosure rule and spacing'],
			aislesOwned: ['supported category links', 'merchant disclosure', 'bounded group labels'],
		},
		{
			id: 'kibble.category-listing', implementation: 'KibbleCategoryReference.svelte',
			variants: [variant('kibble.category-listing.fixed-grid', ['kc.category-listing.fixed-grid'], ['eyebrow', 'title', 'breadcrumbs', 'sortLabel', 'sortOptions', 'selectedSort', 'productCount', 'productSingular', 'productPlural', 'emptyMessage', 'products', 'productHrefs', 'loadMoreHref', 'loadMoreLabel'], ['product.image'], ['home', 'catalog-category'], [], [copy('eyebrow', 24, ['reference-copy']), copy('title', 64, ['merchant-policy']), copy('breadcrumbs[].label', 64, ['reference-copy', 'merchant-policy']), copy('sortLabel', 24, ['reference-copy']), copy('sortOptions[].label', 32, ['reference-copy']), copy('loadMoreLabel', 24, ['reference-copy']), copy('productSingular', 16, ['reference-copy']), copy('productPlural', 16, ['reference-copy']), copy('emptyMessage', 120, ['reference-copy']), copy('products[].name', 96, ['merchant-catalog'])])],
			referenceOwned: ['breadcrumb anatomy', 'fixed title and count header', 'seven-choice sort control', 'four-column product grid', 'cursor continuation control', 'catalog-card anatomy', 'bounded empty state'],
			aislesOwned: ['category title', 'trusted BigCommerce sort mapping', 'live product order', 'live product fields', 'validated cursor destination'],
		},
		{
			id: 'kibble.product-detail', implementation: 'KibbleProductDetailReference.svelte',
			variants: [variant('kibble.product-detail.catalog-display-only', ['kc.product-detail.catalog-display-only'], ['product', 'bundle', 'breadcrumbs', 'options', 'relatedProducts', 'relatedProductHrefs', 'purchaseUnavailableLabel', 'purchaseUnavailableBody', 'relatedHeading', 'copy'], ['product.image', 'product.gallery'], ['home', 'catalog-category', 'product-detail'], [], [copy('product.name', 96, ['merchant-catalog']), copy('product.sku', 64, ['merchant-catalog']), copy('product.category', 96, ['merchant-catalog']), copy('product.description', 4000, ['merchant-catalog']), copy('product.images[].alt', 160, ['merchant-catalog']), copy('product.specs[].label', 64, ['merchant-catalog']), copy('product.specs[].value', 240, ['merchant-catalog']), copy('breadcrumbs[].label', 96, ['reference-copy', 'merchant-catalog']), copy('options[].displayName', 96, ['merchant-catalog']), copy('options[].values[].label', 96, ['merchant-catalog']), copy('bundle.name', 96, ['reference-copy']), copy('bundle.contents[].brand', 48, ['reference-copy']), copy('bundle.contents[].title', 96, ['reference-copy']), copy('bundle.contents[].role', 96, ['reference-copy']), copy('purchaseUnavailableLabel', 72, ['merchant-policy']), copy('purchaseUnavailableBody', 240, ['merchant-policy']), copy('relatedHeading', 72, ['reference-copy']), copy('copy.*', 64, ['reference-copy'])])],
			referenceOwned: ['breadcrumb anatomy', 'gallery placement', 'identity and facts order', 'details and specifications order', 'related-product shelf'],
			aislesOwned: ['server-verified catalog facts', 'merchant-approved unavailable-purchase copy', 'only contracted product destinations'],
		},
		{
			id: 'kibble.error', implementation: 'KibbleErrorReference.svelte',
			variants: [variant('kibble.error.reference-shell', ['kc.error.reference-shell'], ['status', 'message', 'eyebrow', 'headline', 'returnLabel'], [], ['home'], [], [copy('message', 240, ['merchant-policy']), copy('eyebrow', 32, ['reference-copy']), copy('headline', 72, ['reference-copy']), copy('returnLabel', 40, ['reference-copy'])])],
			referenceOwned: ['centered status composition', 'reference type hierarchy', 'single bounded recovery action'],
			aislesOwned: ['HTTP status', 'safe public message', 'home destination'],
		},
	],
	recipes: {
		home: {
			id: 'kibble-home-reference-v1', acceptance: 'approved', implementation: 'KibbleHomeReference.svelte', rootLayoutChrome: 'kibble.header', rootLayoutFooter: 'kibble.footer',
			orderedAnatomy: [
				{ slot: 'merchant-chrome', component: 'kibble.header', variantId: 'kibble.header.responsive-chrome', required: true, owner: 'root-layout' },
				{ slot: 'opening-merchandising', component: 'kibble.hero', variantId: 'kibble.hero.flagship-bundle', required: true, owner: 'home-recipe' },
				{ slot: 'ranked-products', component: 'kibble.featured-grid', variantId: 'kibble.featured-grid.four-column', required: true, owner: 'home-recipe' },
				{ slot: 'catalog-entry', component: 'kibble.visual-module', variantId: 'kibble.visual-module.category', required: true, owner: 'home-recipe' },
				{ slot: 'service-proof', component: 'kibble.service-proof', variantId: 'kibble.service-proof.three-column', required: true, owner: 'home-recipe' },
				{ slot: 'merchant-footer', component: 'kibble.footer', variantId: 'kibble.footer.four-column', required: true, owner: 'root-layout' },
			],
			invariants: ['Root layout renders status and merchant navigation before page content.', 'KibbleHomeReference renders hero, products, catalog entry, then service proof.', 'The hero contains one flagship bundle, not an arbitrary collage.', 'When substantiated proof facts exist, the segmented proof strip stays inside the hero text column; otherwise it is omitted.', 'Product imagery preserves packaging labels.', 'Category or routine copy sits below imagery.', 'Mint appears only for substantiated Auto-Refill status or the ampersand wordmark exception.'],
		},
		plp: {
			id: 'kibble-plp-reference-v1', acceptance: 'approved', implementation: 'KibbleCategoryReference.svelte', variantId: 'kibble.category-listing.fixed-grid',
			source: {
				commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4',
				paths: [
					'apps/storefront-svelte/src/routes/category/[slug]/+page.server.ts',
					'apps/storefront-svelte/src/routes/category/[slug]/+page.svelte',
					'apps/storefront-svelte/src/lib/server/catalog.ts',
				],
			},
			orderedAnatomy: ['breadcrumbs', 'category-header', 'sort-control', 'product-grid', 'cursor-continuation'],
			sortChoices: KIBBLE_PLP_SORT_OPTIONS.map(({ value, label }) => ({ value, label })),
			defaultSort: 'FEATURED',
			pageSize: KIBBLE_PLP_PAGE_SIZE,
			pagination: { strategy: 'forward-cursor', cursorParam: 'after', actionLabel: 'Load more' },
			productCards: 'noninteractive-until-pdp-approved',
			modelLayoutRequest: false,
			invariants: ['Breadcrumbs render Home then the current category.', 'The category header and four-column product grid stay fixed.', 'Exactly seven trusted sort choices map to BigCommerce CategoryProductSort values.', 'Every page requests 24 products and exposes continuation only from a returned end cursor.', 'Invalid sort or cursor input fails closed before a catalog request.', 'Product cards remain non-links until the PDP recipe receives visual approval and a live publication policy.', 'Preserve never requests a model-authored layout.', 'Empty-state copy comes from the pinned manifest.'],
		},
		pdp: {
			id: 'kibble-pdp-reference-v1', acceptance: 'implemented-pending-visual-approval', implementation: 'KibbleProductDetailReference.svelte', variantId: 'kibble.product-detail.catalog-display-only',
			source: { commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4', paths: ['apps/storefront-svelte/src/routes/products/[slug]/+page.server.ts', 'apps/storefront-svelte/src/routes/products/[slug]/+page.svelte', 'apps/storefront-svelte/src/lib/components/ProductGallery.svelte', 'apps/storefront-svelte/src/lib/components/RelatedProducts.svelte', 'apps/storefront-svelte/src/lib/brand/bundle-contents.json'] },
			orderedAnatomy: ['breadcrumbs', 'media-gallery', 'product-identity', 'conditional-bundle-summary', 'catalog-price-and-availability', 'conditional-bundle-contents', 'catalog-options', 'merchant-approved-purchase-unavailable', 'description-and-specifications', 'related-products'],
			allowedCatalogFields: ['name', 'sku', 'description', 'images', 'options', 'price', 'salePrice', 'currencyCode', 'inventory', 'category', 'breadcrumbs', 'relatedProducts', 'customFields'],
			commerce: { mode: 'catalog-display-only', sourcePurchaseControls: 'not-rendered-in-aisles', visibleState: 'merchant-approved-purchase-unavailable', forbidden: ['add-to-cart', 'cart', 'checkout', 'subscription', 'auto-refill-pricing', 'savings-claim', 'model-layout', 'generic-picks'] },
			publication: { mode: 'approval-required', reviewAvailability: 'development-build-only', productLinks: 'disabled-until-approved' },
			bounds: KIBBLE_PDP_BOUNDS,
			richDescription: { mode: 'server-validated-html', allowedTags: KIBBLE_PDP_RICH_DESCRIPTION_TAGS, links: 'https-only-with-noopener' },
			supportedCurrencies: KIBBLE_PDP_SUPPORTED_CURRENCIES,
			responsive: { mobile: 'gallery-thumbnails-follow-primary-image', desktop: 'two-column-gallery-and-details', relatedProducts: 'one-two-four-column-grid' },
			modelLayoutRequest: false,
			invariants: ['The fixed recipe renders catalog facts only after the trusted server validates the product.', 'Breadcrumbs, gallery, identity, conditional bundle summary, catalog price, conditional bundle contents, options, unavailable-purchase state, details, and related shelf remain in this order.', 'Bundle identity and contents come only from the pinned bundle manifest; subscription, savings, and subscribe-price fields are excluded.', 'The unavailable-purchase state is visible instead of an add-to-cart, cart, checkout, subscription, Auto-Refill, or savings claim.', 'The review renderer is development-build-only while acceptance is pending, and published Home and PLP cards remain non-links.', 'Only validated current Kibble PDP paths may be rendered as product links inside the review renderer.', 'Bad route, catalog, copy, or bounds data fails into the Kibble Preserve error shell.', 'No model selects PDP structure, components, or destinations.'],
		},
		error: {
			id: 'kibble-error-reference-v1', acceptance: 'approved', implementation: 'KibbleErrorReference.svelte', variantId: 'kibble.error.reference-shell',
			invariants: ['The Kibble chrome remains visible.', 'Production copy never exposes internal adapter mismatch details.', 'The only recovery action returns home.'],
		},
	},
	viewports: { mobile: { minPx: 320, maxPx: 767, columns: 1 }, tablet: { minPx: 768, maxPx: 1023, columns: 2 }, desktop: { minPx: 1024, contentMaxPx: 1200, productColumns: 4 }, comparison: { widthsPx: [390, 768, 1280, 1440] } },
	ownership: {
		referenceOwns: ['semantic token meanings', 'required chrome', 'component anatomy', 'home recipe order', 'responsive density', 'visual fallbacks'],
		aislesOwns: ['catalog and subscription data', 'ranking within approved slots', 'approved bounded copy values', 'named navigation targets', 'supported interaction callbacks'],
		forbiddenAtRuntime: ['inventing CSS', 'inventing component variants', 'reordering Preserve recipe slots', 'using mint outside Auto-Refill status and the wordmark exception', 'overlaying copy on packaging labels', 'materializing unsupported links or actions'],
	},
} as const;

export type KibbleReferenceContract = z.infer<typeof KibbleReferenceContractSchema>;
export const KIBBLE_REFERENCE_CONTRACT: KibbleReferenceContract = KibbleReferenceContractSchema.parse(contractInput);
