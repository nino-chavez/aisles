import { KIBBLE_REFERENCE_CONTRACT } from './reference/kibble';
import {
	KIBBLE_CART_PRESENTATION_IDS,
	KIBBLE_CHECKOUT_PRESENTATION_IDS,
	KIBBLE_HOME_PRESENTATION_IDS,
	KIBBLE_HOME_PRESENTATION_POLICY,
	KIBBLE_PDP_PRESENTATION_IDS,
	KIBBLE_PLP_PRESENTATION_IDS,
	KIBBLE_SEARCH_PRESENTATION_IDS,
} from './reference/kibble-presentation-decisions';
import {
	AUTONOMY_CAPABILITIES,
	compileCompositionPolicy,
	type BrandCompositionPolicy,
	type CompositionPolicyRegistry,
	type EffectiveCompositionPolicy,
	type OrganizationCompositionPolicy,
} from '$lib/foundation/composition-policy';
import {
	normalizeTrustedShopperRoute,
	tryNormalizeTrustedShopperRoute,
	type TrustedRouteSurface,
} from '$lib/foundation/autonomy-zone-route';
import { findTrustedZoneIdentity, type TrustedZoneIdentityDefinition } from '$lib/foundation/trusted-zone-identity';
import type { Surface } from '$lib/foundation/zones';

const KIBBLE_ORGANIZATION_ID = 'kibble-demo-merchant';

const organization: OrganizationCompositionPolicy = {
	organizationId: KIBBLE_ORGANIZATION_ID,
	policyVersion: 'kibble-organization-policy-v1',
	maximum: {
		capabilities: AUTONOMY_CAPABILITIES,
		decisionMode: 'model',
		publicationMode: 'live',
	},
};

const registeredComponentVariantIds = KIBBLE_REFERENCE_CONTRACT.components.flatMap(
	(component) => component.variants.map((variant) => variant.id),
);
const registeredCopyVariantIds = [...new Set([
	...KIBBLE_HOME_PRESENTATION_IDS.heroCopyVariantIds,
	...KIBBLE_HOME_PRESENTATION_IDS.featuredCopyVariantIds,
	...KIBBLE_HOME_PRESENTATION_IDS.catalogCopyVariantIds,
	...KIBBLE_PLP_PRESENTATION_IDS.headerCopyVariantIds,
	...KIBBLE_PLP_PRESENTATION_IDS.marketingBlockVariantIds,
	...KIBBLE_PDP_PRESENTATION_IDS.relatedCopyVariantIds,
	...KIBBLE_PDP_PRESENTATION_IDS.marketingBlockVariantIds,
	...KIBBLE_SEARCH_PRESENTATION_IDS.emptyCopyVariantIds,
	...KIBBLE_CART_PRESENTATION_IDS.emptyCopyVariantIds,
	...KIBBLE_CHECKOUT_PRESENTATION_IDS.assuranceCopyVariantIds,
])];

const homeComponentVariantIds = [
	...KIBBLE_REFERENCE_CONTRACT.recipes.home.orderedAnatomy.map((slot) => slot.variantId),
	'kibble.product-card.featured-tile',
	'kibble.hero.zone-editorial-header',
	'kibble.featured-grid.ranked-segment',
	'kibble.visual-module.editorial-strip',
	'kibble.service-proof.below-fold',
] as const;
const plpComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.plp.variantId,
	'kibble.product-card.catalog-card',
	'kibble.category-listing.editorial-header',
	'kibble.category-listing.ranked-prefix',
	'kibble.footer.four-column',
] as const;
const pdpComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.pdp.variantId,
	'kibble.product-card.catalog-card',
	'kibble.product-detail.related-products',
	'kibble.footer.four-column',
] as const;
const errorComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.error.variantId,
	'kibble.error.rescue',
	'kibble.footer.four-column',
] as const;
const searchComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.search.variantId,
	'kibble.search.empty-state',
	'kibble.footer.four-column',
] as const;
const cartComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.cart.variantId,
	'kibble.footer.four-column',
] as const;
const checkoutComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.checkout.variantId,
	'kibble.footer.four-column',
] as const;
const accountComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.account.variantId,
	KIBBLE_REFERENCE_CONTRACT.recipes.subscriptions.variantId,
	'kibble.footer.four-column',
] as const;
const locatorComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.error.variantId,
	'kibble.footer.four-column',
] as const;

function cssFor(componentVariantIds: readonly string[]): string[] {
	const wanted = new Set(componentVariantIds);
	return [...new Set(KIBBLE_REFERENCE_CONTRACT.components.flatMap((component) =>
		component.variants
			.filter((variant) => wanted.has(variant.id))
			.flatMap((variant) => variant.cssVariantIds),
	))];
}

