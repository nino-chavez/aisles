import { z } from 'zod';
import { KIBBLE_PLP_PAGE_SIZE, KIBBLE_PLP_SORT_OPTIONS } from './kibble-plp';
import { KIBBLE_CANONICAL_UNION_ZONE_IDS } from './kibble-zone-union';

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

export const KIBBLE_PDP_ADAPTED_SOURCE_FILES = [
	{ path: 'apps/storefront-svelte/src/routes/products/[slug]/+page.server.ts', sha256: '61546d7a03e180c02dba320ea10b95c5d590f616ae60ce85adcb31292070ef68' },
	{ path: 'apps/storefront-svelte/src/routes/products/[slug]/+page.svelte', sha256: '2037eca5a6b2e98b30e9d901ef97616a7347356566d98906ef777948351e3646' },
	{ path: 'apps/storefront-svelte/src/lib/components/Breadcrumbs.svelte', sha256: '89bee94fca474e2c587a1fc12ab912fade83804e9bb27eeca7c4a557d06d43ac' },
	{ path: 'apps/storefront-svelte/src/lib/components/ProductGallery.svelte', sha256: 'f83501005792e00a7d3b540f65ebfa8ea85eeb2c0bf8e9209f2e9ce346073c76' },
	{ path: 'apps/storefront-svelte/src/lib/components/VariantPicker.svelte', sha256: '2723d808e0441834b42e9d44cc7c03d407181e9d7b65452b91dad719ce5836d3' },
	{ path: 'apps/storefront-svelte/src/lib/components/RelatedProducts.svelte', sha256: '285616781af47263191a96452f75fe678044c59877c82e3a010c7a694f57133f' },
	{ path: 'apps/storefront-svelte/src/lib/components/ProductCard.svelte', sha256: '738d4ee911fa6b852672d2067ec45dcc4e0365756c5572108e91bd4a5828d38d' },
	{ path: 'apps/storefront-svelte/src/lib/brand/bundle-contents.json', sha256: '84eeb73ac2d81e2b796b530c876ab334ec6d613e74ff59e7ecffb6f20086bcdd' },
	{ path: 'apps/storefront-svelte/src/lib/brand/kibble-shelf-reference.ts', sha256: '0559e879e7f5b26b0a52a3d1a9f6af8b04b657661b9ff3c6914efc073523bad2' },
	{ path: 'apps/storefront-svelte/src/lib/server/bigcommerce.ts', sha256: '8d4810e67c328ee5b9ed46f0ed0a2c19bb6586f7516679b4f8813661c87e6015' },
	{ path: 'apps/storefront-svelte/src/lib/types/catalog.ts', sha256: '0bd280034b8f2cdfc0c647d0744f115987a4fc6a1209da36217be6b65173ad03' },
] as const;

export const KIBBLE_PDP_EXCLUDED_DEPENDENCIES = [
	{ module: '$lib/subscriptions/SubscriptionWidget.svelte', reason: 'Aisles does not implement the canonical subscription selector or subscribe-to-cart flow.' },
	{ module: '$lib/subscriptions/api-client', reason: 'Aisles does not call the subscription API from its catalog-display-only PDP.' },
	{ module: '$lib/subscriptions/eligible-products.json', reason: 'Aisles excludes Auto-Refill eligibility, subscribe pricing, and savings claims from related-product cards.' },
	{ module: '$lib/server/cart', reason: 'Aisles does not create or mutate a cart from the review-only PDP.' },
	{ module: '$lib/server/cart-intents', reason: 'Aisles does not persist subscription intents from the review-only PDP.' },
	{ module: 'products/[slug]/+page.server.ts#actions.addToCart', reason: 'Aisles replaces canonical purchase actions with a truthful purchase-unavailable state while parity remains pending.' },
] as const;

export const KIBBLE_PDP_EXTERNAL_DEPENDENCIES = [
	{ module: '@sveltejs/kit', classification: 'framework-runtime' },
	{ module: '$app/stores', classification: 'framework-runtime' },
	{ module: '$env/dynamic/public', classification: 'framework-runtime' },
	{ module: '$env/dynamic/private', classification: 'framework-runtime' },
	{ module: './$types', classification: 'generated-types' },
] as const;

export const KIBBLE_PDP_BUNDLE_PROJECTION_SHA256 = '3dcf34363dbf9c9eacc1667773b1b8506ccbb801a8152154cade748eef424710' as const;

/**
 * Canonical surface closures verified with `git show <pinned-commit>:<path> |
 * shasum -a 256`. They document the source anatomy without importing its
 * cart, account, subscription, or search services into the Preserve runtime.
 */
