/** Trusted shopper-route normalization for policy and zone execution. */

import type { Surface } from './zones';

export interface TrustedRouteSurface {
	/** Exact input pathname retained for decision provenance. */
	routePath: string;
	/** Policy surface derived from the route family, never supplied by a client. */
	surface: Surface;
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

type RouteRule = Readonly<{ pattern: RegExp; surface: Surface }>;

/**
 * Route families proven by the Aisles and Kibble reference route trees.
 * Error surfaces are state-derived and intentionally have no pathname alias.
 * Development routes such as /style-guide are intentionally absent.
 */
export const TRUSTED_SHOPPER_ROUTE_RULES: readonly RouteRule[] = [
	{ pattern: /^\/$/, surface: 'home' },
	{ pattern: /^\/category(?:\/[^/]+)+\/?$/, surface: 'plp' },
	{ pattern: /^\/product\/[^/]+\/?$/, surface: 'pdp' },
	{ pattern: /^\/cart(?:\/[^/]+)*\/?$/, surface: 'cart' },
	{ pattern: /^\/checkout(?:\/[^/]+)*\/?$/, surface: 'checkout' },
	{ pattern: /^\/search(?:\/[^/]+)*\/?$/, surface: 'search' },
	{ pattern: /^\/account(?:\/[^/]+)*\/?$/, surface: 'account' },
	{ pattern: /^\/subscriptions(?:\/[^/]+)*\/?$/, surface: 'account' },
	{ pattern: /^\/portal\/(?:login|subscriptions)(?:\/[^/]+)*\/?$/, surface: 'account' },
	{ pattern: /^\/(?:store-locator|locator)(?:\/[^/]+)*\/?$/, surface: 'locator' },
] as const;

/** Returns null for unknown, non-canonical, API, development, or unsafe paths. */
export function tryNormalizeTrustedShopperRoute(routePath: unknown): TrustedRouteSurface | null {
	if (!isSafePathname(routePath)) return null;
	const rule = TRUSTED_SHOPPER_ROUTE_RULES.find(({ pattern }) => pattern.test(routePath));
	return rule ? { routePath, surface: rule.surface } : null;
}

/** Strict form for callers that treat an unknown route as a domain error. */
export function normalizeTrustedShopperRoute(routePath: unknown): TrustedRouteSurface {
	const normalized = tryNormalizeTrustedShopperRoute(routePath);
	if (!normalized) throw new RouteSurfaceNormalizationError(routePath);
	return normalized;
}

/**
 * Error surfaces are trusted server state, not pathname aliases. This keeps an
 * unknown pathname from silently normalizing while still binding an error-zone
 * decision to the exact route which produced the state.
 */
export function tryNormalizeTrustedErrorRoute(
	routePath: unknown,
	surface: unknown,
): TrustedErrorRouteSurface | null {
	if (!isSafePathname(routePath) || (surface !== 'error-404' && surface !== 'error-empty')) return null;
	return { routePath, surface };
}

export function normalizeTrustedErrorRoute(routePath: unknown, surface: unknown): TrustedErrorRouteSurface {
	const normalized = tryNormalizeTrustedErrorRoute(routePath, surface);
	if (!normalized) throw new RouteSurfaceNormalizationError(routePath);
	return normalized;
}

function isSafePathname(value: unknown): value is string {
	if (typeof value !== 'string' || value.length === 0 || value.length > 2048) return false;
	if (!value.startsWith('/') || value.includes('//') || /[\\?#\u0000-\u001f\u007f]/.test(value)) return false;
	if (/%(?:25|2f|5c)/i.test(value)) return false;
	try {
		const decoded = decodeURIComponent(value);
		return !/[\\?#\u0000-\u001f\u007f]/.test(decoded) &&
			!decoded.split('/').some((segment) => segment === '.' || segment === '..');
	} catch {
		return false;
	}
}
