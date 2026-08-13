import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyKibbleLivePreview, listenForKibbleLivePreview, validateKibbleLivePreview } from './kibble-live-preview';
import type { KibbleDevInspectorData } from './kibble-dev-inspector';

const expectation = { reference: { id: 'kibble-preserve-home-v1', version: '2026-08-12' }, policyVersion: 'kibble-policy-v1' };
const product = { id: 'food-a', entityId: 1, name: 'Food A', price: 24, image: '/a.jpg', imageAlt: 'Food A', description: 'A food', specs: { protein: '28%' }, tags: ['dog'], category: 'dog-food' };
const inspector: KibbleDevInspectorData = {
	reference: expectation.reference, surface: 'home', preset: 'preserve', policyVersion: expectation.policyVersion,
	publicationMode: 'approval_required', dataSourceLabel: 'fixture',
	inference: { primary: 'hunter', probabilities: { gatherer: 0.1, hunter: 0.7, researcher: 0.1, gifter: 0.1 }, confidence: 0.6, dominantSource: 'interaction', signalCount: 2, modifiers: { priceSensitivity: 0.2, urgency: 0.3, familiarityWithStore: 0.4 }, shift: { detected: true, from: 'gatherer', trigger: null }, ruleMatches: [] },
	zones: [{ id: 'ranked-products', label: 'Ranked products', authority: 'rules', componentVariant: 'kibble.featured-grid.four-column', capabilities: ['rank_products'], decisionSummary: 'Updated.', changed: true }],
};
const response = () => ({ version: 'kibble-live-home-preview-v1', previewOnly: true, reference: expectation.reference, policyVersion: expectation.policyVersion, persona: 'hunter', products: [product], inspector });

describe('validateKibbleLivePreview', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('accepts a complete, pinned preview response', () => {
		const result = validateKibbleLivePreview(response(), expectation);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.preview.products[0].id).toBe('food-a');
	});

	it.each([
		['version', { version: 'wrong' }],
		['reference', { reference: { id: 'other', version: '2026-08-12' } }],
		['policy', { policyVersion: 'other' }],
		['malformed product', { products: [{ id: 'food-a' }] }],
	])('rejects malformed %s data', (_label, override) => {
		expect(validateKibbleLivePreview({ ...response(), ...override }, expectation).ok).toBe(false);
	});

	it('rejects personaFit at any depth and duplicate product ids', () => {
		expect(validateKibbleLivePreview({ ...response(), products: [{ ...product, specs: { personaFit: 'leak' } }] }, expectation).ok).toBe(false);
		expect(validateKibbleLivePreview({ ...response(), products: [product, { ...product, name: 'Duplicate' }] }, expectation).ok).toBe(false);
	});

	it('rejects undeclared product, inspector, and zone authority fields', () => {
		expect(validateKibbleLivePreview({ ...response(), products: [{ ...product, preferredPersona: 'hunter' }] }, expectation).ok).toBe(false);
		expect(validateKibbleLivePreview({ ...response(), inspector: { ...inspector, policyOverride: 'explore' } }, expectation).ok).toBe(false);
		expect(validateKibbleLivePreview({
			...response(),
			inspector: { ...inspector, zones: [{ ...inspector.zones[0], allowedCapabilities: ['replace_css'] }] },
		}, expectation).ok).toBe(false);
	});

	it('retains the prior approved shelf and trace on failure', () => {
		const current = { products: [{ ...product, id: 'approved' }], inspector: { ...inspector, policyVersion: 'approved-policy' } };
		expect(applyKibbleLivePreview(current, { ...response(), version: 'wrong' }, expectation)).toBe(current);
	});

	it('requests a server decision only after an inference event and removes the listener on cleanup', async () => {
		const eventTarget = new EventTarget();
		const fetchMock = vi.fn(async () => new Response(JSON.stringify(response()), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		}));
		vi.stubGlobal('window', eventTarget);
		vi.stubGlobal('fetch', fetchMock);
		const applied = vi.fn();
		const statuses: string[] = [];
		const cleanup = listenForKibbleLivePreview({
			expectation,
			onApplied: applied,
			onStatus: (status) => statuses.push(status.state),
		});

		expect(fetchMock).not.toHaveBeenCalled();
		eventTarget.dispatchEvent(new Event('aisles-inference-update'));
		await vi.waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith('/api/kibble/home-decision?dev=true', expect.objectContaining({ method: 'POST' }));
		expect(statuses).toEqual(['updating', 'applied']);

		cleanup();
		eventTarget.dispatchEvent(new Event('aisles-inference-update'));
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
