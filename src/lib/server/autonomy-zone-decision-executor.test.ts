import { describe, expect, it, vi } from 'vitest';
import {
	AUTONOMY_CAPABILITIES,
	compileCompositionPolicy,
	PRESET_CAPABILITIES,
	PUBLICATION_MODES,
	type BrandCompositionPolicy,
	type DecisionMode,
	type EffectiveCompositionPolicy,
	type OrganizationCompositionPolicy,
} from '$lib/foundation/composition-policy';
import { SHOPPER_ROUTE_MANIFEST_DIGEST, SHOPPER_ROUTE_MANIFEST_VERSION } from '$lib/foundation/autonomy-zone-route';
import { capabilitiesWithinSurface, isDecisionModeWithinSurface, surfaceAuthorityFor } from '$lib/foundation/surface-authority';
import { findTrustedZoneIdentity, TRUSTED_ZONE_IDENTITIES, ZONE_CATALOG, type TrustedZoneIdentityDefinition } from '$lib/foundation/zone-catalog';
import type { TrustedZoneFieldCatalog } from '$lib/foundation/zone-decision-schema';
import { ZONE_IDS, ZONES, type ZoneId } from '$lib/foundation/zones';
import { SectionSchema } from '$lib/schema/layout';
import {
	executeZoneDecision,
	type TrustedBoundZoneCatalog,
	type TrustedZoneExecutionIdentity,
	type TrustedZoneFallback,
} from './zone-decision-executor';

const productIds = ['product.a', 'product.b', 'product.c'] as const;
const fields: TrustedZoneFieldCatalog = {
	registeredComponentVariantIds: ['component.carousel'],
	registeredCssVariantIds: ['css.reference'],
	registeredCopyVariantIds: ['copy.reference'],
	registeredRecipeIds: ['recipe.home'],
	registeredProductIds: productIds,
	registeredPlacementIds: ['placement.top'],
	completeComponentVariants: [{ componentVariantId: 'component.carousel', cssVariantId: 'css.reference', compatibleCopyVariantIds: ['copy.reference'] }],
	allowedRecipeIds: ['recipe.home'],
	allowedProductIds: productIds,
	allowedPlacementIds: ['placement.top'],
	boundedCopyFields: [{ key: 'headline', maxLength: 24, sourceClasses: ['reference-copy'], sourceBindings: [{ sourceClass: 'reference-copy', sourceId: 'reference.headline', value: 'Pinned headline' }] }],
	fixed: { componentVariantId: 'component.carousel', copyVariantId: 'copy.reference', recipeId: 'recipe.home', productIds, placementId: 'placement.top' },
};

const identity: TrustedZoneExecutionIdentity = {
	organizationId: 'org',
	brandId: 'brand',
	referenceId: 'reference',
	referenceVersion: '1',
	policyVersion: 'org:1:o|brand:1:b',
	routeSource: 'pathname',
	routePath: '/',
	surface: 'home',
	routeManifestVersion: SHOPPER_ROUTE_MANIFEST_VERSION,
	routeManifestDigest: SHOPPER_ROUTE_MANIFEST_DIGEST,
	zoneOrigin: 'aisles',
	familyId: 'home.featured-row',
	instanceId: 'home.featured-row.1',
	productCatalogId: 'catalog',
	productCatalogVersion: '1',
	allowedDecisionModes: ['fixed', 'rules', 'model'],
};

const organizationPolicy: OrganizationCompositionPolicy = {
	organizationId: identity.organizationId,
	policyVersion: 'o',
	maximum: { capabilities: AUTONOMY_CAPABILITIES, decisionMode: 'model', publicationMode: 'live' },
};

const headerContent = { component: 'editorial-header', props: { eyebrow: 'TRUSTED', headline: 'Trusted content', body: 'Server materialized.' } } as const;
const carouselContent = { component: 'product-carousel', props: { title: 'Trusted products', products: productIds.map((productId) => ({ productId, role: 'standard' as const })), showQuickAdd: false } } as const;
const gridContent = { component: 'product-grid', props: { columns: 4, products: productIds.map((productId) => ({ productId, role: 'standard' as const })), imageRatio: 'square', showDescription: false, showSpecs: false, showQuickAdd: false } } as const;
const serviceContent = { component: 'service-callouts-grid', props: { columns: 3, callouts: [{ icon: 'shipping', label: 'Shipping' }, { icon: 'returns', label: 'Returns' }, { icon: 'secure', label: 'Secure' }] } } as const;
const tileContent = { component: 'category-tile-grid', props: { columns: 3, tiles: productIds.map((productId) => ({ label: productId, product: { productId, role: 'standard' as const } })) } } as const;
const chipContent = { component: 'cluster-chip-row', props: { chips: productIds.map((productId) => ({ label: productId, product: { productId, role: 'standard' as const } })) } } as const;

