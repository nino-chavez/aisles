import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyKibbleLivePreview, expectationFromTrustedInspector, listenForKibbleLivePreview, validateKibbleLivePreview } from './kibble-live-preview';
import { buildKibbleDecisionEvidence, type KibbleDevInspectorData, type KibbleLivePreviewStatus } from './kibble-dev-inspector';

const expectation = {
	reference: { id: 'kibble-shelf-native', version: '1.8.0' },
	policyVersion: 'org:kibble|brand:kibble-policy-1.8.0',
	dataSourceLabel: 'fixture',
	synthetic: { value: true, scenarioId: 'local-showcase' },
	modelDecision: {
		policyVersion: 'org:kibble|brand:kibble-observe-assist-policy-1.8.0-v1',
		zoneId: 'home.featured-row' as const,
		capabilities: ['rank_products'] as const,
		publicationMode: 'live' as const,
	},
};
const product = { id: 'food-a', entityId: 1, name: 'Food A', price: 24, image: '/a.jpg', imageAlt: 'Food A', description: 'A food', specs: { protein: '28%' }, tags: ['dog'], category: 'dog-food' };
const products = [
	product,
	{ ...product, id: 'food-b', entityId: 2, name: 'Food B' },
	{ ...product, id: 'food-c', entityId: 3, name: 'Food C' },
];
const inspector: KibbleDevInspectorData = {
	reference: expectation.reference, surface: 'home', preset: 'preserve', policyVersion: expectation.policyVersion,
	publicationMode: 'live', dataSourceLabel: 'fixture',
	availableModelDecision: expectation.modelDecision,
	inference: { primary: 'hunter', probabilities: { gatherer: 0.1, hunter: 0.7, researcher: 0.1, gifter: 0.1 }, confidence: 0.6, dominantSource: 'interaction', signalCount: 2, modifiers: { priceSensitivity: 0.2, urgency: 0.3, familiarityWithStore: 0.4 }, shift: { detected: true, from: 'gatherer', trigger: null }, ruleMatches: [] },
	zones: [
		{ id: 'merchant-chrome', label: 'Root header', authority: 'fixed', componentVariant: 'kibble.header.responsive-chrome', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
		{ id: 'opening-merchandising', label: 'Opening hero', authority: 'fixed', componentVariant: 'kibble.hero.flagship-bundle', capabilities: [], decisionSummary: 'Pinned.', changed: false, modelCallStatus: { calls: 0, authorized: false } },
		{ id: 'ranked-products', label: 'Ranked products', authority: 'rules', componentVariant: 'kibble.featured-grid.four-column', capabilities: ['rank_products', 'select_products'], decisionSummary: 'Updated.', changed: true, inputProducts: [{ id: 'food-b', name: 'Food B' }, { id: 'food-a', name: 'Food A' }, { id: 'food-c', name: 'Food C' }], outputProducts: products.map(({ id, name }) => ({ id, name })), modelCallStatus: { calls: 0, authorized: false } },
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
		promptVersion: 'no-model-preserve-v1', schemaVersion: 'kibble-reference-1.8.0',
		synthetic: { value: true, scenarioId: 'local-showcase' },
	},
};
const rulesAdapters = products.map((entry, index) => ({
	instanceId: `home.featured-row.${index + 1}`,
	sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'rules', modelCallCount: 0,
	adapterId: index === 0 ? 'kibble.zone.home.featured-row.primary' : `kibble.zone.home.featured-row.continuation-${index}`,
	componentVariantId: 'kibble.featured-grid.ranked-segment', inputSha256: 'a'.repeat(64),
	content: { component: 'product-grid', props: { columns: 4, products: [{ productId: String(entry.entityId), role: 'standard' }], imageRatio: 'square', showDescription: false, showSpecs: false, showQuickAdd: false } },
}));
const response = () => ({
	version: 'kibble-live-home-preview-v2', previewOnly: true, reference: expectation.reference,
	policyVersion: expectation.policyVersion, persona: 'hunter', products, featuredZoneAdapters: rulesAdapters, inspector,
});
const modelResponse = () => {
	const rankedProducts = [...products].reverse();
	const modelCalls = 1;
	const modelInspector: KibbleDevInspectorData = {
		...inspector,
		preset: 'assist',
		policyVersion: expectation.modelDecision.policyVersion,
		dataSourceLabel: 'bounded-model-ranking',
		zones: inspector.zones.map((zone) => zone.id === 'ranked-products' ? {
			...zone,
			authority: 'model', componentVariant: 'kibble.featured-grid.ranked-segment', capabilities: ['rank_products'],
			outputProducts: rankedProducts.map(({ id, name }) => ({ id, name })),
			modelCallStatus: { calls: modelCalls, authorized: true },
			decision: { model: 'claude-haiku-4-5', outputField: 'rankedProductIds', productCount: rankedProducts.length },
		} : zone),
		provenance: {
			...(inspector.provenance as Record<string, unknown>),
			policyVersion: expectation.modelDecision.policyVersion,
			decisionSource: 'model', promptVersion: 'kibble-home-bounded-rank-v1', schemaVersion: 'kibble-home-zone-decision-v1',
			autonomy: { preset: 'assist', effectiveCapabilities: ['rank_products'], decisionMode: 'model', publicationMode: 'live' },
		},
	};
	return {
		version: 'kibble-live-home-preview-v2', previewOnly: true, reference: expectation.reference,
		policyVersion: expectation.modelDecision.policyVersion, persona: 'hunter', products: rankedProducts,
		provider: 'anthropic', modelId: 'claude-haiku-4-5',
		featuredZoneAdapters: [{
			instanceId: 'home.featured-row.1', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: modelCalls,
			adapterId: 'kibble.zone.home.featured-row.primary', componentVariantId: 'kibble.featured-grid.ranked-segment', inputSha256: 'b'.repeat(64),
			content: { component: 'product-grid', props: { columns: 4, products: rankedProducts.map(({ entityId }) => ({ productId: String(entityId), role: 'standard' })), imageRatio: 'square', showDescription: false, showSpecs: false, showQuickAdd: false } },
		}],
		inspector: modelInspector,
	};
};

describe('validateKibbleLivePreview', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('describes changed and unchanged model order without implying copy generation', () => {
		const before = products.map(({ id, name }) => ({ id, name }));
		const changed = buildKibbleDecisionEvidence({ surface: 'home', zoneId: 'home.featured-row', zoneLabel: 'Featured product shelf', policyVersion: expectation.modelDecision!.policyVersion, before, after: [...before].reverse(), provider: 'anthropic', model: 'claude-haiku-4-5', calls: 1, state: 'applied' });
		const same = buildKibbleDecisionEvidence({ surface: 'home', zoneId: 'home.featured-row', zoneLabel: 'Featured product shelf', policyVersion: expectation.modelDecision!.policyVersion, before, after: before, provider: 'anthropic', model: 'claude-haiku-4-5', calls: 1, state: 'applied' });
		expect(changed.moved.map(({ id }) => id)).toEqual(['food-c', 'food-a']);
		expect(changed.unchanged.map(({ id }) => id)).toEqual(['food-b']);
		expect(changed.copy).toBe('unchanged');
		expect(same.moved).toEqual([]);
		expect(same.unchanged.map(({ id }) => id)).toEqual(['food-a', 'food-b', 'food-c']);
	});

	it('accepts a complete, pinned preview response', () => {
		const result = validateKibbleLivePreview(response(), expectation);
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.preview.products[0].id).toBe('food-a');
	});

	it('accepts the exact bounded model policy and rendered shelf adapter', () => {
		const result = validateKibbleLivePreview(modelResponse(), expectation);
		expect(result.ok).toBe(true);
		if (result.ok) {
			expect(result.preview.products.map(({ id }) => id)).toEqual(['food-c', 'food-b', 'food-a']);
			expect(result.preview.featuredZoneAdapters?.[0]).toMatchObject({ decisionMode: 'model', modelCallCount: 1 });
		}
		expect(validateKibbleLivePreview({ ...modelResponse(), featuredZoneAdapters: rulesAdapters }, expectation).ok).toBe(false);
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
		expect(fetchMock).toHaveBeenCalledWith('/api/kibble/home-decision?observe=true', expect.objectContaining({ method: 'POST' }));
		expect(statuses).toEqual([{ state: 'updating', mode: 'rules' }, { state: 'applied', mode: 'rules', persona: 'hunter', changed: true }]);

		cleanup();
		eventTarget.dispatchEvent(new Event('aisles-inference-update'));
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('requests a model decision only after the explicit inspector action', async () => {
		const eventTarget = new EventTarget();
		const fetchMock = vi.fn(async () => new Response(JSON.stringify(modelResponse()), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		}));
		vi.stubGlobal('window', eventTarget);
		vi.stubGlobal('fetch', fetchMock);
		const applied = vi.fn();
		const cleanup = listenForKibbleLivePreview({
			expectation,
			getCurrentProductIds: () => products.map(({ id }) => id),
			onApplied: applied,
			onStatus: vi.fn(),
		});

		expect(fetchMock).not.toHaveBeenCalled();
		eventTarget.dispatchEvent(new Event('aisles-kibble-model-request'));
		await vi.waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith('/api/kibble/home-decision?observe=true', expect.objectContaining({
			method: 'POST', body: JSON.stringify({ mode: 'model' }), headers: { 'Content-Type': 'application/json' },
		}));
		cleanup();
	});

	it('fails closed and re-enables the inspector path when a preview request stalls', async () => {
		vi.useFakeTimers();
		const eventTarget = new EventTarget();
		vi.stubGlobal('window', eventTarget);
		vi.stubGlobal('fetch', vi.fn((_input: unknown, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
			init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
		})));
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const statuses: KibbleLivePreviewStatus[] = [];
		const cleanup = listenForKibbleLivePreview({
			expectation,
			getCurrentProductIds: () => ['food-b'],
			onApplied: vi.fn(),
			onStatus: (status) => statuses.push(status),
		});

		eventTarget.dispatchEvent(new Event('aisles-inference-update'));
		expect(statuses).toEqual([{ state: 'updating', mode: 'rules' }]);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(statuses).toEqual([{ state: 'updating', mode: 'rules' }, { state: 'failed', mode: 'rules' }]);
		cleanup();
	});
});
