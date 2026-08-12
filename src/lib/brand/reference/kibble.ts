import { z } from 'zod';

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
	'engine-status-bar',
	'merchant-wordmark',
	'catalog-navigation',
	'search-control',
	'account-control',
	'cart-control',
	'mobile-drawer',
] as const;

const REGISTRY = {
	cssVariantIds: [
		'kc.header.desktop', 'kc.header.mobile-drawer', 'kc.hero.flagship-bundle',
		'kc.product-card.catalog-card', 'kc.product-card.featured-tile', 'kc.product-card.sale',
		'kc.product-card.auto-refill', 'kc.featured-grid.four-column', 'kc.visual-module.routine',
		'kc.visual-module.category', 'kc.service-proof.three-column',
	],
	assetSlots: ['featured.image', 'product.image', 'tile.image'],
	linkTargets: ['home', 'catalog-category', 'search-results', 'account', 'cart', 'saved-picks', 'product-detail', 'featured-bundle', 'browse-all', 'visual-tile'],
	actionTargets: ['open-mobile-navigation', 'close-mobile-navigation', 'open-search', 'close-search', 'open-cart-drawer', 'open-picks-tray'],
} as const;

export const KibbleReferenceContractSchema = z.object({
	id: z.literal('kibble-shelf-native'),
	version: z.literal('1.1.0'),
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
		required: z.tuple(REQUIRED_CHROME.map((entry) => z.literal(entry)) as [z.ZodLiteral<'engine-status-bar'>, z.ZodLiteral<'merchant-wordmark'>, z.ZodLiteral<'catalog-navigation'>, z.ZodLiteral<'search-control'>, z.ZodLiteral<'account-control'>, z.ZodLiteral<'cart-control'>, z.ZodLiteral<'mobile-drawer'>]),
		owner: z.literal('root-layout'),
		mobileDrawerBreakpointPx: z.literal(768),
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
	components: z.array(ReferenceComponentSchema).min(6),
	recipes: z.object({
		home: z.object({
			id: z.literal('kibble-home-reference-v1'),
			implementation: z.literal('KibbleHomeReference.svelte'),
			rootLayoutChrome: z.literal('kibble.header'),
			orderedAnatomy: z.array(ReferenceRecipeSlotSchema).min(5),
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
		if (index === 0 && slot.owner !== 'root-layout') ctx.addIssue({ code: 'custom', message: 'Header chrome must be owned by root-layout', path: ['recipes', 'home', 'orderedAnatomy', index, 'owner'] });
		if (index > 0 && slot.owner !== 'home-recipe') ctx.addIssue({ code: 'custom', message: 'Home content must be owned by home-recipe', path: ['recipes', 'home', 'orderedAnatomy', index, 'owner'] });
	}
});

const copy = (field: string, maxLength: number, sourceClasses: Array<'reference-copy' | 'merchant-catalog' | 'merchant-policy' | 'computed-fact'>) => ({ field, maxLength, sourceClasses });
const variant = (
	id: string, cssVariantIds: string[], dynamicPropFields: string[], assetSlots: string[], linkTargets: string[], actionTargets: string[], copyFields: ReturnType<typeof copy>[],
) => ({ id, cssVariantIds, dynamicPropFields, assetSlots, linkTargets, actionTargets, copyFields });

const contractInput = {
	id: 'kibble-shelf-native', version: '1.1.0', status: 'approved-reference',
	source: {
		repository: 'bc-subscriptions', remote: 'git@github.com:nino-chavez/bc-subscriptions.git',
		commit: 'a5c9555b89d72e7898d6bc1c38c7157a1c415b06', applicationPath: 'apps/storefront-svelte',
		brandKitPath: 'scripts/kibble-demo/data/brand/brand-kit.md', tokensPath: 'scripts/kibble-demo/data/brand/tokens.css',
		canonicalBoundary: 'The pinned storefront source and locked Shelf-Native kit govern this package. Screenshots are comparison evidence, not a replacement source of truth.',
	},
	tokens: {
		colors: { identity: '#1e2150', action: '#3b5bd0', actionHover: '#2f49b0', autoRefill: '#37bfa2', autoRefillText: '#1f9e86', autoRefillInk: '#0e2b25', savings: '#ef7a52', premium: '#e0a33a', page: '#f3f6fc', surface: '#ffffff', mutedSurface: '#e9eef7', panel: '#e4edfb', autoRefillPanel: '#dbf2eb', mutedText: '#5c6486', border: '#d6deee', borderStrong: '#c2cce2' },
		typography: { display: 'Plus Jakarta Sans', body: 'Plus Jakarta Sans', machinery: 'IBM Plex Mono', displayWeight: 800, displayTracking: '-0.035em', baseSizePx: 16, machineryUses: ['prices', 'percentages', 'cadence', 'savings', 'spec labels', 'eyebrows'] },
		geometry: { containerMaxPx: 1200, spacingBasePx: 4, radiiPx: { xs: 4, sm: 6, md: 8, lg: 12, xl: 18 }, shadows: { card: '0 1px 3px rgba(30, 33, 80, 0.07)', lifted: '0 16px 40px rgba(59, 91, 208, 0.14)', hero: '0 24px 60px rgba(30, 33, 80, 0.16)' } },
		density: { name: 'clinical-warm', controlShape: 'squared', cardBorderPx: 1, motion: 'instrument-calm' },
	},
	chrome: { required: REQUIRED_CHROME, owner: 'root-layout', mobileDrawerBreakpointPx: 768, stickyHeader: true },
	adapter: { links: { allowed: REGISTRY.linkTargets, optional: ['account', 'cart', 'saved-picks'] }, actions: { allowed: REGISTRY.actionTargets }, failClosed: true },
	registry: REGISTRY,
	components: [
		{
			id: 'kibble.header', implementation: 'KibbleHeader.svelte',
			variants: [
				variant('kibble.header.desktop', ['kc.header.desktop'], ['brandName', 'navItems', 'autoRefillState', 'statusItems', 'cartCount', 'picksCount'], [], ['home', 'catalog-category', 'search-results', 'account', 'cart', 'saved-picks'], ['open-mobile-navigation', 'open-search', 'close-search', 'open-cart-drawer', 'open-picks-tray'], [copy('brandName', 40, ['merchant-policy']), copy('statusItems[].label', 56, ['computed-fact'])]),
				variant('kibble.header.mobile-drawer', ['kc.header.mobile-drawer'], ['brandName', 'navItems', 'cartCount', 'picksCount'], [], ['home', 'catalog-category', 'account', 'cart', 'saved-picks'], ['close-mobile-navigation', 'open-cart-drawer', 'open-picks-tray'], [copy('brandName', 40, ['merchant-policy']), copy('navItems[].label', 32, ['merchant-policy'])]),
			],
			referenceOwned: ['status-bar anatomy', 'wordmark treatment', 'navigation density', 'control shape', 'mobile drawer structure'],
			aislesOwned: ['navigation labels and named targets', 'verified status facts', 'live counts', 'supported callbacks'],
		},
		{
			id: 'kibble.hero', implementation: 'KibbleHero.svelte',
			variants: [variant('kibble.hero.flagship-bundle', ['kc.hero.flagship-bundle'], ['eyebrow', 'headline', 'body', 'ctas', 'featured', 'proofItems'], ['featured.image'], ['catalog-category', 'featured-bundle'], [], [copy('eyebrow', 72, ['reference-copy']), copy('headline', 88, ['reference-copy']), copy('body', 360, ['reference-copy']), copy('ctas[].label', 32, ['reference-copy']), copy('proofItems[].label', 28, ['merchant-policy']), copy('proofItems[].value', 24, ['computed-fact']), copy('featured.name', 72, ['merchant-catalog'])])],
			referenceOwned: ['two-column composition', 'headline measure', 'flagship bundle anatomy', 'proof-strip anatomy', 'CTA treatments'],
			aislesOwned: ['approved bounded copy', 'named CTA targets', 'featured catalog data', 'substantiated proof values'],
		},
		{
			id: 'kibble.product-card', implementation: 'KibbleProductCard.svelte',
			variants: [
				variant('kibble.product-card.catalog-card', ['kc.product-card.catalog-card'], ['product', 'productHref', 'merchantBrand'], ['product.image'], ['product-detail'], [], [copy('product.name', 96, ['merchant-catalog']), copy('merchantBrand', 48, ['merchant-catalog'])]),
				variant('kibble.product-card.featured-tile', ['kc.product-card.featured-tile'], ['product', 'productHref', 'merchantBrand'], ['product.image'], ['product-detail'], [], [copy('product.name', 96, ['merchant-catalog']), copy('merchantBrand', 48, ['merchant-catalog'])]),
				variant('kibble.product-card.sale', ['kc.product-card.sale'], ['product', 'productHref'], ['product.image'], ['product-detail'], [], [copy('product.name', 96, ['merchant-catalog'])]),
				variant('kibble.product-card.auto-refill', ['kc.product-card.auto-refill'], ['product', 'productHref', 'autoRefill'], ['product.image'], ['product-detail'], [], [copy('product.name', 96, ['merchant-catalog']), copy('autoRefill.cadenceLabel', 28, ['merchant-policy'])]),
			],
			referenceOwned: ['square media', 'one-pixel border', 'mono price treatment', 'mint Auto-Refill seal', 'coral savings semantics'],
			aislesOwned: ['product identity', 'product imagery', 'vendor brand', 'prices', 'subscription eligibility'],
		},
		{
			id: 'kibble.featured-grid', implementation: 'KibbleFeaturedGrid.svelte',
			variants: [variant('kibble.featured-grid.four-column', ['kc.featured-grid.four-column'], ['title', 'eyebrow', 'products', 'productHrefs', 'subscriptionOffers'], [], ['browse-all', 'product-detail'], [], [copy('title', 64, ['reference-copy']), copy('eyebrow', 24, ['reference-copy'])])],
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
	],
	recipes: {
		home: {
			id: 'kibble-home-reference-v1', implementation: 'KibbleHomeReference.svelte', rootLayoutChrome: 'kibble.header',
			orderedAnatomy: [
				{ slot: 'merchant-chrome', component: 'kibble.header', variantId: 'kibble.header.desktop', required: true, owner: 'root-layout' },
				{ slot: 'opening-merchandising', component: 'kibble.hero', variantId: 'kibble.hero.flagship-bundle', required: true, owner: 'home-recipe' },
				{ slot: 'ranked-products', component: 'kibble.featured-grid', variantId: 'kibble.featured-grid.four-column', required: true, owner: 'home-recipe' },
				{ slot: 'catalog-entry', component: 'kibble.visual-module', variantId: 'kibble.visual-module.category', required: true, owner: 'home-recipe' },
				{ slot: 'service-proof', component: 'kibble.service-proof', variantId: 'kibble.service-proof.three-column', required: true, owner: 'home-recipe' },
			],
			invariants: ['Root layout renders status and merchant navigation before page content.', 'KibbleHomeReference renders hero, products, catalog entry, then service proof.', 'The hero contains one flagship bundle, not an arbitrary collage.', 'The segmented proof strip stays inside the hero text column.', 'Product imagery preserves packaging labels.', 'Category or routine copy sits below imagery.', 'Mint appears only for Auto-Refill status or the ampersand wordmark exception.'],
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
