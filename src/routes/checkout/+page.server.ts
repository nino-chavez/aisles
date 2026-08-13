import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';

export const load: PageServerLoad = async ({ url, parent }) => {
	const { renderMode } = await parent();
	// ef122b8 contains only /checkout/gift, /checkout/prepaid, and
	// /checkout/confirmation. Keep the missing index on the actual 404 path
	// instead of presenting an invented checkout fallback as source-native.
	if (getBrand().id === 'kibble') throw error(404, 'Not found');
	return { renderMode };
};
