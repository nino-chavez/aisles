import { describe, expect, it } from 'vitest';
import type { EffectiveCompositionPolicy } from './composition-policy';
import {
	aiSdkObjectOutput,
	createZoneDecisionContract,
	materializeTrustedZoneDecision,
	type TrustedZoneFieldCatalog,
	ZoneDecisionSchemaError,
} from './zone-decision-schema';

const policy = (overrides: Partial<EffectiveCompositionPolicy> = {}): EffectiveCompositionPolicy => ({
	policyVersion: 'org:5:org-v|brand:7:brand-v',
	capabilities: [
		'rank_products',
		'select_products',
		'select_copy_variant',
		'generate_bounded_copy',
		'select_component_variant',
		'toggle_zone',
		'reorder_zones',
		'select_page_recipe',
	],
	decisionMode: 'model',
	publicationMode: 'holdout',
	allowedComponentVariantIds: ['component.hero', 'component.grid'],
	allowedCssVariantIds: ['css.airy', 'css.dense'],
	allowedCopyVariantIds: ['copy.spring', 'copy.evergreen'],
	provenance: {
		kind: 'compiled',
		organizationId: 'merchant',
		organizationPolicyVersion: 'org-v',
		brandId: 'brand',
		brandPolicyVersion: 'brand-v',
		referenceId: 'reference',
		referenceVersion: '1',
		surface: 'home',
		zoneId: 'home.hero',
		preset: 'compose',
	},
	...overrides,
});

const catalog = (overrides: Partial<TrustedZoneFieldCatalog> = {}): TrustedZoneFieldCatalog => ({
	registeredComponentVariantIds: ['component.hero', 'component.grid', 'component.private'],
	registeredCssVariantIds: ['css.airy', 'css.dense', 'css.private'],
	registeredCopyVariantIds: ['copy.spring', 'copy.evergreen', 'copy.private'],
	registeredRecipeIds: ['recipe.home', 'recipe.private'],
	registeredProductIds: ['product.a', 'product.b', 'product.private'],
	registeredPlacementIds: ['placement.top', 'placement.after-grid', 'placement.private'],
	allowedRecipeIds: ['recipe.home'],
	allowedProductIds: ['product.a', 'product.b'],
	allowedPlacementIds: ['placement.top', 'placement.after-grid'],
	boundedCopyFields: [
		{ key: 'headline', maxLength: 24, sourceClasses: ['reference-copy'] },
		{ key: 'subhead', maxLength: 48, sourceClasses: ['merchant-policy', 'computed-fact'] },
	],
	fixed: {
		componentVariantId: 'component.hero',
		cssVariantId: 'css.airy',
		copyVariantId: 'copy.spring',
		recipeId: 'recipe.home',
		productIds: ['product.a'],
	},
	...overrides,
});

function modelContract(overrides: Partial<EffectiveCompositionPolicy> = {}) {
	const contract = createZoneDecisionContract(policy(overrides), catalog());
	expect(contract.kind).toBe('model');
	if (contract.kind !== 'model') throw new Error('test expected model contract');
	return contract;
}

