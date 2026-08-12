import { describe, expect, it } from 'vitest';
import {
	AUTONOMY_CAPABILITIES,
	compileAutonomyPreset,
	compileCompositionPolicy,
	compileLegacyGeneratedCompatibilityPolicy,
	LEGACY_GENERATED_POLICY_VERSION,
	type BrandCompositionPolicy,
	type CompositionPolicyRegistry,
	type OrganizationCompositionPolicy,
} from './composition-policy';

const organization: OrganizationCompositionPolicy = {
	organizationId: 'merchant-co',
	policyVersion: 'org-policy-3',
	maximum: {
		capabilities: AUTONOMY_CAPABILITIES,
		decisionMode: 'model',
		publicationMode: 'live',
	},
};

const brand: BrandCompositionPolicy = {
	organizationId: 'merchant-co',
	brandId: 'merchant-brand',
	policyVersion: 'brand-policy-7',
	maximum: {
		capabilities: AUTONOMY_CAPABILITIES,
		decisionMode: 'model',
		publicationMode: 'live',
	},
	registeredComponentVariantIds: ['hero.editorial', 'hero.compact', 'rail.products'],
	registeredCopyVariantIds: ['hero.spring', 'hero.evergreen'],
	reference: { referenceId: 'merchant-storefront', referenceVersion: 'reference-12' },
	surfaces: {
		home: {
			preset: 'compose',
			capabilities: [
				'rank_products',
				'select_products',
				'select_copy_variant',
				'select_component_variant',
				'toggle_zone',
			],
			decisionMode: 'model',
			publicationMode: 'holdout',
			allowedComponentVariantIds: ['hero.editorial', 'hero.compact'],
			allowedCopyVariantIds: ['hero.spring', 'hero.evergreen'],
			zoneOverrides: {
				'home.hero': {
					capabilities: ['select_products', 'select_copy_variant'],
					decisionMode: 'rules',
					publicationMode: 'holdout',
					allowedComponentVariantIds: ['hero.compact'],
					allowedCopyVariantIds: ['hero.evergreen'],
				},
			},
		},
	},
};

function registry(
	organizationPolicy: OrganizationCompositionPolicy = organization,
	brandPolicy: BrandCompositionPolicy = brand,
): CompositionPolicyRegistry {
	return {
		organizations: { [organizationPolicy.organizationId]: organizationPolicy },
		brands: { [brandPolicy.brandId]: brandPolicy },
	};
}

function compileHome(overrides: Partial<Parameters<typeof compileCompositionPolicy>[0]> = {}) {
	return compileCompositionPolicy({
		organizationId: 'merchant-co',
		brandId: 'merchant-brand',
		surface: 'home',
		registry: registry(),
		...overrides,
	});
}

describe('autonomy presets', () => {
	it.each([
		['preserve', ['rank_products', 'select_products']],
		[
			'assist',
			[
				'rank_products',
				'select_products',
				'select_copy_variant',
				'generate_bounded_copy',
				'select_component_variant',
			],
		],
		['compose', AUTONOMY_CAPABILITIES],
		['explore', AUTONOMY_CAPABILITIES],
	] as const)('%s compiles to its capability allow-list', (preset, expected) => {
		expect(compileAutonomyPreset(preset)).toEqual(expected);
	});

	it('rejects an unknown preset at runtime', () => {
		expect(() => compileAutonomyPreset('unbounded' as never)).toThrow(/unknown autonomy preset/);
	});
});

