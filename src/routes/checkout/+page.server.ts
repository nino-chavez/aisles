import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { chromeMode, renderMode } = await parent();
	if (chromeMode === 'reference') {
		return {
			renderMode,
			kibbleCheckout: {
				subtype: 'checkout' as const,
				availabilityMessage: 'Checkout is not available in this reference-preserved preview. No checkout service or redirect was started.',
			},
		};
	}
	return {};
};
