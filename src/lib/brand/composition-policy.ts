import { KIBBLE_REFERENCE_CONTRACT } from './reference/kibble';
import {
	AUTONOMY_CAPABILITIES,
	compileCompositionPolicy,
	type BrandCompositionPolicy,
	type CompositionPolicyRegistry,
	type EffectiveCompositionPolicy,
	type OrganizationCompositionPolicy,
} from '$lib/foundation/composition-policy';
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
const unavailableComponentVariantIds = [
	'kibble.header.responsive-chrome',
	'kibble.unavailable.reference-shell',
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
			allowedComponentVariantIds: unavailableComponentVariantIds,
			allowedCssVariantIds: cssFor(unavailableComponentVariantIds), allowedCopyVariantIds: [],
		},
		cart: {
			preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live',
			allowedComponentVariantIds: unavailableComponentVariantIds,
			allowedCssVariantIds: cssFor(unavailableComponentVariantIds), allowedCopyVariantIds: [],
		},
		checkout: {
			preset: 'preserve', capabilities: [], decisionMode: 'fixed', publicationMode: 'live',
			allowedComponentVariantIds: unavailableComponentVariantIds,
			allowedCssVariantIds: cssFor(unavailableComponentVariantIds), allowedCopyVariantIds: [],
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
	search: { decisionMode: 'fixed', publicationMode: 'live', capabilities: [], componentVariantIds: unavailableComponentVariantIds, cssVariantIds: cssFor(unavailableComponentVariantIds) },
	cart: { decisionMode: 'fixed', publicationMode: 'live', capabilities: [], componentVariantIds: unavailableComponentVariantIds, cssVariantIds: cssFor(unavailableComponentVariantIds) },
	checkout: { decisionMode: 'fixed', publicationMode: 'live', capabilities: [], componentVariantIds: unavailableComponentVariantIds, cssVariantIds: cssFor(unavailableComponentVariantIds) },
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
	surface: 'home' | 'plp' | 'pdp' | 'search' | 'cart' | 'checkout' | 'error-404' | 'error-empty',
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

function assertExactSet(actual: readonly string[], expected: readonly string[], label: string): void {
	if (actual.length !== expected.length || actual.some((value) => !expected.includes(value))) {
		throw new Error(`Kibble Preserve ${label} do not match the approved route contract.`);
	}
}

export function surfaceForPath(pathname: string): Surface | null {
	if (pathname === '/') return 'home';
	if (/^\/category\/[^/]+\/?$/.test(pathname)) return 'plp';
	if (/^\/product\/[^/]+\/?$/.test(pathname)) return 'pdp';
	if (pathname === '/search') return 'search';
	if (pathname === '/cart') return 'cart';
	if (pathname === '/checkout') return 'checkout';
	return null;
}

export function hasKibbleReferenceChrome(brandId: unknown): boolean {
	return brandId === 'kibble';
}
