<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibbleProduct, KibbleTierNode } from './types';

	let {
		tier,
		tree,
		categoryCount,
		rails,
	}: {
		tier: 'small' | 'medium' | 'enterprise';
		tree: KibbleTierNode[];
		categoryCount: number;
		rails: Array<{ title: string; href: string; products: KibbleProduct[] }>;
	} = $props();

	const TIER_COPY: Record<string, { title: string; body: string }> = {
		small: {
			title: 'Small merchant storefront',
			body: 'A focused catalog a small merchant runs day to day — a handful of shelves, every product hand-picked.',
		},
		medium: {
			title: 'Medium merchant storefront',
			body: 'A multi-species catalog with departments per species — the shape of a growing regional retailer.',
		},
		enterprise: {
			title: 'Enterprise merchant storefront',
			body: 'A deep catalog with a full three-level taxonomy — the shape of a national pet retailer.',
		},
	};
	const copy = $derived(TIER_COPY[tier]);
	const productTotal = $derived(tree.reduce((n, node) => n + node.productCount, 0));
</script>

<div class="kibble-reference kc-tier-storefront">
	<div class="kc-reference-container">
		<header class="kc-tier-storefront__hero">
			<p class="kc-reference-eyebrow">Merchant tier demo — live from this tier's channel</p>
			<h1>{copy.title}</h1>
			<p class="kc-tier-storefront__body">{copy.body}</p>
			<p class="kc-tier-storefront__stats">
				{categoryCount} categories · {productTotal} products in top-level shelves
			</p>
		</header>

		<section class="kc-tier-storefront__categories" aria-label="Departments">
			<div class="kc-tier-storefront__grid">
				{#each tree as node (node.entityId)}
					<article class="kc-tier-storefront__card">
						<a class="kc-reference-focus kc-tier-storefront__card-title" href={node.href}>{node.name}</a>
						<p class="kc-tier-storefront__count">{node.productCount} products</p>
						{#if node.children.length}
							<ul class="kc-tier-storefront__children">
								{#each node.children.slice(0, 6) as child (child.entityId)}
									<li><a class="kc-reference-focus" href={child.href}>{child.name}</a></li>
								{/each}
								{#if node.children.length > 6}
									<li><a class="kc-reference-focus" href={node.href}>+{node.children.length - 6} more</a></li>
								{/if}
							</ul>
						{/if}
					</article>
				{/each}
			</div>
		</section>

		{#each rails as rail (rail.href)}
			<section class="kc-tier-storefront__rail" aria-label={rail.title}>
				<div class="kc-tier-storefront__rail-head">
					<h2>{rail.title}</h2>
					<a class="kc-reference-focus" href={rail.href}>Browse {rail.title}</a>
				</div>
				<div class="kc-reference-product-grid">
					{#each rail.products as product (product.entityId)}
						<KibbleProductCard {product} />
					{/each}
				</div>
			</section>
		{/each}
	</div>
</div>

<style>
	.kc-tier-storefront {
		padding-block: 2.5rem 4rem;
	}
	.kc-tier-storefront__hero {
		max-width: 44rem;
		margin-bottom: 2.5rem;
	}
	.kc-tier-storefront__hero h1 {
		margin: 0.5rem 0;
		font-size: 2rem;
		line-height: 1.15;
	}
	.kc-tier-storefront__body {
		margin: 0 0 0.75rem;
	}
	.kc-tier-storefront__stats {
		margin: 0;
		font-size: 0.875rem;
		opacity: 0.75;
	}
	.kc-tier-storefront__grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(15rem, 1fr));
		gap: 1rem;
		margin-bottom: 3rem;
	}
	.kc-tier-storefront__card {
		border: 1px solid rgba(0, 0, 0, 0.12);
		border-radius: 0.75rem;
		padding: 1.1rem 1.25rem;
	}
	.kc-tier-storefront__card-title {
		font-weight: 700;
		font-size: 1.05rem;
		text-decoration: none;
	}
	.kc-tier-storefront__count {
		margin: 0.25rem 0 0.6rem;
		font-size: 0.8rem;
		opacity: 0.7;
	}
	.kc-tier-storefront__children {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		font-size: 0.85rem;
	}
	.kc-tier-storefront__rail {
		margin-bottom: 2.75rem;
	}
	.kc-tier-storefront__rail-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}
	.kc-tier-storefront__rail-head h2 {
		margin: 0;
		font-size: 1.35rem;
	}
</style>
