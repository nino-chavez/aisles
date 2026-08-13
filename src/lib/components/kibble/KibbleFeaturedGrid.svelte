<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibbleAutoRefillOffer, KibbleFeaturedCopy, KibbleProduct, KibbleZoneAdapterBinding } from './types';
	type ProductGridContent = { component: 'product-grid'; props: { columns: 2 | 3 | 4; products: Array<{ productId: string; role: 'standard' }>; imageRatio: 'square'; showDescription: false; showSpecs: false; showQuickAdd: false } };

	let {
		copy,
		products,
		productHrefs,
		browseHref,
		subscriptionOffers = {},
		zoneAdapters,
	}: {
		copy: KibbleFeaturedCopy;
		products: KibbleProduct[];
		productHrefs: Partial<Record<string, string>>;
		browseHref: string;
		subscriptionOffers?: Record<string, KibbleAutoRefillOffer>;
		zoneAdapters?: KibbleZoneAdapterBinding<ProductGridContent>[];
	} = $props();
	const productsByEntityId = $derived(new Map(products.map((product) => [String(product.entityId), product])));
	const resolvedAdapters = $derived(zoneAdapters ?? []);
</script>

{#if products.length > 0}
	<section id="kibble-featured-shelf" tabindex="-1" class="kibble-reference kc-reference-section" aria-labelledby="kibble-featured-heading">
		<div class="kc-reference-container">
			<div class="kc-reference-section__header">
				<div>
					<p class="kc-reference-eyebrow">{copy.eyebrow}</p>
					<h2 id="kibble-featured-heading" class="kc-reference-section__title">{copy.title}</h2>
				</div>
				<a href={browseHref} class="kc-reference-section__browse kc-reference-focus">{copy.browseAllLabel} →</a>
			</div>

			<div class="kc-reference-product-grid">
				{#each resolvedAdapters as adapter (adapter.instanceId)}
					<div class="kc-reference-zone-segment" data-kibble-zone-instance={adapter.instanceId} data-kibble-zone-status={adapter.sharedStatus} data-kibble-zone-content-kind={adapter.sharedContentKind} data-kibble-zone-adapter={adapter.adapterId} data-kibble-zone-variant={adapter.componentVariantId} data-kibble-zone-input-sha256={adapter.inputSha256} data-aisles-zone-instance={adapter.instanceId} data-aisles-zone-label={adapter.instanceId} data-aisles-authority={adapter.decisionMode ?? 'fixed'} data-aisles-model-calls={adapter.modelCallCount ?? 0}>
						{#each adapter.content.props.products as productRef (productRef.productId)}
							{@const product = productsByEntityId.get(productRef.productId)}
							{#if product}
								<KibbleProductCard product={product} productHref={productHrefs[product.id]} autoRefill={subscriptionOffers[product.id] ?? null} presentation="featured-tile" />
							{/if}
						{/each}
					</div>
				{/each}
				{#if resolvedAdapters.length === 0}{#each products as product (product.id)}<KibbleProductCard product={product} productHref={productHrefs[product.id]} autoRefill={subscriptionOffers[product.id] ?? null} presentation="featured-tile" />{/each}{/if}
			</div>
		</div>
	</section>
{/if}
