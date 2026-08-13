<script lang="ts">
	import './kibble-reference.css';

	type CheckoutSubtype = 'checkout' | 'gift' | 'prepaid' | 'confirmation';
	let { subtype, availabilityMessage }: { subtype: CheckoutSubtype; availabilityMessage: string } = $props();

	const heading = $derived(subtype === 'gift' ? 'Give as a gift' : subtype === 'prepaid' ? 'Pay upfront' : subtype === 'confirmation' ? 'Order confirmation' : 'Checkout');
</script>

<section class="kibble-reference kc-reference-route kc-reference-checkout-page" data-kibble-route-shell="checkout" data-kibble-checkout-subtype={subtype} aria-labelledby="kibble-checkout-heading">
	<div class="kc-reference-checkout-page__column">
		{#if subtype === 'confirmation'}
			<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb"><a class="kc-reference-focus" href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">Order confirmation</span></nav>
		{/if}
		<div class="kc-reference-checkout-page__card" data-kibble-backend-state="unavailable">
			<h1 id="kibble-checkout-heading">{heading}</h1>
			<p>{availabilityMessage}</p>

			{#if subtype === 'gift'}
				<form class="kc-reference-disabled-form" aria-label="Gift purchase unavailable">
					<label>Recipient email<input type="email" placeholder="recipient@example.com" disabled /></label>
					<label>Number of deliveries<input type="number" min="1" disabled /></label>
					<div class="kc-reference-checkout-page__payment-placeholder">Payment method unavailable</div>
					<button type="button" disabled>Gift purchase unavailable</button>
				</form>
			{:else if subtype === 'prepaid'}
				<form class="kc-reference-disabled-form" aria-label="Prepaid purchase unavailable">
					<label>Deliveries to prepay<input type="number" min="2" max="24" disabled /></label>
					<div class="kc-reference-checkout-page__payment-placeholder">Total and payment method unavailable</div>
					<button type="button" disabled>Prepaid purchase unavailable</button>
				</form>
			{:else if subtype === 'confirmation'}
				<p class="kc-reference-route__supporting">No order was read or represented as confirmed.</p>
			{:else}
				<button class="kc-reference-disabled-action" type="button" disabled>Checkout unavailable</button>
			{/if}
			<a class="kc-reference-route__text-link kc-reference-focus" href="/">Return to Kibble &amp; Co.</a>
		</div>
	</div>
</section>
