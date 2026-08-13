import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';
import { throwKibblePreserveError } from '$lib/brand/reference/kibble-error.server';

/** The pinned Kibble storefront has no locator route; retain a typed, Kibble-native 404 boundary. */
export const load: PageServerLoad = async ({ url }) => {
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (routePolicy && routePolicy.surface !== 'locator') {
		throw new Error('Kibble store-locator boundary resolved to the wrong policy surface.');
	}
	if (routePolicy) {
		await throwKibblePreserveError({
			brandId: getBrand().id,
			surface: 'error-404',
			routePath: url.pathname,
			status: 404,
			message: 'Store locator is not part of the pinned Kibble storefront.',
		});
	}
	throw error(404, 'Not found');
};