const kibble: BrandCompositionPolicy = {
	organizationId: KIBBLE_ORGANIZATION_ID,
	brandId: 'kibble',
	policyVersion: `kibble-policy-${KIBBLE_REFERENCE_CONTRACT.version}`,
	maximum: {
		capabilities: AUTONOMY_CAPABILITIES,
		decisionMode: 'model',
		publicationMode: 'live',
	},
	registeredComponentVariantIds,
	registeredCssVariantIds: KIBBLE_REFERENCE_CONTRACT.registry.cssVariantIds,
	registeredCopyVariantIds,
	reference: {
		referenceId: KIBBLE_REFERENCE_CONTRACT.id,
		referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
	},
	surfaces: {
		home: {
			preset: 'preserve',
			capabilities: ['rank_products', 'select_products'],
			decisionMode: 'rules',
			publicationMode: 'live',
			allowedComponentVariantIds: homeComponentVariantIds,
			allowedCssVariantIds: cssFor(homeComponentVariantIds),
			allowedCopyVariantIds: [],
			zoneOverrides: {
				'home.hero': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: ['kibble.hero.zone-editorial-header'] },
				'home.featured-row': { capabilities: ['rank_products', 'select_products'], decisionMode: 'rules', allowedComponentVariantIds: ['kibble.featured-grid.ranked-segment'] },
				'home.editorial-strip': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: ['kibble.visual-module.editorial-strip'] },
				'home.below-fold': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: ['kibble.service-proof.below-fold'] },
			},
		},
		plp: {
			preset: 'preserve',
			capabilities: [],
			decisionMode: 'fixed',
			publicationMode: 'live',
			allowedComponentVariantIds: plpComponentVariantIds,
			allowedCssVariantIds: cssFor(plpComponentVariantIds),
			allowedCopyVariantIds: [],
			zoneOverrides: {
				'plp.editorial-header': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: ['kibble.category-listing.editorial-header'] },
				'plp.product-ranking': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: ['kibble.category-listing.ranked-prefix'] },
			},
		},
		pdp: {
			preset: 'preserve',
			capabilities: [],
			decisionMode: 'fixed',
			publicationMode: 'live',
			allowedComponentVariantIds: pdpComponentVariantIds,
			allowedCssVariantIds: cssFor(pdpComponentVariantIds),
			allowedCopyVariantIds: [],
			zoneOverrides: { 'pdp.related': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: ['kibble.product-detail.related-products'] } },
		},
		search: {
			preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live',
			allowedComponentVariantIds: searchComponentVariantIds,
			allowedCssVariantIds: cssFor(searchComponentVariantIds), allowedCopyVariantIds: [],
			zoneOverrides: { 'search.empty-state': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: ['kibble.search.empty-state'] } },
		},
		cart: {
			preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live',
			allowedComponentVariantIds: cartComponentVariantIds,
			allowedCssVariantIds: cssFor(cartComponentVariantIds), allowedCopyVariantIds: [],
			zoneOverrides: { 'cart.empty-state': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: [KIBBLE_REFERENCE_CONTRACT.recipes.cart.variantId] } },
		},
		checkout: {
			preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live',
			allowedComponentVariantIds: checkoutComponentVariantIds,
			allowedCssVariantIds: cssFor(checkoutComponentVariantIds), allowedCopyVariantIds: [],
			zoneOverrides: { 'checkout.assurance-strip': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: [KIBBLE_REFERENCE_CONTRACT.recipes.checkout.variantId] } },
		},
		account: {
			preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live',
			allowedComponentVariantIds: accountComponentVariantIds,
			allowedCssVariantIds: cssFor(accountComponentVariantIds), allowedCopyVariantIds: [],
		},
		locator: {
			preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live',
			allowedComponentVariantIds: locatorComponentVariantIds,
			allowedCssVariantIds: cssFor(locatorComponentVariantIds), allowedCopyVariantIds: [],
		},
		'error-404': {
			preset: 'preserve',
			capabilities: [],
			decisionMode: 'fixed',
			publicationMode: 'live',
			allowedComponentVariantIds: errorComponentVariantIds,
			allowedCssVariantIds: cssFor(errorComponentVariantIds),
			allowedCopyVariantIds: [],
			zoneOverrides: { 'error-404.rescue': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: ['kibble.error.rescue'] } },
		},
		'error-empty': {
			preset: 'preserve',
			capabilities: [],
			decisionMode: 'fixed',
			publicationMode: 'live',
			allowedComponentVariantIds: errorComponentVariantIds,
			allowedCssVariantIds: cssFor(errorComponentVariantIds),
			allowedCopyVariantIds: [],
			zoneOverrides: { 'error-empty.rescue': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: ['kibble.error.rescue'] } },
		},
	},
};

