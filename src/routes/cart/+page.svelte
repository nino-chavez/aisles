<script lang="ts">
	import type { PageData } from './$types';
	import { KibbleCartReference } from '$lib/components/kibble';
	import { KIBBLE_CART_DEFAULT_PRESENTATION, materializeKibbleCartPresentation, snapshotKibbleCartPresentation } from '$lib/brand/reference/kibble-presentation-decisions';

	let { data }: { data: PageData } = $props();
	type KibbleCartData = NonNullable<PageData['kibbleCart']>;
	let previewZoneAdapter = $state<KibbleCartData['zoneAdapter'] | null>(null);
	let cartModelCallCount = $state(0);

	$effect(() => { data; previewZoneAdapter = null; cartModelCallCount = 0; });
	$effect(() => {
		const cart = data.kibbleCart;
		const decision = cart?.cartModelDecision;
		if (data.renderMode !== 'reference-preserve' || !cart || !decision || !cart.zoneAdapter) return;
		let active = true;
		let cleanup: (() => void) | undefined;
		void import('$lib/components/kibble/kibble-bounded-copy-live-preview').then(({ listenForKibbleBoundedCopyLivePreview }) => {
			if (!active) return;
			cleanup = listenForKibbleBoundedCopyLivePreview({
				expectation: { surface: 'cart', routePath: '/cart', policyVersion: decision.policyVersion },
				requestEvent: 'aisles-kibble-cart-model-request',
				getCurrentPresentation: () => snapshotKibbleCartPresentation(materializeKibbleCartPresentation(KIBBLE_CART_DEFAULT_PRESENTATION)),
				onApplied: (preview) => { previewZoneAdapter = preview.zoneAdapter as KibbleCartData['zoneAdapter']; cartModelCallCount = preview.modelCallCount; },
				onStatus: (status) => window.dispatchEvent(new CustomEvent('aisles-kibble-cart-model-status', { detail: status })),
			});
			window.dispatchEvent(new CustomEvent('aisles-kibble-cart-model-ready'));
		});
		return () => { active = false; cleanup?.(); };
	});
</script>

<svelte:head><title>{data.renderMode === 'reference-preserve' ? 'Cart — Kibble & Co.' : 'Cart'}</title></svelte:head>

{#if data.renderMode === 'reference-preserve' && data.kibbleCart}
	<KibbleCartReference {...data.kibbleCart} zoneAdapter={previewZoneAdapter ?? data.kibbleCart.zoneAdapter} presentationModelCallCount={cartModelCallCount} />
{:else}
	<section class="mx-auto max-w-3xl px-6 py-24 text-center"><h1 class="text-3xl">Cart is unavailable.</h1><a href="/" class="mt-8 inline-flex text-primary">Return home</a></section>
{/if}
