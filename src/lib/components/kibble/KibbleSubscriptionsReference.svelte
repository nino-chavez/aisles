<script lang="ts">
	import './kibble-reference.css';
	import KibbleAccountReference from './KibbleAccountReference.svelte';

	type SubscriptionSubtype = 'portal' | 'account' | 'detail';
	let { subtype, availabilityMessage, policyVersion, brandName }: { subtype: SubscriptionSubtype; availabilityMessage: string; policyVersion?: string; brandName: string } = $props();
</script>

<div class:kc-reference-route={subtype === 'detail'} class="kibble-reference kc-reference-subscriptions-page" data-kibble-route-shell="subscriptions" data-kibble-route-policy={policyVersion} data-kibble-subscriptions-subtype={subtype} aria-labelledby={subtype === 'detail' ? 'kibble-subscriptions-heading' : undefined}>
	{#if subtype === 'portal' || subtype === 'account'}
		<div data-kibble-source-resolution="account-login" data-kibble-backend-state="unavailable">
			<KibbleAccountReference subtype="login" {brandName} {availabilityMessage} {policyVersion} />
		</div>
	{:else}
		<div class="kc-reference-container kc-reference-subscriptions-page__content kc-reference-subscriptions-page__content--detail" data-kibble-backend-state="unavailable">
			<a class="kc-reference-route__text-link kc-reference-focus" href="/subscriptions">← Back to subscriptions</a>
			<h1 id="kibble-subscriptions-heading">Subscription detail</h1>
			<p>{availabilityMessage}</p>
			<div class="kc-reference-subscriptions-page__detail">
				<h2>Subscription unavailable</h2>
				<p>No plan, status, charge, renewal, address, or payment data was requested.</p>
				<button type="button" disabled>Manage subscription unavailable</button>
			</div>
		</div>
	{/if}
</div>
