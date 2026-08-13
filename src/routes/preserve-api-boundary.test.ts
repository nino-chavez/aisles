import { describe, expect, it, vi } from 'vitest';

vi.mock('$lib/brand/config', () => ({
	getBrand: vi.fn(() => ({ organizationId: 'kibble-demo-merchant', id: 'kibble' })),
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

	it('rejects checkout on the server before the generic shell mounts', async () => {
		await expect(checkoutLoad({ parent: async () => ({ chromeMode: 'reference' }) } as never))
			.rejects.toMatchObject({ status: 503 });
		expect(await checkoutLoad({ parent: async () => ({ chromeMode: 'legacy' }) } as never)).toEqual({});
	});
});
