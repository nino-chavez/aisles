import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
import KibbleObserveRail from './KibbleObserveRail.svelte';
import { buildKibbleMerchantCapabilityCoverage } from '$lib/brand/reference/kibble-catalog-enrichment';

const props = {
	enableHref: '/category/dog-food?observe=true',
	disableHref: '/category/dog-food?observe=false',
	surface: 'plp',
	policyVersion: 'kibble-preserve-v1',
	referenceId: 'kibble-shelf-native',
	referenceVersion: KIBBLE_REFERENCE_CONTRACT.version,
	sessionId: 'session-one',
	initialPersona: 'researcher',
	capabilityCoverage: buildKibbleMerchantCapabilityCoverage(),
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
		expect(result.body).toContain('CLP + PLP · Template and rules');
		expect(result.body).toContain('medium · CLP framing, marketing, and first-eight PLP order');
		expect(result.body).toContain(`kibble-shelf-native@${KIBBLE_REFERENCE_CONTRACT.version}`);
		expect(result.body).toContain('/observe?session=session-one');
		expect(result.body).toContain('https://storefront.bcsubs.app/');
		expect(result.body).toContain('href="/category/dog-food?observe=false"');
		expect(result.body).toContain('Merchant capability coverage');
		expect(result.body).toContain('34 pinned offer rows');
		expect(result.body).toContain('10 canonical storefront products');
		expect(result.body).toContain('Not claimed for Kibble');
		expect(result.body).toContain('6 Aisles presentation capabilities');
		expect(result.body).toContain('Outcome proof:');
		expect(result.body).toContain('not measured');
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
		expect(source).toContain("surface === 'pdp' ? pdpModelAction");
		expect(source).toContain('disabled={!modelActionReady || modelAction.disabled || cooldownRemainingSeconds > 0}');
		expect(source).toContain("pdpModelActionStatus = 'updating'");
	});

	it('keeps the PLP first-eight action scoped, accessible, and removes its listeners', () => {
		const source = readFileSync(resolve(import.meta.dirname, 'KibbleObserveRail.svelte'), 'utf8');
		expect(source).toContain("document.querySelector('[data-aisles-plp-model-eligible=\"true\"]')");
		expect(source).toContain("window.addEventListener('aisles-kibble-plp-model-status', onPlpModelStatus)");
		expect(source).toContain("window.removeEventListener('aisles-kibble-plp-model-status', onPlpModelStatus)");
		expect(source).toContain("window.dispatchEvent(new CustomEvent('aisles-kibble-plp-model-request'))");
		expect(source).toContain("surface === 'plp' ? plpModelAction");
		expect(source).toContain('disabled={!modelActionReady || modelAction.disabled || cooldownRemainingSeconds > 0}');
		expect(source).toContain('plpModelActionReady = false');
		expect(source).toContain("plpModelActionStatus = 'idle'");
		expect(source).toContain('homeModelActionReady = false');
		expect(source).toContain('pdpModelActionReady = false');
		expect(source).toContain('decisionEvidence = null');
	});

	it('shows readiness before the first call without counting eligible zones as rendered AI output', () => {
		const rail = readFileSync(resolve(import.meta.dirname, 'KibbleObserveRail.svelte'), 'utf8');
		const home = readFileSync(resolve(import.meta.dirname, 'KibbleFeaturedGrid.svelte'), 'utf8');
		const plp = readFileSync(resolve(import.meta.dirname, 'KibbleCategoryReference.svelte'), 'utf8');
		const pdp = readFileSync(resolve(import.meta.dirname, 'KibbleProductDetailReference.svelte'), 'utf8');
		const marketing = readFileSync(resolve(import.meta.dirname, 'KibbleMarketingBlock.svelte'), 'utf8');

		expect(rail).toContain("`${surfaceLabel} · AI ready`");
		expect(rail).toContain("return 'Run AI'");
		expect(rail).toContain("window.dispatchEvent(new CustomEvent('aisles-kibble-model-request'))");
		expect(rail).toContain("window.addEventListener('aisles-kibble-home-model-ready', onHomeModelReady)");
		expect(rail).toContain('View changes');
		expect(rail).toContain("zone.modelEligible ? 'AI ready'");
		expect(rail).toContain("zones.filter(({ authority, modelCalls }) => authority === 'model' && modelCalls > 0).length");
		expect(rail).toContain('AI zones and AI calls stay zero until validated model-selected output is rendered.');
		expect(rail).not.toContain('KIBBLE_HOME_PRESENTATION_POLICY.zoneIds.length');
		for (const source of [home, plp, pdp]) expect(source).toContain('data-aisles-model-eligible');
		expect(marketing).toContain('data-aisles-model-calls={zoneArtifact.modelCallCount}');
		expect(marketing).toContain('data-aisles-authority={zoneArtifact.decisionMode}');
		expect(marketing).toContain('{zoneArtifact.content.props.headline}');
		expect(marketing).not.toContain('No optional marketing block selected');
		expect(plp).toContain("marketingZoneArtifact?.sharedContentKind === 'content'");
		expect(pdp).toContain("marketingZoneArtifact?.sharedContentKind === 'content'");
		expect(pdp).toContain('<KibbleMarketingBlock zoneArtifact={marketingZoneArtifact} />');
	});

	it('covers the narrow funnel surfaces and never offers retry inside the server cooldown', () => {
		const source = readFileSync(resolve(import.meta.dirname, 'KibbleObserveRail.svelte'), 'utf8');
		for (const surface of ['search', 'cart', 'checkout']) {
			expect(source).toContain(`aisles-kibble-${surface}-model-status`);
			expect(source).toContain(`aisles-kibble-${surface}-model-ready`);
		}
		expect(source).toContain('`aisles-kibble-${actionSurface}-model-request`');
		expect(source).toContain('modelActionCooldownUntil = clockNow + KIBBLE_DEMO_ACTION_COOLDOWN_MS');
		expect(source).toContain('Run AI again in ${cooldownRemainingSeconds}s');
		expect(source).toContain('storedZones === null ? true');
		expect(source).toContain("if ('persona' in status && status.persona) persona = status.persona");
	});
});
