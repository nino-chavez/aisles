import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { chromeMode } = await parent();
	if (chromeMode !== 'reference' || !params.id) throw error(404, 'Not found');
	return {
		kibbleSubscriptions: {
			subtype: 'detail' as const,
			availabilityMessage: 'Subscription detail is unavailable. The route identifier was not used to request subscriber, charge, renewal, address, or payment data.',
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.subscriptions.id,
		},
	};
};