/**
 * Prospect-controlled autonomy temperature for the public observability demo.
 * Normal page loads remain Preserve. An explicit trusted action may invoke a
 * model only inside the reviewed presentation zone for that surface.
 */
const kibbleObserveAssist: BrandCompositionPolicy = {
	...kibble,
	policyVersion: `kibble-observe-presentation-policy-${KIBBLE_REFERENCE_CONTRACT.version}-v3`,
	surfaces: {
		...kibble.surfaces,
		home: {
			...kibble.surfaces.home!, preset: 'compose', capabilities: ['rank_products', 'select_copy_variant', 'select_component_variant', 'reorder_zones'], decisionMode: 'model',
			allowedComponentVariantIds: [...homeComponentVariantIds, 'kibble.visual-module.routine'],
			allowedCssVariantIds: cssFor([...homeComponentVariantIds, 'kibble.visual-module.routine']),
			allowedCopyVariantIds: [
				...KIBBLE_HOME_PRESENTATION_IDS.heroCopyVariantIds,
				...KIBBLE_HOME_PRESENTATION_IDS.featuredCopyVariantIds,
				...KIBBLE_HOME_PRESENTATION_IDS.catalogCopyVariantIds,
			],
			zoneOverrides: {
				...kibble.surfaces.home!.zoneOverrides,
				'home.hero': {
					capabilities: ['select_copy_variant'], decisionMode: 'model', publicationMode: 'live',
					allowedComponentVariantIds: ['kibble.hero.zone-editorial-header'],
					allowedCopyVariantIds: KIBBLE_HOME_PRESENTATION_IDS.heroCopyVariantIds,
				},
				'home.featured-row': {
					capabilities: ['rank_products', 'select_copy_variant', 'reorder_zones'], decisionMode: 'model', publicationMode: 'live',
					allowedComponentVariantIds: ['kibble.featured-grid.ranked-segment'],
					allowedCopyVariantIds: KIBBLE_HOME_PRESENTATION_IDS.featuredCopyVariantIds,
				},
				'home.editorial-strip': {
					capabilities: ['select_copy_variant', 'select_component_variant'], decisionMode: 'model', publicationMode: 'live',
					allowedComponentVariantIds: ['kibble.visual-module.category', 'kibble.visual-module.routine'],
					allowedCopyVariantIds: KIBBLE_HOME_PRESENTATION_IDS.catalogCopyVariantIds,
				},
			},
		},
		pdp: {
			...kibble.surfaces.pdp!, preset: 'compose', capabilities: ['rank_products', 'select_copy_variant', 'toggle_zone'], decisionMode: 'model',
			allowedComponentVariantIds: [...pdpComponentVariantIds, 'kibble.hero.zone-editorial-header'],
			allowedCssVariantIds: cssFor([...pdpComponentVariantIds, 'kibble.hero.zone-editorial-header']),
			allowedCopyVariantIds: [...KIBBLE_PDP_PRESENTATION_IDS.relatedCopyVariantIds, ...KIBBLE_PDP_PRESENTATION_IDS.marketingBlockVariantIds],
			zoneOverrides: {
				...kibble.surfaces.pdp!.zoneOverrides,
				'pdp.related': {
					capabilities: ['rank_products', 'select_copy_variant'], decisionMode: 'model', publicationMode: 'live',
					allowedComponentVariantIds: ['kibble.product-detail.related-products'],
					allowedCopyVariantIds: KIBBLE_PDP_PRESENTATION_IDS.relatedCopyVariantIds,
				},
				'pdp.below-description': {
					capabilities: ['select_copy_variant', 'toggle_zone'], decisionMode: 'model', publicationMode: 'live',
					allowedComponentVariantIds: ['kibble.hero.zone-editorial-header'],
					allowedCopyVariantIds: KIBBLE_PDP_PRESENTATION_IDS.marketingBlockVariantIds,
				},
			},
		},
		plp: {
			...kibble.surfaces.plp!, preset: 'compose', capabilities: ['rank_products', 'select_copy_variant', 'toggle_zone'], decisionMode: 'model',
			allowedComponentVariantIds: [...plpComponentVariantIds, 'kibble.hero.zone-editorial-header'],
			allowedCssVariantIds: cssFor([...plpComponentVariantIds, 'kibble.hero.zone-editorial-header']),
			allowedCopyVariantIds: [...KIBBLE_PLP_PRESENTATION_IDS.headerCopyVariantIds, ...KIBBLE_PLP_PRESENTATION_IDS.marketingBlockVariantIds],
			zoneOverrides: {
				...kibble.surfaces.plp!.zoneOverrides,
				'plp.product-ranking': { capabilities: ['rank_products'], decisionMode: 'model', publicationMode: 'live', allowedComponentVariantIds: ['kibble.category-listing.ranked-prefix'] },
				'plp.editorial-header': {
					capabilities: ['select_copy_variant'], decisionMode: 'model', publicationMode: 'live',
					allowedComponentVariantIds: ['kibble.category-listing.editorial-header'],
					allowedCopyVariantIds: KIBBLE_PLP_PRESENTATION_IDS.headerCopyVariantIds,
				},
				'plp.marketing-block': {
					capabilities: ['select_copy_variant', 'toggle_zone'], decisionMode: 'model', publicationMode: 'live',
					allowedComponentVariantIds: ['kibble.hero.zone-editorial-header'],
					allowedCopyVariantIds: KIBBLE_PLP_PRESENTATION_IDS.marketingBlockVariantIds,
				},
			},
		},
		search: {
			...kibble.surfaces.search!, preset: 'assist', capabilities: ['select_copy_variant'], decisionMode: 'model',
			allowedCopyVariantIds: KIBBLE_SEARCH_PRESENTATION_IDS.emptyCopyVariantIds,
			zoneOverrides: {
				'search.empty-state': { capabilities: ['select_copy_variant'], decisionMode: 'model', publicationMode: 'live', allowedComponentVariantIds: ['kibble.search.empty-state'], allowedCopyVariantIds: KIBBLE_SEARCH_PRESENTATION_IDS.emptyCopyVariantIds },
			},
		},
		cart: {
			...kibble.surfaces.cart!, preset: 'assist', capabilities: ['select_copy_variant'], decisionMode: 'model',
			allowedCopyVariantIds: KIBBLE_CART_PRESENTATION_IDS.emptyCopyVariantIds,
			zoneOverrides: {
				'cart.empty-state': { capabilities: ['select_copy_variant'], decisionMode: 'model', publicationMode: 'live', allowedComponentVariantIds: [KIBBLE_REFERENCE_CONTRACT.recipes.cart.variantId], allowedCopyVariantIds: KIBBLE_CART_PRESENTATION_IDS.emptyCopyVariantIds },
			},
		},
		checkout: {
			...kibble.surfaces.checkout!, preset: 'assist', capabilities: ['select_copy_variant'], decisionMode: 'model',
			allowedCopyVariantIds: KIBBLE_CHECKOUT_PRESENTATION_IDS.assuranceCopyVariantIds,
			zoneOverrides: {
				'checkout.assurance-strip': { capabilities: ['select_copy_variant'], decisionMode: 'model', publicationMode: 'live', allowedComponentVariantIds: [KIBBLE_REFERENCE_CONTRACT.recipes.checkout.variantId], allowedCopyVariantIds: KIBBLE_CHECKOUT_PRESENTATION_IDS.assuranceCopyVariantIds },
			},
		},
	},
};