describe('hierarchy compilation', () => {
	it('intersects and narrows organization, brand, surface, and zone authority', () => {
		const effective = compileHome({ zoneId: 'home.hero' });

		expect(effective.capabilities).toEqual(['select_products', 'select_copy_variant']);
		expect(effective.allowedComponentVariantIds).toEqual(['hero.compact']);
		expect(effective.allowedCopyVariantIds).toEqual(['hero.evergreen']);
		expect(effective.decisionMode).toBe('rules');
		expect(effective.publicationMode).toBe('holdout');
	});

	it('rejects a brand expansion', () => {
		const narrowedOrganization: OrganizationCompositionPolicy = {
			...organization,
			maximum: { ...organization.maximum, capabilities: ['rank_products'] },
		};
		expect(() =>
			compileHome({ registry: registry(narrowedOrganization) }),
		).toThrow(/brand maximum expands organization maximum/);
	});

	it('rejects a surface expansion', () => {
		const narrowedBrand: BrandCompositionPolicy = {
			...brand,
			maximum: {
				...brand.maximum,
				capabilities: ['rank_products', 'select_products'],
			},
		};
		expect(() => compileHome({ registry: registry(organization, narrowedBrand) })).toThrow(
			/home surface expands brand maximum/,
		);
	});

	it('rejects a zone expansion', () => {
		const expandedZone: BrandCompositionPolicy = {
			...brand,
			surfaces: {
				home: {
					...brand.surfaces.home!,
					zoneOverrides: {
						'home.hero': { capabilities: ['generate_bounded_copy'] },
					},
				},
			},
		};
		expect(() =>
			compileHome({ zoneId: 'home.hero', registry: registry(organization, expandedZone) }),
		).toThrow(/home.hero zone expands surface/);
	});

	it('keeps decision and publication modes independent', () => {
		const independentAxes: BrandCompositionPolicy = {
			...brand,
			surfaces: {
				home: {
					...brand.surfaces.home!,
					decisionMode: 'model',
					publicationMode: 'approval_required',
					zoneOverrides: undefined,
				},
			},
		};
		const effective = compileHome({ registry: registry(organization, independentAxes) });

		expect(effective.decisionMode).toBe('model');
		expect(effective.publicationMode).toBe('approval_required');
	});

	it('rejects unregistered component and copy variant IDs', () => {
		const unregisteredComponent: BrandCompositionPolicy = {
			...brand,
			surfaces: {
				home: {
					...brand.surfaces.home!,
					allowedComponentVariantIds: ['invented.component'],
				},
			},
		};
		expect(() => compileHome({ registry: registry(organization, unregisteredComponent) })).toThrow(
			/home surface components expands brand registry/,
		);

		const unregisteredCopy: BrandCompositionPolicy = {
			...brand,
			surfaces: {
				home: {
					...brand.surfaces.home!,
					allowedCopyVariantIds: ['invented.copy'],
				},
			},
		};
		expect(() => compileHome({ registry: registry(organization, unregisteredCopy) })).toThrow(
			/home surface copy expands brand registry/,
		);
	});

	it('requires non-live publication for explore', () => {
		const liveExplore: BrandCompositionPolicy = {
			...brand,
			surfaces: {
				home: {
					...brand.surfaces.home!,
					preset: 'explore',
					publicationMode: 'live',
				},
			},
		};
		expect(() => compileHome({ registry: registry(organization, liveExplore) })).toThrow(
			/explore surface requires holdout or approval/,
		);
	});
});

describe('policy lookup and provenance', () => {
	it('fails for missing organization, brand, and surface policies', () => {
		expect(() => compileHome({ organizationId: 'unknown' })).toThrow(/missing organization policy/);
		expect(() => compileHome({ brandId: 'unknown' })).toThrow(/missing brand policy/);
		expect(() =>
			compileHome({
				registry: registry(organization, { ...brand, surfaces: {} }),
			}),
		).toThrow(/missing surface policy/);
	});

	it('fails for an unknown or cross-surface zone', () => {
		expect(() => compileHome({ zoneId: 'pdp.related' })).toThrow(/unknown zone/);
		expect(() => compileHome({ zoneId: 'home.unknown' as never })).toThrow(/unknown zone/);
	});

	it('preserves policy and reference versions in provenance', () => {
		const effective = compileHome({ zoneId: 'home.hero' });

		expect(effective.policyVersion).toBe('brand-policy-7');
		expect(effective.provenance).toEqual({
			kind: 'compiled',
			organizationId: 'merchant-co',
			organizationPolicyVersion: 'org-policy-3',
			brandId: 'merchant-brand',
			brandPolicyVersion: 'brand-policy-7',
			referenceId: 'merchant-storefront',
			referenceVersion: 'reference-12',
			surface: 'home',
			zoneId: 'home.hero',
			preset: 'compose',
		});
	});
});

describe('legacy generated compatibility', () => {
	it('represents current whole-page generation explicitly with registered variants only', () => {
		const effective = compileLegacyGeneratedCompatibilityPolicy({
			organizationId: 'legacy-demo',
			brandId: 'haven',
			surface: 'home',
			registeredComponentVariantIds: ['editorial-header', 'product-carousel'],
			registeredCopyVariantIds: ['homepage-default'],
		});

		expect(effective.policyVersion).toBe(LEGACY_GENERATED_POLICY_VERSION);
		expect(effective.capabilities).toEqual(AUTONOMY_CAPABILITIES);
		expect(effective.decisionMode).toBe('model');
		expect(effective.publicationMode).toBe('live');
		expect(effective.allowedComponentVariantIds).toEqual(['editorial-header', 'product-carousel']);
		expect(effective.provenance).toMatchObject({
			kind: 'legacy_generated_compatibility',
			referenceId: null,
			referenceVersion: null,
			preset: null,
		});
	});
});
