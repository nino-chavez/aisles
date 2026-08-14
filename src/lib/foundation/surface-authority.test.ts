import { describe, expect, it } from 'vitest';
import {
	assertCanonicalSurfaceAuthority,
	CANONICAL_SURFACE_AUTHORITY,
	capabilitiesWithinSurface,
	isDecisionModeWithinSurface,
	surfaceAuthorityFor,
} from './surface-authority';

describe('canonical generative-commerce surface authority', () => {
	it('keeps the authority gradient broad-to-narrow', () => {
		expect(surfaceAuthorityFor('home').latitude).toBe('wide');
		expect(surfaceAuthorityFor('plp').latitude).toBe('medium');
		expect(surfaceAuthorityFor('pdp').latitude).toBe('narrow');
		expect(surfaceAuthorityFor('cart').latitude).toBe('narrower');
		expect(surfaceAuthorityFor('checkout').latitude).toBe('narrowest');
		expect(surfaceAuthorityFor('account').maximumDecisionMode).toBe('fixed');
	});

	it('allows only copy decisions on funnel surfaces', () => {
		expect(capabilitiesWithinSurface('search', ['select_copy_variant'])).toBe(true);
		expect(capabilitiesWithinSurface('checkout', ['generate_bounded_copy'])).toBe(true);
		expect(capabilitiesWithinSurface('cart', ['rank_products'])).toBe(false);
		expect(capabilitiesWithinSurface('account', ['select_copy_variant'])).toBe(false);
	});

	it('rejects a policy that expands a surface ceiling', () => {
		expect(() => assertCanonicalSurfaceAuthority('account', 'model', [])).toThrow(/cannot use model/);
		expect(() => assertCanonicalSurfaceAuthority('checkout', 'model', ['rank_products'])).toThrow(/cannot use rank_products/);
		expect(() => assertCanonicalSurfaceAuthority('plp', 'model', ['reorder_zones'])).toThrow(/cannot use reorder_zones/);
	});

	it('keeps every surface entry explicit', () => {
		expect(Object.keys(CANONICAL_SURFACE_AUTHORITY)).toEqual([
		'home', 'plp', 'pdp', 'search', 'cart', 'checkout', 'account', 'locator', 'error-404', 'error-empty',
	]);
	});

	it('accepts a bounded PDP recommendation policy', () => {
		expect(isDecisionModeWithinSurface('pdp', 'model')).toBe(true);
		expect(() => assertCanonicalSurfaceAuthority('pdp', 'model', ['rank_products', 'select_copy_variant'])).not.toThrow();
	});
});
