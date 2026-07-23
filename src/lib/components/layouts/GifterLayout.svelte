<script lang="ts">
	import type { Product } from '$lib/types';

	let { category, products }: { category: { name: string; slug: string }; products: Product[] } = $props();

	const topPick = $derived(products[0]);
	const rest = $derived(products.slice(1));

	// Group remaining products by price tier
	const under200 = $derived(rest.filter((p) => (p.salePrice || p.price) < 200));
	const mid = $derived(rest.filter((p) => {
		const price = p.salePrice || p.price;
		return price >= 200 && price < 500;
	}));
	const splurge = $derived(rest.filter((p) => (p.salePrice || p.price) >= 500));
</script>

<!-- Gifter: Curated, occasion-framed, price-tier grouped -->
<div>
	<!-- Editorial header — gift context -->
	<div class="mb-10">
		<p class="text-xs font-medium uppercase tracking-widest text-surface-muted-fg">Gift guide</p>
		<h1 class="mt-3 text-3xl sm:text-4xl">{category.name} gifts they'll love</h1>
		<p class="mt-4 max-w-lg text-surface-muted-fg leading-relaxed">
			{#if category.slug === 'living-room'}
				Pieces that make a house feel like home. Thoughtful, lasting, and always appreciated.
			{:else if category.slug === 'office'}
				Upgrade their workspace with something they'd never buy themselves.
			{:else}
				Curated picks across every budget. Something here for everyone on your list.
			{/if}
		</p>
	</div>

	<!-- Top pick hero -->
	{#if topPick}
		<a
			href="/product/{topPick.id}"
			class="group mb-10 block rounded-sm border border-primary/20 bg-primary/5 p-6"
		>
			<div class="grid gap-6 sm:grid-cols-5">
				<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted sm:col-span-3">
					{#if topPick.image}
						<img
							src={topPick.image}
							alt={topPick.imageAlt}
							class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
							loading="eager"
						/>
					{/if}
				</div>

				<div class="flex flex-col justify-center sm:col-span-2">
					<p class="text-xs font-medium uppercase tracking-widest text-primary">Top pick</p>
					<h2 class="mt-2 font-display text-xl sm:text-2xl">{topPick.name}</h2>
					<p class="mt-3 line-clamp-3 text-sm leading-relaxed text-surface-muted-fg">{topPick.description}</p>

					<div class="mt-4">
						{#if topPick.salePrice}
							<span class="text-lg font-medium text-primary">${topPick.salePrice.toLocaleString()}</span>
							<span class="ml-2 text-sm text-surface-muted-fg line-through">${topPick.price.toLocaleString()}</span>
						{:else}
							<span class="text-lg font-medium">${topPick.price.toLocaleString()}</span>
						{/if}
					</div>

					<span class="mt-4 text-sm font-medium text-primary group-hover:underline">View details &rarr;</span>
				</div>
			</div>
		</a>
	{/if}

	<!-- Price-tier sections -->
	{#if under200.length > 0}
		<div class="mb-10">
			<h2 class="mb-4 text-lg font-medium">Under $200</h2>
			<div class="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
				{#each under200 as product}
					<a href="/product/{product.id}" class="group">
						<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
							{#if product.image}
								<img
									src={product.image}
									alt={product.imageAlt}
									class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
									loading="lazy"
								/>
							{/if}
						</div>
						<div class="mt-3">
							<h3 class="text-sm font-medium group-hover:text-primary transition-colors">{product.name}</h3>
							<p class="mt-1 line-clamp-2 text-xs text-surface-muted-fg">{product.description}</p>
							<div class="mt-2">
								{#if product.salePrice}
									<span class="font-medium text-primary">${product.salePrice.toLocaleString()}</span>
									<span class="ml-1.5 text-xs text-surface-muted-fg line-through">${product.price.toLocaleString()}</span>
								{:else}
									<span class="font-medium">${product.price.toLocaleString()}</span>
								{/if}
							</div>
						</div>
						<button
							onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}
							class="mt-3 w-full rounded-sm bg-surface-fg py-2 text-xs font-medium text-surface-bg transition-opacity hover:opacity-85"
						>
							Add to Cart
						</button>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	{#if mid.length > 0}
		<div class="mb-10">
			<h2 class="mb-4 text-lg font-medium">$200 – $500</h2>
			<div class="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
				{#each mid as product}
					<a href="/product/{product.id}" class="group">
						<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
							{#if product.image}
								<img
									src={product.image}
									alt={product.imageAlt}
									class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
									loading="lazy"
								/>
							{/if}
						</div>
						<div class="mt-3">
							<h3 class="text-sm font-medium group-hover:text-primary transition-colors">{product.name}</h3>
							<p class="mt-1 line-clamp-2 text-xs text-surface-muted-fg">{product.description}</p>
							<div class="mt-2">
								{#if product.salePrice}
									<span class="font-medium text-primary">${product.salePrice.toLocaleString()}</span>
									<span class="ml-1.5 text-xs text-surface-muted-fg line-through">${product.price.toLocaleString()}</span>
								{:else}
									<span class="font-medium">${product.price.toLocaleString()}</span>
								{/if}
							</div>
						</div>
						<button
							onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}
							class="mt-3 w-full rounded-sm bg-surface-fg py-2 text-xs font-medium text-surface-bg transition-opacity hover:opacity-85"
						>
							Add to Cart
						</button>
					</a>
				{/each}
			</div>
		</div>
	{/if}

	{#if splurge.length > 0}
		<div class="mb-10">
			<h2 class="mb-4 text-lg font-medium">Splurge-worthy</h2>
			<div class="grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
				{#each splurge as product}
					<a href="/product/{product.id}" class="group">
						<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
							{#if product.image}
								<img
									src={product.image}
									alt={product.imageAlt}
									class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
									loading="lazy"
								/>
							{/if}
						</div>
						<div class="mt-3">
							<h3 class="text-sm font-medium group-hover:text-primary transition-colors">{product.name}</h3>
							<p class="mt-1 line-clamp-2 text-xs text-surface-muted-fg">{product.description}</p>
							<div class="mt-2">
								{#if product.salePrice}
									<span class="font-medium text-primary">${product.salePrice.toLocaleString()}</span>
									<span class="ml-1.5 text-xs text-surface-muted-fg line-through">${product.price.toLocaleString()}</span>
								{:else}
									<span class="font-medium">${product.price.toLocaleString()}</span>
								{/if}
							</div>
						</div>
						<button
							onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}
							class="mt-3 w-full rounded-sm bg-surface-fg py-2 text-xs font-medium text-surface-bg transition-opacity hover:opacity-85"
						>
							Add to Cart
						</button>
					</a>
				{/each}
			</div>
		</div>
	{/if}
</div>
