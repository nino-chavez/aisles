import { describe, expect, it, vi } from 'vitest';
import { AUTONOMY_CAPABILITIES, PRESET_CAPABILITIES, PUBLICATION_MODES, type DecisionMode, type EffectiveCompositionPolicy } from '$lib/foundation/composition-policy';
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
	zoneId: 'home.featured-row',
	productCatalogId: 'catalog',
	productCatalogVersion: '1',
	allowedDecisionModes: ['fixed', 'rules', 'model'],
};

const headerContent = { component: 'editorial-header', props: { eyebrow: 'TRUSTED', headline: 'Trusted content', body: 'Server materialized.' } } as const;
const carouselContent = { component: 'product-carousel', props: { title: 'Trusted products', products: productIds.map((productId) => ({ productId, role: 'standard' as const })), showQuickAdd: false } } as const;
const serviceContent = { component: 'service-callouts-grid', props: { columns: 3, callouts: [{ icon: 'shipping', label: 'Shipping' }, { icon: 'returns', label: 'Returns' }, { icon: 'secure', label: 'Secure' }] } } as const;
const tileContent = { component: 'category-tile-grid', props: { columns: 3, tiles: productIds.map((productId) => ({ label: productId, product: { productId, role: 'standard' as const } })) } } as const;
const chipContent = { component: 'cluster-chip-row', props: { chips: productIds.map((productId) => ({ label: productId, product: { productId, role: 'standard' as const } })) } } as const;

function contentForZone(zoneId: ZoneId): unknown {
	if (zoneId === 'home.below-fold' || zoneId === 'checkout.assurance-strip') return serviceContent;
	if (zoneId === 'plp.cluster-row') return chipContent;
	if (zoneId === 'plp.below-grid') return tileContent;
	if (['home.featured-row', 'pdp.related', 'pdp.cross-sell', 'pdp.recently-viewed', 'cart.above-checkout-cta', 'checkout.last-chance-upsell'].includes(zoneId)) return carouselContent;
	return headerContent;
}

function identityForZone(zoneId: ZoneId): TrustedZoneExecutionIdentity {
	const surface = ZONES[zoneId].surface;
	const routes = {
		home: '/', plp: '/category/example', pdp: '/product/example', cart: '/cart', checkout: '/checkout', search: '/search',
		account: '/account', locator: '/store-locator', 'error-404': '/missing', 'error-empty': '/category/empty',
	} as const;
	return {
		...identity,
		routeSource: surface === 'error-404' || surface === 'error-empty' ? 'error-state' : 'pathname',
		routePath: routes[surface],
		surface,
		zoneId,
	};
}

function policy(overrides: Partial<EffectiveCompositionPolicy> = {}): EffectiveCompositionPolicy {
	return {
		policyVersion: identity.policyVersion,
		capabilities: [...AUTONOMY_CAPABILITIES],
		decisionMode: 'model',
		publicationMode: 'live',
		allowedComponentVariantIds: ['component.carousel'],
		allowedCssVariantIds: ['css.reference'],
		allowedCopyVariantIds: ['copy.reference'],
		provenance: {
			kind: 'compiled', organizationId: identity.organizationId, organizationPolicyVersion: 'o', brandId: identity.brandId,
			brandPolicyVersion: 'b', referenceId: identity.referenceId, referenceVersion: identity.referenceVersion,
			surface: identity.surface, zoneId: identity.zoneId, preset: 'compose',
		},
		...overrides,
	};
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
		for (const decisionMode of ['fixed', 'rules', 'model'] as const satisfies readonly DecisionMode[]) {
			const runRules = vi.fn(() => ({ productIds }));
			const runModel = vi.fn(async () => ({ productIds }));
			const result = await executeZoneDecision({
				policy: policy({
					decisionMode,
					capabilities: decisionMode === 'fixed' ? [] : ['select_products'],
					publicationMode: decisionMode === 'model' ? 'holdout' : 'live',
					provenance: { ...policy().provenance, surface: zoneIdentity.surface, zoneId },
				}),
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
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'], provenance: { ...policy().provenance, zoneId: null } }), catalog: catalog(), fallback: fallback(), runRules });
		expect(result).toMatchObject({ status: 'fallback', reason: 'policy_not_zone_scoped' });
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

	it('rejects null/surface mismatches and unapproved modes before runners', async () => {
		const runModel = vi.fn();
		const wrongSurface = { ...identity, surface: 'plp' as const };
		expect(await executeZoneDecision({ policy: policy({ provenance: { ...policy().provenance, surface: 'plp' } }), catalog: catalog({ identity: wrongSurface }), fallback: fallback({ identity: wrongSurface }), runModel })).toMatchObject({ status: 'fallback', reason: 'route_surface_mismatch' });
		const wrongZone = { ...identity, routePath: '/category/dog-food', surface: 'plp' as const };
		expect(await executeZoneDecision({ policy: policy({ provenance: { ...policy().provenance, surface: 'plp' } }), catalog: catalog({ identity: wrongZone }), fallback: fallback({ identity: wrongZone }), runModel })).toMatchObject({ status: 'fallback', reason: 'surface_zone_mismatch' });
		const fixedApprovalOnly = { ...identity, allowedDecisionModes: ['fixed'] as const };
		expect(await executeZoneDecision({ policy: policy(), catalog: catalog({ identity: fixedApprovalOnly }), fallback: fallback({ identity: fixedApprovalOnly }), runModel })).toMatchObject({ status: 'fallback', reason: 'decision_mode_not_approved' });
		expect(runModel).not.toHaveBeenCalled();
	});

	it('preserves the fact that no current zone has live model publication approval', async () => {
		const runModel = vi.fn(async () => ({ productIds }));
		const result = await executeZoneDecision({
			policy: policy({ capabilities: ['select_products'], publicationMode: 'live' }),
			catalog: catalog(), fallback: fallback(), runModel,
		});
		expect(result).toMatchObject({ status: 'fallback', reason: 'live_model_not_approved', provenance: { liveModelApproved: false } });
		expect(runModel).not.toHaveBeenCalled();
	});

	it('blocks rules/model on an engine-disabled zone before runners', async () => {
		const plpIdentity = { ...identity, routePath: '/category/dog-food', surface: 'plp' as const, zoneId: 'plp.below-grid' as const };
		const runRules = vi.fn();
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'], provenance: { ...policy().provenance, surface: 'plp', zoneId: 'plp.below-grid' } }), catalog: catalog({ identity: plpIdentity }), fallback: { identity: plpIdentity, kind: 'hidden' }, runRules });
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
		const unknownZone = { ...identity, zoneId: zoneId as ZoneId };
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
