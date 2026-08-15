import { afterEach, describe, expect, it, vi } from 'vitest';
import { applyKibbleLivePreview, expectationFromTrustedInspector, listenForKibbleLivePreview, validateKibbleLivePreview } from './kibble-live-preview';
import { buildKibbleDecisionEvidence, type KibbleDevInspectorData, type KibbleLivePreviewStatus } from './kibble-dev-inspector';
import { KIBBLE_HOME_DEFAULT_PRESENTATION, KIBBLE_HOME_PRESENTATION_POLICY, materializeKibbleHomePresentation, snapshotKibbleHomePresentation } from '$lib/brand/reference/kibble-presentation-decisions';

const expectation = {
	reference: { id: 'kibble-shelf-native', version: '1.8.0' },
	policyVersion: 'org:kibble|brand:kibble-policy-1.8.0',
	dataSourceLabel: 'fixture',
	synthetic: { value: true, scenarioId: 'local-showcase' },
	presentationContext: {
		hero: { eyebrow: 'The brands on your shelf · kept in view', headline: 'The brands worth trusting, organized around your routine.', body: 'Open Farm, Native Pet, Wild One, and Finn — organized around food, wellness, care, gear, and repeat-purchase routines.' },
		featuredCopy: { eyebrow: 'Catalog', title: 'New arrivals', browseAllLabel: 'Browse Dog Food' },
		catalogCopy: { eyebrow: 'Browse', title: 'Shop by category' },
	},
	modelDecision: {
		policyVersion: 'org:kibble|brand:kibble-observe-assist-policy-1.8.0-v1',
		zoneIds: ['home.hero', 'home.featured-row.1', 'home.editorial-strip'] as const,
		capabilities: ['rank_products', 'select_copy_variant', 'select_component_variant', 'reorder_zones'] as const,
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
	version: 'kibble-live-home-preview-v3', previewOnly: true, reference: expectation.reference,
	policyVersion: expectation.policyVersion, persona: 'hunter', products, featuredZoneAdapters: rulesAdapters, inspector,
});
const modelResponse = () => {
	const rankedProducts = [...products].reverse();
	const modelCalls = 1;
	const presentationDecision = {
		...KIBBLE_HOME_DEFAULT_PRESENTATION,
		heroCopyVariantId: 'visit-fast-path' as const,
		catalogComponentVariantId: 'two-column' as const,
	};
	const presentation = materializeKibbleHomePresentation(presentationDecision, expectation.presentationContext);
	const featured = {
		instanceId: 'home.featured-row.1', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: modelCalls,
		adapterId: 'kibble.zone.home.featured-row.primary', componentVariantId: 'kibble.featured-grid.ranked-segment', inputSha256: 'b'.repeat(64),
		selection: { componentVariantId: 'kibble.featured-grid.ranked-segment', copyVariantId: presentationDecision.featuredCopyVariantId, placementId: presentationDecision.sectionOrderId },
		content: { component: 'product-grid', props: { columns: 4, products: rankedProducts.map(({ entityId }) => ({ productId: String(entityId), role: 'standard' })), imageRatio: 'square', showDescription: false, showSpecs: false, showQuickAdd: false } },
	};
	const modelInspector: KibbleDevInspectorData = {
		...inspector,
		preset: 'compose',
		policyVersion: expectation.modelDecision.policyVersion,
		dataSourceLabel: 'bounded-model-presentation',
		zones: inspector.zones.map((zone) => {
			if (zone.id === 'opening-merchandising') return {
				...zone, id: 'home.hero', authority: 'model' as const,
				componentVariant: 'kibble.hero.zone-editorial-header', capabilities: ['select_copy_variant'],
				decisionSummary: 'Selected approved Home hero copy.', changed: true,
				modelCallStatus: { calls: modelCalls, authorized: true },
			};
			if (zone.id === 'ranked-products') return {
				...zone, id: 'home.featured-row.1', label: 'Featured product shelf', authority: 'model' as const,
				componentVariant: 'kibble.featured-grid.ranked-segment', capabilities: ['rank_products', 'select_copy_variant', 'reorder_zones'],
				inputProducts: products.map(({ id, name }) => ({ id, name })),
				outputProducts: rankedProducts.map(({ id, name }) => ({ id, name })), changed: true,
				modelCallStatus: { calls: modelCalls, authorized: true },
				decision: { model: 'claude-haiku-4-5', outputField: 'rankedProductIds', productCount: rankedProducts.length },
			};
			if (zone.id === 'catalog-entry') return {
				...zone, id: 'home.editorial-strip', authority: 'model' as const,
				componentVariant: 'kibble.visual-module.routine', capabilities: ['select_copy_variant', 'select_component_variant'],
				decisionSummary: 'Selected approved Home catalog copy and component.', changed: true,
				modelCallStatus: { calls: modelCalls, authorized: true },
			};
			return zone;
		}),
		provenance: {
			...(inspector.provenance as Record<string, unknown>),
			policyVersion: expectation.modelDecision.policyVersion,
			decisionSource: 'model', promptVersion: 'kibble-home-bounded-presentation-v2', schemaVersion: 'kibble-home-presentation-decision-v2',
			autonomy: { preset: 'compose', effectiveCapabilities: ['rank_products', 'select_copy_variant', 'select_component_variant', 'reorder_zones'], decisionMode: 'model', publicationMode: 'live' },
		},
	};
	return {
		version: 'kibble-live-home-preview-v3', previewOnly: true, reference: expectation.reference,
		policyVersion: expectation.modelDecision.policyVersion, persona: 'hunter', products: rankedProducts,
		provider: 'anthropic', modelId: 'claude-haiku-4-5', modelCallCount: modelCalls,
		presentationPolicy: KIBBLE_HOME_PRESENTATION_POLICY,
		zoneArtifacts: {
			hero: {
				instanceId: 'home.hero', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: modelCalls,
				adapterId: 'kibble.zone.home.hero', componentVariantId: 'kibble.hero.zone-editorial-header', inputSha256: 'c'.repeat(64),
				selection: { componentVariantId: 'kibble.hero.zone-editorial-header', copyVariantId: presentationDecision.heroCopyVariantId },
				content: { component: 'editorial-header', props: presentation.hero },
			},
			featured,
			editorial: {
				instanceId: 'home.editorial-strip', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: modelCalls,
				adapterId: 'kibble.zone.home.editorial-strip', componentVariantId: 'kibble.visual-module.routine', inputSha256: 'd'.repeat(64),
				selection: { componentVariantId: 'kibble.visual-module.routine', copyVariantId: presentationDecision.catalogCopyVariantId },
				content: { component: 'editorial-header', props: { eyebrow: presentation.catalogCopy.eyebrow, headline: presentation.catalogCopy.title, body: 'Browse the current storefront catalog by category.' } },
			},
		},
		inspector: modelInspector,
	};
};