function contentForZone(zoneId: ZoneId): unknown {
	if (zoneId === 'home.below-fold' || zoneId === 'checkout.assurance-strip') return serviceContent;
	if (zoneId === 'plp.cluster-row') return chipContent;
	if (zoneId === 'plp.below-grid') return tileContent;
	if (zoneId === 'plp.product-ranking') return gridContent;
	if (['home.featured-row', 'pdp.related', 'pdp.cross-sell', 'pdp.recently-viewed', 'cart.above-checkout-cta', 'checkout.last-chance-upsell'].includes(zoneId)) return carouselContent;
	return headerContent;
}

function identityForZone(zoneId: ZoneId): TrustedZoneExecutionIdentity {
	const surface = ZONES[zoneId].surface;
	const authority = surfaceAuthorityFor(surface);
	const routes = {
		home: '/', plp: '/category/example', pdp: '/product/example', cart: '/cart', checkout: '/checkout', search: '/search',
		account: '/account', locator: '/store-locator', 'error-404': '/missing', 'error-empty': '/category/empty',
	} as const;
	return {
		...identity,
		routeSource: surface === 'error-404' || surface === 'error-empty' ? 'error-state' : 'pathname',
		routePath: routes[surface],
		surface,
		familyId: zoneId,
		instanceId: ZONES[zoneId].multiplicity === 'indexed' ? `${zoneId}.1` : zoneId,
		allowedDecisionModes: authority.maximumDecisionMode === 'fixed' ? ['fixed'] : ['fixed', 'rules', 'model'],
	};
}

function identityForDefinition(definition: TrustedZoneIdentityDefinition): TrustedZoneExecutionIdentity {
	const routes: Record<TrustedZoneIdentityDefinition['surface'], string> = {
		home: '/', plp: '/category/example', pdp: '/product/example', cart: '/cart', checkout: '/checkout', search: '/search',
		account: '/account', locator: '/store-locator', 'error-404': '/missing', 'error-empty': '/category/empty',
	};
	return {
		...identity,
		routeSource: definition.surface === 'error-404' || definition.surface === 'error-empty' ? 'error-state' : 'pathname',
		routePath: routes[definition.surface],
		surface: definition.surface,
		zoneOrigin: definition.origin,
		familyId: definition.familyId,
		instanceId: definition.instanceId,
		allowedDecisionModes: definition.rendererContract === 'trusted-hidden' ? ['fixed'] : ['fixed', 'rules', 'model'],
	};
}

type PolicyOverrides = Partial<Omit<EffectiveCompositionPolicy, 'provenance'>>;

