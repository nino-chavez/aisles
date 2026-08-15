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
		// A customer access token is server-to-server state and must not be sent to browser code.
		// Verified 2026-08-15 against:
		// https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/authentication
		// Order history also requires a signed-in customer context:
		// https://docs.bigcommerce.com/developer/docs/storefront/guides/graphql-storefront-api/orders
		orderCreation: 'not_exposed',
		orderHistory: 'customer_session_required',
		account: 'merchant_decision_required',
		payment: 'provider_owned',
		subscription: 'provider_not_connected',
		subscriptionPortal: 'portal_session_required',
	};
}

export function isKibbleCommerceEnabled(): boolean {
	return getCommerceServiceBoundary().mode === 'sandbox';
}
