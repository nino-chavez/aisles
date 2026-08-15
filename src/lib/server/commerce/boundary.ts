import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import type { CommerceServiceBoundary } from '$lib/commerce/cart-contract';

export function getCommerceServiceBoundary(): CommerceServiceBoundary {
	const providerConfigured = Boolean(
		env.BIGCOMMERCE_STORE_HASH &&
		(env.KIBBLE_STOREFRONT_TOKEN || env.BIGCOMMERCE_STOREFRONT_TOKEN),
	);
	const durableSessionConfigured = dev || Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
	const enabled =
		getBrand().id === 'kibble' &&
		env.KIBBLE_COMMERCE_MODE === 'sandbox' &&
		providerConfigured &&
		durableSessionConfigured;
	return {
		mode: enabled ? 'sandbox' : 'off',
		cart: enabled ? 'bigcommerce_sandbox' : 'not_connected',
		checkout: enabled ? 'bigcommerce_hosted_handoff' : 'not_connected',
		orderCreation: 'not_exposed',
		account: 'not_configured',
		payment: 'provider_owned',
		subscription: 'not_configured',
	};
}

export function isKibbleCommerceEnabled(): boolean {
	return getCommerceServiceBoundary().mode === 'sandbox';
}