function policy(
	overrides: PolicyOverrides = {},
	executionIdentity: TrustedZoneExecutionIdentity = identity,
	bindZone = true,
): EffectiveCompositionPolicy {
	const definition = findTrustedZoneIdentity(
		executionIdentity.zoneOrigin,
		executionIdentity.familyId,
		executionIdentity.instanceId,
	);
	if (!definition) throw new Error(`test identity is not registered: ${executionIdentity.instanceId}`);
	const authority = surfaceAuthorityFor(definition.surface);
	const decisionMode = overrides.decisionMode ?? authority.maximumDecisionMode;
	const publicationMode = overrides.publicationMode ?? 'live';
	const capabilities = overrides.capabilities ?? authority.maximumCapabilities;
	const allowedComponentVariantIds = overrides.allowedComponentVariantIds ?? ['component.carousel'];
	const allowedCssVariantIds = overrides.allowedCssVariantIds ?? ['css.reference'];
	const allowedCopyVariantIds = overrides.allowedCopyVariantIds ?? ['copy.reference'];
	const localOverride = definition.origin === 'aisles' ? {
		[definition.familyId]: {
			capabilities,
			decisionMode,
			publicationMode,
			allowedComponentVariantIds,
			allowedCssVariantIds,
			allowedCopyVariantIds,
		},
	} : undefined;
	const brandPolicy: BrandCompositionPolicy = {
		organizationId: identity.organizationId,
		brandId: identity.brandId,
		policyVersion: 'b',
		maximum: { capabilities: AUTONOMY_CAPABILITIES, decisionMode: 'model', publicationMode: 'live' },
		registeredComponentVariantIds: ['component.carousel'],
		registeredCssVariantIds: ['css.reference'],
		registeredCopyVariantIds: ['copy.reference'],
		reference: { referenceId: identity.referenceId, referenceVersion: identity.referenceVersion },
		surfaces: {
			[definition.surface]: {
				preset: 'compose',
				capabilities: authority.maximumCapabilities,
				decisionMode: authority.maximumDecisionMode,
				publicationMode: 'live',
				allowedComponentVariantIds: ['component.carousel'],
				allowedCssVariantIds: ['css.reference'],
				allowedCopyVariantIds: ['copy.reference'],
				...(localOverride ? { zoneOverrides: localOverride } : {}),
			},
		},
	};
	return compileCompositionPolicy({
		organizationId: executionIdentity.organizationId,
		brandId: executionIdentity.brandId,
		surface: definition.surface,
		...(bindZone ? {
			zoneIdentity: definition,
			routeSource: executionIdentity.routeSource,
			routePath: executionIdentity.routePath,
		} : {}),
		registry: {
			organizations: { [organizationPolicy.organizationId]: organizationPolicy },
			brands: { [brandPolicy.brandId]: brandPolicy },
		},
	});
}

function decisionProductIds(input: Parameters<TrustedBoundZoneCatalog['materialize']>[0]): readonly string[] {
	const raw = input.decision?.envelope.rawModelContent as { rankedProductIds?: string[]; productIds?: string[] } | undefined;
	return raw?.rankedProductIds ?? raw?.productIds ?? input.fixed.productIds ?? [];
}

function catalog(overrides: Partial<TrustedBoundZoneCatalog> = {}): TrustedBoundZoneCatalog {
	return {
		identity,
		fields,
		products: {
			organizationId: identity.organizationId, brandId: identity.brandId,
			referenceId: identity.referenceId, referenceVersion: identity.referenceVersion,
			catalogId: identity.productCatalogId, catalogVersion: identity.productCatalogVersion,
			productIds,
		},
		materialize: (input) => ({
			component: 'product-carousel',
			props: {
				title: 'Trusted recommendations',
				products: decisionProductIds(input).map((productId) => ({ productId, role: 'standard' as const })),
				showQuickAdd: false,
			},
		}),
		...overrides,
	};
}

function fallback(overrides: Partial<TrustedZoneFallback> = {}): TrustedZoneFallback {
	return {
		identity,
		kind: 'content',
		content: { component: 'editorial-header', props: { eyebrow: 'DEFAULT', headline: 'Trusted fallback', body: 'Safe content.' } },
		...overrides,
	} as TrustedZoneFallback;
}

