import { describe, expect, it } from 'vitest';
import {
	AUTONOMY_CAPABILITIES,
	compileAutonomyPreset,
	compileCompositionPolicy,
	compileLegacyGeneratedCompatibilityPolicy,
	composeEffectivePolicyVersion,
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
	registeredCssVariantIds: ['hero.airy', 'hero.dense', 'rail.standard'],
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
			allowedCssVariantIds: ['hero.airy', 'hero.dense'],
			allowedCopyVariantIds: ['hero.spring', 'hero.evergreen'],
			zoneOverrides: {
				'home.hero': {
					capabilities: ['select_products', 'select_copy_variant'],
					decisionMode: 'rules',
					publicationMode: 'holdout',
					allowedComponentVariantIds: ['hero.compact'],
					allowedCssVariantIds: ['hero.dense'],
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

	it.each(['toString', '__proto__', 'constructor'])(
		'rejects inherited-object preset name %s through the domain error',
		(preset) => {
			expect(() => compileAutonomyPreset(preset as never)).toThrow(/unknown autonomy preset/);
		},
	);
});

describe('hierarchy compilation', () => {
	it.each(['account', 'locator'] as const)('compiles the typed %s surface without inventing a zone family', (surface) => {
		const surfacePolicy = {
			preset: 'preserve' as const,
			capabilities: [] as const,
			decisionMode: 'fixed' as const,
			publicationMode: 'holdout' as const,
			allowedComponentVariantIds: [] as const,
			allowedCssVariantIds: [] as const,
			allowedCopyVariantIds: [] as const,
		};
		const surfaceBrand: BrandCompositionPolicy = {
			...brand,
			surfaces: { [surface]: surfacePolicy },
		};
		const effective = compileCompositionPolicy({
			organizationId: organization.organizationId,
			brandId: surfaceBrand.brandId,
			surface,
			registry: registry(organization, surfaceBrand),
		});

		expect(effective.provenance).toMatchObject({ surface, zoneId: null });
		expect(effective.decisionMode).toBe('fixed');
	});

	it('does not make a Bealls-only account zone executable in Aisles', () => {
		const accountBrand: BrandCompositionPolicy = {
			...brand,
			surfaces: {
				account: {
					preset: 'preserve',
					capabilities: [],
					decisionMode: 'fixed',
					publicationMode: 'holdout',
					allowedComponentVariantIds: [],
					allowedCssVariantIds: [],
					allowedCopyVariantIds: [],
					zoneOverrides: { 'account.welcome': {} },
				} as never,
			},
		};

		expect(() => compileCompositionPolicy({
			organizationId: organization.organizationId,
			brandId: accountBrand.brandId,
			surface: 'account',
			registry: registry(organization, accountBrand),
		})).toThrow(/unknown zone override "account\.welcome" for surface "account"/);
	});

	it('intersects and narrows organization, brand, surface, and zone authority', () => {
		const effective = compileHome({ zoneId: 'home.hero' });

		expect(effective.capabilities).toEqual(['select_products', 'select_copy_variant']);
		expect(effective.allowedComponentVariantIds).toEqual(['hero.compact']);
		expect(effective.allowedCssVariantIds).toEqual(['hero.dense']);
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

	it('rejects unregistered component, CSS, and copy variant IDs', () => {
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

		const unregisteredCss: BrandCompositionPolicy = {
			...brand,
			surfaces: {
				home: {
					...brand.surfaces.home!,
					allowedCssVariantIds: ['invented.css'],
				},
			},
		};
		expect(() => compileHome({ registry: registry(organization, unregisteredCss) })).toThrow(
			/home surface CSS expands brand registry/,
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

	it.each([
		['organization', { organizationId: '__proto__' }],
		['brand', { brandId: 'toString' }],
		['surface', { surface: '__proto__' as never }],
	])('rejects inherited-object %s identifiers as unknown', (_label, input) => {
		expect(() => compileHome(input)).toThrow(/missing|unknown/);
	});

	it('fails when the brand reference contract is missing or blank', () => {
		const missingReference = { ...brand, reference: undefined } as unknown as BrandCompositionPolicy;
		expect(() => compileHome({ registry: registry(organization, missingReference) })).toThrow(
			/brand reference contract is required/,
		);

		const blankReference: BrandCompositionPolicy = {
			...brand,
			reference: { referenceId: ' ', referenceVersion: '' },
		};
		expect(() => compileHome({ registry: registry(organization, blankReference) })).toThrow(
			/reference identifier is required/,
		);

		const blankReferenceVersion: BrandCompositionPolicy = {
			...brand,
			reference: { referenceId: 'merchant-storefront', referenceVersion: ' ' },
		};
		expect(() => compileHome({ registry: registry(organization, blankReferenceVersion) })).toThrow(
			/reference version is required/,
		);
	});

	it('fails when trusted organization or brand identity is blank', () => {
		expect(() => compileHome({ organizationId: ' ' })).toThrow(/organization identity is required/);
		expect(() => compileHome({ brandId: '' })).toThrow(/brand identity is required/);
	});

	it('fails for an unknown or cross-surface zone', () => {
		expect(() => compileHome({ zoneId: 'pdp.related' })).toThrow(/unknown zone/);
		expect(() => compileHome({ zoneId: 'home.unknown' as never })).toThrow(/unknown zone/);
	});

	it('preserves policy and reference versions in provenance', () => {
		const effective = compileHome({ zoneId: 'home.hero' });

		expect(effective.policyVersion).toBe(
			composeEffectivePolicyVersion('org-policy-3', 'brand-policy-7'),
		);
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

	it('changes effective policy identity when only the organization version changes', () => {
		const first = compileHome({ zoneId: 'home.hero' });
		const changedOrganization = { ...organization, policyVersion: 'org-policy-4' };
		const second = compileHome({
			zoneId: 'home.hero',
			registry: registry(changedOrganization),
		});

		expect(second.provenance.brandPolicyVersion).toBe(first.provenance.brandPolicyVersion);
		expect(second.policyVersion).not.toBe(first.policyVersion);
		expect(second.policyVersion).toBe(
			composeEffectivePolicyVersion('org-policy-4', 'brand-policy-7'),
		);
	});
});

describe('legacy generated compatibility', () => {
	it('represents current whole-page generation explicitly with registered variants only', () => {
		const effective = compileLegacyGeneratedCompatibilityPolicy({
			organizationId: 'legacy-demo',
			brandId: 'haven',
			surface: 'home',
			registeredComponentVariantIds: ['editorial-header', 'product-carousel'],
			registeredCssVariantIds: ['homepage-default'],
			registeredCopyVariantIds: ['homepage-default'],
		});

		expect(effective.policyVersion).toBe(LEGACY_GENERATED_POLICY_VERSION);
		expect(effective.capabilities).toEqual(AUTONOMY_CAPABILITIES);
		expect(effective.decisionMode).toBe('model');
		expect(effective.publicationMode).toBe('live');
		expect(effective.allowedComponentVariantIds).toEqual(['editorial-header', 'product-carousel']);
		expect(effective.allowedCssVariantIds).toEqual(['homepage-default']);
		expect(effective.provenance).toMatchObject({
			kind: 'legacy_generated_compatibility',
			referenceId: null,
			referenceVersion: null,
			preset: null,
		});
	});

	it('rejects blank trusted identity', () => {
		expect(() =>
			compileLegacyGeneratedCompatibilityPolicy({
				organizationId: '',
				brandId: 'haven',
				surface: 'home',
				registeredComponentVariantIds: [],
				registeredCssVariantIds: [],
				registeredCopyVariantIds: [],
			}),
		).toThrow(/organization identity is required/);
	});
});
