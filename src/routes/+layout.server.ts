import type { LayoutServerLoad } from './$types';
import { dev } from '$app/environment';
import { getBrand } from '$lib/brand/config';
import { buildKibbleChrome, selectMerchantRenderMode } from '$lib/brand/reference/kibble-runtime';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import {
	getTrustedKibbleRoutePolicy,
	hasKibbleReferenceChrome,
} from '$lib/brand/composition-policy';
import { tryNormalizeTrustedShopperRoute } from '$lib/foundation/autonomy-zone-route';
import { executeKibbleHiddenZoneTerminalsForRoute } from '$lib/brand/reference/kibble-zone-executor.server';
import { buildKibblePreserveErrorState, throwKibblePreserveError } from '$lib/brand/reference/kibble-error.server';

function routeAudience(pathname: string): 'shopper' | 'operator' | 'development' {
	if (pathname === '/observe' || pathname.startsWith('/observe/')) return 'operator';
	if (pathname === '/style-guide' || pathname.startsWith('/style-guide/')) return 'development';
	return 'shopper';
}

export const load: LayoutServerLoad = async ({ url, cookies }) => {
	const brand = getBrand();
	const audience = routeAudience(url.pathname);
	const trustedRoute = audience === 'shopper' ? tryNormalizeTrustedShopperRoute(url.pathname) : null;
	const renderMode = selectMerchantRenderMode(brand.id, trustedRoute?.surface ?? null, {
		allowPendingReview: dev,
	});
	const chromeMode = audience !== 'shopper'
		? 'isolated'
		: hasKibbleReferenceChrome(brand.id) ? 'reference' : 'legacy';
	let kibbleError = null;
	let kibbleErrorPolicy = null;
	let kibbleRoutePolicy = null;
	if (chromeMode === 'reference') {
		if (trustedRoute) {
			const routePolicy = getTrustedKibbleRoutePolicy(brand.id, url.pathname);
			if (!routePolicy) throw new Error(`Kibble route policy is unavailable for ${url.pathname}.`);
			kibbleRoutePolicy = {
				routePath: routePolicy.routePath,
				surface: routePolicy.surface,
				policyVersion: routePolicy.policy.policyVersion,
			};
			try {
				// Execute every applicable trusted-Hidden decision at the trusted
				// server boundary. Results are deliberately discarded: Hidden has
				// no shopper DOM and its policy trace is operator-only evidence.
				await executeKibbleHiddenZoneTerminalsForRoute(trustedRoute.routePath);
			} catch (cause) {
				console.error('[kibble-preserve] trusted Hidden zone execution failed:', cause);
				await throwKibblePreserveError({
					brandId: brand.id,
					surface: 'error-empty',
					routePath: trustedRoute.routePath,
					status: 503,
					message: 'This Kibble page is temporarily unavailable.',
				});
			}
		}
	}
	// A shopper pathname outside the exact manifest has no successful Kibble
	// route. It reaches SvelteKit's 404 boundary, so only that actual error state
	// is allowed to execute and serialize the error-404 rescue binding.
	const kibble404State = chromeMode === 'reference' && audience === 'shopper' && !trustedRoute
		? await buildKibble404State(brand.id, url.pathname)
		: null;
	if (kibble404State) {
		kibbleError = kibble404State.display;
		kibbleErrorPolicy = kibble404State.policy;
	}

	// Dev mode: ?dev=true turns it on, ?dev=false turns it off, cookie persists
	const devParam = url.searchParams.get('dev');
	if (devParam === 'true') {
		cookies.set('aisles_dev', '1', { path: '/', maxAge: 60 * 60 * 24 });
	} else if (devParam === 'false') {
		cookies.delete('aisles_dev', { path: '/' });
	}
	const devMode = devParam === 'true' || (devParam !== 'false' && cookies.get('aisles_dev') === '1');

	return {
		renderMode,
		chromeMode,
		routeAudience: audience,
		kibbleChrome: chromeMode === 'reference' ? buildKibbleChrome(brand) : null,
		kibbleRoutePolicy,
		...(kibble404State ? {
			kibbleError,
			kibbleErrorPolicy,
			kibbleErrorAdapter: kibble404State.adapter,
		} : {}),
		kibbleProvenance: chromeMode === 'reference' ? {
			referenceId: KIBBLE_REFERENCE_CONTRACT.id,
			referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
			...(trustedRoute?.surface === 'search' ? {} : {
				fixturePath: KIBBLE_REFERENCE_CONTRACT.source.fixturePath,
				fixtureSha256: KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256,
			}),
			routePath: url.pathname,
			surface: trustedRoute?.surface ?? 'error-404',
			provenanceSource: 'source-owned-root-layout',
		} : null,
		brand: {
			id: brand.id,
			name: brand.name,
			tagline: brand.tagline,
			footerNote: brand.footerNote,
			googleFontsUrl: brand.googleFontsUrl,
			theme: brand.theme,
			categories: brand.categories,
		},
		devMode,
	};
};

async function buildKibble404State(brandId: string, routePath: string) {
	return buildKibblePreserveErrorState({
		brandId,
		surface: 'error-404',
		routePath,
		status: 404,
		message: 'This page is not available.',
	});
}
