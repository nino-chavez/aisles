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
] as const;
const plpComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.plp.variantId,
	'kibble.product-card.catalog-card',
	'kibble.footer.four-column',
] as const;
const pdpComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.pdp.variantId,
	'kibble.product-card.catalog-card',
	'kibble.footer.four-column',
] as const;
const errorComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.error.variantId,
	'kibble.footer.four-column',
] as const;
const searchComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.search.variantId,
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
	return KIBBLE_REFERENCE_CONTRACT.components.flatMap((component) =>
		component.variants
			.filter((variant) => wanted.has(variant.id))
			.flatMap((variant) => variant.cssVariantIds),
	);
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
		},
		plp: {
			preset: 'preserve',
			capabilities: [],
			decisionMode: 'fixed',
			publicationMode: 'live',
			allowedComponentVariantIds: plpComponentVariantIds,
			allowedCssVariantIds: cssFor(plpComponentVariantIds),
			allowedCopyVariantIds: [],
		},
		pdp: {
			preset: 'preserve',
			capabilities: [],
			decisionMode: 'fixed',
			publicationMode: 'approval_required',
			allowedComponentVariantIds: pdpComponentVariantIds,
			allowedCssVariantIds: cssFor(pdpComponentVariantIds),
			allowedCopyVariantIds: [],
		},
		search: {
			preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live',
			allowedComponentVariantIds: searchComponentVariantIds,
			allowedCssVariantIds: cssFor(searchComponentVariantIds), allowedCopyVariantIds: [],
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
		},
		'error-empty': {
			preset: 'preserve',
			capabilities: [],
			decisionMode: 'fixed',
			publicationMode: 'live',
			allowedComponentVariantIds: errorComponentVariantIds,
			allowedCssVariantIds: cssFor(errorComponentVariantIds),
			allowedCopyVariantIds: [],
		},
	},
};

export const AISLES_COMPOSITION_POLICY: CompositionPolicyRegistry = {
	organizations: { [organization.organizationId]: organization },
	brands: { kibble },
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
		publicationMode: 'approval_required',
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
