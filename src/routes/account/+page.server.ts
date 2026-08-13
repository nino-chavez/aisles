import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';

/** Account is outside the current zone taxonomy, but never falls through to generic UI for Kibble. */
export const load: PageServerLoad = async ({ parent }) => {
	const { chromeMode } = await parent();
	if (chromeMode === 'reference') {
		return {
			kibbleAccount: {
				heading: 'Account',
				message: 'Account services are not available in this reference-preserved preview. No sign-in or account data request was started.',
				returnLabel: 'Return to Kibble & Co.',
				recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.account.id,
			},
		};
	}
	return {};
};