describe('zone decision schema', () => {
	it.each([
		['rank_products', 'rankedProductIds'],
		['select_products', 'productIds'],
		['select_copy_variant', 'copyVariantId'],
		['generate_bounded_copy', 'boundedCopy'],
		['select_component_variant', 'componentVariantId'],
		['toggle_zone', 'visible'],
		['reorder_zones', 'placementId'],
		['select_page_recipe', 'recipeId'],
	] as const)('omits %s output fields when the capability is forbidden', (capability, forbiddenField) => {
		const contract = modelContract({ capabilities: policy().capabilities.filter((value) => value !== capability) });
		const fieldValue = capability === 'generate_bounded_copy'
			? { headline: 'Hello' }
			: capability === 'toggle_zone'
				? true
				: capability === 'reorder_zones'
					? 'placement.top'
					: 'product.a';
		const parsed = contract.outputSchema.safeParse({ [forbiddenField]: fieldValue });
		expect(parsed.success).toBe(false);
	});

	it('omits CSS selection with component selection instead of exposing a standalone CSS control', () => {
		const contract = modelContract({ capabilities: ['select_products'] });
		expect(contract.outputSchema.safeParse({ cssVariantId: 'css.dense' }).success).toBe(false);
	});

	it('intersects registered variants, recipes, and products with their policy bounds', () => {
		const contract = modelContract();
		expect(contract.allowed.componentVariantIds).toEqual(['component.hero', 'component.grid']);
		expect(contract.allowed.cssVariantIds).toEqual(['css.airy', 'css.dense']);
		expect(contract.allowed.copyVariantIds).toEqual(['copy.spring', 'copy.evergreen']);
		expect(contract.allowed.recipeIds).toEqual(['recipe.home']);
		expect(contract.allowed.productIds).toEqual(['product.a', 'product.b']);
		expect(contract.allowed.placementIds).toEqual(['placement.top', 'placement.after-grid']);
		expect(contract.outputSchema.safeParse({ componentVariantId: 'component.private' }).success).toBe(false);
		expect(contract.outputSchema.safeParse({ recipeId: 'recipe.private' }).success).toBe(false);
		expect(contract.outputSchema.safeParse({ productIds: ['product.private'] }).success).toBe(false);
		expect(contract.outputSchema.safeParse({ placementId: 'placement.private' }).success).toBe(false);
	});

	it('enforces copy bounds and source classes from the trusted catalog', () => {
		const contract = modelContract();
		expect(contract.allowed.boundedCopyFields).toEqual([
			{ key: 'headline', maxLength: 24, sourceClasses: ['reference-copy'] },
			{ key: 'subhead', maxLength: 48, sourceClasses: ['merchant-policy', 'computed-fact'] },
		]);
		expect(contract.outputSchema.safeParse({ boundedCopy: { headline: 'x'.repeat(25) } }).success).toBe(false);
		expect(contract.outputSchema.safeParse({ boundedCopy: { invented: 'Nope' } }).success).toBe(false);
		expect(contract.outputSchema.safeParse({ boundedCopy: {} }).success).toBe(false);
		expect(contract.outputSchema.safeParse({ boundedCopy: { headline: 'Pinned headline' } }).success).toBe(true);
		expect(contract.outputSchema.safeParse({ productIds: ['product.a', 'product.a'] }).success).toBe(false);
	});

	it('rejects extra keys and prototype-looking identifiers at both contract and output boundaries', () => {
		const contract = modelContract();
		expect(contract.outputSchema.safeParse({ productIds: ['product.a'], arbitraryUrl: 'https://example.com' }).success).toBe(false);
		expect(contract.outputSchema.safeParse({ componentVariantId: '__proto__.override' }).success).toBe(false);
		expect(() => createZoneDecisionContract(policy(), catalog({ registeredProductIds: ['__proto__'] }))).toThrow(ZoneDecisionSchemaError);
		expect(() => createZoneDecisionContract(policy(), catalog({ boundedCopyFields: [{ key: 'constructor', maxLength: 8, sourceClasses: ['reference-copy'] }] }))).toThrow(ZoneDecisionSchemaError);
	});

	it('returns a no-model fixed result instead of an empty schema', () => {
		const contract = createZoneDecisionContract(policy({ decisionMode: 'fixed', capabilities: [] }), catalog());
		expect(contract).toMatchObject({
			kind: 'fixed',
			decisionMode: 'fixed',
			publicationMode: 'holdout',
			fixed: { componentVariantId: 'component.hero' },
		});
		expect('outputSchema' in contract).toBe(false);
	});

	it('keeps rules mode and approval publication truthful without permitting a model call', () => {
		const contract = createZoneDecisionContract(
			policy({ decisionMode: 'rules', publicationMode: 'approval_required', capabilities: ['select_products'] }),
			catalog(),
		);
		expect(contract.kind).toBe('rules');
		if (contract.kind === 'fixed') throw new Error('test expected rules contract');
		expect(contract.decisionMode).toBe('rules');
		expect(contract.publicationMode).toBe('approval_required');
		expect(() => aiSdkObjectOutput(contract)).toThrow('must not initiate a model call');
	});

	it('materializes only server-derived authority fields', () => {
		const contract = modelContract();
		expect(aiSdkObjectOutput(contract)).toBeDefined();
		const decision = materializeTrustedZoneDecision(contract, {
			componentVariantId: 'component.grid',
			copyVariantId: 'copy.evergreen',
			productIds: ['product.b'],
			visible: true,
			placementId: 'placement.after-grid',
			boundedCopy: { headline: 'Bounded and sourced' },
		});
		expect(decision.publicationMode).toBe('holdout');
		expect(decision.policyVersion).toBe(policy().policyVersion);
		expect(decision.envelope).toMatchObject({
			decisionModeUsed: 'model',
			componentVariantId: 'component.grid',
			copyVariantId: 'copy.evergreen',
			requiredCapabilityIds: ['select_component_variant', 'select_copy_variant', 'select_products', 'toggle_zone', 'reorder_zones', 'generate_bounded_copy'],
		});
		expect(decision.envelope.rawModelContent).toEqual({
			componentVariantId: 'component.grid',
			copyVariantId: 'copy.evergreen',
			productIds: ['product.b'],
			visible: true,
			placementId: 'placement.after-grid',
			boundedCopy: { headline: 'Bounded and sourced' },
		});
	});

	it('does not allow parsed JSON to forge authority fields', () => {
		const contract = modelContract();
		expect(() => materializeTrustedZoneDecision(contract, {
			productIds: ['product.a'],
			requiredCapabilityIds: ['reorder_zones'],
			decisionModeUsed: 'fixed',
			publicationMode: 'live',
			policyVersion: 'forged',
		})).toThrow(ZoneDecisionSchemaError);
	});

	it('refuses model/rules schemas with no eligible values rather than broadening the vocabulary', () => {
		expect(() => createZoneDecisionContract(
			policy({ capabilities: ['select_products'] }),
			catalog({ allowedProductIds: [], fixed: { componentVariantId: 'component.hero', cssVariantId: 'css.airy', copyVariantId: 'copy.spring', recipeId: 'recipe.home', productIds: [] } }),
		)).toThrow('do not call a model');
	});
});