describe('identity-bound zone decision executor', () => {
	it('fixed mode never invokes a runner and materializes actual renderer props', async () => {
		const runRules = vi.fn(); const runModel = vi.fn();
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'fixed', capabilities: [] }), catalog: catalog(), fallback: fallback(), runRules, runModel });
		expect(result).toMatchObject({ status: 'live', decisionMode: 'fixed', render: { kind: 'content', content: { component: 'product-carousel' } } });
		expect(runRules).not.toHaveBeenCalled(); expect(runModel).not.toHaveBeenCalled();
		if (result.status === 'live' && result.render.kind === 'content') expect(SectionSchema.safeParse(result.render.content).success).toBe(true);
	});

	it('rules mode uses server logic and materializes server-bound variants', async () => {
		const runModel = vi.fn();
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }), catalog: catalog(), fallback: fallback(), runRules: () => ({ productIds }), runModel });
		expect(result).toMatchObject({ status: 'live', decisionMode: 'rules', decision: { envelope: { decisionModeUsed: 'rules', componentVariantId: 'component.carousel', cssVariantId: 'css.reference' } } });
		expect(runModel).not.toHaveBeenCalled();
	});

	it('model mode exposes only the strict schema to an injected fake provider', async () => {
		const runModel = vi.fn(async (modelInput: { outputSchema: { safeParse(value: unknown): { success: boolean } } }) => {
			expect(Object.keys(modelInput)).toEqual(['outputSchema']);
			const { outputSchema } = modelInput;
			expect(outputSchema.safeParse({ arbitraryUrl: 'https://invalid.example' }).success).toBe(false);
			return { productIds };
		});
		const result = await executeZoneDecision({ policy: policy({ capabilities: ['select_products'], publicationMode: 'holdout' }), catalog: catalog(), fallback: fallback(), runModel });
		expect(result).toMatchObject({ status: 'held', candidate: { decisionMode: 'model' }, provenance: { liveModelApproved: false } });
		expect(runModel).toHaveBeenCalledOnce();
	});

	it.each(ZONE_IDS)('executes every allowed decision mode for %s and blocks engine modes on fixed-only zones', async (zoneId) => {
		const zoneIdentity = identityForZone(zoneId);
		const authority = surfaceAuthorityFor(zoneIdentity.surface);
		const requestedCapability = authority.maximumCapabilities.includes('select_products') ? 'select_products' : authority.maximumCapabilities[0];
		for (const decisionMode of ['fixed', 'rules', 'model'] as const satisfies readonly DecisionMode[]) {
			const requestedCapabilities = decisionMode === 'fixed' ? [] : requestedCapability ? [requestedCapability] : [];
			if (!isDecisionModeWithinSurface(zoneIdentity.surface, decisionMode) || !capabilitiesWithinSurface(zoneIdentity.surface, requestedCapabilities)) {
				expect(() => policy({ decisionMode, capabilities: requestedCapabilities }, zoneIdentity)).toThrow(/surface authority|zone expands surface|effective policy expands/);
				continue;
			}
			const decisionOutput = requestedCapability === 'select_copy_variant' ? { copyVariantId: 'copy.reference' } : { productIds };
			const runRules = vi.fn(() => decisionOutput);
			const runModel = vi.fn(async () => decisionOutput);
			const result = await executeZoneDecision({
				policy: policy({
					decisionMode,
					capabilities: requestedCapabilities,
					publicationMode: decisionMode === 'model' ? 'holdout' : 'live',
				}, zoneIdentity),
				catalog: catalog({ identity: zoneIdentity, materialize: () => contentForZone(zoneId) }),
				fallback: { identity: zoneIdentity, kind: 'hidden' },
				runRules,
				runModel,
			});
			if (decisionMode === 'model' && ZONES[zoneId].engineComposable) {
				expect(result.status, `${zoneId}:${decisionMode}`).toBe('held');
			} else if (decisionMode === 'fixed' || ZONES[zoneId].engineComposable) {
				expect(result.status, `${zoneId}:${decisionMode}`).toBe('live');
			} else {
				expect(result, `${zoneId}:${decisionMode}`).toMatchObject({ status: 'fallback', reason: 'fixed_only_zone' });
			}
			if (decisionMode === 'fixed' || !ZONES[zoneId].engineComposable) {
				expect(runRules).not.toHaveBeenCalled();
				expect(runModel).not.toHaveBeenCalled();
			}
		}
	});

	it('executes every exact Bealls identity through the union boundary', async () => {
		const bealls = TRUSTED_ZONE_IDENTITIES.filter((definition) => definition.origin === 'bealls-aisles');
		expect(new Set(bealls.map(({ familyId }) => familyId)).size).toBe(28);
		expect(bealls).toHaveLength(36);
		expect(new Set(bealls.map(({ instanceId }) => instanceId)).size).toBe(36);
		expect(bealls.map(({ instanceId }) => instanceId)).toContain('account.welcome');
		for (const definition of bealls) {
			const zoneIdentity = identityForDefinition(definition);
			const materialize = vi.fn(() => headerContent);
			const compiledPolicy = policy({}, zoneIdentity);
			expect(compiledPolicy, definition.instanceId).toMatchObject({
				capabilities: [], decisionMode: 'fixed',
				provenance: { zoneBinding: { rendererContract: 'trusted-hidden', instanceId: definition.instanceId } },
			});
			const result = await executeZoneDecision({
				policy: compiledPolicy,
				catalog: catalog({
					identity: zoneIdentity,
					materialize,
				}),
				fallback: { identity: zoneIdentity, kind: 'hidden' },
			});
			expect(result, `${definition.instanceId} must remain trusted Hidden`).toMatchObject({ status: 'live', render: { kind: 'hidden' } });
			expect(materialize, `${definition.instanceId} must not cross into the local materializer`).not.toHaveBeenCalled();
		}
	});

	it('does not infer the local home.editorial-strip schema across the Bealls origin', async () => {
		const definition = findTrustedZoneIdentity('bealls-aisles', 'home.editorial-strip', 'home.editorial-strip');
		expect(definition).toMatchObject({ rendererContract: 'trusted-hidden' });
		const zoneIdentity = identityForDefinition(definition!);
		const materialize = vi.fn(() => headerContent);
		const result = await executeZoneDecision({
			policy: policy({}, zoneIdentity),
			catalog: catalog({ identity: zoneIdentity, materialize }),
			fallback: { identity: zoneIdentity, kind: 'content', content: headerContent },
		});
		expect(result).toMatchObject({ status: 'live', render: { kind: 'hidden' } });
		expect(materialize).not.toHaveBeenCalled();
	});

	it.each(PUBLICATION_MODES)('enforces %s as a result-level publication gate', async (publicationMode) => {
		const result = await executeZoneDecision({
			policy: policy({ decisionMode: 'fixed', capabilities: [], publicationMode }),
			catalog: catalog(),
			fallback: fallback(),
		});
		expect(result.status).toBe(publicationMode === 'live' ? 'live' : publicationMode === 'holdout' ? 'held' : 'approval_candidate');
		if (publicationMode !== 'live') expect(result.render).toMatchObject({ kind: 'content', content: { component: 'editorial-header' } });
	});

	it('holdout and approval results render only fallback while retaining a non-live candidate', async () => {
		const holdout = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'], publicationMode: 'holdout' }), catalog: catalog(), fallback: fallback(), runRules: () => ({ productIds }) });
		expect(holdout).toMatchObject({ status: 'held', gate: 'holdout', candidate: { render: { kind: 'content', content: { component: 'product-carousel' } } }, render: { kind: 'content', content: { component: 'editorial-header' } } });
		const approval = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'], publicationMode: 'approval_required' }), catalog: catalog(), fallback: fallback(), runRules: () => ({ productIds }) });
		expect(approval).toMatchObject({ status: 'approval_candidate', gate: 'approval_required', render: { kind: 'content', content: { component: 'editorial-header' } } });
	});

	it.each(Object.entries(PRESET_CAPABILITIES))('executes all %s preset capabilities through a held candidate', async (_preset, capabilities) => {
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities, publicationMode: 'holdout' }), catalog: catalog(), fallback: fallback(), runRules: () => ({ rankedProductIds: productIds }) });
		expect(result.status).toBe('held');
	});

	it.each(AUTONOMY_CAPABILITIES)('fails closed when %s output is outside effective policy', async (capability) => {
		const output = capability === 'rank_products' ? { rankedProductIds: productIds }
			: capability === 'select_products' ? { productIds }
			: capability === 'select_copy_variant' ? { copyVariantId: 'copy.reference' }
			: capability === 'generate_bounded_copy' ? { boundedCopy: { headline: 'Pinned headline' } }
			: capability === 'select_component_variant' ? { componentVariantId: 'component.carousel' }
			: capability === 'toggle_zone' ? { visible: true }
			: capability === 'reorder_zones' ? { placementId: 'placement.top' }
			: { recipeId: 'recipe.home' };
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: AUTONOMY_CAPABILITIES.filter((candidate) => candidate !== capability) }), catalog: catalog(), fallback: fallback(), runRules: () => output });
		expect(result).toMatchObject({ status: 'fallback', reason: 'invalid_output', render: { kind: 'content', content: { component: 'editorial-header' } } });
	});

	it('rejects a surface-level policy before any runner call', async () => {
		const runRules = vi.fn();
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }, identity, false), catalog: catalog(), fallback: fallback(), runRules });
		expect(result).toMatchObject({ status: 'fallback', reason: 'policy_not_zone_scoped' });
		expect(runRules).not.toHaveBeenCalled();
	});

	it('rejects hand-built provenance even when every visible binding field is copied', async () => {
		const compiled = policy({ decisionMode: 'rules', capabilities: ['select_products'] });
		const forged: EffectiveCompositionPolicy = { ...compiled, provenance: { ...compiled.provenance } };
		const runRules = vi.fn(() => ({ productIds }));
		const result = await executeZoneDecision({ policy: forged, catalog: catalog(), fallback: fallback(), runRules });
		expect(result).toMatchObject({ status: 'fallback', reason: 'identity_mismatch', render: { kind: 'hidden' } });
		expect(runRules).not.toHaveBeenCalled();
	});

	it('rejects cross-brand and cross-reference catalogs before any runner call', async () => {
		for (const changedIdentity of [{ ...identity, brandId: 'other-brand' }, { ...identity, referenceVersion: 'other-reference' }]) {
			const runRules = vi.fn();
			const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }), catalog: catalog({ identity: changedIdentity }), fallback: fallback({ identity: changedIdentity }), runRules });
			expect(result).toMatchObject({ status: 'fallback', reason: 'identity_mismatch' });
			expect(runRules).not.toHaveBeenCalled();
		}
	});

	it('rejects a cross-bound product catalog before any runner call', async () => {
		const runRules = vi.fn();
		const changed = catalog();
		changed.products = { ...changed.products, brandId: 'other-brand' };
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }), catalog: changed, fallback: fallback(), runRules });
		expect(result).toMatchObject({ status: 'fallback', reason: 'product_catalog_mismatch' });
		expect(runRules).not.toHaveBeenCalled();
	});

	it('rejects null, surface, and compiler-bound decision-mode identity mismatches before runners', async () => {
		const runModel = vi.fn();
		const wrongSurface = { ...identity, surface: 'plp' as const };
		expect(await executeZoneDecision({ policy: policy(), catalog: catalog({ identity: wrongSurface }), fallback: fallback({ identity: wrongSurface }), runModel })).toMatchObject({ status: 'fallback', reason: 'route_surface_mismatch' });
		const wrongZone = { ...identity, routePath: '/category/dog-food', surface: 'plp' as const };
		expect(await executeZoneDecision({ policy: policy(), catalog: catalog({ identity: wrongZone }), fallback: fallback({ identity: wrongZone }), runModel })).toMatchObject({ status: 'fallback', reason: 'surface_zone_mismatch' });
		const fixedApprovalOnly = { ...identity, allowedDecisionModes: ['fixed'] as const };
		expect(await executeZoneDecision({ policy: policy(), catalog: catalog({ identity: fixedApprovalOnly }), fallback: fallback({ identity: fixedApprovalOnly }), runModel })).toMatchObject({ status: 'fallback', reason: 'identity_mismatch' });
		expect(runModel).not.toHaveBeenCalled();
	});

	it('blocks live model publication on a zone without explicit approval', async () => {
		const heroIdentity = identityForZone('home.hero');
		const runModel = vi.fn(async () => ({ productIds }));
		const result = await executeZoneDecision({
			policy: policy({ capabilities: ['select_products'], publicationMode: 'live' }, heroIdentity),
			catalog: catalog({ identity: heroIdentity }), fallback: fallback({ identity: heroIdentity }), runModel,
		});
		expect(result).toMatchObject({ status: 'fallback', reason: 'live_model_not_approved', provenance: { liveModelApproved: false } });
		expect(runModel).not.toHaveBeenCalled();
	});

	it('does not widen the Kibble-specific approval to another organization or brand', async () => {
		const runModel = vi.fn(async ({ outputSchema }) => {
			expect(outputSchema.safeParse({ rankedProductIds: [...productIds].reverse() }).success).toBe(true);
			expect(outputSchema.safeParse({ rankedProductIds: [...productIds].reverse(), copy: 'forbidden' }).success).toBe(false);
			return { rankedProductIds: [...productIds].reverse() };
		});
		const result = await executeZoneDecision({
			policy: policy({ capabilities: ['rank_products'], publicationMode: 'live' }),
			catalog: catalog(), fallback: fallback(), runModel,
		});
		expect(result).toMatchObject({ status: 'fallback', reason: 'live_model_not_approved', provenance: { liveModelApproved: false } });
		expect(runModel).not.toHaveBeenCalled();
	});

	it('keeps the full live-model authority graph immutable before execution', async () => {
		const heroEntry = ZONE_CATALOG['home.hero'];
		const rankedEntry = ZONE_CATALOG['home.featured-row'];
		const rankedApproval = rankedEntry.liveModelApprovals[0];
		const heroDefinition = heroEntry.definitions[0];
		const aislesFacts = heroEntry.implementation.aisles;
		const fallbackMap = heroEntry.fallbackByAislesBrand;
		if (!heroDefinition || !aislesFacts || !fallbackMap) throw new Error('home.hero authority fixture is incomplete');
		const fallbackBrand = Object.keys(fallbackMap)[0];
		if (!fallbackBrand) throw new Error('home.hero fallback authority fixture is empty');
		const originalFallback = fallbackMap[fallbackBrand];

		expect(Object.isFrozen(ZONE_CATALOG)).toBe(true);
		expect(Object.isFrozen(heroEntry)).toBe(true);
		expect(Object.isFrozen(heroEntry.definitions)).toBe(true);
		expect(Object.isFrozen(heroDefinition)).toBe(true);
		expect(Object.isFrozen(heroEntry.implementation)).toBe(true);
		expect(Object.isFrozen(aislesFacts)).toBe(true);
		expect(Object.isFrozen(fallbackMap)).toBe(true);
		expect(Object.isFrozen(rankedEntry.liveModelApprovals)).toBe(true);
		expect(Object.isFrozen(rankedApproval)).toBe(true);
		expect(Reflect.set(ZONE_CATALOG, 'home.hero', { ...heroEntry, liveModelApprovals: [{ organizationId: 'attacker', brandId: 'attacker', referenceId: 'attacker', referenceVersion: '1', routePath: '/', instanceId: 'home.hero' }] })).toBe(false);
		expect(Reflect.set(heroEntry, 'liveModelApprovals', [{ organizationId: 'attacker', brandId: 'attacker', referenceId: 'attacker', referenceVersion: '1', routePath: '/', instanceId: 'home.hero' }])).toBe(false);
		expect(Reflect.set(rankedApproval, 'brandId', 'attacker')).toBe(false);
		expect(Reflect.set(heroEntry.implementation, 'aisles', { ...aislesFacts, routeRendered: true })).toBe(false);
		expect(Reflect.set(aislesFacts, 'routeRendered', true)).toBe(false);
		expect(Reflect.set(heroEntry.definitions, '0', { ...heroDefinition, engineComposable: false })).toBe(false);
		expect(Reflect.set(heroDefinition, 'engineComposable', false)).toBe(false);
		expect(Reflect.set(fallbackMap, fallbackBrand, originalFallback === 'content' ? 'hidden' : 'content')).toBe(false);
		expect(ZONE_CATALOG['home.hero']).toBe(heroEntry);
		expect(heroEntry.liveModelApprovals).toEqual([]);
		expect(rankedApproval).toMatchObject({ organizationId: 'kibble-demo-merchant', brandId: 'kibble', referenceId: 'kibble-shelf-native', referenceVersion: '1.8.0', routePath: '/', instanceId: 'home.featured-row.1' });
		expect(aislesFacts.routeRendered).toBe(false);
		expect(heroEntry.definitions[0]).toBe(heroDefinition);
		expect(heroDefinition.engineComposable).toBe(true);
		expect(fallbackMap[fallbackBrand]).toBe(originalFallback);

		const heroIdentity = identityForZone('home.hero');
		const runModel = vi.fn(async () => ({ productIds }));
		const result = await executeZoneDecision({
			policy: policy({ capabilities: ['select_products'], publicationMode: 'live' }, heroIdentity),
			catalog: catalog({ identity: heroIdentity }),
			fallback: { identity: heroIdentity, kind: 'hidden' },
			runModel,
		});
		expect(result).toMatchObject({ status: 'fallback', reason: 'live_model_not_approved', provenance: { liveModelApproved: false } });
		expect(runModel).not.toHaveBeenCalled();
	});

	it('blocks rules/model on an engine-disabled zone before runners', async () => {
		const plpIdentity = { ...identity, routePath: '/category/dog-food', surface: 'plp' as const, familyId: 'plp.below-grid', instanceId: 'plp.below-grid' };
		const runRules = vi.fn();
		expect(Object.isFrozen(ZONES)).toBe(true);
		expect(Object.isFrozen(ZONES['plp.below-grid'])).toBe(true);
		expect(Reflect.set(ZONES['plp.below-grid'], 'engineComposable', true)).toBe(false);
		expect(Reflect.set(ZONES, 'plp.below-grid', { ...ZONES['plp.below-grid'], engineComposable: true })).toBe(false);
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }, plpIdentity), catalog: catalog({ identity: plpIdentity }), fallback: { identity: plpIdentity, kind: 'hidden' }, runRules });
		expect(result).toMatchObject({ status: 'fallback', reason: 'fixed_only_zone' });
		expect(runRules).not.toHaveBeenCalled();
	});

	it('rejects unknown routes before runners and retains the exact route in provenance', async () => {
		const runRules = vi.fn();
		const unknownRoute = { ...identity, routePath: '/style-guide' };
		const result = await executeZoneDecision({
			policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }),
			catalog: catalog({ identity: unknownRoute }),
			fallback: fallback({ identity: unknownRoute }),
			runRules,
		});
		expect(result).toMatchObject({
			status: 'fallback',
			reason: 'route_surface_mismatch',
			render: { kind: 'hidden' },
			provenance: { routePath: '/style-guide', surface: 'home' },
		});
		expect(runRules).not.toHaveBeenCalled();
	});

	it.each(['unknown.zone', 'constructor', '__proto__'])('fails closed for unknown or prototype zone identity %s', async (zoneId) => {
		const runRules = vi.fn();
		const unknownZone = { ...identity, familyId: zoneId };
		const result = await executeZoneDecision({
			policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }),
			catalog: catalog({ identity: unknownZone }),
			fallback: fallback({ identity: unknownZone }),
			runRules,
		});
		expect(result).toMatchObject({ status: 'fallback', reason: 'surface_zone_mismatch', render: { kind: 'hidden' } });
		expect(runRules).not.toHaveBeenCalled();
	});

	it('turns provider rejection, invalid output, and materializer failure into structured fallback', async () => {
		const provider = await executeZoneDecision({ policy: policy({ capabilities: ['select_products'], publicationMode: 'holdout' }), catalog: catalog(), fallback: fallback(), runModel: async () => { throw new Error('secret provider detail'); } });
		expect(provider).toMatchObject({ status: 'fallback', reason: 'provider_failed' });
		expect(JSON.stringify(provider)).not.toContain('secret provider detail');
		const invalid = await executeZoneDecision({ policy: policy({ capabilities: ['select_products'], publicationMode: 'holdout' }), catalog: catalog(), fallback: fallback(), runModel: async () => ({ arbitrary: true }) });
		expect(invalid).toMatchObject({ status: 'fallback', reason: 'invalid_output' });
		const brokenCatalog = catalog({ materialize: () => { throw new Error('private materializer detail'); } });
		const broken = await executeZoneDecision({ policy: policy({ decisionMode: 'fixed', capabilities: [] }), catalog: brokenCatalog, fallback: fallback() });
		expect(broken).toMatchObject({ status: 'fallback', reason: 'materialization_failed' });
		expect(JSON.stringify(broken)).not.toContain('private materializer detail');
	});

	it('turns absent and rejected rules runners into trusted fallback without raw errors', async () => {
		const missing = await executeZoneDecision({
			policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }), catalog: catalog(), fallback: fallback(),
		});
		expect(missing).toMatchObject({ status: 'fallback', reason: 'runner_unavailable' });
		const rejected = await executeZoneDecision({
			policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }), catalog: catalog(), fallback: fallback(),
			runRules: () => { throw new Error('private rules detail'); },
		});
		expect(rejected).toMatchObject({ status: 'fallback', reason: 'rules_runner_failed' });
		expect(JSON.stringify(rejected)).not.toContain('private rules detail');
	});

	it('rejects incomplete renderer props and foreign product references', async () => {
		const incomplete = await executeZoneDecision({ policy: policy({ decisionMode: 'fixed', capabilities: [] }), catalog: catalog({ materialize: () => ({ component: 'product-carousel', props: { title: 'Missing products' } }) }), fallback: fallback() });
		expect(incomplete).toMatchObject({ status: 'fallback', reason: 'invalid_renderer_content' });
		const foreign = await executeZoneDecision({ policy: policy({ decisionMode: 'fixed', capabilities: [] }), catalog: catalog({ materialize: () => ({ component: 'product-carousel', props: { title: 'Foreign', products: ['x', 'y', 'z'].map((suffix) => ({ productId: `foreign.${suffix}`, role: 'standard' })), showQuickAdd: false } }) }), fallback: fallback() });
		expect(foreign).toMatchObject({ status: 'fallback', reason: 'untrusted_product_reference' });
	});

	it('uses Hidden when a supplied fallback cannot satisfy its trusted schema', async () => {
		const result = await executeZoneDecision({ policy: policy({ capabilities: ['select_products'], publicationMode: 'holdout' }), catalog: catalog(), fallback: fallback({ content: { arbitraryUrl: 'https://invalid.example' } }), runModel: async () => { throw new Error('offline'); } });
		expect(result).toMatchObject({ status: 'fallback', reason: 'provider_failed', render: { kind: 'hidden' } });
	});
});
