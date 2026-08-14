import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBrand } from '$lib/brand/config';
import { getKibbleCommerceMode, KibbleCommerceError, registerKibbleCustomer } from '$lib/server/kibble-commerce';
import { hasKibbleCommerceSessionStorage } from '$lib/server/kibble-commerce-session';

function validField(value: unknown, max: number): value is string {
	return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

export const POST: RequestHandler = async ({ request, url }) => {
	if (getBrand().id !== 'kibble') return json({ error: 'Account is unavailable.' }, { status: 404 });
	if (getKibbleCommerceMode() === 'off') return json({ error: 'Account services are unavailable in this preview.' }, { status: 503 });
	if (getKibbleCommerceMode() === 'live' && !hasKibbleCommerceSessionStorage()) return json({ error: 'Account services are not configured for this environment.' }, { status: 503 });
	const origin = request.headers.get('origin');
	if (origin && origin !== url.origin) return json({ error: 'Invalid account request origin.' }, { status: 403 });
	try {
		const body = await request.json() as Record<string, unknown>;
		const input = {
			firstName: typeof body.firstName === 'string' ? body.firstName.trim() : '',
			lastName: typeof body.lastName === 'string' ? body.lastName.trim() : '',
			email: typeof body.email === 'string' ? body.email.trim() : '',
			password: typeof body.password === 'string' ? body.password : '',
		};
		if (!validField(input.firstName, 64) || !validField(input.lastName, 64) || !/^\S+@\S+\.\S+$/.test(input.email) || input.email.length > 254 || input.password.length < 1 || input.password.length > 256) {
			return json({ error: 'Enter your name, a valid email address, and a password.' }, { status: 400 });
		}
		const result = await registerKibbleCustomer(input);
		if (result.errors.length > 0 || !result.customer) {
			const emailInUse = result.errors.some((message) => /email.*(use|exist)/i.test(message));
			return json({ error: emailInUse ? 'That email address is already in use.' : 'We could not create your account. Check your details and try again.' }, { status: 400 });
		}
		return json({ customer: result.customer, next: '/account/login' });
	} catch (error) {
		const status = error instanceof KibbleCommerceError ? error.status : 502;
		console.warn('[kibble-account] Registration failed:', error instanceof Error ? error.message : error);
		return json({ error: status === 400 ? 'We could not create your account.' : 'Account services are temporarily unavailable.' }, { status });
	}
};
