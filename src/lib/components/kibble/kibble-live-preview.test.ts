import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyKibbleLivePreview, expectationFromTrustedInspector, listenForKibbleLivePreview, validateKibbleLivePreview } from './kibble-live-preview';
import type { KibbleDevInspectorData, KibbleLivePreviewStatus } from './kibble-dev-inspector';

const expectation = {
	reference: { id: 'kibble-shelf-native', version: '1.5.0' },
	policyVersion: 'org:kibble|brand:kibble-policy-1.5.0',
	dataSourceLabel: 'fixture',
	synthetic: { value: true, scenarioId: 'local-showcase' },
};
const product = { id: 'food-a', entityId: 1, name: 'Food A', price: 24, image: '/a.jpg', imageAlt: 'Food A', description: 'A food', specs: { protein: '28%' }, tags: ['dog'], category: 'dog-food' };
const inspector: KibbleDevInspectorData = {
	reference: expectation.reference, surface: 'home', preset: 'preserve', policyVersion: expectation.policyVersion,
	publicationMode: 'live', dataSourceLabel: 'fixture',
	inference: { primary: 'hunter', probabilities: { gatherer: 0.1, hunter: 0.7, researcher: 0.1, gifter: 0.1 }, confidence: 0.6, dominantSource: 'interaction', signalCount: 2, modifiers: { priceSensitivity: 0.2, urgency: 0.3, familiarityWithStore: 0.4 }, shift: { detected: true, from: 'gatherer', trigger: null }, ruleMatches: [] },
	zones: [
		{ id: 'merchant-chrome', label: 'Root header', authority: 'fixed', componentVariant: 'kibble.header.responsive-chrome', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
		{ id: 'opening-merchandising', label: 'Opening hero', authority: 'fixed', componentVariant: 'kibble.hero.flagship-bundle', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
		{ id: 'ranked-products', label: 'Ranked products', authority: 'rules', componentVariant: 'kibble.featured-grid.four-column', capabilities: ['rank_products', 'select_products'], decisionSummary: 'Updated.', changed: true, inputProducts: [{ id: 'food-b', name: 'Food B' }, { id: 'food-a', name: 'Food A' }], outputProducts: [{ id: 'food-a', name: 'Food A' }], modelCallStatus: { calls: 0, authorized: false } },
		{ id: 'catalog-entry', label: 'Catalog entry', authority: 'fixed', componentVariant: 'kibble.visual-module.category', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
		{ id: 'service-proof', label: 'Service proof', authority: 'fixed', componentVariant: 'kibble.service-proof.three-column', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
		{ id: 'merchant-footer', label: 'Root footer', authority: 'fixed', componentVariant: 'kibble.footer.four-column', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
	],
	provenance: {
		version: 'layout-provenance-v1', organizationId: 'kibble-demo-merchant', brandId: 'kibble',
		reference: { status: 'contracted', id: expectation.reference.id, version: expectation.reference.version },
		policyVersion: expectation.policyVersion, surface: 'home', route: '/', persona: 'hunter', viewportClass: 'responsive',
		renderer: { componentId: 'kibble.home', variantId: 'kibble-home-reference-v1' }, decisionSource: 'rules',
		inputHash: '0123456789abcdef', catalogVersion: 'catalog:0123456789abcdef', shopperContextHash: 'fedcba9876543210',
		picksHash: null, incentiveHash: null,
		autonomy: { preset: 'preserve', effectiveCapabilities: ['rank_products', 'select_products'], decisionMode: 'rules', publicationMode: 'live' },
		promptVersion: 'no-model-preserve-v1', schemaVersion: 'kibble-reference-1.5.0',
		synthetic: { value: true, scenarioId: 'local-showcase' },
	},
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
			inspector: { ...inspector, zones: inspector.zones.map((zone, index) => index === 2 ? { ...zone, allowedCapabilities: ['replace_css'] } : zone) },
		}, expectation).ok).toBe(false);
	});

	it('rejects false Home Preserve authority and missing provenance', () => {
		for (const override of [
			{ surface: 'checkout' },
			{ preset: 'explore' },
			{ publicationMode: 'approval_required' },
		]) {
			expect(validateKibbleLivePreview({ ...response(), inspector: { ...inspector, ...override } }, expectation).ok).toBe(false);
		}
		const { provenance: _provenance, ...withoutProvenance } = inspector;
		expect(validateKibbleLivePreview({ ...response(), inspector: withoutProvenance }, expectation).ok).toBe(false);
	});

	it('rejects model authority and a zone order that does not bind the rendered shelf', () => {
		const modelZone = inspector.zones.map((zone, index) => index === 2
			? { ...zone, authority: 'model', capabilities: ['replace_css'], modelCallStatus: { calls: 99, authorized: true } }
			: zone);
		expect(validateKibbleLivePreview({ ...response(), inspector: { ...inspector, zones: modelZone } }, expectation).ok).toBe(false);
		const wrongOrder = inspector.zones.map((zone, index) => index === 2
			? { ...zone, outputProducts: [{ id: 'food-b', name: 'Food B' }] }
			: zone);
		expect(validateKibbleLivePreview({ ...response(), inspector: { ...inspector, zones: wrongOrder } }, expectation).ok).toBe(false);
	});

	it('rejects provenance that does not describe the same contracted decision', () => {
		const provenance = inspector.provenance as Record<string, unknown>;
		expect(validateKibbleLivePreview({
			...response(), inspector: { ...inspector, provenance: { ...provenance, persona: 'gifter' } },
		}, expectation).ok).toBe(false);
		expect(validateKibbleLivePreview({
			...response(), inspector: { ...inspector, provenance: { ...provenance, decisionSource: 'model' } },
		}, expectation).ok).toBe(false);
	});

	it('binds source label and synthetic identity to trusted initial PageData', () => {
		expect(expectationFromTrustedInspector(inspector)).toEqual(expectation);
		expect(validateKibbleLivePreview({
			...response(), inspector: { ...inspector, dataSourceLabel: 'merchant data' },
		}, expectation).ok).toBe(false);
		const provenance = inspector.provenance as Record<string, unknown>;
		expect(validateKibbleLivePreview({
			...response(), inspector: { ...inspector, provenance: { ...provenance, synthetic: { value: false, scenarioId: null } } },
		}, expectation).ok).toBe(false);
		expect(expectationFromTrustedInspector({ ...inspector, provenance: { ...provenance, synthetic: { value: false, scenarioId: 'fake' } } })).toBeNull();
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
		const statuses: KibbleLivePreviewStatus[] = [];
		const cleanup = listenForKibbleLivePreview({
			expectation,
			getCurrentProductIds: () => ['food-b'],
			onApplied: applied,
			onStatus: (status) => statuses.push(status),
		});

		expect(fetchMock).not.toHaveBeenCalled();
		eventTarget.dispatchEvent(new Event('aisles-inference-update'));
		await vi.waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith('/api/kibble/home-decision?dev=true', expect.objectContaining({ method: 'POST' }));
		expect(statuses).toEqual([{ state: 'updating' }, { state: 'applied', persona: 'hunter', changed: true }]);

		cleanup();
		eventTarget.dispatchEvent(new Event('aisles-inference-update'));
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});
