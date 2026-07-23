<script lang="ts">
	import { getPickItems, removePick, type PickItem } from '$lib/stores/picks.svelte';
	import { getBrand } from '$lib/brand/config';

	let items = $derived(getPickItems());
	const brand = getBrand();

	// Collect all unique spec keys across all picked products, ordered by frequency
	let specKeys = $derived.by(() => {
		const keyCount = new Map<string, number>();
		for (const item of items) {
			for (const key of Object.keys(item.specs)) {
				keyCount.set(key, (keyCount.get(key) || 0) + 1);
			}
		}
		return [...keyCount.entries()]
			.sort((a, b) => b[1] - a[1])
			.map(([key]) => key);
	});
</script>

<svelte:head>
	<title>Compare ({items.length}) — {brand.name}</title>
	<meta name="description" content="Compare {items.length} products side by side." />
</svelte:head>

<div class="mx-auto max-w-7xl px-6 py-8">
	<div class="mb-8">
		<h1 class="text-3xl">Compare</h1>
		{#if items.length > 0}
			<p class="mt-2 text-surface-muted-fg">{items.length} products side by side</p>
		{/if}
	</div>

	{#if items.length === 0}
		<div class="flex h-64 flex-col items-center justify-center text-center">
			<p class="text-surface-muted-fg">No products to compare.</p>
			<p class="mt-2 text-sm text-surface-muted-fg">Add products to your picks from any category page.</p>
			<a href="/" class="mt-4 text-sm font-medium text-primary hover:text-secondary">Start browsing</a>
		</div>
	{:else if items.length === 1}
		<div class="flex h-64 flex-col items-center justify-center text-center">
			<p class="text-surface-muted-fg">Add at least one more product to compare.</p>
			<a href="/" class="mt-4 text-sm font-medium text-primary hover:text-secondary">Continue browsing</a>
		</div>
	{:else}
		<!-- Comparison table -->
		<div class="overflow-x-auto -mx-6 px-6">
			<table class="w-full min-w-[600px] border-collapse">
				<!-- Product images + names -->
				<thead>
					<tr>
						<th class="w-36 p-0"></th>
						{#each items as item}
							<th class="p-2 text-left align-top" style="min-width: {100 / items.length}%">
								<div class="relative">
									<a href="/product/{item.id}" class="block">
										<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
											{#if item.image}
												<img src={item.image} alt={item.name} class="h-full w-full object-cover" loading="lazy" decoding="async" />
											{/if}
										</div>
										<h3 class="mt-3 font-display text-base hover:text-primary transition-colors">{item.name}</h3>
									</a>
									<button
										onclick={() => removePick(item.id)}
										class="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-surface-card/80 text-surface-muted-fg hover:bg-error hover:text-white transition-colors"
										aria-label="Remove from comparison"
									>
										<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
									</button>
								</div>
							</th>
						{/each}
					</tr>
				</thead>

				<tbody>
					<!-- Price row -->
					<tr class="border-t border-surface-border">
						<td class="py-3 pr-4 text-sm font-medium text-surface-muted-fg">Price</td>
						{#each items as item}
							<td class="py-3 px-2">
								{#if item.salePrice}
									<span class="text-lg font-semibold text-primary">${item.salePrice.toLocaleString()}</span>
									<span class="ml-1 text-sm text-surface-muted-fg line-through">${item.price.toLocaleString()}</span>
								{:else}
									<span class="text-lg font-semibold">${item.price.toLocaleString()}</span>
								{/if}
							</td>
						{/each}
					</tr>

					<!-- Category row -->
					<tr class="border-t border-surface-border">
						<td class="py-3 pr-4 text-sm font-medium text-surface-muted-fg">Category</td>
						{#each items as item}
							<td class="py-3 px-2 text-sm">{item.category}</td>
						{/each}
					</tr>

					<!-- Spec rows — dynamically generated from all products -->
					{#each specKeys as key}
						<tr class="border-t border-surface-border">
							<td class="py-3 pr-4 text-sm font-medium text-surface-muted-fg">{key}</td>
							{#each items as item}
								<td class="py-3 px-2 text-sm">
									{#if item.specs[key]}
										<span class="text-surface-fg">{item.specs[key]}</span>
									{:else}
										<span class="text-surface-muted-fg/50">—</span>
									{/if}
								</td>
							{/each}
						</tr>
					{/each}

					<!-- Actions row -->
					<tr class="border-t border-surface-border">
						<td class="py-4 pr-4"></td>
						{#each items as item}
							<td class="py-4 px-2">
								<a
									href="/product/{item.id}"
									class="inline-block rounded-sm bg-surface-fg px-6 py-2.5 text-sm font-medium text-surface-bg transition-opacity hover:opacity-85"
								>
									View Details
								</a>
							</td>
						{/each}
					</tr>
				</tbody>
			</table>
		</div>
	{/if}
</div>
