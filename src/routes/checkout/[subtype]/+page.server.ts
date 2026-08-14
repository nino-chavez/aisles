import { error } from '@sveltejs/kit';
import { env as privateEnv } from '$env/dynamic/private';
import type { PageServerLoad } from './$types';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import { getBrand } from '$lib/brand/config';
import { getKibbleObserveCopyModelPolicyDescriptor, getTrustedKibbleRoutePolicy } from '$lib/brand/composition-policy';
import { executeKibbleCheckoutAssuranceZoneAdapter } from '$lib/brand/reference/kibble-zone-executor.server';
import { KIBBLE_CHECKOUT_DEFAULT_PRESENTATION, materializeKibbleCheckoutPresentation } from '$lib/brand/reference/kibble-presentation-decisions';
import { createStoreFromRequest } from '$lib/signals/request';

const SUBTYPES = new Set(['gift', 'prepaid', 'confirmation']);

export const load: PageServerLoad = async ({ params, url, request, cookies, parent }) => {
	if (!SUBTYPES.has(params.subtype)) throw error(404, 'Not found');
	const routePolicy = getTrustedKibbleRoutePolicy(getBrand().id, url.pathname);
	if (!routePolicy || routePolicy.surface !== 'checkout') throw error(404, 'Not found');
	const subtype = params.subtype as 'gift' | 'prepaid' | 'confirmation';
	const { observeMode } = await parent();
	const modelSubtype = subtype === 'gift' || subtype === 'prepaid' ? subtype : null;
	const modelEnabled = Boolean(modelSubtype) && observeMode && privateEnv.KIBBLE_DEMO_AI_ENABLED === 'true';
	if (modelEnabled) await createStoreFromRequest({ url, request, cookies, category: 'checkout' });
	const availabilityMessage = subtype === 'gift'
		? 'Gift checkout is unavailable. No product, plan, recipient, amount, payment method, or purchase request was loaded.'
		: subtype === 'prepaid'
			? 'Prepaid checkout is unavailable. No plan, term, savings, total, payment method, or purchase request was loaded.'
			: 'Order confirmation is unavailable because no checkout or order service was called.';
	return {
		kibbleCheckout: {
			subtype, availabilityMessage, recipeId: KIBBLE_REFERENCE_CONTRACT.recipes.checkout.id, policyVersion: routePolicy.policy.policyVersion,
			assuranceZoneAdapter: modelSubtype ? await executeKibbleCheckoutAssuranceZoneAdapter({ routePath: `/checkout/${modelSubtype}`, assurance: materializeKibbleCheckoutPresentation(KIBBLE_CHECKOUT_DEFAULT_PRESENTATION).assurance }) : null,
			checkoutModelDecision: modelSubtype && modelEnabled
				? getKibbleObserveCopyModelPolicyDescriptor({ surface: 'checkout', familyId: 'checkout.assurance-strip', instanceId: 'checkout.assurance-strip', routePath: `/checkout/${modelSubtype}` })
				: null,
		},
	};
};
