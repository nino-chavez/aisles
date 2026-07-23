<script lang="ts">
	import type { Product } from '$lib/types';

	let { category, products }: { category: { name: string; slug: string }; products: Product[] } = $props();

	type SortMode = 'price-asc' | 'price-desc' | 'newest';
	let sortMode = $state<SortMode>('price-asc');
	let filterOpen = $state(false);
	let onSaleOnly = $state(false);

	const priceBounds = $derived.by(() => {
		if (products.length === 0) return { min: 0, max: 1000 };
		const prices = products.map((p) => p.salePrice || p.price);
		return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
	});

	let maxPrice = $state(Infinity);
	$effect(() => {
		if (maxPrice === Infinity) maxPrice = priceBounds.max;
	});

	const filtered = $derived.by(() => {
		return products.filter((p) => {
			const effective = p.salePrice || p.price;
			if (effective > maxPrice) return false;
			if (onSaleOnly && !p.salePrice) return false;
			return true;
		});
	});

	const sorted = $derived.by(() => {
		const arr = [...filtered];
		if (sortMode === 'price-asc') return arr.sort((a, b) => (a.salePrice || a.price) - (b.salePrice || b.price));
		if (sortMode === 'price-desc') return arr.sort((a, b) => (b.salePrice || b.price) - (a.salePrice || a.price));
		return arr; // newest = original order
	});

	const activeFilterCount = $derived(
		(onSaleOnly ? 1 : 0) + (maxPrice < priceBounds.max ? 1 : 0)
	);

	function resetFilters() {
		onSaleOnly = false;
		maxPrice = priceBounds.max;
	}
</script>

<!-- Hunter: Dense, functional, price-first, scannable -->
<div>
	<!-- Compact header with filters -->
	<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="text-2xl">{category.name}</h1>
			<p class="mt-1 text-sm text-surface-muted-fg">{sorted.length} of {products.length} items</p>
		</div>
		<div class="relative flex gap-2">
			<button
				type="button"
				onclick={() => (filterOpen = !filterOpen)}
				class="flex items-center gap-1.5 rounded-sm border border-surface-border px-3 py-1.5 text-xs font-medium transition-colors hover:border-neutral-400 {activeFilterCount > 0 || filterOpen ? 'border-neutral-500 text-surface-fg' : 'text-surface-muted-fg hover:text-surface-fg'}"
				aria-expanded={filterOpen}
			>
				Filter
				{#if activeFilterCount > 0}
					<span class="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-surface-bg">
						{activeFilterCount}
					</span>
				{/if}
			</button>
			<select
				bind:value={sortMode}
				class="rounded-sm border border-surface-border bg-surface-card px-3 py-1.5 text-xs font-medium text-surface-muted-fg"
			>
				<option value="price-asc">Price: Low to High</option>
				<option value="price-desc">Price: High to Low</option>
				<option value="newest">Newest</option>
			</select>

			{#if filterOpen}
				<div
					class="absolute right-0 top-full z-20 mt-2 w-72 rounded-md border border-surface-border bg-surface-card p-4 shadow-xl"
					role="dialog"
					aria-label="Filter products"
				>
					<div class="mb-3 flex items-center justify-between">
						<span class="text-xs font-semibold uppercase tracking-wider text-surface-muted-fg">Filters</span>
						<button
							type="button"
							onclick={resetFilters}
							class="text-[11px] text-surface-muted-fg hover:text-surface-fg"
						>
							Reset
						</button>
					</div>

					<div class="space-y-4">
						<!-- Max price -->
						<div>
							<div class="mb-1.5 flex items-baseline justify-between text-xs">
								<label for="max-price" class="font-medium text-surface-fg">Max price</label>
								<span class="font-mono tabular-nums text-surface-muted-fg">${maxPrice}</span>
							</div>
							<input
								id="max-price"
								type="range"
								min={priceBounds.min}
								max={priceBounds.max}
								bind:value={maxPrice}
								class="w-full accent-primary"
							/>
							<div class="mt-1 flex justify-between text-[10px] text-surface-muted-fg">
								<span>${priceBounds.min}</span>
								<span>${priceBounds.max}</span>
							</div>
						</div>

						<!-- On sale only -->
						<label class="flex items-center gap-2 text-xs text-surface-fg">
							<input
								type="checkbox"
								bind:checked={onSaleOnly}
								class="rounded border-surface-border"
							/>
							On sale only
						</label>
					</div>

					<button
						type="button"
						onclick={() => (filterOpen = false)}
						class="mt-4 w-full rounded-sm bg-surface-fg py-2 text-xs font-medium text-surface-bg hover:opacity-85"
					>
						Apply
					</button>
				</div>
			{/if}
		</div>
	</div>

	<!-- Dense grid -->
	{#if sorted.length === 0}
		<div class="rounded-sm border border-surface-border bg-surface-card px-6 py-16 text-center">
			<p class="text-sm text-surface-muted-fg">No products match the current filters.</p>
			<button
				type="button"
				onclick={resetFilters}
				class="mt-3 text-xs font-medium text-primary hover:text-secondary"
			>
				Clear filters
			</button>
		</div>
	{:else}
		<div class="grid gap-px overflow-hidden rounded-sm border border-surface-border bg-surface-border sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
			{#each sorted as product}
				<a href="/product/{product.id}" class="group flex flex-col bg-surface-card">
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

						{#if Object.keys(product.specs).length > 0}
							<p class="mt-1 text-xs text-surface-muted-fg">
								{Object.values(product.specs).slice(0, 2).join(' · ')}
							</p>
						{/if}

						<div class="mt-auto pt-3">
							{#if product.salePrice}
								<div class="flex items-baseline gap-2">
									<span class="text-base font-semibold text-primary">${product.salePrice}</span>
									<span class="text-xs text-surface-muted-fg line-through">${product.price}</span>
								</div>
							{:else}
								<span class="text-base font-semibold">${product.price}</span>
							{/if}
						</div>

						<button
							onclick={(e) => { e.preventDefault(); e.stopPropagation(); }}
							class="mt-3 w-full rounded-sm bg-surface-fg py-2 text-xs font-medium text-surface-bg transition-opacity hover:opacity-85"
						>
							Add to Cart
						</button>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>
