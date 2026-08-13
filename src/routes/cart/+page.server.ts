import type { PageServerLoad } from './$types';

/** Kibble never reads a cart cookie or commerce backend in Preserve mode. */
export const load: PageServerLoad = async ({ parent }) => {
	const { chromeMode, renderMode } = await parent();
	if (chromeMode === 'reference') {
		return {
			renderMode,
			kibbleCart: {
				availabilityMessage: 'Cart services are not available in this reference-preserved preview.',
			},
		};
	}
	return { renderMode };
};