export const AISLES_COMPOSITION_POLICY: CompositionPolicyRegistry = {
	organizations: { [organization.organizationId]: organization },
	brands: { kibble },
};

const KIBBLE_OBSERVE_ASSIST_POLICY: CompositionPolicyRegistry = {
	organizations: { [organization.organizationId]: organization },
	brands: { kibble: kibbleObserveAssist },
};

export type ContractSurfaceDecision =
	| { mode: 'reference-preserve'; policy: EffectiveCompositionPolicy }
	| { mode: 'legacy-generated'; reason: 'uncontracted-brand' | 'unsupported-surface' };

const REQUIRED_PRESERVE_POLICY = {
	home: {
		decisionMode: 'rules',
		publicationMode: 'live',
		capabilities: ['rank_products', 'select_products'],
		componentVariantIds: homeComponentVariantIds,
		cssVariantIds: cssFor(homeComponentVariantIds),
	},
	plp: {
		decisionMode: 'fixed',
		publicationMode: 'live',
		capabilities: [],
		componentVariantIds: plpComponentVariantIds,
		cssVariantIds: cssFor(plpComponentVariantIds),
	},
	pdp: {
		decisionMode: 'fixed',
		publicationMode: 'live',
		capabilities: [],
		componentVariantIds: pdpComponentVariantIds,
		cssVariantIds: cssFor(pdpComponentVariantIds),
	},
	search: { decisionMode: 'fixed', publicationMode: 'live', capabilities: [], componentVariantIds: searchComponentVariantIds, cssVariantIds: cssFor(searchComponentVariantIds) },
	cart: { decisionMode: 'fixed', publicationMode: 'live', capabilities: [], componentVariantIds: cartComponentVariantIds, cssVariantIds: cssFor(cartComponentVariantIds) },
	checkout: { decisionMode: 'fixed', publicationMode: 'live', capabilities: [], componentVariantIds: checkoutComponentVariantIds, cssVariantIds: cssFor(checkoutComponentVariantIds) },
	account: { decisionMode: 'fixed', publicationMode: 'live', capabilities: [], componentVariantIds: accountComponentVariantIds, cssVariantIds: cssFor(accountComponentVariantIds) },
	locator: { decisionMode: 'fixed', publicationMode: 'live', capabilities: [], componentVariantIds: locatorComponentVariantIds, cssVariantIds: cssFor(locatorComponentVariantIds) },
	'error-404': {
		decisionMode: 'fixed',
		publicationMode: 'live',
		capabilities: [],
		componentVariantIds: errorComponentVariantIds,
		cssVariantIds: cssFor(errorComponentVariantIds),
	},
	'error-empty': {
		decisionMode: 'fixed',
		publicationMode: 'live',
		capabilities: [],
		componentVariantIds: errorComponentVariantIds,
		cssVariantIds: cssFor(errorComponentVariantIds),
	},
} as const;

