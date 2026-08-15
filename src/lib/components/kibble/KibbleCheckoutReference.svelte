<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleZoneAdapterBinding } from './types';
	import type { CommerceServiceBoundary } from '$lib/commerce/cart-contract';

	type CheckoutSubtype = 'gift' | 'prepaid' | 'confirmation';
	let {
		subtype, availabilityMessage, policyVersion, assuranceZoneAdapter = null, checkoutModelDecision = null, presentationModelCallCount = 0,
		services = { mode: 'off', cart: 'not_connected', checkout: 'not_connected', orderCreation: 'not_exposed', orderHistory: 'customer_session_required', account: 'merchant_decision_required', payment: 'provider_owned', subscription: 'provider_not_connected', subscriptionPortal: 'portal_session_required' },
	}: {
		subtype: CheckoutSubtype; availabilityMessage: string; policyVersion?: string;
		assuranceZoneAdapter?: KibbleZoneAdapterBinding<any> | null;
		checkoutModelDecision?: { zoneId: 'checkout.assurance-strip'; routePath: '/checkout/gift' | '/checkout/prepaid'; policyVersion: string } | null;
		presentationModelCallCount?: number;
		services?: CommerceServiceBoundary;
	} = $props();

	const heading = $derived(subtype === 'gift' ? 'Give as a gift' : subtype === 'prepaid' ? 'Pay upfront' : 'Order confirmation');
</script>

<div class="kibble-reference kc-reference-route kc-reference-checkout-page" data-kibble-route-shell="checkout" data-kibble-route-policy={policyVersion} data-kibble-checkout-subtype={subtype} aria-labelledby="kibble-checkout-heading">
	{#if subtype === 'confirmation'}
		<div class="kc-reference-container kc-reference-checkout-page__confirmation" data-kibble-backend-state={services.orderHistory} data-kibble-order-creation-state={services.orderCreation}>
			<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb"><a class="kc-reference-focus" href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">Order confirmation</span></nav>
			<div class="kc-reference-checkout-page__confirmation-body">
				<h1 id="kibble-checkout-heading">Order confirmation unavailable</h1>
				<p>{availabilityMessage}</p>
				<p class="kc-reference-route__supporting">No order was read or represented as confirmed.</p>
				<div class="kc-checkout-boundary" aria-label="Order connection status">
					<p><strong>Order creation:</strong> no Aisles endpoint.</p>
					<p><strong>Order history:</strong> requires a signed-in customer session.</p>
					<p><strong>Subscription reconciliation:</strong> provider not connected.</p>
				</div>
				<a class="kc-reference-button kc-reference-button--primary kc-reference-focus" href="/">Continue shopping</a>
			</div>
		</div>
	{:else}
		<div class="kc-reference-checkout-page__column">
			<div class="kc-reference-checkout-page__card" data-kibble-backend-state={services.subscription} data-kibble-checkout-state={services.checkout} data-kibble-payment-state={services.payment}>
				<h1 id="kibble-checkout-heading">{heading}</h1>
				<p>{availabilityMessage}</p>
				<section class="kc-checkout-boundary" aria-label="Checkout connection status">
					<p><strong>One-time hosted checkout:</strong> {services.checkout === 'bigcommerce_hosted_handoff' ? 'connected from the cart.' : 'not connected.'}</p>
					<p><strong>{subtype === 'gift' ? 'Gift' : 'Prepaid'} checkout:</strong> blocked until identity, subscription plan, and payment-adapter decisions are complete.</p>
					<p><strong>Payment:</strong> provider-owned; no credentials enter Aisles.</p>
					<a class="kc-reference-route__text-link kc-reference-focus" href="/cart">Return to the one-time cart</a>
				</section>
				{#if assuranceZoneAdapter}
					<section id="kibble-checkout-assurance-strip" tabindex="-1" class="kc-reference-checkout-page__assurance" data-kibble-zone-instance={assuranceZoneAdapter.instanceId} data-kibble-zone-status={assuranceZoneAdapter.sharedStatus} data-kibble-zone-content-kind={assuranceZoneAdapter.sharedContentKind} data-kibble-zone-adapter={assuranceZoneAdapter.adapterId} data-kibble-zone-variant={assuranceZoneAdapter.componentVariantId} data-kibble-zone-input-sha256={assuranceZoneAdapter.inputSha256} data-aisles-zone-instance={assuranceZoneAdapter.instanceId} data-aisles-zone-label="Checkout assurance" data-aisles-authority={presentationModelCallCount > 0 ? 'model' : (assuranceZoneAdapter.decisionMode ?? 'fixed')} data-aisles-model-calls={presentationModelCallCount} data-aisles-model-eligible={checkoutModelDecision ? 'true' : undefined} data-aisles-checkout-model-eligible={checkoutModelDecision ? 'true' : undefined}>
						{#each assuranceZoneAdapter.content.props.callouts as callout}
							<div><strong>{callout.label}</strong><p>{callout.body}</p></div>
						{/each}
					</section>
				{/if}

				{#if subtype === 'gift'}
					<div class="kc-reference-checkout-page__plan-box">
						<label>How many deliveries to gift?<input type="number" min="1" disabled /></label>
						<label>Recipient's email<input type="email" placeholder="recipient@example.com" disabled /></label>
						<p>Plan details unavailable — no product or plan was loaded.</p>
					</div>
					<p class="kc-reference-checkout-page__signin-copy">Sign-in and purchase controls are unavailable.</p>
					<form class="kc-reference-disabled-form" aria-label="Gift purchase unavailable">
						<label class="kc-reference-sr-only" for="kibble-gift-email">Email address</label>
						<input id="kibble-gift-email" type="email" placeholder="you@example.com" disabled />
						<button type="button" disabled>Email sign-in unavailable</button>
					</form>
				{:else if subtype === 'prepaid'}
					<div class="kc-reference-checkout-page__plan-box">
						<label>How many deliveries to prepay?<input type="number" min="2" max="24" disabled /></label>
						<p>Plan details unavailable — no plan, savings, or total was loaded.</p>
					</div>
					<p class="kc-reference-checkout-page__signin-copy">Sign-in and purchase controls are unavailable.</p>
					<form class="kc-reference-disabled-form" aria-label="Prepaid purchase unavailable">
						<label class="kc-reference-sr-only" for="kibble-prepaid-email">Email address</label>
						<input id="kibble-prepaid-email" type="email" placeholder="you@example.com" disabled />
						<button type="button" disabled>Email sign-in unavailable</button>
					</form>
				{:else}
					<button class="kc-reference-disabled-action" type="button" disabled>Checkout unavailable</button>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.kc-checkout-boundary { margin:1rem 0; border:1px solid var(--kc-border-strong); background:var(--kc-panel); padding:1rem; }
	.kc-checkout-boundary p { margin:.35rem 0; color:var(--kc-muted-text); line-height:1.5; }
	.kc-checkout-boundary strong { color:var(--kc-identity); }
	.kc-checkout-boundary a { margin-top:.55rem; }
</style>
