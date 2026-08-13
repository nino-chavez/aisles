/**
 * Checked-in Bealls Aisles snapshot.
 *
 * Generated from the pinned source checkout and verified locally with
 * `npx tsx scripts/zone-coverage-refresh.ts`. CI consumes this file only;
 * it never requires a sibling repository.
 */

export type SnapshotFact = 'yes' | 'partial' | 'no';

export interface ZoneImplementationFacts {
	declared: boolean;
	schemaValidatable: boolean;
	/** `yes` means every accepted variant is dispatched; `partial` means only some are. */
	rendererMaterializable: SnapshotFact;
	routeResolved: boolean;
	routeRendered: boolean;
}

export interface BeallsSnapshotZone {
	zoneId: string;
	surface: string;
	multiplicity: 'singleton' | 'indexed' | 'array';
	maxIndex?: number;
	maxItems?: number;
	engineComposable: boolean;
	adminAuthorable: boolean;
	implementation: ZoneImplementationFacts;
	fallbackByBrand: Readonly<Record<'bealls' | 'beallsflorida' | 'homecentric', 'content' | 'hidden'>>;
}

export const AISLES_ZONE_REGISTRY_SNAPSHOT = [
	{ zoneId: 'home.hero', surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'home.featured-row', surface: 'home', multiplicity: 'indexed', maxIndex: 3, engineComposable: true, adminAuthorable: true },
	{ zoneId: 'home.editorial-strip', surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'home.below-fold', surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'plp.editorial-header', surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'plp.cluster-row', surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'plp.below-grid', surface: 'plp', multiplicity: 'singleton', engineComposable: false, adminAuthorable: true },
	{ zoneId: 'pdp.below-description', surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'pdp.related', surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'pdp.cross-sell', surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'pdp.recently-viewed', surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: false },
	{ zoneId: 'cart.above-checkout-cta', surface: 'cart', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'checkout.assurance-strip', surface: 'checkout', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'checkout.last-chance-upsell', surface: 'checkout', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'search.empty-state', surface: 'search', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'error-404.rescue', surface: 'error-404', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
	{ zoneId: 'error-empty.rescue', surface: 'error-empty', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true },
] as const;

export const AISLES_RENDERER_CONTRACT_SNAPSHOT = {
	files: [
		{ path: 'src/lib/foundation/ZoneRenderer.svelte', sha256: '8867a76190f5070bdedf431cad5bc05dbdf53c647e7870f86d2d81fbb4f8ec4f' },
		{ path: 'src/lib/foundation/autonomy-zone-materializer.ts', sha256: '93810d4fbf6debe3880f146ca21531a6fdaa8da67bd1ff89b924826adb208b31' },
		{ path: 'src/lib/foundation/zone-schemas.ts', sha256: '53d1595c4fb3c066b8d75de92e490a6ddc37362076618e411013ffb48ba10b27' },
		{ path: 'src/lib/components/layouts/LayoutRenderer.svelte', sha256: '351eda569ba54d6f9419d7b042b68afbc64d337935269542397ad8da63b28827' },
		{ path: 'src/lib/schema/layout.ts', sha256: 'e35307b2541757991d26ae54e54d1bc274177ffe4a0eb976581a95e79ca20ced' },
	],
} as const;

const yes = (routeResolved = false, routeRendered = false): ZoneImplementationFacts => ({
	declared: true,
	schemaValidatable: true,
	rendererMaterializable: 'yes',
	routeResolved,
	routeRendered,
});

const partial = (routeResolved = false, routeRendered = false): ZoneImplementationFacts => ({
	declared: true,
	schemaValidatable: true,
	rendererMaterializable: 'partial',
	routeResolved,
	routeRendered,
});

const no = (): ZoneImplementationFacts => ({
	declared: true,
	schemaValidatable: true,
	rendererMaterializable: 'no',
	routeResolved: false,
	routeRendered: false,
});

const beallsBrands = ['bealls', 'beallsflorida', 'homecentric'] as const;
const beallsAllBrandFallbacks = new Set([
	'home.hero',
	'home.editorial-strip',
	'home.below-fold',
	'plp.banner',
	'checkout.assurance-strip',
]);

function beallsFallbackByBrand(zoneId: string): BeallsSnapshotZone['fallbackByBrand'] {
	return Object.fromEntries(beallsBrands.map((brandId) => [
		brandId,
		beallsAllBrandFallbacks.has(zoneId) || (zoneId === 'pdp.below-recs' && brandId !== 'homecentric')
			? 'content'
			: 'hidden',
	])) as BeallsSnapshotZone['fallbackByBrand'];
}

export const BEALLS_ZONE_SNAPSHOT = {
	manifestVersion: 1,
	source: {
		repository: 'bealls-aisles',
		ref: '71e8750f9070fb788816f0464355f46ab63fb272',
		files: [
			{ path: 'src/lib/foundation/zones.ts', sha256: '60de21cd5643ddd18b7f73f3bc94942099a94bcf056b3d56005207a969ee106a' },
			{ path: 'src/lib/foundation/zone-schemas.ts', sha256: 'a9d4761ad9fa91212eeb62e77b3454cf0ed6fa13388ddef399656d7024b28366' },
			{ path: 'src/lib/foundation/ZoneRenderer.svelte', sha256: 'ccb8876fbef4a40a81bb0760075d97d80be16b166078240bc05e32b50ab19b36' },
			{ path: 'src/lib/components/layouts/LayoutRenderer.svelte', sha256: '2d91f3d577849fc98f1774e9ce7637c8634347521e03f9b0db7c6951c0d1572d' },
			{ path: 'src/lib/schema/blocks.ts', sha256: '012124b118e196f8325449ca84e09b254d82e3f9cbf4ace06023497b10ed8d9b' },
			{ path: 'src/lib/brand/config.ts', sha256: 'daa7de60d5656247d208a95af67e51d957ad0bcef3ac0f6f1bb4fdf0b4827c51' },
			{ path: 'src/lib/brand/composition-policy.ts', sha256: 'ece5951531717edece9478edae61fbc7c65294c9a5f2e16e88aa82e1f55e96ab' },
			{ path: 'src/lib/foundation/fallbacks/index.ts', sha256: '9df8089797b0cf371fd56802139ee68c07ee56ec56867aba79e1b69dbedebd83' },
			{ path: 'src/lib/foundation/fallbacks/home.ts', sha256: '868df1ed13917c12a9d4c05438acc5ffcb32894440494f99e9f6126546adcba1' },
			{ path: 'src/lib/foundation/fallbacks/plp.ts', sha256: '743804e12601803ed57c6f31654ee80dc71ef9b613650c953a44b454570c4337' },
			{ path: 'src/lib/foundation/fallbacks/pdp.ts', sha256: '2ffb98562514921e9489aae76bd93fd12ded82e30eb5264a95eeea47984c0924' },
			{ path: 'src/lib/foundation/fallbacks/cart.ts', sha256: '9a85a2c5de9b03cdb9553cc87d908894a0fef248e07dd486df5d43638d718829' },
			{ path: 'src/lib/foundation/fallbacks/checkout.ts', sha256: '314dc18604cff765070edf32d247139ebc3b37389a8599dab3edd568a793381d' },
			{ path: 'src/routes/+page.server.ts', sha256: 'e3b33af1c9553379aae3d0ed6cf173517b1d2326eb9d1efb7ee68e6fd9d9bfc0' },
			{ path: 'src/routes/+page.svelte', sha256: 'd745b0cc7cff0348a8416389a1b59cdc102bb6de03cab3607b2cf6bfc6e17417' },
			{ path: 'src/routes/cart/+page.server.ts', sha256: '9466513ec5e8c422016f72acd3d1df709b387e9e7f0b121b8073401bbf2a14d4' },
			{ path: 'src/routes/cart/+page.svelte', sha256: '507e018f31d6f60232aeb1b87af0206bd202ff3c96ea145ec1f06f515247ce8a' },
			{ path: 'src/routes/category/[slug]/+page.server.ts', sha256: '736fa18c6fd8c50b22c0978bd1fa3a96e1077f15abbb2eb6dc1170502f29ca95' },
			{ path: 'src/routes/category/[slug]/+page.svelte', sha256: '125d85eda5b55bc4798bba0a57ad983e3937cb3c5ca147bb56615165d25d86c4' },
			{ path: 'src/routes/product/[slug]/+page.server.ts', sha256: 'a6a47d04290b9422270611375a4773b9343cf9023e3915dcbdef57d26a4128f1' },
			{ path: 'src/routes/product/[slug]/+page.svelte', sha256: '166e40b9188e7882858dee355228a6eae5a69108a9313eda5178cdf59219f6ac' },
			{ path: 'src/routes/search/+page.server.ts', sha256: '5d0c600920471ce436ac64def6ee31ac6a9be48dfa76936403ac34cbc7b04a23' },
			{ path: 'src/routes/search/+page.svelte', sha256: '1e9fe38fab97a005a16c2bd323416ff0fd60202fe016cd7f0e16ea44b6be3134' },
			{ path: 'src/routes/account/+page.server.ts', sha256: 'd362c2f66a58d4437ce7142cf17c747ed8b15f1e73f63b7519237cafe238eab6' },
			{ path: 'src/routes/account/+page.svelte', sha256: 'ba8fe024768f097d8fe565d392e6bb38564d00cabd12ac02d374ae837f2e66d8' },
			{ path: 'src/routes/store-locator/+page.server.ts', sha256: '7a268e957f96183a789f9980c46f05f9696820cd1f8c818fa4085a81408557af' },
			{ path: 'src/routes/store-locator/+page.svelte', sha256: 'f50fcb65f3cf42510ccba46e6c4651e555bb88cb2307d232e70c99b976e1f294' },
			{ path: 'src/routes/checkout/+page.server.ts', sha256: '55a81a9e573ca56f3472bfca1c7f8ff14cf88dd2cd37aab0876a166c59841a3f' },
			{ path: 'src/routes/checkout/+page.svelte', sha256: 'fdf6dd2fd9a40d7e078a816b134f079e953a348af9016bf01ecfc5a603c09c1c' },
			{ path: 'src/routes/+error.svelte', sha256: '9768ad309bcc9cf63fbeafa966f17f2b68f4c0d98dffab9de1f5a017380c086a' },
			{ path: 'src/routes/style-guide/+page.server.ts', sha256: 'b4cddf7efcfa7e94940e3b47fab83eac8c2da54de2842a32a8f4618ac6b3d938' },
			{ path: 'src/routes/style-guide/+page.svelte', sha256: '88d94f313b30c7226d2c4d834b7155a67ca864367db0b0047f5deab6757a40be' },
		],
	},
	zones: ([
		{ zoneId: 'home.hero', surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: yes(true, true) },
		{ zoneId: 'home.featured-row', surface: 'home', multiplicity: 'indexed', maxIndex: 6, engineComposable: true, adminAuthorable: true, implementation: partial() },
		{ zoneId: 'home.editorial-strip', surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: partial() },
		{ zoneId: 'home.brand-spotlight', surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: yes() },
		{ zoneId: 'home.below-fold', surface: 'home', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: yes() },
		{ zoneId: 'plp.banner', surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: partial() },
		{ zoneId: 'plp.editorial-header', surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: yes() },
		{ zoneId: 'plp.cluster-row', surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: yes() },
		{ zoneId: 'plp.between-thirds', surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: partial() },
		{ zoneId: 'plp.below-grid', surface: 'plp', multiplicity: 'singleton', engineComposable: false, adminAuthorable: true, implementation: partial() },
		{ zoneId: 'plp.empty-state', surface: 'plp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: no() },
		{ zoneId: 'pdp.below-description', surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: partial(true, true) },
		{ zoneId: 'pdp.related', surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: yes(true, true) },
		{ zoneId: 'pdp.cross-sell', surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: partial(true, true) },
		{ zoneId: 'pdp.recently-viewed', surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: false, implementation: partial(true, true) },
		{ zoneId: 'pdp.below-recs', surface: 'pdp', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: partial(true, true) },
		{ zoneId: 'cart.above-checkout-cta', surface: 'cart', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: partial() },
		{ zoneId: 'cart.below-fold', surface: 'cart', multiplicity: 'array', maxItems: 2, engineComposable: true, adminAuthorable: true, implementation: no() },
		{ zoneId: 'cart.empty-state', surface: 'cart', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: no() },
		{ zoneId: 'checkout.assurance-strip', surface: 'checkout', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: yes(true, true) },
		{ zoneId: 'checkout.last-chance-upsell', surface: 'checkout', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: yes() },
		{ zoneId: 'search.empty-state', surface: 'search', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: no() },
		{ zoneId: 'search.zero-results-rescue', surface: 'search', multiplicity: 'array', maxItems: 3, engineComposable: true, adminAuthorable: true, implementation: partial() },
		{ zoneId: 'account.welcome', surface: 'account', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: partial() },
		{ zoneId: 'account.dashboard-pick', surface: 'account', multiplicity: 'indexed', maxIndex: 4, engineComposable: true, adminAuthorable: true, implementation: no() },
		{ zoneId: 'locator.editorial-intro', surface: 'locator', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: yes(true, true) },
		{ zoneId: 'error-404.rescue', surface: 'error-404', multiplicity: 'array', maxItems: 3, engineComposable: true, adminAuthorable: true, implementation: partial() },
		{ zoneId: 'error-empty.rescue', surface: 'error-empty', multiplicity: 'singleton', engineComposable: true, adminAuthorable: true, implementation: no() },
	] as const).map((zone) => ({ ...zone, fallbackByBrand: beallsFallbackByBrand(zone.zoneId) })) as readonly BeallsSnapshotZone[],
	routeSurfaces: [
		{
			routePath: '/',
			zoneSurfaceId: 'home',
			policySurfaceByBrand: { bealls: 'home', beallsflorida: 'home', homecentric: 'home' },
			note: 'The home route resolves and renders only home.hero; other home zones remain declaration-only.',
		},
		{
			routePath: '/category/[slug]',
			zoneSurfaceId: 'plp',
			policySurfaceByBrand: { bealls: 'plp', beallsflorida: 'plp', homecentric: 'category' },
			note: 'Home Centric uses the same route path but a fixed content policy surface; category is not a plp alias.',
		},
		{
			routePath: '/product/[slug]',
			zoneSurfaceId: 'pdp',
			policySurfaceByBrand: { bealls: 'pdp', beallsflorida: 'pdp', homecentric: null },
			note: 'The route resolves and renders all five PDP zones for storefront brands; Home Centric declares no PDP policy.',
		},
		{
			routePath: '/cart',
			zoneSurfaceId: 'cart',
			policySurfaceByBrand: { bealls: 'cart', beallsflorida: 'cart', homecentric: null },
			note: 'The route exists, but no cart zone is resolved or rendered through the zone resolver.',
		},
		{
			routePath: '/checkout',
			zoneSurfaceId: 'checkout',
			policySurfaceByBrand: { bealls: 'checkout', beallsflorida: 'checkout', homecentric: null },
			note: 'The route directly resolves checkout.assurance-strip; it does not render through ZoneRenderer.',
		},
		{
			routePath: '/search',
			zoneSurfaceId: 'search',
			policySurfaceByBrand: { bealls: null, beallsflorida: null, homecentric: null },
			note: 'The route exists, but the Bealls policy registry and route do not adopt search zones.',
		},
		{
			routePath: '/account',
			zoneSurfaceId: 'account',
			policySurfaceByBrand: { bealls: null, beallsflorida: null, homecentric: null },
			note: 'The route exists, but the Bealls policy registry and route do not adopt account zones.',
		},
		{
			routePath: '/store-locator',
			zoneSurfaceId: 'locator',
			policySurfaceByBrand: { bealls: 'locator', beallsflorida: 'locator', homecentric: 'locator' },
			note: 'The route resolves and renders locator.editorial-intro under a fixed locator policy.',
		},
		{
			routePath: '/style-guide',
			zoneSurfaceId: null,
			policySurfaceByBrand: { bealls: 'style-guide', beallsflorida: 'style-guide', homecentric: 'style-guide' },
			note: 'Development/reference route with an explicit policy surface and no zone family.',
		},
	],
} as const;
