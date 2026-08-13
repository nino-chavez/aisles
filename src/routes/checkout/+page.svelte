<script lang="ts">
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import type { PageData } from './$types';
	import { KibbleCheckoutReference } from '$lib/components/kibble';

	let { data }: { data: PageData } = $props();

	let checkoutContainer: HTMLDivElement;
	let isLoading = $state(true);
	let error = $state('');
	let cartId = $state('');

	onMount(async () => {
		if (data.renderMode === 'reference-preserve') return;
		// Get cart ID from our API
		try {
			const res = await fetch('/api/cart');
			const data = await res.json();

			if (!data.cart?.entityId) {
				error = 'Your cart is empty. Add some items before checking out.';
				isLoading = false;
				return;
			}

			cartId = data.cart.entityId;
			await loadEmbeddedCheckout(cartId);
		} catch (err) {
			error = 'Failed to load checkout. Please try again.';
			isLoading = false;
		}
	});

	async function loadEmbeddedCheckout(cartEntityId: string) {
		try {
			// Load the BC Checkout SDK script
			const script = document.createElement('script');
			script.src = 'https://checkout-sdk.bigcommerce.com/v1/loader.js';
			script.async = true;

			await new Promise<void>((resolve, reject) => {
				script.onload = () => resolve();
				script.onerror = () => reject(new Error('Failed to load checkout SDK'));
				document.head.appendChild(script);
			});

			// Initialize embedded checkout
			const module = await (window as any).checkoutKitLoader.load('checkout-sdk');
			const service = module.createCheckoutService();

			// For embedded checkout, we need the checkout URL
			// BC embedded checkout uses a redirect URL approach
			const checkoutUrl = `https://store-${import.meta.env.VITE_BC_STORE_HASH || 'cdfqf9k6zf'}.mybigcommerce.com/checkout`;

			// Create an iframe-based checkout
			const iframe = document.createElement('iframe');
			iframe.src = `${checkoutUrl}?cartId=${cartEntityId}`;
			iframe.style.width = '100%';
			iframe.style.minHeight = '600px';
			iframe.style.border = 'none';
			iframe.allow = 'payment';

			checkoutContainer.innerHTML = '';
			checkoutContainer.appendChild(iframe);
			isLoading = false;
		} catch (err) {
			console.error('Checkout SDK error:', err);
			// Fallback: redirect to BC hosted checkout
			if (browser) {
				window.location.href = `https://store-${import.meta.env.VITE_BC_STORE_HASH || 'cdfqf9k6zf'}.mybigcommerce.com/checkout?cartId=${cartEntityId}`;
			}
		}
	}
</script>

<svelte:head>
	<title>{data.renderMode === 'reference-preserve' ? 'Checkout — Kibble & Co.' : 'Checkout — Haven'}</title>
</svelte:head>

{#if data.renderMode === 'reference-preserve' && data.kibbleCheckout}
	<KibbleCheckoutReference {...data.kibbleCheckout} />
{:else}
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
				<div class="animate-pulse text-surface-muted-fg">Loading checkout...</div>
			</div>
		{/if}
		<div bind:this={checkoutContainer} class="mt-6"></div>
	{/if}
</div>
{/if}
