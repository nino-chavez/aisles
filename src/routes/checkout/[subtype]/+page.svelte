<script lang="ts">
	import type { PageData } from './$types';
	import { KibbleCheckoutReference } from '$lib/components/kibble';
	import { KIBBLE_CHECKOUT_DEFAULT_PRESENTATION, materializeKibbleCheckoutPresentation, snapshotKibbleCheckoutPresentation } from '$lib/brand/reference/kibble-presentation-decisions';

	let { data }: { data: PageData } = $props();
	type KibbleCheckoutData = NonNullable<PageData['kibbleCheckout']>;
	let previewZoneAdapter = $state<KibbleCheckoutData['assuranceZoneAdapter'] | null>(null);
	let checkoutModelCallCount = $state(0);

	$effect(() => { data; previewZoneAdapter = null; checkoutModelCallCount = 0; });
	$effect(() => {
		const checkout = data.kibbleCheckout;
		const decision = checkout.checkoutModelDecision;
		if (!decision || !checkout.assuranceZoneAdapter || (checkout.subtype !== 'gift' && checkout.subtype !== 'prepaid')) return;
		let active = true;
		let cleanup: (() => void) | undefined;
		void import('$lib/components/kibble/kibble-bounded-copy-live-preview').then(({ listenForKibbleBoundedCopyLivePreview }) => {
			if (!active) return;
			cleanup = listenForKibbleBoundedCopyLivePreview({
				expectation: { surface: 'checkout', routePath: decision.routePath, subtype: checkout.subtype as 'gift' | 'prepaid', policyVersion: decision.policyVersion },
				requestEvent: 'aisles-kibble-checkout-model-request',
				getCurrentPresentation: () => snapshotKibbleCheckoutPresentation(materializeKibbleCheckoutPresentation(KIBBLE_CHECKOUT_DEFAULT_PRESENTATION)),
				onApplied: (preview) => { previewZoneAdapter = preview.zoneAdapter as KibbleCheckoutData['assuranceZoneAdapter']; checkoutModelCallCount = preview.modelCallCount; },
				onStatus: (status) => window.dispatchEvent(new CustomEvent('aisles-kibble-checkout-model-status', { detail: status })),
			});
			window.dispatchEvent(new CustomEvent('aisles-kibble-checkout-model-ready'));
		});
		return () => { active = false; cleanup?.(); };
	});
</script>

<svelte:head><title>Checkout — Kibble &amp; Co.</title><meta name="robots" content="noindex" /></svelte:head>

<div data-reference-recipe={data.kibbleCheckout.recipeId}>
	<KibbleCheckoutReference {...data.kibbleCheckout} assuranceZoneAdapter={previewZoneAdapter ?? data.kibbleCheckout.assuranceZoneAdapter} presentationModelCallCount={checkoutModelCallCount} />
</div>