/** Compile a trusted brand/surface decision. Request JSON carries no authority. */
export function getContractSurfaceDecision(
	brandId: unknown,
	surface: Surface | null,
): ContractSurfaceDecision {
	if (brandId !== 'kibble') {
		return { mode: 'legacy-generated', reason: 'uncontracted-brand' };
	}
	if (!surface || !Object.prototype.hasOwnProperty.call(kibble.surfaces, surface)) {
		return { mode: 'legacy-generated', reason: 'unsupported-surface' };
	}
	return {
		mode: 'reference-preserve',
		policy: compileCompositionPolicy({
			organizationId: KIBBLE_ORGANIZATION_ID,
			brandId: 'kibble',
			surface,
			registry: AISLES_COMPOSITION_POLICY,
		}),
	};
}

/**
 * Final route publication gate. A Preserve route renders only when the
 * trusted compiler authorizes its exact fixed recipe and decision envelope.
 */
export function assertKibblePreserveRoutePolicy(
	policy: EffectiveCompositionPolicy,
	surface: Surface,
): void {
	const required = REQUIRED_PRESERVE_POLICY[surface];
	const identityMatches =
		policy.provenance.kind === 'compiled' &&
		policy.provenance.organizationId === KIBBLE_ORGANIZATION_ID &&
		policy.provenance.brandId === 'kibble' &&
		policy.provenance.surface === surface &&
		policy.provenance.referenceId === KIBBLE_REFERENCE_CONTRACT.id &&
		policy.provenance.referenceVersion === KIBBLE_REFERENCE_CONTRACT.version &&
		policy.provenance.preset === 'preserve';
	if (!identityMatches) throw new Error(`Kibble Preserve policy identity does not authorize ${surface}.`);
	if (policy.decisionMode !== required.decisionMode || policy.publicationMode !== required.publicationMode) {
		throw new Error(`Kibble Preserve policy decision envelope does not authorize ${surface}.`);
	}
	assertExactSet(policy.capabilities, required.capabilities, `${surface} capabilities`);
	assertExactSet(policy.allowedComponentVariantIds, required.componentVariantIds, `${surface} component variants`);
	assertExactSet(policy.allowedCssVariantIds, required.cssVariantIds, `${surface} CSS variants`);
	if (policy.allowedCopyVariantIds.length !== 0) {
		throw new Error(`Kibble Preserve ${surface} does not authorize runtime copy variants.`);
	}
}

export type TrustedKibbleRoutePolicy = TrustedRouteSurface & {
	policy: EffectiveCompositionPolicy;
};

/**
 * Resolve a Kibble shopper pathname through the shared trusted route table and
 * the shared composition-policy compiler. Non-Kibble brands return null;
 * unsafe, operator, development, or unknown paths fail closed in the shared
 * normalizer instead of acquiring storefront authority from page chrome.
 */
export function getTrustedKibbleRoutePolicy(
	brandId: unknown,
	routePath: unknown,
): TrustedKibbleRoutePolicy | null {
	if (brandId !== 'kibble') return null;
	const normalized = normalizeTrustedShopperRoute(routePath);
	const decision = getContractSurfaceDecision(brandId, normalized.surface);
	if (decision.mode !== 'reference-preserve') {
		throw new Error(`Kibble Preserve has no trusted policy for ${normalized.routePath}.`);
	}
	assertKibblePreserveRoutePolicy(decision.policy, normalized.surface);
	return { ...normalized, policy: decision.policy };
}

/**
 * Compile one registry-issued union-zone identity for a trusted Kibble route.
 * This deliberately reuses the shared compiler; Kibble does not maintain a
 * parallel authority path or accept hand-authored provenance.
 */
