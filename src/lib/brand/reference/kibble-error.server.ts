import { error } from '@sveltejs/kit';
import { assertKibblePreserveRoutePolicy, getContractSurfaceDecision } from '$lib/brand/composition-policy';
import { KIBBLE_REFERENCE_CONTRACT } from './kibble';
import { KIBBLE_PRESERVE_MANIFEST } from './kibble-manifest';
import { executeKibbleErrorZoneAdapter } from './kibble-zone-executor.server';

export type KibblePreserveErrorSurface = 'error-404' | 'error-empty';

export async function buildKibblePreserveErrorState(input: {
	brandId: string;
	surface: KibblePreserveErrorSurface;
	routePath: string;
	status: 404 | 503;
	message: string;
}) {
	const decision = getContractSurfaceDecision(input.brandId, input.surface);
	if (decision.mode !== 'reference-preserve') {
		throw new Error(`Kibble ${input.surface} reference policy is unavailable.`);
	}
	assertKibblePreserveRoutePolicy(decision.policy, input.surface);
	const adapter = await executeKibbleErrorZoneAdapter({
		surface: input.surface,
		routePath: input.routePath,
		status: input.status,
		message: input.message,
	});
	const policy = {
		referenceId: KIBBLE_REFERENCE_CONTRACT.id,
		referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
		policies: [{ surface: input.surface, policyVersion: decision.policy.policyVersion }],
	};
	return {
		display: KIBBLE_PRESERVE_MANIFEST.display.error,
		adapter,
		policy,
		body: {
			message: input.message,
			kibbleErrorAdapter: adapter,
			kibbleErrorPolicy: policy,
		},
	};
}

export async function throwKibblePreserveError(input: Parameters<typeof buildKibblePreserveErrorState>[0]): Promise<never> {
	const state = await buildKibblePreserveErrorState(input);
	error(input.status, state.body as never);
}
