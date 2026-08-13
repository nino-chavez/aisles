import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';

export const load: PageServerLoad = () => {
	if (getBrand().id === 'kibble') {
		throw error(404, 'Kibble Preserve does not expose saved picks or a comparison route.');
	}
	return {};
};