describe('validateKibbleLivePreview', () => {
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('describes changed and unchanged product order independently from presentation choices', () => {
		const before = products.map(({ id, name }) => ({ id, name }));
		const changed = buildKibbleDecisionEvidence({ surface: 'home', zoneIds: ['home.featured-row.1'], zoneLabel: 'Featured product shelf', policyVersion: expectation.modelDecision!.policyVersion, before, after: [...before].reverse(), provider: 'anthropic', model: 'claude-haiku-4-5', calls: 1, state: 'applied' });
		const same = buildKibbleDecisionEvidence({ surface: 'home', zoneIds: ['home.featured-row.1'], zoneLabel: 'Featured product shelf', policyVersion: expectation.modelDecision!.policyVersion, before, after: before, provider: 'anthropic', model: 'claude-haiku-4-5', calls: 1, state: 'applied' });
		expect(changed.moved.map(({ id }) => id)).toEqual(['food-c', 'food-a']);
		expect(changed.unchanged.map(({ id }) => id)).toEqual(['food-b']);
		expect(changed.copy).toEqual([]);
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
			expect(result.preview.zoneArtifacts?.featured).toMatchObject({ decisionMode: 'model', modelCallCount: 1 });
		}
		expect(validateKibbleLivePreview({ ...modelResponse(), presentationDecision: KIBBLE_HOME_DEFAULT_PRESENTATION }, expectation).ok).toBe(false);
		const missingHero = modelResponse();
		delete (missingHero.zoneArtifacts as Partial<typeof missingHero.zoneArtifacts>).hero;
		expect(validateKibbleLivePreview(missingHero, expectation).ok).toBe(false);
		const adjacent = modelResponse() as any;
		adjacent.zoneArtifacts['home.brand-spotlight'] = adjacent.zoneArtifacts.hero;
		expect(validateKibbleLivePreview(adjacent, expectation).ok).toBe(false);
		const tampered = modelResponse();
		tampered.zoneArtifacts.featured.content.props.products[0]!.productId = '999';
		expect(validateKibbleLivePreview(tampered, expectation).ok).toBe(false);
		const mismatchedCalls = modelResponse();
		mismatchedCalls.zoneArtifacts.hero.modelCallCount = 2;
		expect(validateKibbleLivePreview(mismatchedCalls, expectation).ok).toBe(false);
		expect(validateKibbleLivePreview({ ...modelResponse(), modelCallCount: 0 }, expectation).ok).toBe(false);
	});

	it('rejects a Home descriptor or provenance that understates the aggregate model boundary', () => {
		const missingZone = modelResponse() as any;
		missingZone.inspector.availableModelDecision = {
			...missingZone.inspector.availableModelDecision,
			zoneIds: ['home.hero', 'home.featured-row.1'],
		};
		expect(validateKibbleLivePreview(missingZone, expectation).ok).toBe(false);

		const missingCapability = modelResponse() as any;
		missingCapability.inspector.provenance.autonomy.effectiveCapabilities = ['rank_products', 'select_copy_variant', 'reorder_zones'];
		expect(validateKibbleLivePreview(missingCapability, expectation).ok).toBe(false);
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
		expect(expectationFromTrustedInspector(inspector, expectation.presentationContext)).toEqual(expectation);
		expect(validateKibbleLivePreview({
			...response(), inspector: { ...inspector, dataSourceLabel: 'merchant data' },
		}, expectation).ok).toBe(false);
		const provenance = inspector.provenance as Record<string, unknown>;
		expect(validateKibbleLivePreview({
			...response(), inspector: { ...inspector, provenance: { ...provenance, synthetic: { value: false, scenarioId: null } } },
		}, expectation).ok).toBe(false);
		expect(expectationFromTrustedInspector({ ...inspector, provenance: { ...provenance, synthetic: { value: false, scenarioId: 'fake' } } }, expectation.presentationContext)).toBeNull();
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
		const statuses: KibbleLivePreviewStatus[] = [];
		const snapshotPresentationDecision = vi.fn((decision) => snapshotKibbleHomePresentation(materializeKibbleHomePresentation(decision)));
		const cleanup = listenForKibbleLivePreview({
			expectation,
			getCurrentProductIds: () => products.map(({ id }) => id),
			getCurrentPresentation: () => snapshotKibbleHomePresentation(materializeKibbleHomePresentation(KIBBLE_HOME_DEFAULT_PRESENTATION)),
			snapshotPresentationDecision,
			onApplied: applied,
			onStatus: (status) => statuses.push(status),
		});

		expect(fetchMock).not.toHaveBeenCalled();
		eventTarget.dispatchEvent(new Event('aisles-kibble-model-request'));
		await vi.waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
		expect(fetchMock).toHaveBeenCalledWith('/api/kibble/home-decision?observe=true', expect.objectContaining({
			method: 'POST', body: JSON.stringify({ mode: 'model' }), headers: { 'Content-Type': 'application/json' },
		}));
		const appliedStatus = statuses.find((status) => status.state === 'applied');
		expect(snapshotPresentationDecision).toHaveBeenCalledWith({
			...KIBBLE_HOME_DEFAULT_PRESENTATION,
			heroCopyVariantId: 'visit-fast-path',
			catalogComponentVariantId: 'two-column',
		});
		expect(appliedStatus?.evidence?.copy).toContainEqual(expect.objectContaining({ id: 'home.hero', changed: true }));
			expect(appliedStatus?.evidence?.components).toContainEqual(expect.objectContaining({ id: 'home.editorial-strip', changed: true }));
		cleanup();
	});

	it('retains the actual provider count when a provider-backed 200 response fails validation', async () => {
		const eventTarget = new EventTarget();
		vi.stubGlobal('window', eventTarget);
		vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ...modelResponse(), version: 'tampered' }), {
			status: 200,
			headers: { 'content-type': 'application/json' },
		})));
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const statuses: KibbleLivePreviewStatus[] = [];
		const applied = vi.fn();
		const cleanup = listenForKibbleLivePreview({
			expectation,
			getCurrentProductIds: () => products.map(({ id }) => id),
			onApplied: applied,
			onStatus: (status) => statuses.push(status),
		});

		eventTarget.dispatchEvent(new Event('aisles-kibble-model-request'));
		await vi.waitFor(() => expect(statuses.at(-1)?.state).toBe('failed'));
		expect(applied).not.toHaveBeenCalled();
		expect(statuses.at(-1)?.evidence?.calls).toBe(1);
		cleanup();
	});

	it('ignores an older model response after a newer request replaces it', async () => {
		const eventTarget = new EventTarget();
		const pending: Array<(response: Response) => void> = [];
		vi.stubGlobal('window', eventTarget);
		vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve))));
		const applied = vi.fn();
		const cleanup = listenForKibbleLivePreview({
			expectation,
			getCurrentProductIds: () => products.map(({ id }) => id),
			getCurrentPresentation: () => snapshotKibbleHomePresentation(materializeKibbleHomePresentation(KIBBLE_HOME_DEFAULT_PRESENTATION)),
			onApplied: applied,
			onStatus: vi.fn(),
		});
		eventTarget.dispatchEvent(new Event('aisles-kibble-model-request'));
		eventTarget.dispatchEvent(new Event('aisles-kibble-model-request'));
		expect(fetch).toHaveBeenCalledTimes(2);
		pending[0]?.(new Response(JSON.stringify(modelResponse()), { status: 200, headers: { 'content-type': 'application/json' } }));
		await Promise.resolve();
		expect(applied).not.toHaveBeenCalled();
		pending[1]?.(new Response(JSON.stringify(modelResponse()), { status: 200, headers: { 'content-type': 'application/json' } }));
		await vi.waitFor(() => expect(applied).toHaveBeenCalledTimes(1));
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
