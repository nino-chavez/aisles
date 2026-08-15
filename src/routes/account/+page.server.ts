import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';

/** Account authority comes from the trusted route normalizer and shared policy compiler. */
export const load: PageServerLoad = async ({ url, parent }) => {
	const { brand, kibbleCommerceServices } = await parent();
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (routePolicy) {
		if (routePolicy.surface !== 'account') throw new Error('Kibble account route resolved to the wrong policy surface.');
		return {
			kibbleAccount: {
				subtype: 'login' as const,
				brandName: brand.name,
				availabilityMessage: 'Customer sign-in is paused until the merchant chooses the identity owner and Aisles has an opaque server-side customer session. No sign-in or account-data request was started.',
				recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.account.id,
				policyVersion: routePolicy.policy.policyVersion,
				services: kibbleCommerceServices ?? undefined,
			},
		};
	}
	return {};
};
