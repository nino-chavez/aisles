import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ createStoreFromRequest: vi.fn(), search: vi.fn() }));
vi.mock('$env/dynamic/private', () => ({ env: { KIBBLE_DEMO_AI_ENABLED: 'true' } }));
vi.mock('$lib/signals/request', () => ({ createStoreFromRequest: mocks.createStoreFromRequest }));
vi.mock('$lib/brand/reference/kibble-search.server', async (importOriginal) => ({
	...await importOriginal<typeof import('$lib/brand/reference/kibble-search.server')>(),
	searchKibbleCatalog: mocks.search,
}));

import { load as loadSearch } from './search/+page.server';
import { load as loadCart } from './cart/+page.server';
import { load as loadCheckout } from './checkout/[subtype]/+page.server';

const parent = async () => ({ renderMode: 'reference-preserve' as const, observeMode: true, devMode: false });
const cookies = { get: () => undefined, set: vi.fn() };
const request = new Request('https://aisles.test/', { headers: { 'user-agent': 'test' } });

describe('Kibble direct-entry AI sessions', () => {
	beforeEach(() => {
		process.env.BRAND_ID = 'kibble';
		mocks.createStoreFromRequest.mockReset().mockResolvedValue({ store: {}, visitCount: 1 });
		mocks.search.mockReset().mockResolvedValue({
			products: [], pageInfo: { hasNextPage: false, hasPreviousPage: false, startCursor: null, endCursor: null },
			provenance: { referenceId: 'kibble-shelf-native', referenceVersion: '1.8.0', source: 'live-storefront', query: 'none', cursor: null, pageSize: 24, catalogSha256: 'a'.repeat(64), resultSha256: 'b'.repeat(64) },
		});
	});

	it('persists inference context when a prospect lands directly on search, cart, or checkout', async () => {
		await loadSearch({ url: new URL('https://aisles.test/search?q=none&observe=true'), request, cookies, parent, setHeaders: vi.fn() } as never);
		await loadCart({ url: new URL('https://aisles.test/cart?observe=true'), request, cookies, parent } as never);
		await loadCheckout({ params: { subtype: 'prepaid' }, url: new URL('https://aisles.test/checkout/prepaid?observe=true'), request, cookies, parent } as never);

		expect(mocks.createStoreFromRequest).toHaveBeenCalledTimes(3);
		expect(mocks.createStoreFromRequest).toHaveBeenNthCalledWith(1, expect.objectContaining({ category: 'search' }));
		expect(mocks.createStoreFromRequest).toHaveBeenNthCalledWith(2, expect.objectContaining({ category: 'cart' }));
		expect(mocks.createStoreFromRequest).toHaveBeenNthCalledWith(3, expect.objectContaining({ category: 'checkout' }));
	});
});
