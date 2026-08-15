<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleZoneAdapterBinding } from './types';
	import type { CommerceCart, CommerceServiceBoundary } from '$lib/commerce/cart-contract';

	let {
		availabilityMessage, policyVersion, zoneAdapter, cartModelDecision = null, presentationModelCallCount = 0,
		cart: initialCart = null,
		cartStatus: initialCartStatus = 'unavailable',
		services = { mode: 'off', cart: 'not_connected', checkout: 'not_connected', orderCreation: 'not_exposed', orderHistory: 'customer_session_required', account: 'merchant_decision_required', payment: 'provider_owned', subscription: 'provider_not_connected', subscriptionPortal: 'portal_session_required' },
	}: {
		availabilityMessage: string; policyVersion?: string; zoneAdapter?: KibbleZoneAdapterBinding<any> | null;
		cartModelDecision?: { zoneId: 'cart.empty-state'; routePath: '/cart'; policyVersion: string } | null;
		presentationModelCallCount?: number;
		cart?: CommerceCart | null;
		cartStatus?: 'ready' | 'empty' | 'unavailable';
		services?: CommerceServiceBoundary;
	} = $props();

	const initialCartState = () => initialCart;
	let cart = $state<CommerceCart | null>(initialCartState());
	let cartStatus = $state(initialCartStatus);
	let pending = $state<string | null>(null);
	let operationError = $state('');
	const operationIdempotencyKeys = new Map<string, string>();
	let checkoutIdempotencyKey: string | null = null;
	const retainIdempotencyKeyFor = new Set(['provider_outcome_unknown', 'session_unavailable', 'operation_in_progress']);

	function money(value: number, currencyCode: string): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: currencyCode || 'USD' }).format(value);
	}

	async function changeLine(lineId: string, quantity: number) {
		await cartRequest(`/api/cart/lines/${encodeURIComponent(lineId)}`, 'PATCH', { quantity }, `update:${lineId}:${quantity}`);
	}

	async function removeLine(lineId: string) {
		await cartRequest(`/api/cart/lines/${encodeURIComponent(lineId)}`, 'DELETE', undefined, `remove:${lineId}`);
	}

	async function emptyCart() {
		await cartRequest('/api/cart', 'DELETE', undefined, 'empty');
	}

	async function cartRequest(path: string, method: 'PATCH' | 'DELETE', body: object | undefined, operationKey: string) {
		const idempotencyKey = operationIdempotencyKeys.get(operationKey) ?? crypto.randomUUID();
		operationIdempotencyKeys.set(operationKey, idempotencyKey);
		pending = operationKey;
		operationError = '';
		try {
			const response = await fetch(path, {
				method,
				headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), 'Idempotency-Key': idempotencyKey },
				...(body ? { body: JSON.stringify(body) } : {}),
			});
			const result = await response.json();
			if (result.evidence) window.dispatchEvent(new CustomEvent('commerce-service-outcome', { detail: result.evidence }));
			if (!response.ok || result.evidence?.confirmed !== true) {
				if (!retainIdempotencyKeyFor.has(result.error?.code)) operationIdempotencyKeys.delete(operationKey);
				throw new Error(result.error?.message || 'BigCommerce did not confirm the cart change.');
			}
			operationIdempotencyKeys.delete(operationKey);
			cart = result.cart;
			cartStatus = result.cart ? 'ready' : 'empty';
			window.dispatchEvent(new CustomEvent('cart-updated', { detail: { itemCount: result.itemCount } }));
		} catch (cause) {
			operationError = cause instanceof Error ? cause.message : 'The cart could not be changed.';
		} finally {
			pending = null;
		}
	}

	async function continueToCheckout() {
		checkoutIdempotencyKey ??= crypto.randomUUID();
		pending = 'checkout';
		operationError = '';
		try {
			const response = await fetch('/api/checkout/redirect', {
				method: 'POST',
				headers: { 'Idempotency-Key': checkoutIdempotencyKey },
			});
			const result = await response.json();
			if (result.evidence) window.dispatchEvent(new CustomEvent('commerce-service-outcome', { detail: result.evidence }));
			if (!response.ok || result.evidence?.confirmed !== true || typeof result.redirectUrl !== 'string') {
				if (!retainIdempotencyKeyFor.has(result.error?.code)) checkoutIdempotencyKey = null;
				throw new Error(result.error?.message || 'BigCommerce did not confirm checkout handoff.');
			}
			window.location.assign(result.redirectUrl);
		} catch (cause) {
			operationError = cause instanceof Error ? cause.message : 'Hosted checkout is temporarily unavailable.';
			pending = null;
		}
	}
