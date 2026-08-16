import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { MERCHANT_TIER_COOKIE, isMerchantTier } from '$lib/server/merchant-tier';

/**
 * Sets or clears the `kibble_tier` demo cookie and redirects back to the
 * page the toggle was submitted from, so SSR re-renders against the newly
 * selected tier's BigCommerce channel.
 */
export const POST: RequestHandler = async ({ request, cookies }) => {
	const form = await request.formData();
	const tier = form.get('tier');
	const redirectTo = form.get('redirectTo');
	const target = typeof redirectTo === 'string' && redirectTo.startsWith('/') ? redirectTo : '/';

	if (isMerchantTier(tier)) {
		cookies.set(MERCHANT_TIER_COOKIE, tier, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30,
		});
	} else {
		cookies.delete(MERCHANT_TIER_COOKIE, { path: '/' });
	}

	throw redirect(303, target);
};
