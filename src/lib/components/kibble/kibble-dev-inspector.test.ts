import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import KibbleDevInspector from './KibbleDevInspector.svelte';
import {
	redactInspectorDebugValue,
	describeKibbleRehearsalStatus,
	describeKibbleBehaviorStatus,
	describeKibbleModelDecisionStatus,
	sanitizeInspectorInference,
	type KibbleDevInspectorData,
	type KibbleInspectorInference,
} from './kibble-dev-inspector';

const inspector: KibbleDevInspectorData = {
	reference: { id: 'kibble-preserve-home-v1', version: '2026-08-12' },
	surface: 'home', preset: 'preserve', policyVersion: 'kibble-policy-v1', publicationMode: 'approval_required',
	dataSourceLabel: 'local catalog fixture',
	availableModelDecision: { policyVersion: 'kibble-observe-model-v1', zoneId: 'home.featured-row', capabilities: ['rank_products'], publicationMode: 'live' },
	inference: {
		primary: 'researcher', probabilities: { gatherer: 0.15, hunter: 0.2, researcher: 0.55, gifter: 0.1 }, confidence: 0.35,
		dominantSource: 'request', signalCount: 2, modifiers: { priceSensitivity: 0.2, urgency: 0.1, familiarityWithStore: 0.3 },
		shift: { detected: false, from: null, trigger: null }, ruleMatches: [{ ruleName: 'explicit-intent', reason: 'intent query parameter', weight: 1, adjustment: { researcher: 1 } }],
	},
	zones: [
		{ id: 'opening-merchandising', label: 'Opening merchandising', authority: 'fixed', componentVariant: 'kibble.hero.flagship-bundle', capabilities: [], decisionSummary: 'Reference-owned.', changed: false },
		{ id: 'ranked-products', label: 'Ranked products', authority: 'rules', componentVariant: 'kibble.featured-grid.four-column', capabilities: ['rank_products'], decisionSummary: 'Deterministic rank.', changed: true, inputProducts: [{ id: 'a', name: 'A' }], outputProducts: [{ id: 'a', name: 'A' }] },
		{ id: 'catalog-entry', label: 'Catalog entry', authority: 'model', componentVariant: 'kibble.visual-module.category', capabilities: ['select_component_variant'], decisionSummary: 'No Preserve model decision.', changed: false },
	],
	provenance: { prompt: 'must not render', credential: 'must not render' },
};

