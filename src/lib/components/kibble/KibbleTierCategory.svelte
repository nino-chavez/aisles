<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibbleProduct } from './types';

	interface TierNode {
		entityId: number;
		name: string;
		href: string;
		productCount: number;
		children: TierNode[];
	}

	let {
		category,
		breadcrumb,
		subcategories,
		products,
		hasMore,
	}: {
		category: { entityId: number; name: string };
		breadcrumb: Array<{ label: string; href: string }>;
		subcategories: TierNode[];
		products: KibbleProduct[];
		hasMore: boolean;
	} = $props();
</script>

<div class="kibble-reference kc-tier-category">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			<a class="kc-reference-focus" href="/">Home</a>
			{#each breadcrumb as crumb (crumb.href)}
				<span aria-hidden="true">/</span>
				{#if crumb.href === breadcrumb[breadcrumb.length - 1]?.href}
					<span aria-current="page">{crumb.label}</span>
				{:else}
					<a class="kc-reference-focus" href={crumb.href}>{crumb.label}</a>
				{/if}
			{/each}
		</nav>

		<header class="kc-tier-category__header">
			<p class="kc-reference-eyebrow">Merchant tier demo</p>
			<h1>{category.name}</h1>
			<p class="kc-tier-category__count">
				{products.length}{hasMore ? '+' : ''} {products.length === 1 && !hasMore ? 'product' : 'products'}
			</p>
			{#if subcategories.length}
				<ul class="kc-tier-category__children">
					{#each subcategories as child (child.entityId)}
						<li><a class="kc-reference-focus" href={child.href}>{child.name} ({child.productCount})</a></li>
					{/each}
				</ul>
			{/if}
		</header>

		{#if products.length}
			<div class="kc-reference-product-grid">
				{#each products as product (product.entityId)}
					<KibbleProductCard {product} />
				{/each}
			</div>
		{:else}
			<p class="kc-reference-category__empty">No products on this shelf yet in this tier's catalog.</p>
		{/if}
	</div>
</div>

<style>
	.kc-tier-category {
		padding-block: 1.5rem 4rem;
	}
	.kc-tier-category__header {
		margin: 1rem 0 1.75rem;
		max-width: 44rem;
	}
	.kc-tier-category__header h1 {
		margin: 0.4rem 0;
		font-size: 1.8rem;
		line-height: 1.15;
	}
	.kc-tier-category__count {
		margin: 0 0 0.75rem;
		font-size: 0.875rem;
		opacity: 0.75;
	}
	.kc-tier-category__children {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem 0.9rem;
		font-size: 0.9rem;
	}
</style>
