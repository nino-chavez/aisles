import type { LayoutServerLoad } from './$types';
import { dev } from '$app/environment';
import { getBrand } from '$lib/brand/config';
import { buildKibbleChrome, selectMerchantRenderMode } from '$lib/brand/reference/kibble-runtime';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import {
	assertKibblePreserveRoutePolicy,
	getTrustedKibbleRoutePolicy,
	getContractSurfaceDecision,
	hasKibbleReferenceChrome,
} from '$lib/brand/composition-policy';
import { tryNormalizeTrustedShopperRoute } from '$lib/foundation/autonomy-zone-route';

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
		}
		const errorPolicies = (['error-404', 'error-empty'] as const).map((surface) => {
			const decision = getContractSurfaceDecision(brand.id, surface);
			if (decision.mode !== 'reference-preserve') throw new Error(`Kibble ${surface} reference policy is unavailable.`);
			assertKibblePreserveRoutePolicy(decision.policy, surface);
			return { surface, policyVersion: decision.policy.policyVersion };
		});
		kibbleError = KIBBLE_PRESERVE_MANIFEST.display.error;
		kibbleErrorPolicy = {
			referenceId: KIBBLE_REFERENCE_CONTRACT.id,
			referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
			policies: errorPolicies,
		};
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
		kibbleError,
		kibbleErrorPolicy,
		kibbleRoutePolicy,
		kibbleProvenance: chromeMode === 'reference' ? {
			referenceId: KIBBLE_REFERENCE_CONTRACT.id,
			referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
			fixturePath: KIBBLE_REFERENCE_CONTRACT.source.fixturePath,
			fixtureSha256: KIBBLE_REFERENCE_CONTRACT.source.fixtureSha256,
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
