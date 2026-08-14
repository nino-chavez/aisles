<script lang="ts">
	import type { PageData } from './$types';
	import { KibbleProductDetailReference } from '$lib/components/kibble';
	import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
	import { KIBBLE_PARITY_FIXED_DATA_IDENTITY } from '$lib/brand/reference/kibble-parity';
	import { getEmitter } from '$lib/signals/emitter';
	import { addPick, isPicked, removePick } from '$lib/stores/picks.svelte';
	import {
		KIBBLE_PDP_DEFAULT_PRESENTATION,
		materializeKibblePdpPresentation,
		snapshotKibblePdpPresentation,
	} from '$lib/brand/reference/kibble-presentation-decisions';

	let { data }: { data: PageData } = $props();
	let product = $derived(data.product);
	let relatedProducts = $derived(data.relatedProducts);
	let persona = $derived(data.persona);
	let isKibblePdp = $derived(data.renderMode === 'reference-preserve' || data.renderMode === 'reference-review');
	type KibblePdpData = NonNullable<PageData['kibblePdp']>;
	let previewRelatedProducts = $state<KibblePdpData['relatedProducts'] | null>(null);
	let previewRelatedZoneAdapter = $state<KibblePdpData['zoneAdapter'] | null>(null);
	let previewPdpPresentation = $state<ReturnType<typeof materializeKibblePdpPresentation> | null>(null);
	const defaultPdpPresentation = materializeKibblePdpPresentation(KIBBLE_PDP_DEFAULT_PRESENTATION);
	let activePdpPresentation = $derived(previewPdpPresentation ?? defaultPdpPresentation);

	$effect(() => {
		data;
		previewRelatedProducts = null;
		previewRelatedZoneAdapter = null;
		previewPdpPresentation = null;
	});

	$effect(() => {
		const pdp = data.kibblePdp;
		const decision = pdp?.relatedModelDecision;
		if (!isKibblePdp || !decision || !pdp) return;
		const expectation = {
			routePath: decision.routePath,
			policyVersion: decision.policyVersion,
			productIds: pdp.relatedProducts.map(({ entityId }) => String(entityId)),
			relatedHeading: pdp.relatedHeading,
		};
		const products = pdp.relatedProducts;
		let active = true;
		let cleanup: (() => void) | undefined;
		void import('$lib/components/kibble/kibble-pdp-live-preview').then(({ listenForKibblePdpLivePreview }) => {
			if (!active) return;
			const listener = listenForKibblePdpLivePreview({
				expectation,
				products,
				getCurrentPresentation: () => snapshotKibblePdpPresentation(activePdpPresentation),
				onApplied: (preview) => {
					// Validation proves these are a reorder of this server-rendered rail.
					previewRelatedProducts = preview.products as KibblePdpData['relatedProducts'];
					previewRelatedZoneAdapter = preview.zoneAdapter as KibblePdpData['zoneAdapter'];
					previewPdpPresentation = materializeKibblePdpPresentation(preview.presentationDecision);
				},
				onStatus: (status) => window.dispatchEvent(new CustomEvent('aisles-kibble-pdp-model-status', { detail: status })),
			});
			cleanup = listener;
			window.dispatchEvent(new CustomEvent('aisles-kibble-pdp-model-ready'));
		});
		return () => { active = false; cleanup?.(); };
	});

	$effect(() => {
		if (isKibblePdp) return;
		if (!product) return;
		const startTime = Date.now();
		const productId = product.id;
		return () => {
			const dwellMs = Date.now() - startTime;
			if (dwellMs > 3000) getEmitter()?.emit('interact.dwell_time', { productId, dwellMs, category: product.category });
		};
	});

	let isAddingToCart = $state(false);
	let cartMessage = $state('');
	let pairings = $state<Array<{ id: string; name: string; price: number; reason: string }>>([]);
	let pairingsLoading = $state(false);

	$effect(() => {
		if (isKibblePdp) return;
		const p = product;
		if (!p) return;
		pairingsLoading = true;
		fetch('/api/suggest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ picks: [{ id: p.id, name: p.name, price: p.price, category: p.category, specs: p.specs }] }) })
			.then((r) => r.json()).then((result) => { pairings = result.suggestions || []; }).catch(() => {}).finally(() => { pairingsLoading = false; });
	});

	async function addToCart() {
		if (!product) return;
		isAddingToCart = true; cartMessage = '';
		try {
			const res = await fetch('/api/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productEntityId: product.entityId }) });
			if (!res.ok) throw new Error('Failed to add to cart');
			const result = await res.json(); cartMessage = `Added to cart (${result.itemCount} items)`;
			getEmitter()?.emit('commerce.add_to_cart', { productId: product.id, entityId: product.entityId, price: product.salePrice || product.price, name: product.name, category: product.category });
			window.dispatchEvent(new CustomEvent('cart-updated', { detail: { itemCount: result.itemCount } }));
			setTimeout(() => { cartMessage = ''; }, 3000);
		} catch { cartMessage = 'Failed to add to cart'; } finally { isAddingToCart = false; }
	}
</script>

<svelte:head><title>{isKibblePdp ? data.kibblePdp?.product.name : product?.name}</title><meta name="description" content={isKibblePdp ? data.kibblePdp?.product.descriptionPlain.slice(0, 160) : product?.descriptionPlain.slice(0, 160)} /></svelte:head>

{#if isKibblePdp && data.kibblePdp}
	<div
		data-reference-pdp="catalog-display-only"
		data-reference-id={KIBBLE_REFERENCE_CONTRACT.id}
		data-reference-contract-version={KIBBLE_REFERENCE_CONTRACT.version}
		data-reference-fixture={KIBBLE_REFERENCE_CONTRACT.source.fixturePath}
		data-reference-fixture-sha256={KIBBLE_PARITY_FIXED_DATA_IDENTITY}
	><KibbleProductDetailReference
		{...data.kibblePdp}
		relatedProducts={previewRelatedProducts ?? data.kibblePdp.relatedProducts}
		zoneAdapter={previewRelatedZoneAdapter ?? data.kibblePdp.zoneAdapter}
		presentation={activePdpPresentation}
		presentationModelCallCount={previewRelatedZoneAdapter?.modelCallCount ?? 0}
	/></div>
{:else if product && relatedProducts}
	<div class="mx-auto max-w-7xl px-6 py-8">
		<nav class="mb-8 text-sm text-surface-muted-fg"><a href="/" class="hover:text-surface-fg">Home</a><span class="mx-2">/</span>{#if product.categoryPath}<a href="/category/{product.categoryPath.replace(/^\/|\/$/g, '').replace(/^(haven|volt|ember)-/i, '')}" class="hover:text-surface-fg">{product.category.replace(/^(Haven|Volt|Ember)\s+/i, '')}</a><span class="mx-2">/</span>{/if}<span class="text-surface-fg">{product.name}</span></nav>
		<div class="grid gap-12 lg:grid-cols-2"><div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">{#if product.image}<img src={product.image} alt={product.imageAlt} class="h-full w-full object-cover" loading="eager" />{/if}</div><div class="flex flex-col"><h1 class="text-3xl sm:text-4xl">{product.name}</h1><div class="mt-4">{#if product.salePrice}<span class="text-2xl font-medium text-primary">${product.salePrice.toLocaleString()}</span><span class="ml-2 text-lg text-surface-muted-fg line-through">${product.price.toLocaleString()}</span><span class="ml-2 rounded-sm bg-primary/10 px-2 py-0.5 text-sm font-medium text-primary">Save ${(product.price - product.salePrice).toLocaleString()}</span>{:else}<span class="text-2xl font-medium">${product.price.toLocaleString()}</span>{/if}</div><div class="mt-6 leading-relaxed text-surface-muted-fg prose-sm">{@html product.description}</div>{#if Object.keys(product.specs).length > 0}<dl class="mt-6 border-t border-surface-border pt-6">{#each Object.entries(product.specs) as [key, value]}<div class="flex justify-between border-b border-surface-border py-3"><dt class="text-sm text-surface-muted-fg">{key}</dt><dd class="text-sm font-medium">{value}</dd></div>{/each}</dl>{/if}<div class="mt-8 flex flex-wrap gap-3"><button onclick={addToCart} disabled={isAddingToCart} class="rounded-sm bg-surface-fg py-4 text-sm font-semibold text-surface-bg transition-opacity hover:opacity-85 disabled:opacity-50 px-12">{isAddingToCart ? 'Adding...' : `Add to Cart — $${(product.salePrice || product.price).toLocaleString()}`}</button><button onclick={() => isPicked(product.id) ? removePick(product.id) : addPick(product)} class="rounded-sm border py-4 px-6 text-sm font-medium transition-colors">{isPicked(product.id) ? 'In Your Picks' : 'Add to Picks'}</button></div>{#if cartMessage}<p class="mt-2 text-sm">{cartMessage}</p>{/if}{#if pairingsLoading}<div class="mt-8 border-t border-surface-border pt-8"><h3 class="font-display text-lg">Pairs well with</h3></div>{:else if pairings.length > 0}<div class="mt-8 border-t border-surface-border pt-8"><h3 class="font-display text-lg">Pairs well with</h3><ul class="mt-3 space-y-2">{#each pairings as pairing}<li><a href="/product/{pairing.id}" class="flex items-center justify-between rounded-sm border border-surface-border px-4 py-3"><span class="text-sm font-medium">{pairing.name}</span><span class="text-sm font-medium">${pairing.price.toLocaleString()}</span></a></li>{/each}</ul></div>{/if}</div></div>
		{#if relatedProducts.length > 0}<section class="mt-16 border-t border-surface-border pt-12"><h2 class="text-2xl">You might also like</h2><div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">{#each relatedProducts as related}<a href="/product/{related.id}" class="group"><div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">{#if related.image}<img src={related.image} alt={related.imageAlt} class="h-full w-full object-cover" loading="lazy" />{/if}</div><div class="mt-3"><h3 class="text-sm font-medium">{related.name}</h3><span class="text-sm font-medium">${(related.salePrice || related.price).toLocaleString()}</span></div></a>{/each}</div></section>{/if}
	</div>
{/if}
