import { describe, expect, it } from 'vitest';
import {
	normalizeTrustedShopperRoute,
	normalizeTrustedErrorRoute,
	RouteSurfaceNormalizationError,
	SHOPPER_ROUTE_MANIFEST_DIGEST,
	SHOPPER_ROUTE_MANIFEST_VERSION,
	tryNormalizeTrustedErrorRoute,
	tryNormalizeTrustedShopperRoute,
	TRUSTED_SHOPPER_ROUTE_MANIFEST,
} from './autonomy-zone-route';

describe('trusted shopper route normalization', () => {
	it.each([
		['/', 'home'],
		['/category/dog-food', 'plp'],
		['/product/kibble-bites', 'pdp'],
		['/cart', 'cart'],
		['/checkout', 'checkout'],
		['/checkout/gift', 'checkout'],
		['/checkout/prepaid', 'checkout'],
		['/checkout/confirmation', 'checkout'],
		['/search', 'search'],
		['/account', 'account'],
		['/subscriptions', 'account'],
		['/portal/subscriptions/123', 'account'],
		['/store-locator', 'locator'],
		['/locator', 'locator'],
	] as const)('normalizes %s to %s while retaining the exact path', (routePath, surface) => {
		expect(normalizeTrustedShopperRoute(routePath)).toEqual({ routePath, surface, routeManifestVersion: SHOPPER_ROUTE_MANIFEST_VERSION, routeManifestDigest: SHOPPER_ROUTE_MANIFEST_DIGEST });
	});

	it('binds server-derived error surfaces without turning unknown paths into shopper aliases', () => {
		expect(normalizeTrustedErrorRoute('/missing-product', 'error-404')).toEqual({
			routePath: '/missing-product', surface: 'error-404', routeManifestVersion: SHOPPER_ROUTE_MANIFEST_VERSION, routeManifestDigest: SHOPPER_ROUTE_MANIFEST_DIGEST,
		});
		expect(normalizeTrustedErrorRoute('/category/no-results', 'error-empty')).toEqual({
			routePath: '/category/no-results', surface: 'error-empty', routeManifestVersion: SHOPPER_ROUTE_MANIFEST_VERSION, routeManifestDigest: SHOPPER_ROUTE_MANIFEST_DIGEST,
		});
		expect(tryNormalizeTrustedShopperRoute('/missing-product')).toBeNull();
		expect(tryNormalizeTrustedErrorRoute('/missing-product', 'home')).toBeNull();
		expect(tryNormalizeTrustedErrorRoute('/missing?query=x', 'error-404')).toBeNull();
	});

	it('normalizes every reviewed static and dynamic manifest entry with bounded segments', () => {
		for (const route of TRUSTED_SHOPPER_ROUTE_MANIFEST.static) {
			expect(tryNormalizeTrustedShopperRoute(route.path)).toMatchObject({ routePath: route.path, surface: route.surface });
		}
		for (const route of TRUSTED_SHOPPER_ROUTE_MANIFEST.dynamic) {
			const segment = route.segment === 'slug' ? 'bounded-shopper-slug' : 'subscription_123';
			const routePath = `${route.prefix}${segment}`;
			expect(tryNormalizeTrustedShopperRoute(routePath)).toMatchObject({ routePath, surface: route.surface });
			expect(tryNormalizeTrustedShopperRoute(`${route.prefix}${'x'.repeat(121)}`)).toBeNull();
			expect(tryNormalizeTrustedShopperRoute(`${route.prefix}${segment}/extra`)).toBeNull();
		}
	});

	it.each([
		'/category/Uppercase',
		'/category/has_underscore',
		'/category/double--dash',
		'/product/has.dot',
		'/portal/subscriptions/.hidden',
		'/portal/subscriptions/has.dot',
	])('rejects malformed dynamic segments: %s', (routePath) => {
		expect(tryNormalizeTrustedShopperRoute(routePath)).toBeNull();
	});

	it.each([
		'/style-guide',
		'/api/subscriptions',
		'/category',
		'/category/dog-food/sale',
		'/portal/login',
		'/subscriptions/123',
		'/checkout/admin',
		'/account/admin',
		'/locator/private',
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