export const KIBBLE_SEARCH_ADAPTED_SOURCE_FILES = [
	{ path: 'apps/storefront-svelte/src/routes/search/+page.svelte', sha256: '75cbfe8a6fa9dbbda7cea804200c9b0dc021fa732927194b0b812454c3ab2158' },
	{ path: 'apps/storefront-svelte/src/lib/components/SearchInput.svelte', sha256: 'f2e2fc9b766e0301e22df2ea6d171fda74cb91457d8b23dc7a9aef3696fe1a8e' },
	{ path: 'apps/storefront-svelte/src/lib/components/Breadcrumbs.svelte', sha256: '89bee94fca474e2c587a1fc12ab912fade83804e9bb27eeca7c4a557d06d43ac' },
] as const;
export const KIBBLE_CART_ADAPTED_SOURCE_FILES = [
	{ path: 'apps/storefront-svelte/src/routes/cart/+page.svelte', sha256: '2940a76fb4a3fb5d49cfb5325497833060312af6ab184e840c97c8986675a768' },
	{ path: 'apps/storefront-svelte/src/lib/components/Breadcrumbs.svelte', sha256: '89bee94fca474e2c587a1fc12ab912fade83804e9bb27eeca7c4a557d06d43ac' },
] as const;
export const KIBBLE_ACCOUNT_ADAPTED_SOURCE_FILES = [
	{ path: 'apps/storefront-svelte/src/routes/account/+layout.svelte', sha256: '1addd8ff2da26b481e24a7cffde1ec5b9b2b9c6737c3b1a318a10cc53a512d38' },
	{ path: 'apps/storefront-svelte/src/routes/account/login/+page.svelte', sha256: 'e0d7f8ea0346222f1cd4d0b15dcb47102ca78763dce6374679be64353e39e44c' },
	{ path: 'apps/storefront-svelte/src/routes/account/register/+page.svelte', sha256: '7479a2e2e92a17f854aaf4f5dfde22cd5ed7ef91316a92d620d371937326fca3' },
	{ path: 'apps/storefront-svelte/src/routes/account/orders/+page.svelte', sha256: 'ba83fada01e6ec8064cd96fffc5ee7e6321366c12dae64d043410ff27a949e22' },
	{ path: 'apps/storefront-svelte/src/routes/account/payment-methods/+page.svelte', sha256: '763b35fd25d0c81d22ad381ac217d7000e5265afc7e948afcdeeccc390891826' },
	{ path: 'apps/storefront-svelte/src/routes/account/addresses/+page.svelte', sha256: 'd00e4f7f2f5466a207aca9d7c0aae77b0e70887e22d7663fa0994d3c69d298af' },
	{ path: 'apps/storefront-svelte/src/routes/account/subscriptions/+page.svelte', sha256: 'f482c8910aac6f9efd27a348812db08417db357e436758dd4891ad556488a8dc' },
	{ path: 'apps/storefront-svelte/src/lib/components/Breadcrumbs.svelte', sha256: '89bee94fca474e2c587a1fc12ab912fade83804e9bb27eeca7c4a557d06d43ac' },
] as const;
export const KIBBLE_CHECKOUT_ADAPTED_SOURCE_FILES = [
	{ path: 'apps/storefront-svelte/src/routes/checkout/gift/+page.svelte', sha256: '3cb7b0b58389fcf1e30e8843046e4ab8f72436027292bcdad3bbb7dd007ca39b' },
	{ path: 'apps/storefront-svelte/src/lib/subscriptions/GiftPurchaseView.svelte', sha256: '836c36ffc6e8c951c68551b26614359b3f3c0d413535af1fa3d6fd739aa19478' },
	{ path: 'apps/storefront-svelte/src/routes/checkout/prepaid/+page.svelte', sha256: '7f5b2d971e57563b49d302f0eb693768855a802518549dd7900b0268579b51e6' },
	{ path: 'apps/storefront-svelte/src/lib/subscriptions/PrepaidPurchaseView.svelte', sha256: 'f598aae8afd74389c785b9484d69e5295b09f882d57debd288048b94d5a944a7' },
	{ path: 'apps/storefront-svelte/src/routes/checkout/confirmation/+page.svelte', sha256: 'f7a3f2c2271335483936d5fce3e0fea7ec410e3957b75c05a4c02d90a4a46a93' },
	{ path: 'apps/storefront-svelte/src/lib/components/Breadcrumbs.svelte', sha256: '89bee94fca474e2c587a1fc12ab912fade83804e9bb27eeca7c4a557d06d43ac' },
] as const;

export const KIBBLE_SUBSCRIPTIONS_ADAPTED_SOURCE_FILES = [
	{ path: 'apps/storefront-svelte/src/routes/subscriptions/+page.svelte', sha256: '7430e47767c479480b4cf04231543f00985b42c32810a989c402b013c6e94f92' },
	{ path: 'apps/storefront-svelte/src/routes/account/subscriptions/+page.svelte', sha256: 'f482c8910aac6f9efd27a348812db08417db357e436758dd4891ad556488a8dc' },
	{ path: 'apps/storefront-svelte/src/lib/subscriptions/SubscriberPortalApp.svelte', sha256: '20a9d60d1ee670b0b4c8f98ce3f065fb3ad1b2a4e3e951be4f2e41107e8e6da6' },
	{ path: 'apps/storefront-svelte/src/routes/portal/subscriptions/[id]/+page.svelte', sha256: '833c883194d433ab232b2450c55f8990ebfb9ae04a30873692c744f66770c0fc' },
	{ path: 'apps/storefront-svelte/src/lib/subscriptions/SubscriptionDetailView.svelte', sha256: '0a91e9f03497b0901dc6d47de0d743cf00a8bf8f40ee9ebacbfd50761be3d044' },
] as const;

const excluded = (module: string, reason: string, invariant: string) => ({ module, reason, invariant });
const external = (module: string, classification: 'framework-runtime' | 'generated-types') => ({ module, classification });

export const KIBBLE_SEARCH_SOURCE_CLOSURE = {
	scope: 'canonical-search-import-closure-at-pinned-commit',
	roots: ['apps/storefront-svelte/src/routes/search/+page.server.ts', 'apps/storefront-svelte/src/routes/search/+page.svelte'],
	traversalRule: 'Traverse adapted imports recursively; excluded roots terminate traversal; framework and generated imports are external.',
	adapted: KIBBLE_SEARCH_ADAPTED_SOURCE_FILES,
	excluded: [
		excluded('apps/storefront-svelte/src/routes/search/+page.server.ts', 'Search data loading is not adapted because Aisles has no approved Kibble search authority.', 'The Preserve search route must issue no catalog or search request.'),
		excluded('$lib/components/ProductCard.svelte', 'Result-card commerce links are excluded while PDP publication remains approval-gated.', 'Search must not expose a product destination before PDP approval.'),
	],
	external: [external('./$types', 'generated-types'), external('$app/navigation', 'framework-runtime')],
	exclusionInvariant: 'The adapted search shell may submit a query navigation, but it must not load results or expose product commerce without approved authority.',
} as const;

export const KIBBLE_CART_SOURCE_CLOSURE = {
	scope: 'canonical-cart-import-closure-at-pinned-commit',
	roots: ['apps/storefront-svelte/src/routes/cart/+page.server.ts', 'apps/storefront-svelte/src/routes/cart/+page.svelte'],
	traversalRule: 'Traverse adapted imports recursively; excluded roots terminate traversal; framework and generated imports are external.',
	adapted: KIBBLE_CART_ADAPTED_SOURCE_FILES,
	excluded: [
		excluded('apps/storefront-svelte/src/routes/cart/+page.server.ts', 'Canonical cart loading and actions require commerce services Aisles has not authorized.', 'The Preserve cart route must not read or mutate a cart.'),
		excluded('$lib/components/CartLine.svelte', 'Cart-line quantity, removal, and subscription controls require cart mutation authority.', 'No cart-line action may render as supported.'),
		excluded('$lib/components/CartTotals.svelte', 'Totals and checkout destination require a verified cart and checkout URL.', 'No amount, discount, or checkout destination may be claimed.'),
		excluded('$lib/server/cart', 'Cart types and services are commerce-owned and are not invoked by the Preserve empty state.', 'The Preserve cart route remains service-free.'),
	],
	external: [external('./$types', 'generated-types')],
	exclusionInvariant: 'The adapted cart keeps canonical empty-cart anatomy only; it performs no cart read, write, total calculation, or checkout transition.',
} as const;

