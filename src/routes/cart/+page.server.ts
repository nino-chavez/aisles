import type { PageServerLoad } from './$types';

/** Kibble never reads a cart cookie or commerce backend in Preserve mode. */
export const load: PageServerLoad = async ({ parent }) => {
	const { chromeMode, renderMode } = await parent();
	if (chromeMode === 'reference') {
		return {
			renderMode,
			kibbleCart: {
				heading: 'Your cart',
				message: 'Cart services are not available in this reference-preserved preview. No cart was read, created, or changed.',
				returnLabel: 'Return to Kibble & Co.',
			},
		};
	}
	return { renderMode };
};
