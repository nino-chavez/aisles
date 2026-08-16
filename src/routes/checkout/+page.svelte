<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let isLoading = $state(true);
	let error = $state('');
	let cartId = $state('');

	onMount(async () => {
		if (data.renderMode === 'reference-preserve') return;
		// Get cart ID from our API
		try {
			const res = await fetch('/api/cart');
			// Named `payload`, not `data` — the page prop is also called `data`,
			// and goToHostedCheckout reads checkoutOrigin off it.
			const payload = await res.json();

			if (!payload.cart?.entityId) {
				error = 'Your cart is empty. Add some items before checking out.';
				isLoading = false;
				return;
			}

			cartId = payload.cart.entityId;
			goToHostedCheckout(cartId);
		} catch (err) {
			error = 'Failed to load checkout. Please try again.';
			isLoading = false;
		}
	});

	/**
	 * Hand the shopper to BigCommerce's hosted checkout.
	 *
	 * This used to iframe the same URL. BC serves /checkout with
	 * `x-frame-options: deny`, so the browser refused the frame and the
	 * shopper got an empty box — and the surrounding try/catch never fired,
	 * because a blocked frame is not a thrown error. A redirect is what the
	 * hosted checkout actually supports.
	 *
	 * The origin is resolved server-side from the active channel, so a cart
	 * built on a merchant-tier channel checks out on that same channel.
	 */
	function goToHostedCheckout(cartEntityId: string) {
		if (!browser) return;

		if (!data.checkoutOrigin) {
			error = 'Checkout is not configured for this store.';
			isLoading = false;
			return;
		}

		window.location.href = `${data.checkoutOrigin}/checkout?cartId=${cartEntityId}`;
	}
</script>

<svelte:head>
	<title>Checkout — {data.brandName ?? 'Kibble & Co.'}</title>
</svelte:head>

<div class="mx-auto max-w-4xl px-6 py-8">
	<h1 class="text-2xl">Checkout</h1>

	{#if error}
		<div class="mt-8 rounded-sm border border-error/30 bg-error/5 p-6 text-center">
			<p class="text-surface-muted-fg">{error}</p>
			<a href="/" class="mt-4 inline-block text-sm font-medium text-primary hover:text-secondary">
				Continue shopping
			</a>
		</div>
	{:else}
		{#if isLoading}
			<div class="mt-8 flex items-center justify-center py-24">
				<div class="animate-pulse text-surface-muted-fg">Taking you to secure checkout...</div>
			</div>
		{/if}
	{/if}
</div>
