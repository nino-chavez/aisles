<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleZoneAdapterBinding } from './types';

	let {
		availabilityMessage, policyVersion, zoneAdapter, cartModelDecision = null, presentationModelCallCount = 0,
	}: {
		availabilityMessage: string; policyVersion?: string; zoneAdapter?: KibbleZoneAdapterBinding<any> | null;
		cartModelDecision?: { zoneId: 'cart.empty-state'; routePath: '/cart'; policyVersion: string } | null;
		presentationModelCallCount?: number;
	} = $props();
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
		<div class="kc-reference-route__empty" data-kibble-backend-state="unavailable">
			<p>{availabilityMessage}</p>
			{#if zoneAdapter}
				<section id="kibble-cart-empty-state" tabindex="-1" data-kibble-zone-instance={zoneAdapter.instanceId} data-kibble-zone-status={zoneAdapter.sharedStatus} data-kibble-zone-content-kind={zoneAdapter.sharedContentKind} data-kibble-zone-adapter={zoneAdapter.adapterId} data-kibble-zone-variant={zoneAdapter.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter.inputSha256} data-aisles-zone-instance={zoneAdapter.instanceId} data-aisles-zone-label="Cart recovery" data-aisles-authority={presentationModelCallCount > 0 ? 'model' : (zoneAdapter.decisionMode ?? 'fixed')} data-aisles-model-calls={presentationModelCallCount} data-aisles-model-eligible={cartModelDecision ? 'true' : undefined} data-aisles-cart-model-eligible={cartModelDecision ? 'true' : undefined}>
					<p class="kc-reference-eyebrow">{zoneAdapter.content.props.eyebrow}</p>
					<h2>{zoneAdapter.content.props.headline}</h2>
					<p class="kc-reference-route__supporting">{zoneAdapter.content.props.body}</p>
				</section>
			{:else}
				<p class="kc-reference-route__supporting">No cart was read, created, priced, or changed.</p>
			{/if}
			<a href="/" class="kc-reference-button kc-reference-button--primary kc-reference-focus">Start shopping</a>
			<a href="/checkout/prepaid" class="kc-reference-route__text-link kc-reference-focus">View checkout presentation boundary</a>
		</div>
	</div>
</div>
