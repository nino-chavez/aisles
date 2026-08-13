import { describe, expect, it, vi } from 'vitest';

const brandState = vi.hoisted(() => ({ id: 'kibble' }));
vi.mock('$lib/brand/config', () => ({
	getBrand: vi.fn(() => ({ organizationId: 'kibble-demo-merchant', id: brandState.id })),
}));

import { POST as layoutPost } from './api/layout/+server';
import { POST as streamPost } from './api/layout/stream/+server';
import { POST as refinePost } from './api/refine/+server';
import { load as checkoutLoad } from './checkout/+page.server';

function event(path: string) {
	return {
		request: new Request(`https://aisles.test${path}`, {
			method: 'POST',
			body: 'this body must not be parsed',
		}),
		cookies: { get: () => undefined },
	} as never;
}

describe('Kibble Preserve API authority boundary', () => {
	it.each([
		['layout', layoutPost, '/api/layout'],
		['stream layout', streamPost, '/api/layout/stream'],
		['refinement', refinePost, '/api/refine'],
	] as const)('rejects direct %s model requests before parsing browser input', async (_label, handler, path) => {
		const response = await handler(event(path));
		expect(response.status).toBe(503);
		expect(await response.json()).toMatchObject({ error: expect.stringContaining('reference-preserved') });
	});

	it('renders checkout as a Kibble-native unavailable state before the generic shell mounts', async () => {
		brandState.id = 'kibble';
		await expect(checkoutLoad({ url: new URL('https://aisles.test/checkout'), parent: async () => ({ renderMode: 'reference-preserve' }) } as never))
			.resolves.toMatchObject({ kibbleCheckout: { subtype: 'checkout', availabilityMessage: expect.stringContaining('No checkout service') } });
		brandState.id = 'haven';
		expect(await checkoutLoad({ url: new URL('https://aisles.test/checkout'), parent: async () => ({ renderMode: 'legacy-generated' }) } as never)).toEqual({ renderMode: 'legacy-generated' });
		brandState.id = 'kibble';
	});
});