export const KIBBLE_ACCOUNT_SOURCE_CLOSURE = {
	scope: 'canonical-account-import-closure-at-pinned-commit',
	roots: [
		'apps/storefront-svelte/src/routes/account/+layout.server.ts', 'apps/storefront-svelte/src/routes/account/+layout.svelte',
		'apps/storefront-svelte/src/routes/account/login/+page.server.ts', 'apps/storefront-svelte/src/routes/account/login/+page.svelte',
		'apps/storefront-svelte/src/routes/account/register/+page.server.ts', 'apps/storefront-svelte/src/routes/account/register/+page.svelte',
		'apps/storefront-svelte/src/routes/account/orders/+page.server.ts', 'apps/storefront-svelte/src/routes/account/orders/+page.svelte',
		'apps/storefront-svelte/src/routes/account/payment-methods/+page.server.ts', 'apps/storefront-svelte/src/routes/account/payment-methods/+page.svelte',
		'apps/storefront-svelte/src/routes/account/addresses/+page.server.ts', 'apps/storefront-svelte/src/routes/account/addresses/+page.svelte',
		'apps/storefront-svelte/src/routes/account/subscriptions/+page.server.ts', 'apps/storefront-svelte/src/routes/account/subscriptions/+page.svelte',
		'apps/storefront-svelte/src/routes/account/logout/+page.server.ts',
	],
	traversalRule: 'Traverse adapted imports recursively; excluded roots terminate traversal; framework and generated imports are external.',
	adapted: KIBBLE_ACCOUNT_ADAPTED_SOURCE_FILES,
	excluded: [
		...['+layout.server.ts', 'login/+page.server.ts', 'register/+page.server.ts', 'orders/+page.server.ts', 'payment-methods/+page.server.ts', 'addresses/+page.server.ts', 'subscriptions/+page.server.ts', 'logout/+page.server.ts'].map((path) => excluded(`apps/storefront-svelte/src/routes/account/${path}`, 'Customer authentication and account services are not available in Aisles Preserve.', 'The account shell must not authenticate, read, create, update, or delete customer data.')),
		excluded('$lib/subscriptions/SubscriberPortalApp.svelte', 'Subscription management is classified in its own closure and remains service-disabled.', 'Account routes must not initialize the subscriber portal client.'),
		excluded('$lib/subscriptions/api-client', 'No subscription API authority is configured.', 'Account routes must not call the subscription API.'),
		excluded('$lib/brand/config', 'Aisles supplies the tenant name through its trusted server brand record instead of importing source runtime config.', 'Displayed tenant identity must come from trusted server data.'),
	],
	external: [external('./$types', 'generated-types'), external('$app/stores', 'framework-runtime'), external('$env/dynamic/public', 'framework-runtime')],
	exclusionInvariant: 'The adapted account shell preserves navigation and form anatomy while every identity and account mutation stays disabled and request-free.',
} as const;

export const KIBBLE_CHECKOUT_SOURCE_CLOSURE = {
	scope: 'canonical-checkout-import-closure-at-pinned-commit',
	roots: [
		'apps/storefront-svelte/src/routes/checkout/gift/+page.ts', 'apps/storefront-svelte/src/routes/checkout/gift/+page.svelte',
		'apps/storefront-svelte/src/routes/checkout/prepaid/+page.ts', 'apps/storefront-svelte/src/routes/checkout/prepaid/+page.svelte',
		'apps/storefront-svelte/src/routes/checkout/confirmation/+page.svelte',
	],
	traversalRule: 'Traverse adapted imports recursively; excluded roots terminate traversal; framework and generated imports are external.',
	adapted: KIBBLE_CHECKOUT_ADAPTED_SOURCE_FILES,
	excluded: [
		excluded('apps/storefront-svelte/src/routes/checkout/gift/+page.ts', 'Gift query parameters identify an executable purchase flow and are not consumed by Preserve.', 'The disabled gift shell must not infer a product, plan, recipient, cycles, or total.'),
		excluded('apps/storefront-svelte/src/routes/checkout/prepaid/+page.ts', 'Prepaid query parameters identify an executable purchase flow and are not consumed by Preserve.', 'The disabled prepaid shell must not infer a plan, term, savings, or total.'),
		excluded('$lib/subscriptions/api-client', 'Purchase, preflight, magic-link, and instrument operations require an unavailable backend.', 'No checkout API method may be constructed or invoked.'),
		excluded('./api-client', 'The adapted purchase views import the same unavailable subscription API through a relative specifier.', 'No checkout API type, token, or method may be used by the Preserve shell.'),
		excluded('./AddStoredInstrumentButton.svelte', 'Stored-instrument provisioning is a money-path action.', 'No payment method control may be enabled.'),
	],
	external: [external('./$types', 'generated-types'), external('$env/dynamic/public', 'framework-runtime'), external('$app/stores', 'framework-runtime'), external('svelte', 'framework-runtime')],
	exclusionInvariant: 'Gift, prepaid, and confirmation shells preserve canonical anatomy without amounts, savings, order claims, authentication, payment collection, or purchase actions.',
} as const;

export const KIBBLE_SUBSCRIPTIONS_SOURCE_CLOSURE = {
	scope: 'canonical-subscriptions-import-closure-at-pinned-commit',
	roots: [
		'apps/storefront-svelte/src/routes/subscriptions/+page.server.ts', 'apps/storefront-svelte/src/routes/subscriptions/+page.svelte',
		'apps/storefront-svelte/src/routes/account/subscriptions/+page.server.ts', 'apps/storefront-svelte/src/routes/account/subscriptions/+page.svelte',
		'apps/storefront-svelte/src/routes/portal/subscriptions/[id]/+page.svelte',
	],
	traversalRule: 'Traverse adapted imports recursively; excluded roots terminate traversal; framework and generated imports are external.',
	adapted: KIBBLE_SUBSCRIPTIONS_ADAPTED_SOURCE_FILES,
	excluded: [
		excluded('apps/storefront-svelte/src/routes/subscriptions/+page.server.ts', 'The canonical compatibility redirect depends on account authentication state.', 'Preserve renders a stable subscription shell without redirecting into an unauthorized account flow.'),
		excluded('apps/storefront-svelte/src/routes/account/subscriptions/+page.server.ts', 'SSO, B2B context, and subscription session exchange are not available.', 'No account or subscription session is created.'),
		excluded('$lib/subscriptions/api-client', 'Subscription reads and mutations require an unavailable API.', 'No subscriber or subscription data request may run.'),
		excluded('./api-client', 'Adapted portal components import the same unavailable subscription API through a relative specifier.', 'No portal API type, token, or method may be used by the Preserve shell.'),
		...['ManagePanel.svelte', 'UpdatePaymentForm.svelte', 'UpdateShippingAddressForm.svelte', 'UpdateBillingAddressForm.svelte', 'CancelSubscriptionButton.svelte', 'RenewalStatePanel.svelte', 'PrepaidPanel.svelte', 'GiftPanel.svelte', 'SubscriberPreferencesPanel.svelte', 'SubscriptionStatusActions.svelte', 'BuildABoxPanel.svelte'].map((name) => excluded(`./${name}`, 'This child performs or presents subscription management that Aisles cannot execute.', 'The Preserve shell must not expose this action as available.')),
		excluded('./subscriptionStatus', 'Live subscription status formatting would imply subscription data authority.', 'No production subscription status or guarantee is displayed.'),
		excluded('./types', 'Charge summaries and subscription types belong to the excluded live portal.', 'No charge or renewal record is synthesized.'),
		excluded('$lib/subscriptions/types', 'The detail route imports the excluded live portal types through the source alias.', 'No charge or renewal record is synthesized.'),
	],
	external: [external('./$types', 'generated-types'), external('$env/dynamic/public', 'framework-runtime'), external('svelte', 'framework-runtime')],
	exclusionInvariant: 'The adapted subscription shells preserve the canonical sign-in and detail hierarchy while all subscriber data, status, billing, renewal, cancellation, gift, and prepaid behavior stays unavailable.',
} as const;

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

