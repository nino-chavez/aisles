import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';
import { getKibbleCommerceSession } from '$lib/server/kibble-commerce-session';
import { getKibbleCommerceMode } from '$lib/server/kibble-commerce';
import { loadKibbleAccountState } from '$lib/server/kibble-account-load';

/** Account authority comes from the trusted route normalizer and shared policy compiler. */
export const load: PageServerLoad = async ({ url, parent, cookies }) => {
	const { brand } = await parent();
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (routePolicy) {
		if (routePolicy.surface !== 'account') throw new Error('Kibble account route resolved to the wrong policy surface.');
		const session = getKibbleCommerceMode() !== 'off' ? await getKibbleCommerceSession(cookies) : null;
		return { kibbleAccount: await loadKibbleAccountState({
			subtype: session ? 'account' : 'login',
			brandName: brand.name,
			availabilityMessage: 'Account services are not available in this reference-preserved preview. No sign-in or account data request was started.',
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.account.id,
			policyVersion: routePolicy.policy.policyVersion,
			cookies,
		}) };
	}
	return {};
};
