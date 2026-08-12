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

const homeComponentVariantIds = KIBBLE_REFERENCE_CONTRACT.recipes.home.orderedAnatomy.map(
	(slot) => slot.variantId,
);
const plpComponentVariantIds = [
	'kibble.header.responsive-chrome',
	KIBBLE_REFERENCE_CONTRACT.recipes.plp.variantId,
	'kibble.product-card.catalog-card',
	'kibble.footer.four-column',
] as const;
const errorComponentVariantIds = [
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
			capabilities: ['rank_products', 'select_products'],
			decisionMode: 'rules',
			publicationMode: 'live',
			allowedComponentVariantIds: plpComponentVariantIds,
			allowedCssVariantIds: cssFor(plpComponentVariantIds),
			allowedCopyVariantIds: [],
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

export function surfaceForPath(pathname: string): Surface | null {
	if (pathname === '/') return 'home';
	if (/^\/category\/[^/]+\/?$/.test(pathname)) return 'plp';
	if (/^\/product\/[^/]+\/?$/.test(pathname)) return 'pdp';
	if (pathname === '/search') return 'search';
	return null;
}

export function hasKibbleReferenceChrome(brandId: unknown): boolean {
	return brandId === 'kibble';
}
