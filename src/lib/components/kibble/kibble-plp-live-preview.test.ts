import { describe, expect, it } from 'vitest';
import { validateKibblePlpLivePreview } from './kibble-plp-live-preview';
import type { KibbleProduct } from './types';

const products: KibbleProduct[] = Array.from({ length: 10 }, (_, index) => ({ id: `food-${index + 1}`, entityId: index + 1, name: `Food ${index + 1}`, price: index + 10, image: '', imageAlt: '', description: '', specs: {}, tags: [], category: 'Dog Food' }));
const expected = { routePath: '/category/dog-food' as const, sort: 'FEATURED' as const, cursor: null, policyVersion: 'plp-assist-v1', reference: { id: 'kibble-shelf-native', version: '1.8.0' }, prefixIds: products.slice(0, 8).map(({ entityId }) => String(entityId)), tailIds: ['9', '10'] };
function response(ids = [...expected.prefixIds].reverse()) {
	return { version: 'kibble-plp-first-eight-preview-v1', previewOnly: true, routePath: expected.routePath, sort: expected.sort, cursor: null, policyVersion: expected.policyVersion, reference: expected.reference, prefixIds: expected.prefixIds, tailIds: expected.tailIds, rankedPrefixIds: ids, modelCallCount: 1, provenance: {}, zoneAdapter: { instanceId: 'plp.product-ranking', sharedStatus: 'live', sharedContentKind: 'content', decisionMode: 'model', modelCallCount: 1, adapterId: 'kibble.zone.plp.product-ranking', componentVariantId: 'kibble.category-listing.ranked-prefix', inputSha256: 'a'.repeat(64), content: { component: 'product-grid', props: { columns: 4, products: ids.map((productId) => ({ productId, role: 'standard' })), imageRatio: 'square', showDescription: false, showSpecs: false, showQuickAdd: false } } } };
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
		if (kind === 'component') invalid.zoneAdapter.content.component = 'product-carousel';
		if (kind === 'props') invalid.zoneAdapter.content.props.showQuickAdd = true;
		if (kind === 'product') invalid.zoneAdapter.content.props.products[0]!.productId = '9';
		expect(validateKibblePlpLivePreview(invalid, expected, products)).toBeNull();
	});
	it('rejects an adjacent sort, cursor, or tail substitution', () => {
		const wrongSort = response() as any; wrongSort.sort = 'NEWEST'; expect(validateKibblePlpLivePreview(wrongSort, expected, products)).toBeNull();
		const wrongCursor = response() as any; wrongCursor.cursor = 'cursor'; expect(validateKibblePlpLivePreview(wrongCursor, expected, products)).toBeNull();
		const wrongTail = response(); wrongTail.tailIds = ['10', '9']; expect(validateKibblePlpLivePreview(wrongTail, expected, products)).toBeNull();
	});
});