</script>

<div class="kibble-reference kc-reference-route kc-reference-cart-page" data-kibble-route-shell="cart" data-kibble-route-policy={policyVersion} aria-labelledby="kibble-cart-heading">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			<a class="kc-reference-focus" href="/">Home</a>
			<span aria-hidden="true">/</span>
			<span aria-current="page">Cart</span>
		</nav>
		<header class="kc-reference-route__header">
			<h1 id="kibble-cart-heading" class="kc-reference-display">Your cart</h1>
		</header>
		{#if cart && cart.lines.length > 0}
			<div class="kc-reference-cart" data-kibble-backend-state="bigcommerce-sandbox" data-cart-version={cart.version}>
				<ul class="kc-reference-cart__lines" aria-label="Cart items">
					{#each cart.lines as line (line.lineId)}
						<li>
							{#if line.imageUrl}<img src={line.imageUrl} alt="" width="112" height="112" loading="lazy" />{/if}
							<div class="kc-reference-cart__line-copy">
								<a class="kc-reference-focus" href={line.productPath}><strong>{line.name}</strong></a>
								<span>{money(line.unitPrice.value, line.unitPrice.currencyCode)} each</span>
								<div class="kc-reference-cart__quantity" aria-label={line.isMutable ? undefined : `${line.name} quantity cannot be changed`}>
									<button type="button" class="kc-reference-focus" aria-label={`Decrease ${line.name} quantity`} disabled={!line.isMutable || pending !== null || line.quantity <= 1} onclick={() => changeLine(line.lineId, line.quantity - 1)}>−</button>
									<output aria-label={`${line.name} quantity`}>{line.quantity}</output>
									<button type="button" class="kc-reference-focus" aria-label={`Increase ${line.name} quantity`} disabled={!line.isMutable || pending !== null || line.quantity >= 99} onclick={() => changeLine(line.lineId, line.quantity + 1)}>+</button>
								</div>
								<button type="button" class="kc-reference-cart__remove kc-reference-focus" disabled={!line.isMutable || pending !== null} onclick={() => removeLine(line.lineId)}>Remove</button>
							</div>
							<strong>{money(line.extendedPrice.value, line.extendedPrice.currencyCode)}</strong>
						</li>
					{/each}
				</ul>
				<aside class="kc-reference-cart__summary" aria-label="Cart summary">
					<dl>
						<div><dt>Subtotal</dt><dd>{money(cart.subtotal.value, cart.subtotal.currencyCode)}</dd></div>
						<div><dt>Current total</dt><dd>{money(cart.total.value, cart.total.currencyCode)}</dd></div>
					</dl>
					<p>Final tax, shipping, discounts, payment, and order creation belong to BigCommerce hosted checkout.</p>
					<button type="button" class="kc-reference-button kc-reference-button--primary kc-reference-focus" disabled={pending !== null || services.checkout !== 'bigcommerce_hosted_handoff'} onclick={continueToCheckout}>{pending === 'checkout' ? 'Opening checkout…' : 'Continue to secure checkout'}</button>
					<button type="button" class="kc-reference-cart__empty-button kc-reference-focus" disabled={pending !== null} onclick={emptyCart}>Empty cart</button>
				</aside>
			</div>
		{:else}
		<div class="kc-reference-route__empty" data-kibble-backend-state={cartStatus}>
			<p>{availabilityMessage}</p>
			{#if zoneAdapter}
				<section id="kibble-cart-empty-state" tabindex="-1" data-kibble-zone-instance={zoneAdapter.instanceId} data-kibble-zone-status={zoneAdapter.sharedStatus} data-kibble-zone-content-kind={zoneAdapter.sharedContentKind} data-kibble-zone-adapter={zoneAdapter.adapterId} data-kibble-zone-variant={zoneAdapter.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter.inputSha256} data-aisles-zone-instance={zoneAdapter.instanceId} data-aisles-zone-label="Cart recovery" data-aisles-authority={presentationModelCallCount > 0 ? 'model' : (zoneAdapter.decisionMode ?? 'fixed')} data-aisles-model-calls={presentationModelCallCount} data-aisles-model-eligible={cartModelDecision ? 'true' : undefined} data-aisles-cart-model-eligible={cartModelDecision ? 'true' : undefined}>
					<p class="kc-reference-eyebrow">{zoneAdapter.content.props.eyebrow}</p>
					<h2>{zoneAdapter.content.props.headline}</h2>
					<p class="kc-reference-route__supporting">{zoneAdapter.content.props.body}</p>
				</section>
			{:else}
				<p class="kc-reference-route__supporting">{cartStatus === 'empty' ? 'There is no active BigCommerce cart in this Aisles session.' : services.mode === 'off' ? 'No cart was read, created, priced, or changed.' : 'BigCommerce did not confirm the current cart. Refresh before changing it.'}</p>
			{/if}
			<a href="/" class="kc-reference-button kc-reference-button--primary kc-reference-focus">Start shopping</a>
			<a href="/checkout/prepaid" class="kc-reference-route__text-link kc-reference-focus">View checkout presentation boundary</a>
		</div>
		{/if}
		{#if operationError}<p class="kc-reference-cart__error" role="alert">{operationError}</p>{/if}
	</div>
</div>

<style>
	.kc-reference-cart { display:grid; grid-template-columns:minmax(0, 1fr) minmax(17rem, 22rem); gap:2rem; align-items:start; }
	.kc-reference-cart__lines { display:grid; gap:0; margin:0; padding:0; list-style:none; border-top:1px solid var(--kc-border); }
	.kc-reference-cart__lines li { display:grid; grid-template-columns:7rem minmax(0, 1fr) auto; gap:1rem; align-items:start; padding:1.25rem 0; border-bottom:1px solid var(--kc-border); }
	.kc-reference-cart__lines img { width:7rem; height:7rem; object-fit:cover; background:var(--kc-surface); }
	.kc-reference-cart__line-copy { display:grid; gap:.55rem; }
	.kc-reference-cart__line-copy a { color:inherit; text-decoration:none; }
	.kc-reference-cart__line-copy span { color:var(--kc-muted-text); }
	.kc-reference-cart__quantity { display:flex; align-items:center; width:max-content; border:1px solid var(--kc-border); }
	.kc-reference-cart__quantity button { width:44px; height:44px; border:0; background:transparent; font:inherit; cursor:pointer; }
	.kc-reference-cart__quantity output { min-width:2rem; text-align:center; }
	.kc-reference-cart__remove, .kc-reference-cart__empty-button { width:max-content; min-height:44px; border:0; background:transparent; color:inherit; text-decoration:underline; cursor:pointer; }
	.kc-reference-cart__summary { display:grid; gap:1rem; padding:1.4rem; border:1px solid var(--kc-border); background:var(--kc-surface); }
	.kc-reference-cart__summary dl { display:grid; gap:.6rem; margin:0; }
	.kc-reference-cart__summary dl div { display:flex; justify-content:space-between; gap:1rem; }
	.kc-reference-cart__summary p { margin:0; color:var(--kc-muted-text); font-size:.82rem; }
	.kc-reference-cart__error { margin-top:1rem; border-left:4px solid #a33; padding:.8rem 1rem; background:#fff4f2; }
	@media (max-width: 760px) { .kc-reference-cart { grid-template-columns:1fr; } .kc-reference-cart__lines li { grid-template-columns:5rem minmax(0, 1fr); } .kc-reference-cart__lines img { width:5rem; height:5rem; } .kc-reference-cart__lines li > strong { grid-column:2; } }
</style>
