<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibbleAutoRefillOffer, KibbleProduct } from './types';

	let {
		title = 'New arrivals',
		eyebrow = 'Catalog',
		products,
		browseHref = '/search',
		subscriptionOffers = {},
	}: {
		title?: string;
		eyebrow?: string;
		products: KibbleProduct[];
		browseHref?: string;
		subscriptionOffers?: Record<string, KibbleAutoRefillOffer>;
	} = $props();
</script>

{#if products.length > 0}
	<section class="kibble-reference kc-reference-section" aria-labelledby="kibble-featured-heading">
		<div class="kc-reference-container">
			<div class="kc-reference-section__header">
				<div>
					{#if eyebrow}<p class="kc-reference-eyebrow">{eyebrow}</p>{/if}
					<h2 id="kibble-featured-heading" class="kc-reference-section__title">{title}</h2>
				</div>
				<a href={browseHref} class="kc-reference-section__browse kc-reference-focus">Browse all →</a>
			</div>

			<div class="kc-reference-product-grid">
				{#each products as product (product.id)}
					<KibbleProductCard product={product} autoRefill={subscriptionOffers[product.id] ?? null} presentation="featured-tile" />
				{/each}
			</div>
		</div>
	</section>
{/if}
