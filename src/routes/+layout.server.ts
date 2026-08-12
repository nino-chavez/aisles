import type { LayoutServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';
import { buildKibbleChrome, selectMerchantRenderMode } from '$lib/brand/reference/kibble-runtime';
import { KIBBLE_PRESERVE_MANIFEST } from '$lib/brand/reference/kibble-manifest';

export const load: LayoutServerLoad = async ({ url, cookies }) => {
	const brand = getBrand();
	const renderMode = selectMerchantRenderMode(brand.id);

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
		kibbleChrome: renderMode === 'reference-preserve' ? buildKibbleChrome(brand) : null,
		kibbleError: renderMode === 'reference-preserve' ? KIBBLE_PRESERVE_MANIFEST.display.error : null,
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