export function getTrustedKibbleZonePolicy(input: {
	brandId: unknown;
	origin: TrustedZoneIdentityDefinition['origin'];
	familyId: string;
	instanceId: string;
	routeSource: 'pathname' | 'error-state';
	routePath: string;
}): EffectiveCompositionPolicy | null {
	if (input.brandId !== 'kibble') return null;
	const identity = findTrustedZoneIdentity(input.origin, input.familyId, input.instanceId);
	if (!identity) throw new Error(`Kibble zone identity is not registered: ${input.origin}:${input.instanceId}.`);
	return compileCompositionPolicy({
		organizationId: KIBBLE_ORGANIZATION_ID,
		brandId: 'kibble',
		surface: identity.surface,
		zoneIdentity: identity,
		routeSource: input.routeSource,
		routePath: input.routePath,
		registry: AISLES_COMPOSITION_POLICY,
	});
}

export type KibbleObservePresentationZoneInput =
	| { surface: 'home'; familyId: 'home.hero'; instanceId: 'home.hero'; routePath: '/' }
	| { surface: 'home'; familyId: 'home.featured-row'; instanceId: 'home.featured-row.1'; routePath: '/' }
	| { surface: 'home'; familyId: 'home.editorial-strip'; instanceId: 'home.editorial-strip'; routePath: '/' }
	| { surface: 'plp'; familyId: 'plp.editorial-header'; instanceId: 'plp.editorial-header'; routePath: string }
	| { surface: 'plp'; familyId: 'plp.product-ranking'; instanceId: 'plp.product-ranking'; routePath: string }
	| { surface: 'plp'; familyId: 'plp.marketing-block'; instanceId: 'plp.marketing-block'; routePath: string }
	| { surface: 'pdp'; familyId: 'pdp.related'; instanceId: 'pdp.related'; routePath: string }
	| { surface: 'pdp'; familyId: 'pdp.below-description'; instanceId: 'pdp.below-description'; routePath: string };

const KIBBLE_PRESENTATION_CAPABILITIES_BY_INSTANCE = {
	'home.hero': ['select_copy_variant'],
	'home.featured-row.1': ['rank_products', 'select_copy_variant', 'reorder_zones'],
	'home.editorial-strip': ['select_copy_variant', 'select_component_variant'],
	'plp.editorial-header': ['select_copy_variant'],
	'plp.product-ranking': ['rank_products'],
	'plp.marketing-block': ['select_copy_variant', 'toggle_zone'],
	'pdp.related': ['rank_products', 'select_copy_variant'],
	'pdp.below-description': ['select_copy_variant', 'toggle_zone'],
} as const;

/** Compile one exact presentation instance used by an explicit demo action. */
export function getTrustedKibbleObservePresentationZonePolicy(
	input: KibbleObservePresentationZoneInput,
): EffectiveCompositionPolicy {
	const route = tryNormalizeTrustedShopperRoute(input.routePath);
	if (!route || route.surface !== input.surface) throw new Error(`Kibble observe ${input.surface} route is not approved.`);
	const identity = findTrustedZoneIdentity('aisles', input.familyId, input.instanceId);
	if (!identity || identity.surface !== input.surface) {
		throw new Error(`Kibble observe zone identity is not registered: aisles:${input.instanceId}.`);
	}
	const policy = compileCompositionPolicy({
		organizationId: KIBBLE_ORGANIZATION_ID,
		brandId: 'kibble',
		surface: input.surface,
		zoneIdentity: identity,
		routeSource: 'pathname',
		routePath: input.routePath,
		registry: KIBBLE_OBSERVE_ASSIST_POLICY,
	});
	const expected = KIBBLE_PRESENTATION_CAPABILITIES_BY_INSTANCE[input.instanceId];
	if (
		policy.decisionMode !== 'model' ||
		policy.publicationMode !== 'live' ||
		policy.provenance.preset !== 'compose' ||
		policy.capabilities.length !== expected.length ||
		policy.capabilities.some((capability) => !expected.includes(capability as never))
	) {
		throw new Error(`Kibble observe ${input.instanceId} policy exceeds or misses its approved presentation boundary.`);
	}
	return policy;
}

/** Compile the Home ranked-shelf boundary exposed by the explicit demo control. */
export function getTrustedKibbleObserveHomeZonePolicy(input: {
	origin: TrustedZoneIdentityDefinition['origin'];
	familyId: 'home.featured-row';
	instanceId: string;
	routePath: '/';
}): EffectiveCompositionPolicy {
	if (input.origin !== 'aisles' || input.instanceId !== 'home.featured-row.1') {
		throw new Error(`Kibble observe zone identity is not registered: ${input.origin}:${input.instanceId}.`);
	}
	return getTrustedKibbleObservePresentationZonePolicy({
		surface: 'home', familyId: 'home.featured-row', instanceId: 'home.featured-row.1', routePath: '/',
	});
}

/**
 * Compile the complete Home presentation boundary recorded by one explicit
 * action. Individual artifacts still execute against their own named-zone
 * policies; this surface policy exists only to describe their aggregate
 * provenance without pretending the featured shelf owns the other zones.
 */
