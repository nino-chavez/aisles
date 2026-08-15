import { afterEach, describe, expect, it, vi } from 'vitest';
import { hashKibblePlpRankingInput } from '$lib/brand/reference/kibble-plp-ranking-boundary.server';
import { listenForKibblePlpLivePreview, validateKibblePlpLivePreview } from './kibble-plp-live-preview';
import type { KibbleProduct } from './types';
import type { KibbleLivePreviewStatus } from './kibble-dev-inspector';
import { KIBBLE_PLP_DEFAULT_PRESENTATION, KIBBLE_PLP_PRESENTATION_POLICY, materializeKibblePlpPresentation, snapshotKibblePlpPresentation } from '$lib/brand/reference/kibble-presentation-decisions';

const products: KibbleProduct[] = Array.from({ length: 10 }, (_, index) => ({ id: `food-${index + 1}`, entityId: index + 1, name: `Food ${index + 1}`, price: index + 10, image: '', imageAlt: '', description: '', specs: {}, tags: [], category: 'Dog Food' }));
const expected = { routePath: '/category/dog-food' as const, sort: 'FEATURED' as const, cursor: null, policyVersion: 'plp-assist-v1', reference: { id: 'kibble-shelf-native', version: '1.8.0' }, prefixIds: products.slice(0, 8).map(({ entityId }) => String(entityId)), tailIds: ['9', '10'], expectedInputSha256: hashKibblePlpRankingInput(products.slice(0, 8).map(({ entityId }) => String(entityId)), ['9', '10'], '/category/dog-food'), title: 'Dog Food', productCount: 10, productSingular: 'product', productPlural: 'products' };
function response(ids = [...expected.prefixIds].reverse()) {
	const presentation = materializeKibblePlpPresentation(KIBBLE_PLP_DEFAULT_PRESENTATION, expected);
	return {
		version: 'kibble-plp-presentation-preview-v2', previewOnly: true, routePath: expected.routePath, sort: expected.sort, cursor: null,
		policyVersion: expected.policyVersion, reference: expected.reference, prefixIds: expected.prefixIds, tailIds: expected.tailIds,
		rankedPrefixIds: ids, presentationPolicy: KIBBLE_PLP_PRESENTATION_POLICY, modelCallCount: 1,
		provider: 'anthropic', modelId: 'claude-haiku-4-5', persona: 'hunter', provenance: {},
		zoneArtifacts: {
			header: {
				instanceId: 'plp.editorial-header', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 1,
				adapterId: 'kibble.zone.plp.editorial-header', componentVariantId: 'kibble.category-listing.editorial-header', inputSha256: 'b'.repeat(64),
				selection: { componentVariantId: 'kibble.category-listing.editorial-header', copyVariantId: KIBBLE_PLP_DEFAULT_PRESENTATION.headerCopyVariantId },
				content: { component: 'editorial-header', props: { eyebrow: presentation.header.eyebrow, headline: presentation.header.title, body: presentation.header.body } },
			},
			ranking: {
				instanceId: 'plp.product-ranking', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 1,
				adapterId: 'kibble.zone.plp.product-ranking', componentVariantId: 'kibble.category-listing.ranked-prefix', inputSha256: hashKibblePlpRankingInput(expected.prefixIds, expected.tailIds, expected.routePath),
				selection: { componentVariantId: 'kibble.category-listing.ranked-prefix' },
				content: { component: 'product-grid', props: { columns: 4, products: ids.map((productId) => ({ productId, role: 'standard' })), imageRatio: 'square', showDescription: false, showSpecs: false, showQuickAdd: false } },
			},
			marketing: {
				instanceId: 'plp.marketing-block', sharedStatus: 'live', sharedContentKind: 'hidden', decisionMode: 'model', modelCallCount: 1,
				adapterId: 'kibble.zone.plp.marketing-block', componentVariantId: 'kibble.hero.zone-editorial-header', inputSha256: 'c'.repeat(64),
				selection: { componentVariantId: 'kibble.hero.zone-editorial-header', copyVariantId: 'none', visible: false },
			},
		},
	};
}

