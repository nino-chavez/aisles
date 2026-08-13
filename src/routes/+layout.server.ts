import type { LayoutServerLoad } from './$types';
import { dev } from '$app/environment';
import { getBrand } from '$lib/brand/config';
import { buildKibbleChrome, selectMerchantRenderMode } from '$lib/brand/reference/kibble-runtime';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import {
	assertKibblePreserveRoutePolicy,
	getContractSurfaceDecision,
	hasKibbleReferenceChrome,
	surfaceForPath,
} from '$lib/brand/composition-policy';

export const load: LayoutServerLoad = async ({ url, cookies }) => {
	const brand = getBrand();
	const renderMode = selectMerchantRenderMode(brand.id, surfaceForPath(url.pathname), {
		allowPendingReview: dev,
	});
	const chromeMode = hasKibbleReferenceChrome(brand.id) ? 'reference' : 'legacy';
	let kibbleError = null;
	let kibbleErrorPolicy = null;
	if (chromeMode === 'reference') {
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
		kibbleChrome: chromeMode === 'reference' ? buildKibbleChrome(brand) : null,
		kibbleError,
		kibbleErrorPolicy,
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
