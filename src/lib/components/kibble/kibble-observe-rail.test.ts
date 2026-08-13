import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import KibbleObserveRail from './KibbleObserveRail.svelte';

const props = {
	enableHref: '/category/dog-food?observe=true',
	disableHref: '/category/dog-food?observe=false',
	surface: 'plp',
	policyVersion: 'kibble-preserve-v1',
	referenceId: 'kibble-shelf-native',
	referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
	sessionId: 'session-one',
	initialPersona: 'researcher',
};

describe('KibbleObserveRail', () => {
	it('makes the observability demo discoverable without knowing the query flag', () => {
		const result = render(KibbleObserveRail, { props: { ...props, active: false } });
		expect(result.body).toContain('Show decision inspector');
		expect(result.body).toContain('href="/category/dog-food?observe=true"');
	});

	it('explains actual authority, commerce boundaries, and exact session access', () => {
		const result = render(KibbleObserveRail, { props: { ...props, active: true } });
		for (const label of ['Template', 'Rules', 'AI', 'No model generated', 'Why purchase controls stop here']) {
			expect(result.body).toContain(label);
		}
		expect(result.body).toContain('researcher');
		expect(result.body).toContain(`kibble-shelf-native@${KIBBLE_REFERENCE_CONTRACT.version}`);
		expect(result.body).toContain('/observe?session=session-one');
		expect(result.body).toContain('https://storefront.bcsubs.app/');
		expect(result.body).toContain('href="/category/dog-food?observe=false"');
	});
});
