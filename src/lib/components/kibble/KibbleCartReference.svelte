<script lang="ts">
	import './kibble-reference.css';

	let { availabilityMessage, policyVersion }: { availabilityMessage: string; policyVersion?: string } = $props();
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
			<p class="kc-reference-route__supporting">No cart was read, created, priced, or changed.</p>
			<a href="/" class="kc-reference-button kc-reference-button--primary kc-reference-focus">Start shopping</a>
		</div>
	</div>
</div>
