import { describe, expect, it, vi } from 'vitest';
import { POST } from './+server';
import { MERCHANT_TIER_COOKIE } from '$lib/server/merchant-tier';

function formRequest(fields: Record<string, string>): Request {
	const body = new URLSearchParams(fields);
	return new Request('https://kibble.example/api/merchant-tier', {
		method: 'POST',
		headers: { 'content-type': 'application/x-www-form-urlencoded' },
		body: body.toString(),
	});
}

function mockCookies() {
	return {
		set: vi.fn(),
		delete: vi.fn(),
	};
}

describe('POST /api/merchant-tier', () => {
	it('sets the tier cookie and redirects back to the submitted page', async () => {
		const cookies = mockCookies();
		const request = formRequest({ tier: 'enterprise', redirectTo: '/category/dog-food' });
		await expect(POST({ request, cookies } as never)).rejects.toMatchObject({ status: 303, location: '/category/dog-food' });
		expect(cookies.set).toHaveBeenCalledWith(MERCHANT_TIER_COOKIE, 'enterprise', expect.objectContaining({ path: '/' }));
		expect(cookies.delete).not.toHaveBeenCalled();
	});

	it('rejects an invalid tier by clearing the cookie instead of setting it', async () => {
		const cookies = mockCookies();
		const request = formRequest({ tier: 'giant', redirectTo: '/' });
		await expect(POST({ request, cookies } as never)).rejects.toMatchObject({ status: 303 });
		expect(cookies.set).not.toHaveBeenCalled();
		expect(cookies.delete).toHaveBeenCalledWith(MERCHANT_TIER_COOKIE, { path: '/' });
	});

	it('falls back to / when redirectTo is missing or not a local path', async () => {
		const cookies = mockCookies();
		const request = formRequest({ tier: 'small', redirectTo: 'https://evil.example/phish' });
		await expect(POST({ request, cookies } as never)).rejects.toMatchObject({ status: 303, location: '/' });
	});
});
