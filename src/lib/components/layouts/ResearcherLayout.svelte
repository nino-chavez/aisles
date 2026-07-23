<script lang="ts">
	import type { Product } from '$lib/types';

	let { category, products }: { category: { name: string; slug: string }; products: Product[] } = $props();

	const sorted = $derived([...products].sort((a, b) => {
		// Sort by spec count (more specs = more interesting to a researcher), then by name
		const aSpecs = Object.keys(a.specs).length;
		const bSpecs = Object.keys(b.specs).length;
		if (bSpecs !== aSpecs) return bSpecs - aSpecs;
		return a.name.localeCompare(b.name);
	}));
</script>

<!-- Researcher: Spec-forward, comparison-friendly, evidence-driven -->
<div>
	<!-- Header with count and sort -->
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl">{category.name}</h1>
			<p class="mt-1 text-sm text-surface-muted-fg">{products.length} items &middot; Sorted by detail</p>
		</div>
		<div class="flex gap-2">
			<button class="rounded-sm border border-surface-border px-3 py-1.5 text-xs font-medium text-surface-muted-fg transition-colors hover:border-neutral-400 hover:text-surface-fg">
				Filter
			</button>
			<select class="rounded-sm border border-surface-border bg-surface-card px-3 py-1.5 text-xs font-medium text-surface-muted-fg">
				<option>Most detailed</option>
				<option>Price: Low to High</option>
				<option>Price: High to Low</option>
				<option>Name: A-Z</option>
			</select>
		</div>
	</div>

	<!-- Spec-card grid: 2-3 columns, every card shows full specs -->
	<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
		{#each sorted as product}
			<a href="/product/{product.id}" class="group flex flex-col rounded-sm border border-surface-border bg-surface-card transition-colors hover:border-primary/30">
				<div class="aspect-square overflow-hidden bg-surface-muted">
					{#if product.image}
						<img
							src={product.image}
							alt={product.imageAlt}
							class="h-full w-full object-cover transition-opacity group-hover:opacity-90"
							loading="lazy"
						/>
					{/if}
				</div>

				<div class="flex flex-1 flex-col p-4">
					<h3 class="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{product.name}</h3>

					<!-- Full description -->
					<p class="mt-2 line-clamp-3 text-xs leading-relaxed text-surface-muted-fg">{product.description}</p>

					<!-- Full specs table -->
					{#if Object.keys(product.specs).length > 0}
						<dl class="mt-3 border-t border-surface-border pt-3">
							{#each Object.entries(product.specs) as [key, value]}
								<div class="flex justify-between py-1 text-xs">
									<dt class="text-surface-muted-fg">{key}</dt>
									<dd class="font-medium text-surface-fg">{value}</dd>
								</div>
							{/each}
						</dl>
					{/if}

					<!-- Price at bottom -->
					<div class="mt-auto pt-3">
						{#if product.salePrice}
							<div class="flex items-baseline gap-2">
								<span class="text-base font-semibold text-primary">${product.salePrice.toLocaleString()}</span>
								<span class="text-xs text-surface-muted-fg line-through">${product.price.toLocaleString()}</span>
							</div>
						{:else}
							<span class="text-base font-semibold">${product.price.toLocaleString()}</span>
						{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>
</div>
