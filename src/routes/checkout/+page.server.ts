import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';
import { getBrand } from '$lib/brand/config';
import { resolveStorefrontChannel, storefrontOrigin } from '$lib/server/bigcommerce';

export const load: PageServerLoad = async ({ url, parent }) => {
	const { renderMode } = await parent();
	// ef122b8 contains only /checkout/gift, /checkout/prepaid, and
	// /checkout/confirmation. Keep the missing index on the actual 404 path
	// instead of presenting an invented checkout fallback as source-native.
	if (getBrand().id === 'kibble') throw error(404, 'Not found');

	// Derived server-side, and from the same resolver the catalog uses. The
	// client used to hardcode the default-channel host, which would hand a
	// cart created on one channel to another channel's checkout.
	const storeHash = env.BIGCOMMERCE_STORE_HASH;
	const { channelId } = resolveStorefrontChannel();

	return {
		renderMode,
		brandName: getBrand().name,
		checkoutOrigin: storeHash ? storefrontOrigin(storeHash, channelId) : null,
	};
};