const SourceDependencyClosureSchema = z.object({
	scope: RequiredString,
	roots: UniqueRequiredStrings,
	traversalRule: z.literal('Traverse adapted imports recursively; excluded roots terminate traversal; framework and generated imports are external.'),
	adapted: z.array(z.object({ path: RequiredString, sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict()).min(1),
	excluded: z.array(z.object({ module: RequiredString, reason: RequiredString, invariant: RequiredString }).strict()).min(1),
	external: z.array(z.object({ module: RequiredString, classification: z.enum(['framework-runtime', 'generated-types']) }).strict()).min(1),
	exclusionInvariant: RequiredString,
}).strict();

const CanonicalAdaptationSourceSchema = z.object({
	owner: z.literal('canonical-reference-adaptation'),
	commit: z.literal('ef122b8e17b9eb0b327c9d42491c44a61577ead4'),
	dependencyClosure: SourceDependencyClosureSchema,
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
		'kc.search.reference-shell', 'kc.cart.reference-shell', 'kc.account.reference-shell',
		'kc.checkout.reference-shell', 'kc.subscriptions.reference-shell',
	],
	assetSlots: ['featured.image', 'product.image', 'product.gallery', 'tile.image'],
	linkTargets: ['home', 'catalog-category', 'search-results', 'account', 'cart', 'saved-picks', 'product-detail', 'featured-bundle', 'browse-all', 'visual-tile', 'checkout'],
	actionTargets: ['open-mobile-navigation', 'close-mobile-navigation', 'open-search', 'close-search', 'open-cart-drawer', 'open-picks-tray'],
} as const;

export const KibbleReferenceContractSchema = z.object({
	id: z.literal('kibble-shelf-native'),
	version: z.literal('1.6.0'),
	status: z.literal('approved-reference'),
		source: z.object({
		repository: z.literal('bc-subscriptions'),
		remote: z.literal('git@github.com:nino-chavez/bc-subscriptions.git'),
		commit: z.string().regex(/^[0-9a-f]{40}$/),
		referenceContractVersion: z.literal('1.5.0'),
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
			acceptance: z.literal('pending-parity'),
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
				dependencyClosure: z.object({
					scope: z.literal('canonical-pdp-import-closure-at-pinned-commit'),
					traversalRule: z.literal('Traverse adapted imports recursively; excluded roots terminate traversal; framework and generated imports are external.'),
					adapted: z.array(z.object({ path: RequiredString, sha256: z.string().regex(/^[0-9a-f]{64}$/) }).strict()).length(KIBBLE_PDP_ADAPTED_SOURCE_FILES.length),
					excluded: z.array(z.object({ module: RequiredString, reason: RequiredString }).strict()).length(KIBBLE_PDP_EXCLUDED_DEPENDENCIES.length),
					external: z.array(z.object({ module: RequiredString, classification: z.enum(['framework-runtime', 'generated-types']) }).strict()).length(KIBBLE_PDP_EXTERNAL_DEPENDENCIES.length),
					exclusionInvariant: z.literal('Excluded commerce and subscription dependencies must not be imported, invoked, or represented as claims in the Aisles catalog-display-only PDP.'),
				}).strict(),
			}).strict(),
			bundleProjection: z.object({
				sourcePath: z.literal('apps/storefront-svelte/src/lib/brand/bundle-contents.json'),
				serialization: z.literal('canonical-json-v1'),
				bundleCount: z.literal(8),
				sha256: z.literal(KIBBLE_PDP_BUNDLE_PROJECTION_SHA256),
			}).strict(),
			orderedAnatomy: z.tuple([
				z.literal('breadcrumbs'), z.literal('media-gallery'), z.literal('product-identity'),
				z.literal('conditional-bundle-summary'), z.literal('catalog-price-and-availability'),
				z.literal('conditional-bundle-contents'), z.literal('catalog-options'),
				z.literal('truthful-purchase-unavailable'), z.literal('description-and-specifications'),
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
				visibleState: z.literal('truthful-purchase-unavailable'),
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
		search: z.object({
			id: z.literal('kibble-search-reference-v1'), acceptance: z.literal('pending-parity'), implementation: z.literal('KibbleSearchReference.svelte'), variantId: z.literal('kibble.search.reference-shell'),
			source: CanonicalAdaptationSourceSchema,
			orderedAnatomy: z.tuple([z.literal('breadcrumbs'), z.literal('query-heading'), z.literal('search-control'), z.literal('result-count'), z.literal('empty-result-message'), z.literal('catalog-recovery')]),
			responsive: z.object({ mobile: z.literal('fluid-search-and-single-column-results'), desktop: z.literal('wide-query-header-and-results-grid') }).strict(),
			backend: z.literal('not-authorized-no-catalog-or-search-call'),
			fallback: z.literal('canonical-empty-search-anatomy-with-no-result-claim'),
		}).strict(),
		cart: z.object({
			id: z.literal('kibble-cart-reference-v1'), acceptance: z.literal('pending-parity'), implementation: z.literal('KibbleCartReference.svelte'), variantId: z.literal('kibble.cart.reference-shell'),
			source: CanonicalAdaptationSourceSchema,
			orderedAnatomy: z.tuple([z.literal('breadcrumbs'), z.literal('cart-heading'), z.literal('header-rule'), z.literal('empty-cart-message'), z.literal('catalog-recovery')]),
			responsive: z.object({ mobile: z.literal('single-column-empty-cart'), desktop: z.literal('wide-empty-cart-with-canonical-spacing') }).strict(),
			backend: z.literal('not-authorized-no-cart-read-or-write'),
			fallback: z.literal('canonical-empty-cart-anatomy-with-no-cart-claim'),
		}).strict(),
		checkout: z.object({
			id: z.literal('kibble-checkout-reference-v1'), acceptance: z.literal('pending-parity'), implementation: z.literal('KibbleCheckoutReference.svelte'), variantId: z.literal('kibble.checkout.reference-shell'),
			source: CanonicalAdaptationSourceSchema,
			subtypes: z.tuple([z.literal('checkout'), z.literal('gift'), z.literal('prepaid'), z.literal('confirmation')]),
			orderedAnatomy: z.tuple([z.literal('bounded-checkout-column'), z.literal('route-heading'), z.literal('route-introduction'), z.literal('disabled-route-fields'), z.literal('unavailable-action'), z.literal('catalog-recovery')]),
			responsive: z.object({ mobile: z.literal('full-width-form-card'), desktop: z.literal('centered-max-lg-form-card') }).strict(),
			backend: z.literal('not-authorized-no-checkout-sdk-or-redirect'),
			fallback: z.literal('canonical-route-form-anatomy-with-disabled-actions'),
		}).strict(),
		account: z.object({
			id: z.literal('kibble-account-reference-v1'), acceptance: z.literal('pending-parity'), implementation: z.literal('KibbleAccountReference.svelte'), variantId: z.literal('kibble.account.reference-shell'),
			source: CanonicalAdaptationSourceSchema,
			subtypes: z.tuple([z.literal('login'), z.literal('register'), z.literal('orders'), z.literal('addresses'), z.literal('payment-methods'), z.literal('subscriptions'), z.literal('logout'), z.literal('unknown')]),
			orderedAnatomy: z.tuple([z.literal('breadcrumbs'), z.literal('account-heading'), z.literal('section-navigation'), z.literal('route-heading'), z.literal('disabled-route-content')]),
			responsive: z.object({ mobile: z.literal('horizontal-scroll-navigation-over-content'), desktop: z.literal('two-column-sidebar-and-content') }).strict(),
			backend: z.literal('not-authorized-no-account-read-or-write'),
			fallback: z.literal('canonical-account-layout-with-disabled-route-content'),
		}).strict(),
		subscriptions: z.object({
			id: z.literal('kibble-subscriptions-reference-v1'), acceptance: z.literal('pending-parity'), implementation: z.literal('KibbleSubscriptionsReference.svelte'), variantId: z.literal('kibble.subscriptions.reference-shell'),
			source: CanonicalAdaptationSourceSchema,
			subtypes: z.tuple([z.literal('portal'), z.literal('account'), z.literal('detail')]),
			orderedAnatomy: z.tuple([z.literal('route-heading'), z.literal('sign-in-or-detail-introduction'), z.literal('disabled-identity-control'), z.literal('unavailable-state')]),
			responsive: z.object({ mobile: z.literal('single-column-form'), desktop: z.literal('bounded-portal-content') }).strict(),
			backend: z.literal('not-authorized-no-subscription-read-or-write'),
			fallback: z.literal('canonical-portal-anatomy-with-disabled-actions'),
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
	unionZoneCoverage: z.array(z.object({ id: z.enum(KIBBLE_CANONICAL_UNION_ZONE_IDS), classification: z.enum(['fixed', 'hidden', 'not-applicable']), reason: RequiredString }).strict()).length(KIBBLE_CANONICAL_UNION_ZONE_IDS.length).superRefine((entries, ctx) => {
		if (JSON.stringify(entries.map(({ id }) => id)) !== JSON.stringify(KIBBLE_CANONICAL_UNION_ZONE_IDS)) ctx.addIssue({ code: 'custom', message: 'Union zone coverage must exactly match the canonical ordered snapshot' });
	}),
	routeInventory: z.array(z.object({ path: RequiredString, audience: z.enum(['shopper', 'operator', 'development']), classification: z.enum(['reference-preserve', 'reference-unavailable', 'operator-only', 'development-only', 'not-applicable']), reason: RequiredString }).strict()).min(1),
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
	if (contract.recipes.pdp.source.commit !== contract.source.commit) {
		ctx.addIssue({ code: 'custom', message: 'PDP source commit must match the canonical Kibble source commit', path: ['recipes', 'pdp', 'source', 'commit'] });
	}
	const dependencyClosure = contract.recipes.pdp.source.dependencyClosure;
	if (JSON.stringify(dependencyClosure.adapted) !== JSON.stringify(KIBBLE_PDP_ADAPTED_SOURCE_FILES)) {
		ctx.addIssue({ code: 'custom', message: 'PDP adapted dependency closure must match the pinned canonical import closure', path: ['recipes', 'pdp', 'source', 'dependencyClosure', 'adapted'] });
	}
	if (JSON.stringify(dependencyClosure.excluded) !== JSON.stringify(KIBBLE_PDP_EXCLUDED_DEPENDENCIES)) {
		ctx.addIssue({ code: 'custom', message: 'PDP excluded dependency closure must retain every approved module and reason', path: ['recipes', 'pdp', 'source', 'dependencyClosure', 'excluded'] });
	}
	if (JSON.stringify(dependencyClosure.external) !== JSON.stringify(KIBBLE_PDP_EXTERNAL_DEPENDENCIES)) {
		ctx.addIssue({ code: 'custom', message: 'PDP external dependency closure must retain every framework and generated import', path: ['recipes', 'pdp', 'source', 'dependencyClosure', 'external'] });
	}
	const pdpSourcePaths = dependencyClosure.adapted.map(({ path }) => path);
	if (new Set(pdpSourcePaths).size !== pdpSourcePaths.length) {
		ctx.addIssue({ code: 'custom', message: 'PDP adapted source file paths must be unique', path: ['recipes', 'pdp', 'source', 'dependencyClosure', 'adapted'] });
	}
	const classifiedDependencies = [
		...pdpSourcePaths,
		...dependencyClosure.excluded.map(({ module }) => module),
		...dependencyClosure.external.map(({ module }) => module),
	];
	if (new Set(classifiedDependencies).size !== classifiedDependencies.length) {
		ctx.addIssue({ code: 'custom', message: 'Each PDP dependency must have exactly one classification', path: ['recipes', 'pdp', 'source', 'dependencyClosure'] });
	}
	if (!pdpSourcePaths.includes(contract.recipes.pdp.bundleProjection.sourcePath)) {
		ctx.addIssue({ code: 'custom', message: 'PDP bundle projection must name a pinned canonical source file', path: ['recipes', 'pdp', 'bundleProjection', 'sourcePath'] });
	}
	const expectedClosures = {
		search: KIBBLE_SEARCH_SOURCE_CLOSURE,
		cart: KIBBLE_CART_SOURCE_CLOSURE,
		account: KIBBLE_ACCOUNT_SOURCE_CLOSURE,
		checkout: KIBBLE_CHECKOUT_SOURCE_CLOSURE,
		subscriptions: KIBBLE_SUBSCRIPTIONS_SOURCE_CLOSURE,
	} as const;
	for (const [surface, expected] of Object.entries(expectedClosures)) {
		const recipe = contract.recipes[surface as keyof typeof expectedClosures];
		if (recipe.source.commit !== contract.source.commit) {
			ctx.addIssue({ code: 'custom', message: `${surface} source commit must match the canonical Kibble source commit`, path: ['recipes', surface, 'source', 'commit'] });
		}
		const closure = recipe.source.dependencyClosure;
		if (JSON.stringify(closure) !== JSON.stringify(expected)) {
			ctx.addIssue({ code: 'custom', message: `${surface} dependency closure must exactly match its independently pinned classification`, path: ['recipes', surface, 'source', 'dependencyClosure'] });
		}
		const classifications = [
			...closure.adapted.map(({ path }) => path),
			...closure.excluded.map(({ module }) => module),
			...closure.external.map(({ module }) => module),
		];
		if (new Set(classifications).size !== classifications.length) {
			ctx.addIssue({ code: 'custom', message: `${surface} dependency closure classifies a dependency more than once`, path: ['recipes', surface, 'source', 'dependencyClosure'] });
		}
		for (const root of closure.roots) {
			if (!classifications.includes(root)) {
				ctx.addIssue({ code: 'custom', message: `${surface} dependency root ${root} is unclassified`, path: ['recipes', surface, 'source', 'dependencyClosure', 'roots'] });
			}
		}
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

	for (const [recipeName, recipe] of Object.entries({ plp: contract.recipes.plp, pdp: contract.recipes.pdp, error: contract.recipes.error, search: contract.recipes.search, cart: contract.recipes.cart, checkout: contract.recipes.checkout, account: contract.recipes.account, subscriptions: contract.recipes.subscriptions })) {
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
	id: 'kibble-shelf-native', version: '1.6.0', status: 'approved-reference',
	source: {
		repository: 'bc-subscriptions', remote: 'git@github.com:nino-chavez/bc-subscriptions.git',
		commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4', referenceContractVersion: '1.5.0', applicationPath: 'apps/storefront-svelte',
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
			aislesOwned: ['server-verified catalog facts', 'truthful unavailable-purchase copy', 'only contracted product destinations'],
		},
		{
			id: 'kibble.error', implementation: 'KibbleErrorReference.svelte',
			variants: [variant('kibble.error.reference-shell', ['kc.error.reference-shell'], ['status', 'message', 'eyebrow', 'headline', 'returnLabel'], [], ['home'], [], [copy('message', 240, ['merchant-policy']), copy('eyebrow', 32, ['reference-copy']), copy('headline', 72, ['reference-copy']), copy('returnLabel', 40, ['reference-copy'])])],
			referenceOwned: ['centered status composition', 'reference type hierarchy', 'single bounded recovery action'],
			aislesOwned: ['HTTP status', 'safe public message', 'home destination'],
		},
		{
			id: 'kibble.search', implementation: 'KibbleSearchReference.svelte',
			variants: [variant('kibble.search.reference-shell', ['kc.search.reference-shell'], ['query', 'availabilityMessage', 'policyVersion'], [], ['home', 'search-results'], [], [copy('query', 160, ['computed-fact']), copy('availabilityMessage', 240, ['merchant-policy'])])],
			referenceOwned: ['breadcrumb placement', 'query heading', 'large search control', 'result count position', 'empty-result spacing'],
			aislesOwned: ['bounded query echo', 'truthful backend availability', 'safe search navigation'],
		},
		{
			id: 'kibble.cart', implementation: 'KibbleCartReference.svelte',
			variants: [variant('kibble.cart.reference-shell', ['kc.cart.reference-shell'], ['availabilityMessage', 'policyVersion'], [], ['home', 'catalog-category'], [], [copy('availabilityMessage', 240, ['merchant-policy'])])],
			referenceOwned: ['breadcrumb placement', 'cart title rule', 'empty-cart spacing', 'primary catalog recovery'],
			aislesOwned: ['truthful no-cart state', 'safe catalog destination'],
		},
		{
			id: 'kibble.account', implementation: 'KibbleAccountReference.svelte',
			variants: [variant('kibble.account.reference-shell', ['kc.account.reference-shell'], ['subtype', 'brandName', 'availabilityMessage', 'policyVersion'], [], ['home', 'account'], [], [copy('brandName', 40, ['merchant-policy']), copy('availabilityMessage', 240, ['merchant-policy'])])],
			referenceOwned: ['account breadcrumbs', 'account title rule', 'responsive section navigation', 'route-specific form and empty-state hierarchy'],
			aislesOwned: ['trusted tenant identity', 'route subtype', 'disabled unavailable controls'],
		},
		{
			id: 'kibble.checkout', implementation: 'KibbleCheckoutReference.svelte',
			variants: [variant('kibble.checkout.reference-shell', ['kc.checkout.reference-shell'], ['subtype', 'availabilityMessage', 'policyVersion'], [], ['home'], [], [copy('availabilityMessage', 240, ['merchant-policy'])])],
			referenceOwned: ['bounded form-card column', 'gift and prepaid headings', 'field rhythm', 'confirmation hierarchy'],
			aislesOwned: ['route subtype', 'disabled unavailable controls', 'safe home destination'],
		},
		{
			id: 'kibble.subscriptions', implementation: 'KibbleSubscriptionsReference.svelte',
			variants: [variant('kibble.subscriptions.reference-shell', ['kc.subscriptions.reference-shell'], ['subtype', 'availabilityMessage', 'policyVersion'], [], ['home', 'account'], [], [copy('availabilityMessage', 240, ['merchant-policy'])])],
			referenceOwned: ['portal heading hierarchy', 'sign-in form anatomy', 'subscription-detail hierarchy'],
			aislesOwned: ['route subtype', 'disabled identity and management controls', 'safe account destination'],
		},
	],
	recipes: {
		home: {
			id: 'kibble-home-reference-v1', acceptance: 'pending-parity', implementation: 'KibbleHomeReference.svelte', rootLayoutChrome: 'kibble.header', rootLayoutFooter: 'kibble.footer',
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
			source: {
				commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4',
				dependencyClosure: {
					scope: 'canonical-pdp-import-closure-at-pinned-commit',
					traversalRule: 'Traverse adapted imports recursively; excluded roots terminate traversal; framework and generated imports are external.',
					adapted: KIBBLE_PDP_ADAPTED_SOURCE_FILES,
					excluded: KIBBLE_PDP_EXCLUDED_DEPENDENCIES,
					external: KIBBLE_PDP_EXTERNAL_DEPENDENCIES,
					exclusionInvariant: 'Excluded commerce and subscription dependencies must not be imported, invoked, or represented as claims in the Aisles catalog-display-only PDP.',
				},
			},
			bundleProjection: { sourcePath: 'apps/storefront-svelte/src/lib/brand/bundle-contents.json', serialization: 'canonical-json-v1', bundleCount: 8, sha256: KIBBLE_PDP_BUNDLE_PROJECTION_SHA256 },
			orderedAnatomy: ['breadcrumbs', 'media-gallery', 'product-identity', 'conditional-bundle-summary', 'catalog-price-and-availability', 'conditional-bundle-contents', 'catalog-options', 'truthful-purchase-unavailable', 'description-and-specifications', 'related-products'],
			allowedCatalogFields: ['name', 'sku', 'description', 'images', 'options', 'price', 'salePrice', 'currencyCode', 'inventory', 'category', 'breadcrumbs', 'relatedProducts', 'customFields'],
			commerce: { mode: 'catalog-display-only', sourcePurchaseControls: 'not-rendered-in-aisles', visibleState: 'truthful-purchase-unavailable', forbidden: ['add-to-cart', 'cart', 'checkout', 'subscription', 'auto-refill-pricing', 'savings-claim', 'model-layout', 'generic-picks'] },
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
		search: {
			id: 'kibble-search-reference-v1', acceptance: 'pending-parity', implementation: 'KibbleSearchReference.svelte', variantId: 'kibble.search.reference-shell',
			source: { owner: 'canonical-reference-adaptation', commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4', dependencyClosure: KIBBLE_SEARCH_SOURCE_CLOSURE }, orderedAnatomy: ['breadcrumbs', 'query-heading', 'search-control', 'result-count', 'empty-result-message', 'catalog-recovery'], responsive: { mobile: 'fluid-search-and-single-column-results', desktop: 'wide-query-header-and-results-grid' }, backend: 'not-authorized-no-catalog-or-search-call', fallback: 'canonical-empty-search-anatomy-with-no-result-claim',
		},
		cart: {
			id: 'kibble-cart-reference-v1', acceptance: 'pending-parity', implementation: 'KibbleCartReference.svelte', variantId: 'kibble.cart.reference-shell',
			source: { owner: 'canonical-reference-adaptation', commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4', dependencyClosure: KIBBLE_CART_SOURCE_CLOSURE }, orderedAnatomy: ['breadcrumbs', 'cart-heading', 'header-rule', 'empty-cart-message', 'catalog-recovery'], responsive: { mobile: 'single-column-empty-cart', desktop: 'wide-empty-cart-with-canonical-spacing' }, backend: 'not-authorized-no-cart-read-or-write', fallback: 'canonical-empty-cart-anatomy-with-no-cart-claim',
		},
		checkout: {
			id: 'kibble-checkout-reference-v1', acceptance: 'pending-parity', implementation: 'KibbleCheckoutReference.svelte', variantId: 'kibble.checkout.reference-shell',
			source: { owner: 'canonical-reference-adaptation', commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4', dependencyClosure: KIBBLE_CHECKOUT_SOURCE_CLOSURE }, subtypes: ['checkout', 'gift', 'prepaid', 'confirmation'], orderedAnatomy: ['bounded-checkout-column', 'route-heading', 'route-introduction', 'disabled-route-fields', 'unavailable-action', 'catalog-recovery'], responsive: { mobile: 'full-width-form-card', desktop: 'centered-max-lg-form-card' }, backend: 'not-authorized-no-checkout-sdk-or-redirect', fallback: 'canonical-route-form-anatomy-with-disabled-actions',
		},
		account: {
			id: 'kibble-account-reference-v1', acceptance: 'pending-parity', implementation: 'KibbleAccountReference.svelte', variantId: 'kibble.account.reference-shell',
			source: { owner: 'canonical-reference-adaptation', commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4', dependencyClosure: KIBBLE_ACCOUNT_SOURCE_CLOSURE }, subtypes: ['login', 'register', 'orders', 'addresses', 'payment-methods', 'subscriptions', 'logout', 'unknown'], orderedAnatomy: ['breadcrumbs', 'account-heading', 'section-navigation', 'route-heading', 'disabled-route-content'], responsive: { mobile: 'horizontal-scroll-navigation-over-content', desktop: 'two-column-sidebar-and-content' }, backend: 'not-authorized-no-account-read-or-write', fallback: 'canonical-account-layout-with-disabled-route-content',
		},
		subscriptions: {
			id: 'kibble-subscriptions-reference-v1', acceptance: 'pending-parity', implementation: 'KibbleSubscriptionsReference.svelte', variantId: 'kibble.subscriptions.reference-shell',
			source: { owner: 'canonical-reference-adaptation', commit: 'ef122b8e17b9eb0b327c9d42491c44a61577ead4', dependencyClosure: KIBBLE_SUBSCRIPTIONS_SOURCE_CLOSURE }, subtypes: ['portal', 'account', 'detail'], orderedAnatomy: ['route-heading', 'sign-in-or-detail-introduction', 'disabled-identity-control', 'unavailable-state'], responsive: { mobile: 'single-column-form', desktop: 'bounded-portal-content' }, backend: 'not-authorized-no-subscription-read-or-write', fallback: 'canonical-portal-anatomy-with-disabled-actions',
		},
	},
	viewports: { mobile: { minPx: 320, maxPx: 767, columns: 1 }, tablet: { minPx: 768, maxPx: 1023, columns: 2 }, desktop: { minPx: 1024, contentMaxPx: 1200, productColumns: 4 }, comparison: { widthsPx: [390, 768, 1280, 1440] } },
	ownership: {
		referenceOwns: ['semantic token meanings', 'required chrome', 'component anatomy', 'home recipe order', 'responsive density', 'visual fallbacks'],
		aislesOwns: ['catalog and subscription data', 'ranking within approved slots', 'approved bounded copy values', 'named navigation targets', 'supported interaction callbacks'],
		forbiddenAtRuntime: ['inventing CSS', 'inventing component variants', 'reordering Preserve recipe slots', 'using mint outside Auto-Refill status and the wordmark exception', 'overlaying copy on packaging labels', 'materializing unsupported links or actions'],
	},
	unionZoneCoverage: [
		{ id: 'home.hero', classification: 'fixed', reason: 'Home recipe owns the opening merchandising slot.' },
		{ id: 'home.featured-row', classification: 'fixed', reason: 'Home recipe owns the ranked shelf.' },
		{ id: 'home.editorial-strip', classification: 'fixed', reason: 'Home recipe owns the category entry module.' },
		{ id: 'home.brand-spotlight', classification: 'not-applicable', reason: 'No pinned Kibble source recipe names this Bealls-only zone.' },
		{ id: 'home.below-fold', classification: 'fixed', reason: 'Home recipe owns the service proof.' },
		{ id: 'plp.banner', classification: 'not-applicable', reason: 'No pinned Kibble source banner is in the PLP anatomy.' },
		{ id: 'plp.editorial-header', classification: 'hidden', reason: 'The fixed Kibble PLP owns its category header directly.' },
		{ id: 'plp.cluster-row', classification: 'hidden', reason: 'No composable merchandising row is authorized in Preserve.' },
		{ id: 'plp.between-thirds', classification: 'not-applicable', reason: 'No pinned Kibble source insertion divides the grid.' },
		{ id: 'plp.below-grid', classification: 'hidden', reason: 'No below-grid module exists in the pinned PLP recipe.' },
		{ id: 'plp.empty-state', classification: 'fixed', reason: 'The fixed PLP recipe owns its empty message.' },
		{ id: 'pdp.below-description', classification: 'hidden', reason: 'The fixed PDP has no composable post-description slot.' },
		{ id: 'pdp.related', classification: 'fixed', reason: 'The fixed PDP owns its related-product shelf.' },
		{ id: 'pdp.cross-sell', classification: 'hidden', reason: 'Cross-sell selection is not authorized.' },
		{ id: 'pdp.recently-viewed', classification: 'hidden', reason: 'History-backed recommendations are not implemented.' },
		{ id: 'pdp.below-recs', classification: 'not-applicable', reason: 'No pinned Kibble source recipe names this Bealls-only slot.' },
		{ id: 'cart.above-checkout-cta', classification: 'fixed', reason: 'Cart renders a fixed unavailable state and no CTA.' },
		{ id: 'cart.below-fold', classification: 'not-applicable', reason: 'No cart composition is authorized without cart data.' },
		{ id: 'cart.empty-state', classification: 'fixed', reason: 'The canonical empty-cart anatomy is fixed and visible.' },
		{ id: 'checkout.assurance-strip', classification: 'hidden', reason: 'Checkout is unavailable and exposes no assurance claims.' },
		{ id: 'checkout.last-chance-upsell', classification: 'hidden', reason: 'Checkout merchandising is not authorized.' },
		{ id: 'search.empty-state', classification: 'fixed', reason: 'Search renders its fixed unavailable state without catalog access.' },
		{ id: 'search.zero-results-rescue', classification: 'fixed', reason: 'Search cannot claim zero results without a search backend.' },
		{ id: 'account.welcome', classification: 'fixed', reason: 'Account renders canonical identity-entry anatomy with unavailable controls.' },
		{ id: 'account.dashboard-pick', classification: 'hidden', reason: 'Account data and picks storage are not authorized.' },
		{ id: 'locator.editorial-intro', classification: 'not-applicable', reason: 'The pinned Kibble source has no store-locator route.' },
		{ id: 'error-404.rescue', classification: 'fixed', reason: 'The Kibble error recipe owns recovery.' },
		{ id: 'error-empty.rescue', classification: 'fixed', reason: 'The Kibble error recipe owns empty recovery.' },
	],
	routeInventory: [
		{ path: '/', audience: 'shopper', classification: 'reference-preserve', reason: 'Contracted Home recipe.' },
		{ path: '/category/[slug]', audience: 'shopper', classification: 'reference-preserve', reason: 'Contracted PLP recipe.' },
		{ path: '/product/[slug]', audience: 'shopper', classification: 'reference-unavailable', reason: 'Development review only until PDP approval passes.' },
		{ path: '/search', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical search anatomy is visible; result loading is not authorized.' },
		{ path: '/cart', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical empty-cart anatomy is visible; cart services are not authorized.' },
		{ path: '/checkout', audience: 'shopper', classification: 'reference-unavailable', reason: 'Kibble checkout boundary is visible; checkout SDK and redirects are not authorized.' },
		{ path: '/checkout/gift', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical gift form anatomy is visible with every money-path action disabled.' },
		{ path: '/checkout/prepaid', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical prepaid form anatomy is visible without a term, savings, amount, or purchase claim.' },
		{ path: '/checkout/confirmation', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical confirmation hierarchy is visible but never claims an order exists.' },
		{ path: '/account', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical account layout is visible; identity services are not authorized.' },
		{ path: '/account/login', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical sign-in anatomy is visible with disabled identity controls.' },
		{ path: '/account/register', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical registration anatomy is visible with disabled identity controls.' },
		{ path: '/account/orders', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical orders section is visible without reading customer data.' },
		{ path: '/account/addresses', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical address section is visible without reading or mutating customer data.' },
		{ path: '/account/payment-methods', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical payment-method section is visible without reading or provisioning instruments.' },
		{ path: '/account/subscriptions', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical account subscription section is visible without subscriber data.' },
		{ path: '/account/logout', audience: 'shopper', classification: 'reference-unavailable', reason: 'The route is bounded by the Kibble account shell and performs no session mutation.' },
		{ path: '/subscriptions', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical portal entry anatomy is visible without redirecting or creating a session.' },
		{ path: '/portal/subscriptions/[id]', audience: 'shopper', classification: 'reference-unavailable', reason: 'Canonical detail hierarchy is visible without loading a subscription or charge.' },
		{ path: '/store-locator', audience: 'shopper', classification: 'not-applicable', reason: 'No pinned Kibble source route exists.' },
		{ path: '/compare', audience: 'shopper', classification: 'not-applicable', reason: 'Generic Aisles comparison depends on picks, which Kibble does not expose; the pinned source has no comparison route.' },
		{ path: '/404-or-unknown', audience: 'shopper', classification: 'reference-preserve', reason: 'Unknown shopper routes resolve through the contracted Kibble error shell.' },
		{ path: '/observe', audience: 'operator', classification: 'operator-only', reason: 'Observe is an operator surface, not Kibble storefront content.' },
		{ path: '/style-guide', audience: 'development', classification: 'development-only', reason: 'Style guide is a development surface, not a shopper route.' },
		{ path: '/about', audience: 'shopper', classification: 'not-applicable', reason: 'Canonical Kibble page outside the current Aisles route and zone taxonomy.' },
		{ path: '/how-it-works', audience: 'shopper', classification: 'not-applicable', reason: 'Canonical Kibble page outside the current Aisles route and zone taxonomy.' },
		{ path: '/gift-preview', audience: 'shopper', classification: 'not-applicable', reason: 'Canonical Kibble development preview outside the current Aisles route and zone taxonomy.' },
		{ path: '/box-preview', audience: 'shopper', classification: 'not-applicable', reason: 'Canonical Kibble development preview outside the current Aisles route and zone taxonomy.' },
		{ path: '/why-subscribe', audience: 'shopper', classification: 'not-applicable', reason: 'Canonical Kibble page outside the current Aisles route and zone taxonomy.' },
		{ path: '/widget-preview', audience: 'development', classification: 'not-applicable', reason: 'Canonical component preview is not an Aisles shopper surface.' },
		{ path: '/auth/verify', audience: 'shopper', classification: 'not-applicable', reason: 'Canonical identity endpoint is excluded because Aisles has no subscription session authority.' },
		{ path: '/gift/[token]', audience: 'shopper', classification: 'not-applicable', reason: 'Canonical gift-claim route is excluded because Aisles has no gift token or subscription authority.' },
	],
} as const;

export type KibbleReferenceContract = z.infer<typeof KibbleReferenceContractSchema>;
export const KIBBLE_REFERENCE_CONTRACT: KibbleReferenceContract = KibbleReferenceContractSchema.parse(contractInput);
