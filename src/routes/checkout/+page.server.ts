import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { chromeMode } = await parent();
	if (chromeMode === 'reference') {
		throw error(503, 'Checkout is unavailable for this reference-preserved storefront.');
	}
	return {};
};
