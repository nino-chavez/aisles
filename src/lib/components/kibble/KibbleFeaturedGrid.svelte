<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibbleAutoRefillOffer, KibbleFeaturedCopy, KibbleProduct } from './types';

	let {
		copy,
		products,
		productHrefs,
		browseHref,
		subscriptionOffers = {},
	}: {
		copy: KibbleFeaturedCopy;
		products: KibbleProduct[];
		productHrefs: Partial<Record<string, string>>;
		browseHref: string;
		subscriptionOffers?: Record<string, KibbleAutoRefillOffer>;
	} = $props();
</script>

{#if products.length > 0}
	<section class="kibble-reference kc-reference-section" aria-labelledby="kibble-featured-heading">
		<div class="kc-reference-container">
			<div class="kc-reference-section__header">
				<div>
					<p class="kc-reference-eyebrow">{copy.eyebrow}</p>
					<h2 id="kibble-featured-heading" class="kc-reference-section__title">{copy.title}</h2>
				</div>
				<a href={browseHref} class="kc-reference-section__browse kc-reference-focus">{copy.browseAllLabel} →</a>
			</div>

			<div class="kc-reference-product-grid">
				{#each products as product (product.id)}
					<KibbleProductCard product={product} productHref={productHrefs[product.id]} autoRefill={subscriptionOffers[product.id] ?? null} presentation="featured-tile" />
				{/each}
			</div>
		</div>
	</section>
{/if}