export function getTrustedKibbleObserveHomePresentationPolicy(): EffectiveCompositionPolicy {
	const policy = compileCompositionPolicy({
		organizationId: KIBBLE_ORGANIZATION_ID,
		brandId: 'kibble',
		surface: 'home',
		registry: KIBBLE_OBSERVE_ASSIST_POLICY,
	});
	if (
		policy.decisionMode !== 'model'
		|| policy.publicationMode !== 'live'
		|| policy.provenance.preset !== 'compose'
		|| policy.provenance.zoneBinding !== null
	) {
		throw new Error('Kibble observe Home aggregate policy is not a compiled Compose surface boundary.');
	}
	assertExactSet(policy.capabilities, KIBBLE_HOME_PRESENTATION_POLICY.capabilities, 'Home aggregate capabilities');
	const zonePolicies = [
		getTrustedKibbleObservePresentationZonePolicy({ surface: 'home', familyId: 'home.hero', instanceId: 'home.hero', routePath: '/' }),
		getTrustedKibbleObservePresentationZonePolicy({ surface: 'home', familyId: 'home.featured-row', instanceId: 'home.featured-row.1', routePath: '/' }),
		getTrustedKibbleObservePresentationZonePolicy({ surface: 'home', familyId: 'home.editorial-strip', instanceId: 'home.editorial-strip', routePath: '/' }),
	];
	if (zonePolicies.some((zonePolicy, index) => zonePolicy.provenance.zoneBinding?.instanceId !== KIBBLE_HOME_PRESENTATION_POLICY.zoneIds[index])) {
		throw new Error('Kibble observe Home named-zone bindings do not match the aggregate descriptor.');
	}
	if (zonePolicies.some((zonePolicy) => zonePolicy.policyVersion !== policy.policyVersion)) {
		throw new Error('Kibble observe Home named-zone policies do not share the aggregate policy version.');
	}
	const compiledCapabilityUnion = AUTONOMY_CAPABILITIES.filter((capability) =>
		zonePolicies.some((zonePolicy) => zonePolicy.capabilities.includes(capability)),
	);
	if (compiledCapabilityUnion.length !== policy.capabilities.length
		|| compiledCapabilityUnion.some((capability, index) => capability !== policy.capabilities[index])) {
		throw new Error('Kibble observe Home named-zone capabilities do not compose the aggregate boundary.');
	}
	return policy;
}

/**
 * Client-safe declaration of the Home model decision this demo may request.
 * The server re-compiles the policy before every call; this descriptor lets
 * the browser reject a response that claims a different authority boundary.
 */
export function getKibbleObserveHomeModelPolicyDescriptor() {
	const policy = getTrustedKibbleObserveHomePresentationPolicy();
	return {
		policyVersion: policy.policyVersion,
		zoneIds: KIBBLE_HOME_PRESENTATION_POLICY.zoneIds,
		capabilities: KIBBLE_HOME_PRESENTATION_POLICY.capabilities,
		publicationMode: 'live' as const,
	};
}

/** Every accepted PDP is still one normalized, server-reloaded concrete route. */
export const KIBBLE_OBSERVE_PDP_RELATED_ROUTE_PATTERN = '/product/[slug]' as const;

/** Compile the one live PDP model boundary exposed by the explicit demo control. */
export function getTrustedKibbleObservePdpRelatedZonePolicy(input: {
	origin: TrustedZoneIdentityDefinition['origin'];
	familyId: 'pdp.related';
	instanceId: 'pdp.related';
	routePath: string;
}): EffectiveCompositionPolicy {
	if (input.origin !== 'aisles') throw new Error(`Kibble observe zone identity is not registered: ${input.origin}:${input.instanceId}.`);
	return getTrustedKibbleObservePresentationZonePolicy({
		surface: 'pdp', familyId: 'pdp.related', instanceId: 'pdp.related', routePath: input.routePath,
	});
}

export function getKibbleObservePdpRelatedModelPolicyDescriptor(routePath: string) {
	const policy = getTrustedKibbleObservePdpRelatedZonePolicy({
		origin: 'aisles', familyId: 'pdp.related', instanceId: 'pdp.related',
		routePath,
	});
	return {
		policyVersion: policy.policyVersion,
		zoneId: 'pdp.related' as const,
		capabilities: ['rank_products'] as const,
		publicationMode: 'live' as const,
		routePath,
	};
}

/** Category model calls are allowed on one normalized category route at a time. */
export const KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_ROUTE_PATTERN = '/category/[slug]' as const;
export const KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_SORT = 'FEATURED' as const;

