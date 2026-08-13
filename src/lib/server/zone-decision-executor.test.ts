import { describe, expect, it, vi } from 'vitest';
import { AUTONOMY_CAPABILITIES, PRESET_CAPABILITIES, type EffectiveCompositionPolicy } from '$lib/foundation/composition-policy';
import type { TrustedZoneFieldCatalog } from '$lib/foundation/zone-decision-schema';
import { executeZoneDecision, ZoneDecisionExecutionError } from './zone-decision-executor';

const catalog: TrustedZoneFieldCatalog = {
	registeredComponentVariantIds: ['component.a'], registeredCssVariantIds: ['css.a'], registeredCopyVariantIds: ['copy.a'],
	registeredRecipeIds: ['recipe.a'], registeredProductIds: ['product.a', 'product.b'], registeredPlacementIds: ['placement.a'],
	completeComponentVariants: [{ componentVariantId: 'component.a', cssVariantId: 'css.a', compatibleCopyVariantIds: ['copy.a'] }],
	allowedRecipeIds: ['recipe.a'], allowedProductIds: ['product.a', 'product.b'], allowedPlacementIds: ['placement.a'],
	boundedCopyFields: [{ key: 'headline', maxLength: 24, sourceClasses: ['reference-copy'], sourceBindings: [{ sourceClass: 'reference-copy', sourceId: 'reference.headline', value: 'Pinned headline' }] }],
	fixed: { componentVariantId: 'component.a', copyVariantId: 'copy.a', recipeId: 'recipe.a', productIds: ['product.a'], placementId: 'placement.a' },
};

function policy(overrides: Partial<EffectiveCompositionPolicy> = {}): EffectiveCompositionPolicy {
	return {
		policyVersion: 'org:1:o|brand:1:b', capabilities: [...AUTONOMY_CAPABILITIES], decisionMode: 'model', publicationMode: 'live',
		allowedComponentVariantIds: ['component.a'], allowedCssVariantIds: ['css.a'], allowedCopyVariantIds: ['copy.a'],
		provenance: { kind: 'compiled', organizationId: 'org', organizationPolicyVersion: 'o', brandId: 'brand', brandPolicyVersion: 'b', referenceId: 'reference', referenceVersion: '1', surface: 'home', zoneId: 'home.hero', preset: 'compose' },
		...overrides,
	};
}

describe('zone decision executor', () => {
	it('fixed mode does not invoke rules or model runners', async () => {
		const rules = vi.fn(); const model = vi.fn();
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'fixed', capabilities: [] }), catalog, runRules: rules, runModel: model });
		expect(result).toMatchObject({ kind: 'fixed', publication: 'publishable', fixed: { componentVariantId: 'component.a' } });
		expect(rules).not.toHaveBeenCalled(); expect(model).not.toHaveBeenCalled();
	});

	it('rules mode uses only injected server logic and materializes trusted variants', async () => {
		const model = vi.fn();
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }), catalog, runRules: () => ({ productIds: ['product.b'] }), runModel: model });
		expect(result).toMatchObject({ kind: 'rules', publication: 'publishable', decision: { envelope: { decisionModeUsed: 'rules', componentVariantId: 'component.a', cssVariantId: 'css.a', requiredCapabilityIds: ['select_products'] } } });
		expect(model).not.toHaveBeenCalled();
	});

	it('model mode exposes only strict derived schema and uses injected fake output', async () => {
		const model = vi.fn(async ({ outputSchema }: { outputSchema: { safeParse(value: unknown): { success: boolean } } }) => {
			expect(outputSchema.safeParse({ arbitraryUrl: 'https://invalid.example' }).success).toBe(false);
			return { copyVariantId: 'copy.a' };
		});
		const result = await executeZoneDecision({ policy: policy({ capabilities: ['select_copy_variant'], publicationMode: 'approval_required' }), catalog, runModel: model });
		expect(result).toMatchObject({ kind: 'model', publication: 'approval_required', decision: { envelope: { decisionModeUsed: 'model', cssVariantId: 'css.a', copyVariantId: 'copy.a' } } });
	});

	it.each(['holdout', 'approval_required'] as const)('never makes %s automatically publishable', async (publicationMode) => {
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'], publicationMode }), catalog, runRules: () => ({ productIds: ['product.a'] }) });
		expect(result.publication).toBe(publicationMode);
	});

	it.each(Object.entries(PRESET_CAPABILITIES))('derives a bounded contract for %s capabilities', async (_preset, capabilities) => {
		const result = await executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities, publicationMode: 'holdout' }), catalog, runRules: () => ({ rankedProductIds: ['product.a', 'product.b'] }) });
		expect(result.kind).toBe('rules');
	});

	it.each(AUTONOMY_CAPABILITIES)('fails closed if %s is emitted but policy omits it', async (capability) => {
		const output = capability === 'rank_products' ? { rankedProductIds: ['product.a', 'product.b'] }
			: capability === 'select_products' ? { productIds: ['product.a'] }
			: capability === 'select_copy_variant' ? { copyVariantId: 'copy.a' }
			: capability === 'generate_bounded_copy' ? { boundedCopy: { headline: 'Pinned headline' } }
			: capability === 'select_component_variant' ? { componentVariantId: 'component.a' }
			: capability === 'toggle_zone' ? { visible: true }
			: capability === 'reorder_zones' ? { placementId: 'placement.a' }
			: { recipeId: 'recipe.a' };
		await expect(executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: AUTONOMY_CAPABILITIES.filter((item) => item !== capability) }), catalog, runRules: () => output }))
			.rejects.toThrow(/invalid structured output/);
	});

	it('requires a runner for non-fixed policies', async () => {
		await expect(executeZoneDecision({ policy: policy({ decisionMode: 'rules', capabilities: ['select_products'] }), catalog })).rejects.toThrow(ZoneDecisionExecutionError);
		await expect(executeZoneDecision({ policy: policy({ decisionMode: 'model', capabilities: ['select_products'] }), catalog })).rejects.toThrow(ZoneDecisionExecutionError);
	});
});
