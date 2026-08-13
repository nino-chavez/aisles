import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import KibbleDevInspector from './KibbleDevInspector.svelte';
import {
	redactInspectorDebugValue,
	sanitizeInspectorInference,
	type KibbleDevInspectorData,
} from './kibble-dev-inspector';

const inspector: KibbleDevInspectorData = {
	reference: { id: 'kibble-preserve-home-v1', version: '2026-08-12' },
	surface: 'home', preset: 'preserve', policyVersion: 'kibble-policy-v1', publicationMode: 'approval_required',
	dataSourceLabel: 'local catalog fixture',
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
	it('renders the developer contract, all authority states, and deterministic scenario links', () => {
		const result = render(KibbleDevInspector, { props: { inspector } });
		for (const label of ['Dev Mode — Kibble decision inspector', 'Local development only', 'Fixed', 'Rules', 'Model']) expect(result.body).toContain(label);
		for (const persona of ['gatherer', 'hunter', 'researcher', 'gifter']) expect(result.body).toContain(`?dev=true&amp;intent=${persona}`);
		expect(result.body).toContain('0 model calls · Not authorized in Preserve');
	});

	it('does not make shopper commerce claims and redacts raw private fields', () => {
		const result = render(KibbleDevInspector, { props: { inspector } });
		expect(result.body).not.toMatch(/Add to Cart|Checkout|Free shipping|Auto-Refill/);
		expect(result.body).not.toContain('must not render');
		expect(result.body).toContain('[redacted]');
	});

	it('withholds shopper-controlled inference details and secrets embedded in strings', () => {
		const sanitized = sanitizeInspectorInference({
			...inspector.inference,
			shift: { detected: true, from: 'hunter', trigger: 'search person@example.com' },
			ruleMatches: [{
				ruleName: 'search', reason: 'https://example.com/?access_token=sekret', weight: 1,
				adjustment: { researcher: 1 },
			}],
		});
		expect(sanitized.shift.trigger).toBe('[request detail withheld]');
		expect(sanitized.ruleMatches[0].reason).toBe('Matched; raw request detail withheld.');
		expect(JSON.stringify(redactInspectorDebugValue({
			reason: 'https://example.com/?access_token=sekret',
			trigger: 'search person@example.com',
		}))).toBe('{"reason":"https://example.com/?access_token=[redacted]","trigger":"search [redacted-email]"}');
	});

	it('labels policy publication as distinct from deployment status', () => {
		const result = render(KibbleDevInspector, { props: { inspector } });
		expect(result.body).toContain('policy publication mode');
		expect(result.body).toContain('not deployment status');
	});

	it('labels the development-only shelf preview and its applied status', () => {
		const result = render(KibbleDevInspector, { props: { inspector, livePreview: { state: 'applied', persona: 'hunter' } } });
		expect(result.body).toContain('preview applied for hunter');
		expect(result.body).toContain('Production applies decisions on a route boundary; this live change is a development preview.');
		expect(result.body).toContain('aria-live="polite"');
	});
});
