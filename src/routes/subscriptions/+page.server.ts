import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';

export const load: PageServerLoad = async ({ parent }) => {
	const { chromeMode } = await parent();
	if (chromeMode !== 'reference') throw error(404, 'Not found');
	return {
		kibbleSubscriptions: {
			subtype: 'portal' as const,
			availabilityMessage: 'Subscription services are not available in this reference-preserved preview. No redirect, session, or subscriber-data request was started.',
			recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.subscriptions.id,
		},
	};
};
