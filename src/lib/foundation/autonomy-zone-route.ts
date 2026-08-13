/** Trusted, versioned shopper-route normalization for policy and zone execution. */

import type { Surface } from './zones';

export const SHOPPER_ROUTE_MANIFEST_VERSION = '2026-08-13.1';
/** Changes whenever the allow-list below changes; carried into execution provenance. */
export const SHOPPER_ROUTE_MANIFEST_DIGEST = 'sha256:4a249774c4e598928a312af7cb5d8c06fbbd60578d93392028d4fc0eef75af5c';

export interface TrustedRouteSurface {
	/** Exact input pathname retained for decision provenance. */
	routePath: string;
	/** Policy surface derived from the manifest, never supplied by a client. */
	surface: Surface;
	routeManifestVersion: typeof SHOPPER_ROUTE_MANIFEST_VERSION;
	routeManifestDigest: typeof SHOPPER_ROUTE_MANIFEST_DIGEST;
}

export interface TrustedErrorRouteSurface extends TrustedRouteSurface {
	surface: 'error-404' | 'error-empty';
}

export class RouteSurfaceNormalizationError extends Error {
	constructor(routePath: unknown) {
		super(`Unknown or unsafe shopper route: ${String(routePath)}`);
		this.name = 'RouteSurfaceNormalizationError';
	}
}

type StaticRoute = Readonly<{ path: string; surface: Surface }>;

/**
 * The complete shopper authority manifest. Catch-all Svelte routes do not add
 * authority here: every accepted path is either an exact static route or a
 * single bounded dynamic segment.
 */
export const TRUSTED_SHOPPER_ROUTE_MANIFEST = {
	version: SHOPPER_ROUTE_MANIFEST_VERSION,
	digest: SHOPPER_ROUTE_MANIFEST_DIGEST,
	static: [
		{ path: '/', surface: 'home' },
		{ path: '/search', surface: 'search' },
		{ path: '/cart', surface: 'cart' },
		{ path: '/subscriptions', surface: 'account' },
		{ path: '/account', surface: 'account' },
		{ path: '/account/login', surface: 'account' },
		{ path: '/account/register', surface: 'account' },
		{ path: '/account/logout', surface: 'account' },
		{ path: '/account/orders', surface: 'account' },
		{ path: '/account/addresses', surface: 'account' },
		{ path: '/account/payment-methods', surface: 'account' },
		{ path: '/account/subscriptions', surface: 'account' },
		{ path: '/checkout', surface: 'checkout' },
		{ path: '/checkout/gift', surface: 'checkout' },
		{ path: '/checkout/prepaid', surface: 'checkout' },
		{ path: '/checkout/confirmation', surface: 'checkout' },
		{ path: '/store-locator', surface: 'locator' },
		{ path: '/locator', surface: 'locator' },
	] as const satisfies readonly StaticRoute[],
	dynamic: [
		{ prefix: '/category/', surface: 'plp', segment: 'slug' },
		{ prefix: '/product/', surface: 'pdp', segment: 'slug' },
		{ prefix: '/portal/subscriptions/', surface: 'account', segment: 'id' },
	] as const,
} as const;

/** Backwards-compatible name for consumers that need the reviewed manifest. */
export const TRUSTED_SHOPPER_ROUTE_RULES = TRUSTED_SHOPPER_ROUTE_MANIFEST;

/** Returns null for unknown, non-canonical, API, development, or unsafe paths. */
export function tryNormalizeTrustedShopperRoute(routePath: unknown): TrustedRouteSurface | null {
	if (!isSafePathname(routePath)) return null;
	const exact = TRUSTED_SHOPPER_ROUTE_MANIFEST.static.find((rule) => rule.path === routePath);
	if (exact) return trustedRoute(routePath, exact.surface);
	for (const rule of TRUSTED_SHOPPER_ROUTE_MANIFEST.dynamic) {
		if (!routePath.startsWith(rule.prefix)) continue;
		const segment = routePath.slice(rule.prefix.length);
		if (isBoundedSegment(segment, rule.segment)) return trustedRoute(routePath, rule.surface);
	}
	return null;
}

/** Strict form for callers that treat an unknown route as a domain error. */
export function normalizeTrustedShopperRoute(routePath: unknown): TrustedRouteSurface {
	const normalized = tryNormalizeTrustedShopperRoute(routePath);
	if (!normalized) throw new RouteSurfaceNormalizationError(routePath);
	return normalized;
}

/** Error surfaces are server state, not shopper-path aliases. */
export function tryNormalizeTrustedErrorRoute(routePath: unknown, surface: unknown): TrustedErrorRouteSurface | null {
	if (!isSafePathname(routePath) || (surface !== 'error-404' && surface !== 'error-empty')) return null;
	return {
		routePath,
		surface,
		routeManifestVersion: SHOPPER_ROUTE_MANIFEST_VERSION,
		routeManifestDigest: SHOPPER_ROUTE_MANIFEST_DIGEST,
	};
}

export function normalizeTrustedErrorRoute(routePath: unknown, surface: unknown): TrustedErrorRouteSurface {
	const normalized = tryNormalizeTrustedErrorRoute(routePath, surface);
	if (!normalized) throw new RouteSurfaceNormalizationError(routePath);
	return normalized;
}

function trustedRoute(routePath: string, surface: Surface): TrustedRouteSurface {
	return { routePath, surface, routeManifestVersion: SHOPPER_ROUTE_MANIFEST_VERSION, routeManifestDigest: SHOPPER_ROUTE_MANIFEST_DIGEST };
}

function isBoundedSegment(value: string, kind: 'slug' | 'id'): boolean {
	if (value.length === 0 || value.length > 120 || value.includes('/')) return false;
	return kind === 'slug'
		? /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)
		: /^[A-Za-z0-9][A-Za-z0-9_-]{0,119}$/.test(value);
}

function isSafePathname(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
	if (!value.startsWith('/') || value.includes('//') || /[\\?#\u0000-\u001f\u007f]/.test(value)) return false;
	if (/%(?:25|2f|5c)/i.test(value)) return false;
	try {
		const decoded = decodeURIComponent(value);
		return !/[\\?#\u0000-\u001f\u007f]/.test(decoded) && !decoded.split('/').some((segment) => segment === '.' || segment === '..');
	} catch {
		return false;
	}
}
