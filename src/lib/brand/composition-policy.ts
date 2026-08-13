import { KIBBLE_REFERENCE_CONTRACT } from './reference/kibble';
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
	registeredCopyVariantIds: [],
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
			zoneOverrides: { 'plp.editorial-header': { capabilities: [], decisionMode: 'fixed', allowedComponentVariantIds: ['kibble.category-listing.editorial-header'] } },
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
		},
		checkout: {
			preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live',
			allowedComponentVariantIds: checkoutComponentVariantIds,
			allowedCssVariantIds: cssFor(checkoutComponentVariantIds), allowedCopyVariantIds: [],
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
 * It is a separate, versioned policy: normal Kibble page loads continue to use
 * Preserve, while an explicit server-trusted demo action may ask a model to
 * rank the fixed Home shelf or one explicitly approved PDP related rail, and
 * nothing else.
 */
const kibbleObserveAssist: BrandCompositionPolicy = {
	...kibble,
	policyVersion: `kibble-observe-assist-policy-${KIBBLE_REFERENCE_CONTRACT.version}-v1`,
	surfaces: {
		...kibble.surfaces,
		home: {
			...kibble.surfaces.home!,
			preset: 'assist',
			capabilities: ['rank_products'],
			decisionMode: 'model',
			zoneOverrides: {
				...kibble.surfaces.home!.zoneOverrides,
				'home.featured-row': {
					capabilities: ['rank_products'],
					decisionMode: 'model',
					publicationMode: 'live',
					allowedComponentVariantIds: ['kibble.featured-grid.ranked-segment'],
				},
			},
		},
		pdp: {
			...kibble.surfaces.pdp!,
			preset: 'assist',
			capabilities: ['rank_products'],
			decisionMode: 'model',
			zoneOverrides: {
				...kibble.surfaces.pdp!.zoneOverrides,
				'pdp.related': {
					capabilities: ['rank_products'],
					decisionMode: 'model',
					publicationMode: 'live',
					allowedComponentVariantIds: ['kibble.product-detail.related-products'],
				},
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

/** Compile the one live model boundary exposed by the explicit demo control. */
export function getTrustedKibbleObserveHomeZonePolicy(input: {
	origin: TrustedZoneIdentityDefinition['origin'];
	familyId: 'home.featured-row';
	instanceId: string;
	routePath: '/';
}): EffectiveCompositionPolicy {
	const identity = findTrustedZoneIdentity(input.origin, input.familyId, input.instanceId);
	if (!identity || identity.surface !== 'home') {
		throw new Error(`Kibble observe zone identity is not registered: ${input.origin}:${input.instanceId}.`);
	}
	const policy = compileCompositionPolicy({
		organizationId: KIBBLE_ORGANIZATION_ID,
		brandId: 'kibble',
		surface: 'home',
		zoneIdentity: identity,
		routeSource: 'pathname',
		routePath: input.routePath,
		registry: KIBBLE_OBSERVE_ASSIST_POLICY,
	});
	if (
		policy.decisionMode !== 'model' ||
		policy.publicationMode !== 'live' ||
		policy.provenance.preset !== 'assist' ||
		policy.capabilities.length !== 1 ||
		policy.capabilities[0] !== 'rank_products'
	) {
		throw new Error('Kibble observe Home policy exceeds or misses its approved model boundary.');
	}
	return policy;
}

/**
 * Client-safe declaration of the Home model decision this demo may request.
 * The server re-compiles the policy before every call; this descriptor lets
 * the browser reject a response that claims a different authority boundary.
 */
export function getKibbleObserveHomeModelPolicyDescriptor() {
	const policy = getTrustedKibbleObserveHomeZonePolicy({
		origin: 'aisles',
		familyId: 'home.featured-row',
		instanceId: 'home.featured-row.1',
		routePath: '/',
	});
	return {
		policyVersion: policy.policyVersion,
		zoneId: 'home.featured-row' as const,
		capabilities: ['rank_products'] as const,
		publicationMode: 'live' as const,
	};
}

/** The PDP boundary is deliberately an exact route approval, never a slug pattern. */
export const KIBBLE_OBSERVE_PDP_RELATED_ROUTE = '/product/puppy-starter-kit' as const;
export const KIBBLE_OBSERVE_PDP_RELATED_SLUG = 'puppy-starter-kit' as const;

/** Compile the one live PDP model boundary exposed by the explicit demo control. */
export function getTrustedKibbleObservePdpRelatedZonePolicy(input: {
	origin: TrustedZoneIdentityDefinition['origin'];
	familyId: 'pdp.related';
	instanceId: 'pdp.related';
	routePath: typeof KIBBLE_OBSERVE_PDP_RELATED_ROUTE;
}): EffectiveCompositionPolicy {
	if (input.routePath !== KIBBLE_OBSERVE_PDP_RELATED_ROUTE) {
		throw new Error('Kibble observe PDP route is not explicitly approved.');
	}
	const identity = findTrustedZoneIdentity(input.origin, input.familyId, input.instanceId);
	if (!identity || identity.surface !== 'pdp') {
		throw new Error(`Kibble observe zone identity is not registered: ${input.origin}:${input.instanceId}.`);
	}
	const policy = compileCompositionPolicy({
		organizationId: KIBBLE_ORGANIZATION_ID,
		brandId: 'kibble',
		surface: 'pdp',
		zoneIdentity: identity,
		routeSource: 'pathname',
		routePath: input.routePath,
		registry: KIBBLE_OBSERVE_ASSIST_POLICY,
	});
	if (
		policy.decisionMode !== 'model' ||
		policy.publicationMode !== 'live' ||
		policy.provenance.preset !== 'assist' ||
		policy.capabilities.length !== 1 ||
		policy.capabilities[0] !== 'rank_products'
	) {
		throw new Error('Kibble observe PDP policy exceeds or misses its approved model boundary.');
	}
	return policy;
}

export function getKibbleObservePdpRelatedModelPolicyDescriptor(routePath: string) {
	const policy = getTrustedKibbleObservePdpRelatedZonePolicy({
		origin: 'aisles', familyId: 'pdp.related', instanceId: 'pdp.related',
		routePath: routePath as typeof KIBBLE_OBSERVE_PDP_RELATED_ROUTE,
	});
	return {
		policyVersion: policy.policyVersion,
		zoneId: 'pdp.related' as const,
		capabilities: ['rank_products'] as const,
		publicationMode: 'live' as const,
		routePath: KIBBLE_OBSERVE_PDP_RELATED_ROUTE,
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
