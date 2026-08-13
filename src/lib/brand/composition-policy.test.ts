import { describe, expect, it } from 'vitest';
import { KIBBLE_REFERENCE_CONTRACT } from './reference/kibble';
import {
	AISLES_COMPOSITION_POLICY,
	assertKibblePreserveRoutePolicy,
	getContractSurfaceDecision,
	hasKibbleReferenceChrome,
	surfaceForPath,
} from './composition-policy';

describe('Kibble composition policy registry', () => {
	it('binds Preserve decisions to the pinned reference contract', () => {
		const decision = getContractSurfaceDecision('kibble', 'home');
		expect(decision.mode).toBe('reference-preserve');
		if (decision.mode !== 'reference-preserve') throw new Error('expected Preserve');
		expect(decision.policy.provenance).toMatchObject({
			organizationId: 'kibble-demo-merchant',
			brandId: 'kibble',
			referenceId: KIBBLE_REFERENCE_CONTRACT.id,
			referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
			preset: 'preserve',
		});
		expect(decision.policy.capabilities).toEqual(['rank_products', 'select_products']);
		expect(decision.policy.decisionMode).toBe('rules');
		expect(decision.policy.publicationMode).toBe('live');
		expect(() => assertKibblePreserveRoutePolicy(decision.policy, 'home')).not.toThrow();
	});

	it('fails the route gate when compiled policy narrows or changes publication', () => {
		const decision = getContractSurfaceDecision('kibble', 'home');
		if (decision.mode !== 'reference-preserve') throw new Error('expected Preserve');
		expect(() => assertKibblePreserveRoutePolicy({
			...decision.policy,
			publicationMode: 'holdout',
		}, 'home')).toThrow('decision envelope');
		expect(() => assertKibblePreserveRoutePolicy({
			...decision.policy,
			allowedComponentVariantIds: decision.policy.allowedComponentVariantIds.slice(1),
		}, 'home')).toThrow('component variants');
	});

	it('derives registered component and CSS variants from the contract', () => {
		const policy = AISLES_COMPOSITION_POLICY.brands.kibble;
		expect(policy.registeredComponentVariantIds).toEqual(
			KIBBLE_REFERENCE_CONTRACT.components.flatMap((component) =>
				component.variants.map((variant) => variant.id),
			),
		);
		expect(policy.registeredCssVariantIds).toEqual(KIBBLE_REFERENCE_CONTRACT.registry.cssVariantIds);
	});

	it('keeps fixed error surfaces outside model authority', () => {
		for (const surface of ['error-404', 'error-empty'] as const) {
			const decision = getContractSurfaceDecision('kibble', surface);
			expect(decision.mode).toBe('reference-preserve');
			if (decision.mode !== 'reference-preserve') throw new Error('expected Preserve');
			expect(decision.policy.capabilities).toEqual([]);
			expect(decision.policy.decisionMode).toBe('fixed');
		}
	});

	it('binds the fixed PLP shell and nested product cards outside model authority', () => {
		const decision = getContractSurfaceDecision('kibble', 'plp');
		expect(decision.mode).toBe('reference-preserve');
		if (decision.mode !== 'reference-preserve') throw new Error('expected Preserve');
		expect(decision.policy.capabilities).toEqual([]);
		expect(decision.policy.decisionMode).toBe('fixed');
		expect(decision.policy.publicationMode).toBe('live');
		expect(decision.policy.allowedComponentVariantIds).toEqual([
			'kibble.header.responsive-chrome',
			'kibble.product-card.catalog-card',
			'kibble.footer.four-column',
			'kibble.category-listing.fixed-grid',
		]);
		expect(() => assertKibblePreserveRoutePolicy(decision.policy, 'plp')).not.toThrow();
	});

	it('binds the fixed PDP shell and catalog-only detail component outside model authority', () => {
		const decision = getContractSurfaceDecision('kibble', 'pdp');
		expect(decision.mode).toBe('reference-preserve');
		if (decision.mode !== 'reference-preserve') throw new Error('expected Preserve');
		expect(decision.policy.capabilities).toEqual([]);
		expect(decision.policy.decisionMode).toBe('fixed');
		expect(decision.policy.publicationMode).toBe('approval_required');
		expect(decision.policy.allowedComponentVariantIds).toEqual([
			'kibble.header.responsive-chrome',
			'kibble.product-card.catalog-card',
			'kibble.footer.four-column',
			'kibble.product-detail.catalog-display-only',
		]);
		expect(() => assertKibblePreserveRoutePolicy(decision.policy, 'pdp')).not.toThrow();
	});

	it('does not mislabel unsupported Kibble surfaces or other brands as Preserve', () => {
		for (const surface of ['search', 'cart', 'checkout'] as const) {
			expect(getContractSurfaceDecision('kibble', surface)).toEqual({
				mode: 'legacy-generated',
				reason: 'unsupported-surface',
			});
		}
		expect(getContractSurfaceDecision('haven', 'home')).toEqual({
			mode: 'legacy-generated',
			reason: 'uncontracted-brand',
		});
	});

	it('fails closed for prototype-shaped identities and unknown paths', () => {
		expect(getContractSurfaceDecision('__proto__', 'home').mode).toBe('legacy-generated');
		expect(getContractSurfaceDecision({ id: 'kibble' }, 'home').mode).toBe('legacy-generated');
		expect(surfaceForPath('/constructor')).toBeNull();
		expect(surfaceForPath('/category/dog-food')).toBe('plp');
		expect(hasKibbleReferenceChrome('__proto__')).toBe(false);
		expect(hasKibbleReferenceChrome('kibble')).toBe(true);
	});
});