describe('Kibble PLP live preview validation', () => {
	it('permutes only the first eight and retains the two-product tail', () => {
		const preview = validateKibblePlpLivePreview(response(), expected, products);
		expect(preview?.products.map(({ entityId }) => entityId)).toEqual([8, 7, 6, 5, 4, 3, 2, 1, 9, 10]);
	});
	it.each([['duplicate', ['8', '8', '6', '5', '4', '3', '2', '1']], ['missing', ['8', '7']], ['extra', ['8', '7', '6', '5', '4', '3', '2', '1', '99']], ['unknown', ['8', '7', '6', '5', '4', '3', '2', '99']]])('rejects %s prefix IDs without changing the full server order', (_label, ids) => {
		const snapshot = structuredClone(products); expect(validateKibblePlpLivePreview(response(ids), expected, products)).toBeNull(); expect(products).toEqual(snapshot);
	});
	it.each(['component', 'props', 'product'])('rejects a tampered adapter %s', (kind) => {
		const invalid = response();
		if (kind === 'component') invalid.zoneArtifacts.ranking.content.component = 'product-carousel';
		if (kind === 'props') invalid.zoneArtifacts.ranking.content.props.showQuickAdd = true;
		if (kind === 'product') invalid.zoneArtifacts.ranking.content.props.products[0]!.productId = '9';
		expect(validateKibblePlpLivePreview(invalid, expected, products)).toBeNull();
	});
	it('rejects the old aggregate decision shape and hidden artifacts with content', () => {
		expect(validateKibblePlpLivePreview({ ...response(), presentationDecision: KIBBLE_PLP_DEFAULT_PRESENTATION }, expected, products)).toBeNull();
		const missing = response() as any;
		delete missing.zoneArtifacts.header;
		expect(validateKibblePlpLivePreview(missing, expected, products)).toBeNull();
		const adjacent = response() as any;
		adjacent.zoneArtifacts['plp.below-grid'] = adjacent.zoneArtifacts.marketing;
		expect(validateKibblePlpLivePreview(adjacent, expected, products)).toBeNull();
		const invalid = response() as any;
		invalid.zoneArtifacts.marketing.content = { component: 'editorial-header', props: { eyebrow: '', headline: '', body: '' } };
		expect(validateKibblePlpLivePreview(invalid, expected, products)).toBeNull();
	});
	it('rejects an adjacent sort, cursor, or tail substitution', () => {
		const wrongSort = response() as any; wrongSort.sort = 'NEWEST'; expect(validateKibblePlpLivePreview(wrongSort, expected, products)).toBeNull();
		const wrongCursor = response() as any; wrongCursor.cursor = 'cursor'; expect(validateKibblePlpLivePreview(wrongCursor, expected, products)).toBeNull();
		const wrongTail = response(); wrongTail.tailIds = ['10', '9']; expect(validateKibblePlpLivePreview(wrongTail, expected, products)).toBeNull();
	});
	it('rejects an adapter digest that does not bind this server-owned route input', () => {
		const invalid = response(); invalid.zoneArtifacts.ranking.inputSha256 = 'a'.repeat(64);
		expect(validateKibblePlpLivePreview(invalid, expected, products)).toBeNull();
	});
	it('accepts a valid model response that retains the current first-eight order', () => {
		const preview = validateKibblePlpLivePreview(response([...expected.prefixIds]), expected, products);
		expect(preview?.products.map(({ entityId }) => entityId)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
	});
});

describe('Kibble PLP live preview request lifecycle', () => {
	afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
	it('marks a stalled request failed and releases the duplicate-dispatch lock', async () => {
		vi.useFakeTimers();
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const listeners = new EventTarget();
		vi.stubGlobal('window', Object.assign(listeners, { setTimeout, clearTimeout }));
		vi.stubGlobal('fetch', vi.fn((_url, init: RequestInit) => new Promise((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))))));
		const statuses: KibbleLivePreviewStatus[] = [];
		const stop = listenForKibblePlpLivePreview({ expectation: expected, products, getCurrentPresentation: () => snapshotKibblePlpPresentation(materializeKibblePlpPresentation(KIBBLE_PLP_DEFAULT_PRESENTATION, expected)), onApplied: () => {}, onStatus: (status) => statuses.push(status) });
		window.dispatchEvent(new Event('aisles-kibble-plp-model-request'));
		await vi.advanceTimersByTimeAsync(15_000);
		expect(statuses).toEqual([{ state: 'updating', mode: 'model' }, { state: 'failed', mode: 'model', evidence: expect.objectContaining({ state: 'failed', fallback: true }) }]);
		window.dispatchEvent(new Event('aisles-kibble-plp-model-request'));
		expect(fetch).toHaveBeenCalledTimes(2);
		stop();
	});
});
