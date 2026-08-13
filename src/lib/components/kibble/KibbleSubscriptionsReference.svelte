<script lang="ts">
	import './kibble-reference.css';

	type SubscriptionSubtype = 'portal' | 'account' | 'detail';
	let { subtype, availabilityMessage, policyVersion }: { subtype: SubscriptionSubtype; availabilityMessage: string; policyVersion?: string } = $props();
</script>

<section class="kibble-reference kc-reference-route kc-reference-subscriptions-page" data-kibble-route-shell="subscriptions" data-kibble-route-policy={policyVersion} data-kibble-subscriptions-subtype={subtype} aria-labelledby="kibble-subscriptions-heading">
	<div class="kc-reference-subscriptions-page__content" data-kibble-backend-state="unavailable">
		<h1 id="kibble-subscriptions-heading">{subtype === 'detail' ? 'Subscription detail' : 'Your subscriptions'}</h1>
		<p>{availabilityMessage}</p>
		{#if subtype === 'detail'}
			<div class="kc-reference-subscriptions-page__detail">
				<h2>Subscription unavailable</h2>
				<p>No plan, status, charge, renewal, address, or payment data was requested.</p>
				<button type="button" disabled>Manage subscription unavailable</button>
			</div>
		{:else}
			<div class="kc-reference-subscriptions-page__signin">
				<h2>Sign in to manage your subscriptions</h2>
				<form class="kc-reference-disabled-form" aria-label="Subscription sign in unavailable">
					<label>Email address<input type="email" placeholder="you@example.com" disabled /></label>
					<button type="button" disabled>Email sign-in unavailable</button>
				</form>
			</div>
		{/if}
		<a class="kc-reference-route__text-link kc-reference-focus" href="/">Return to Kibble &amp; Co.</a>
	</div>
</section>
