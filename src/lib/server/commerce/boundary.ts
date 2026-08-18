import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getBrand } from '$lib/brand/config';
import type { CommerceServiceBoundary } from '$lib/commerce/cart-contract';

export function getCommerceServiceBoundary(): CommerceServiceBoundary {
	const providerConfigured = Boolean(
		env.BIGCOMMERCE_STORE_HASH &&
		(env.BIGCOMMERCE_PRIVATE_TOKEN || env.KIBBLE_STOREFRONT_TOKEN || env.BIGCOMMERCE_STOREFRONT_TOKEN),
	);
	const durableSessionConfigured = dev || Boolean(env.KV_REST_API_URL && env.KV_REST_API_TOKEN);
	const enabled =
		getBrand().id === 'kibble' &&
		env.KIBBLE_COMMERCE_MODE === 'sandbox' &&
		providerConfigured &&
		durableSessionConfigured;
	const bigCommerceIdentitySelected = env.KIBBLE_CUSTOMER_IDENTITY_MODE === 'bigcommerce';
	const customerPrivateTokenConfigured = Boolean(env.BIGCOMMERCE_PRIVATE_TOKEN);
	const account = !bigCommerceIdentitySelected
		? 'merchant_decision_required'
		: !customerPrivateTokenConfigured || !enabled
			? 'private_token_required'
			: 'bigcommerce_login_ready';
	const subscriptionPlansReady = enabled && env.KIBBLE_SUBSCRIPTION_MODE === 'sandbox';
	const subscriptionPortal = !subscriptionPlansReady
		? 'provider_not_connected'
		: !env.SSO_HANDOFF_SECRET
			? 'handoff_secret_required'
			: 'portal_session_required';
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
		account,
		payment: 'provider_owned',
		subscription: !subscriptionPlansReady
			? 'provider_not_connected'
			: account === 'bigcommerce_login_ready'
				? 'authenticated_intent_ready'
				: 'plan_lookup_ready',
		subscriptionPortal,
	};
}

export function isKibbleCommerceEnabled(): boolean {
	return getCommerceServiceBoundary().mode === 'sandbox';
}

export function isKibbleCustomerIdentityEnabled(): boolean {
	return getCommerceServiceBoundary().account === 'bigcommerce_login_ready';
}

export function isKibbleSubscriptionPlanLookupEnabled(): boolean {
	return getCommerceServiceBoundary().subscription !== 'provider_not_connected';
}

export function isKibbleSubscriptionIntentEnabled(): boolean {
	return getCommerceServiceBoundary().subscription === 'authenticated_intent_ready';
}
