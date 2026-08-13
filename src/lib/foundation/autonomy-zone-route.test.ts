import { describe, expect, it } from 'vitest';
import {
	normalizeTrustedShopperRoute,
	normalizeTrustedErrorRoute,
	RouteSurfaceNormalizationError,
	tryNormalizeTrustedErrorRoute,
	tryNormalizeTrustedShopperRoute,
} from './autonomy-zone-route';

describe('trusted shopper route normalization', () => {
	it.each([
		['/', 'home'],
		['/category/dog-food', 'plp'],
		['/category/dog-food/', 'plp'],
		['/category/dog-food/sale', 'plp'],
		['/product/kibble-bites', 'pdp'],
		['/cart', 'cart'],
		['/cart/edit', 'cart'],
		['/checkout', 'checkout'],
		['/checkout/confirmation', 'checkout'],
		['/search', 'search'],
		['/account', 'account'],
		['/account/subscriptions/123', 'account'],
		['/subscriptions', 'account'],
		['/subscriptions/123', 'account'],
		['/portal/subscriptions/123/payment-method', 'account'],
		['/portal/login', 'account'],
		['/store-locator', 'locator'],
		['/locator/60601', 'locator'],
	] as const)('normalizes %s to %s while retaining the exact path', (routePath, surface) => {
		expect(normalizeTrustedShopperRoute(routePath)).toEqual({ routePath, surface });
	});

	it('binds server-derived error surfaces without turning unknown paths into shopper aliases', () => {
		expect(normalizeTrustedErrorRoute('/missing-product', 'error-404')).toEqual({
			routePath: '/missing-product', surface: 'error-404',
		});
		expect(normalizeTrustedErrorRoute('/category/no-results', 'error-empty')).toEqual({
			routePath: '/category/no-results', surface: 'error-empty',
		});
		expect(tryNormalizeTrustedShopperRoute('/missing-product')).toBeNull();
		expect(tryNormalizeTrustedErrorRoute('/missing-product', 'home')).toBeNull();
		expect(tryNormalizeTrustedErrorRoute('/missing?query=x', 'error-404')).toBeNull();
	});

	it.each([
		'/style-guide',
		'/api/subscriptions',
		'/category',
		'/account//orders',
		'/account/../admin',
		'/account/%2e%2e/admin',
		'/account/%252e%252e/admin',
		'/account/%3Fadmin',
		'/portal/admin',
		'/checkout?step=payment',
		'/checkout#payment',
		'/unknown',
		'',
	])('fails closed for %s', (routePath) => {
		expect(tryNormalizeTrustedShopperRoute(routePath)).toBeNull();
		expect(() => normalizeTrustedShopperRoute(routePath)).toThrow(RouteSurfaceNormalizationError);
	});
});
