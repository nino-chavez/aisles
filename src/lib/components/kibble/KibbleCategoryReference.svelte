<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibbleProduct } from './types';

	let {
		eyebrow,
		title,
		productCount,
		productSingular,
		productPlural,
		emptyMessage,
		products,
		productHrefs,
	}: {
		eyebrow: string;
		title: string;
		productCount: number;
		productSingular: string;
		productPlural: string;
		emptyMessage: string;
		products: KibbleProduct[];
		productHrefs: Partial<Record<string, string>>;
	} = $props();
</script>

<section class="kibble-reference kc-reference-section kc-reference-category" aria-labelledby="kibble-category-heading">
	<div class="kc-reference-container">
		<header class="kc-reference-category__header">
			<div>
				<p class="kc-reference-eyebrow">{eyebrow}</p>
				<h1 id="kibble-category-heading">{title}</h1>
			</div>
			<p class="kc-reference-category__count">{productCount} {productCount === 1 ? productSingular : productPlural}</p>
		</header>

		{#if products.length > 0}
			<div class="kc-reference-product-grid">
				{#each products as product (product.entityId)}
					<KibbleProductCard product={product} productHref={productHrefs[product.id]} />
				{/each}
			</div>
		{:else}
			<p class="kc-reference-category__empty">{emptyMessage}</p>
		{/if}
	</div>
</section>
