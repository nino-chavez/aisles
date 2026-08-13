import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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
		expect(result.body).toContain('Plp · Preserve shell');
		expect(result.body).toContain(`kibble-shelf-native@${KIBBLE_REFERENCE_CONTRACT.version}`);
		expect(result.body).toContain('/observe?session=session-one');
		expect(result.body).toContain('https://storefront.bcsubs.app/');
		expect(result.body).toContain('href="/category/dog-food?observe=false"');
	});

	it('collapses when same-page navigation opens the full signal lab', () => {
		const source = readFileSync(resolve(import.meta.dirname, 'KibbleObserveRail.svelte'), 'utf8');
		expect(source).toContain("window.addEventListener('hashchange', collapseForSignalLab)");
		expect(source).toContain("window.removeEventListener('hashchange', collapseForSignalLab)");
		expect(source).toContain('aria-live="polite"');
		expect(source).toContain('min-height:44px');
	});

	it('keeps the PDP AI action status mounted and disables it while a ranking runs', () => {
		const source = readFileSync(resolve(import.meta.dirname, 'KibbleObserveRail.svelte'), 'utf8');
		expect(source).toContain('role="status" aria-live="polite"');
		expect(source).toContain('disabled={pdpModelAction.disabled}');
		expect(source).toContain("pdpModelActionStatus = 'updating'");
	});

	it('keeps the PLP first-eight action scoped, accessible, and removes its listeners', () => {
		const source = readFileSync(resolve(import.meta.dirname, 'KibbleObserveRail.svelte'), 'utf8');
		expect(source).toContain("document.querySelector('[data-aisles-plp-model-eligible=\"true\"]')");
		expect(source).toContain("window.addEventListener('aisles-kibble-plp-model-status', onPlpModelStatus)");
		expect(source).toContain("window.removeEventListener('aisles-kibble-plp-model-status', onPlpModelStatus)");
		expect(source).toContain("window.dispatchEvent(new CustomEvent('aisles-kibble-plp-model-request'))");
		expect(source).toContain('disabled={plpModelAction.disabled}');
	});
});