export function getTrustedKibbleObservePlpProductRankingZonePolicy(input: {
	origin: TrustedZoneIdentityDefinition['origin'];
	familyId: 'plp.product-ranking';
	instanceId: 'plp.product-ranking';
	routePath: string;
}): EffectiveCompositionPolicy {
	if (input.origin !== 'aisles') throw new Error(`Kibble observe zone identity is not registered: ${input.origin}:${input.instanceId}.`);
	return getTrustedKibbleObservePresentationZonePolicy({
		surface: 'plp', familyId: 'plp.product-ranking', instanceId: 'plp.product-ranking', routePath: input.routePath,
	});
}

export function getKibbleObservePlpProductRankingModelPolicyDescriptor(routePath: string) {
	const policy = getTrustedKibbleObservePlpProductRankingZonePolicy({
		origin: 'aisles', familyId: 'plp.product-ranking', instanceId: 'plp.product-ranking',
		routePath,
	});
	return {
		policyVersion: policy.policyVersion,
		zoneId: 'plp.product-ranking' as const,
		capabilities: ['rank_products'] as const,
		publicationMode: 'live' as const,
		routePath,
		sort: KIBBLE_OBSERVE_PLP_PRODUCT_RANKING_SORT,
		cursor: null,
	};
}

type KibbleObserveCopyZoneInput =
	| { surface: 'search'; familyId: 'search.empty-state'; instanceId: 'search.empty-state'; routePath: '/search' }
	| { surface: 'cart'; familyId: 'cart.empty-state'; instanceId: 'cart.empty-state'; routePath: '/cart' }
	| { surface: 'checkout'; familyId: 'checkout.assurance-strip'; instanceId: 'checkout.assurance-strip'; routePath: '/checkout/gift' | '/checkout/prepaid' };

/** Compile a single copy-only model zone for the narrower funnel surfaces. */
export function getTrustedKibbleObserveCopyZonePolicy(input: KibbleObserveCopyZoneInput): EffectiveCompositionPolicy {
	const route = tryNormalizeTrustedShopperRoute(input.routePath);
	if (!route || route.surface !== input.surface) throw new Error(`Kibble observe ${input.surface} route is not approved.`);
	const identity = findTrustedZoneIdentity('aisles', input.familyId, input.instanceId);
	if (!identity || identity.surface !== input.surface) throw new Error(`Kibble observe zone identity is not registered: aisles:${input.instanceId}.`);
	const policy = compileCompositionPolicy({
		organizationId: KIBBLE_ORGANIZATION_ID, brandId: 'kibble', surface: input.surface,
		zoneIdentity: identity, routeSource: 'pathname', routePath: input.routePath,
		registry: KIBBLE_OBSERVE_ASSIST_POLICY,
	});
	if (policy.decisionMode !== 'model' || policy.publicationMode !== 'live' || policy.provenance.preset !== 'assist'
		|| policy.capabilities.length !== 1 || policy.capabilities[0] !== 'select_copy_variant') {
		throw new Error(`Kibble observe ${input.surface} policy exceeds or misses its approved copy boundary.`);
	}
	return policy;
}

export function getKibbleObserveCopyModelPolicyDescriptor(input: Extract<KibbleObserveCopyZoneInput, { surface: 'search' }>): { policyVersion: string; zoneId: 'search.empty-state'; capabilities: readonly ['select_copy_variant']; publicationMode: 'live'; routePath: '/search' };
export function getKibbleObserveCopyModelPolicyDescriptor(input: Extract<KibbleObserveCopyZoneInput, { surface: 'cart' }>): { policyVersion: string; zoneId: 'cart.empty-state'; capabilities: readonly ['select_copy_variant']; publicationMode: 'live'; routePath: '/cart' };
export function getKibbleObserveCopyModelPolicyDescriptor(input: Extract<KibbleObserveCopyZoneInput, { surface: 'checkout' }>): { policyVersion: string; zoneId: 'checkout.assurance-strip'; capabilities: readonly ['select_copy_variant']; publicationMode: 'live'; routePath: '/checkout/gift' | '/checkout/prepaid' };
export function getKibbleObserveCopyModelPolicyDescriptor(input: KibbleObserveCopyZoneInput) {
	const policy = getTrustedKibbleObserveCopyZonePolicy(input);
	return {
		policyVersion: policy.policyVersion,
		zoneId: input.instanceId,
		capabilities: ['select_copy_variant'] as const,
		publicationMode: 'live' as const,
		routePath: input.routePath,
	};
}

function assertExactSet(actual: readonly string[], expected: readonly string[], label: string): void {
	if (actual.length !== expected.length || actual.some((value) => !expected.includes(value))) {
		throw new Error(`Kibble Preserve ${label} do not match the approved route contract.`);
	}
}

export function surfaceForPath(pathname: string): Surface | null {
	return tryNormalizeTrustedShopperRoute(pathname)?.surface ?? null;
}

export function hasKibbleReferenceChrome(brandId: unknown): boolean {
	return brandId === 'kibble';
}