describe('KibbleDevInspector', () => {
	it('renders the demo contract, all authority states, and deterministic scenario links', () => {
		const result = render(KibbleDevInspector, { props: { inspector } });
		for (const label of ['Aisles decision inspector', 'Live demo controls', 'Template', 'Rules', 'AI model']) expect(result.body).toContain(label);
		for (const persona of ['gatherer', 'hunter', 'researcher', 'gifter']) expect(result.body).toContain(`?observe=true&amp;intent=${persona}#kibble-signal-lab`);
		expect(result.body).toContain('Template stays fixed. Rules react to signals. AI model appears only where policy authorizes generation.');
		expect(result.body).toContain('0 model calls · Not authorized in Preserve');
		expect(result.body).toContain('aria-expanded="true"');
		expect(result.body).toContain('Collapse');
		expect(result.body).toContain('Hide inspector');
	});

	it('deep-links Observe to the exact simulated shopper in a new tab', () => {
		const result = render(KibbleDevInspector, { props: { inspector, sessionId: 'synthetic:kibble local' } });
		expect(result.body).toContain('href="/observe?session=synthetic%3Akibble+local"');
		expect(result.body).toContain('target="_blank"');
		expect(result.body).toContain('rel="noopener"');
		expect(render(KibbleDevInspector, { props: { inspector, sessionId: ' invalid' } }).body).not.toContain('Open this session in Observe');
	});

	it('does not make shopper commerce claims and redacts raw private fields', () => {
		const result = render(KibbleDevInspector, { props: { inspector } });
		expect(result.body).not.toMatch(/Add to Cart|Checkout|Free shipping|Auto-Refill/);
		expect(result.body).not.toContain('must not render');
		expect(result.body).toContain('[redacted]');
	});

	it('withholds shopper-controlled inference details and secrets embedded in strings', () => {
		const unsafeInference: KibbleInspectorInference = {
			...inspector.inference,
			shift: { detected: true, from: 'hunter', trigger: 'search person@example.com' },
			ruleMatches: [{
				ruleName: 'search', reason: 'https://example.com/?access_token=sekret', weight: 1,
				adjustment: { researcher: 1 },
			}],
		};
		const sanitized = sanitizeInspectorInference(unsafeInference);
		expect(sanitized.shift.trigger).toBe('[request detail withheld]');
		expect(sanitized.ruleMatches[0].reason).toBe('Matched; raw request detail withheld.');
		expect(JSON.stringify(redactInspectorDebugValue({
			reason: 'https://example.com/?access_token=sekret',
			trigger: 'search person@example.com',
		}))).toBe('{"reason":"https://example.com/?access_token=[redacted]","trigger":"search [redacted-email]"}');
		expect(sanitized).not.toBe(unsafeInference);
		expect(sanitized.probabilities).not.toBe(unsafeInference.probabilities);
		expect(sanitized.modifiers).not.toBe(unsafeInference.modifiers);
		expect(sanitized.ruleMatches[0].adjustment).not.toBe(unsafeInference.ruleMatches[0].adjustment);
	});

	it('labels policy publication as distinct from deployment status', () => {
		const result = render(KibbleDevInspector, { props: { inspector } });
		expect(result.body).toContain('policy publication mode');
		expect(result.body).toContain('not deployment status');
	});

	it('labels the public demo shelf preview and its applied status', () => {
		const result = render(KibbleDevInspector, { props: { inspector, livePreview: { state: 'applied', persona: 'hunter', changed: true } } });
		expect(result.body).toContain('preview applied for hunter');
		expect(result.body).toContain('Signals update deterministic rules first. The explicit AI control may reorder the same approved shelf; the Kibble template remains fixed.');
		expect(result.body).not.toContain('View changed shelf');
	});

	it('reports the requested signal separately from the applied persona and actual shelf change', () => {
		expect(describeKibbleRehearsalStatus('hunter', { state: 'applied', persona: 'gatherer', changed: false }, false))
			.toBe('Signal hunter accepted. Server applied gatherer; shelf order unchanged.');
		expect(describeKibbleRehearsalStatus('gatherer', { state: 'applied', persona: 'gatherer', changed: true }, false))
			.toBe('Signal gatherer accepted. Server applied gatherer; shelf order changed.');
		expect(describeKibbleRehearsalStatus('researcher', { state: 'applied', persona: 'hunter', changed: true }, true))
			.toBe('Signal researcher queued. Waiting for the signal endpoint.');
	});

	it('explains behavior input, inferred result, and personalization outcome separately', () => {
		const behavior = { label: 'Compare products carefully', eventCount: 7 };
		expect(describeKibbleBehaviorStatus(null, { state: 'waiting' })).toBe('Choose a customer behavior to simulate.');
		expect(describeKibbleBehaviorStatus(behavior, { state: 'waiting' }, true))
			.toBe('Compare products carefully: sending 7 synthetic signals through the storefront pipeline.');
		expect(describeKibbleBehaviorStatus(behavior, { state: 'applied', persona: 'researcher', changed: true }))
			.toBe('Compare products carefully: 7 synthetic signals accepted. Server inferred researcher; shelf order changed.');
	});

	it('keeps an explicit bounded-AI failure visible when no behavior control is active', () => {
		expect(describeKibbleModelDecisionStatus({ state: 'updating' }))
			.toBe('Bounded AI ranking is running.');
		expect(describeKibbleModelDecisionStatus({ state: 'failed' }))
			.toBe('Bounded AI ranking failed; the last approved shelf was retained.');
		expect(describeKibbleModelDecisionStatus({ state: 'applied', persona: 'hunter', changed: false }))
			.toBe('Bounded AI ranking applied for hunter; shelf order was unchanged.');
	});

	it('offers real behavior simulations only for a synthetic scenario', () => {
		const synthetic = {
			...inspector,
			provenance: { synthetic: { value: true, scenarioId: 'local-showcase' } },
		};
		const result = render(KibbleDevInspector, { props: { inspector: synthetic } });
		expect(result.body).toContain('Customer behavior simulator');
		expect(result.body).toContain('actual signal endpoint');
		for (const behavior of ['Browse several departments', 'Compare products carefully', 'Search for a deal', 'Shop for a birthday gift']) {
			expect(result.body).toContain(behavior);
		}
		expect(result.body).toContain('Start a fresh shopper');
		expect(result.body).toContain('Run bounded AI ranking');
		expect(result.body).toContain('It may only return the product order. Copy, layout, prices, links, and actions stay template-owned.');
		expect(result.body).toContain('Choose a customer behavior to simulate.');
		expect(result.body).toContain('aria-atomic="true"');
		expect(result.body).toContain('aria-disabled="false"');
		expect(result.body).not.toMatch(/<button[^>]*\sdisabled(?:=|\s|>)/);
		expect(render(KibbleDevInspector, { props: { inspector } }).body).not.toContain('Customer behavior simulator');
	});
});
