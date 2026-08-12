<script lang="ts">
	import type { Product } from '$lib/types';
	import { addPick, isPicked, removePick } from '$lib/stores/picks.svelte';

	let {
		title,
		products,
		showQuickAdd = false,
	}: {
		title: string;
		products: Product[];
		showQuickAdd?: boolean;
	} = $props();

	let scrollEl = $state<HTMLDivElement | null>(null);

	function scrollBy(direction: 1 | -1) {
		if (!scrollEl) return;
		const amount = scrollEl.clientWidth * 0.8 * direction;
		scrollEl.scrollBy({ left: amount, behavior: 'smooth' });
	}
</script>

{#if products.length > 0}
	<div class="mb-10">
		<div class="mb-4 flex items-end justify-between">
			<h2 class="font-display text-xl tracking-tight sm:text-2xl">{title}</h2>
			<div class="flex gap-2">
				<button
					onclick={() => scrollBy(-1)}
					aria-label="Scroll left"
					class="flex h-9 w-9 items-center justify-center rounded-full border border-surface-border text-surface-muted-fg transition-colors hover:border-primary hover:text-primary"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
				</button>
				<button
					onclick={() => scrollBy(1)}
					aria-label="Scroll right"
					class="flex h-9 w-9 items-center justify-center rounded-full border border-surface-border text-surface-muted-fg transition-colors hover:border-primary hover:text-primary"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18l6-6-6-6"/></svg>
				</button>
			</div>
		</div>

		<div
			bind:this={scrollEl}
			class="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:thin]"
			style="scroll-snap-type: x mandatory;"
		>
			{#each products as product}
				<a
					href="/product/{product.id}"
					class="group flex w-[220px] shrink-0 flex-col overflow-hidden rounded-md bg-surface-card shadow-sm transition-shadow hover:shadow-md sm:w-[240px]"
					style="scroll-snap-align: start;"
				>
					<div class="relative aspect-square max-h-[min(70vh,640px)] overflow-hidden bg-surface-muted">
						{#if product.image}
							<img
								src={product.image}
								alt={product.imageAlt}
								loading="lazy"
								class="h-full w-full object-cover transition-opacity group-hover:opacity-90"
							/>
						{/if}

						<button
							onclick={(e) => { e.preventDefault(); e.stopPropagation(); isPicked(product.id) ? removePick(product.id) : addPick(product); }}
							class="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full transition-all
								{isPicked(product.id)
									? 'bg-accent text-white shadow-md'
									: 'bg-surface-card/80 text-surface-muted-fg opacity-0 group-hover:opacity-100 hover:bg-accent hover:text-white'}"
							aria-label="{isPicked(product.id) ? 'Remove from' : 'Add to'} picks"
						>
							<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="{isPicked(product.id) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
						</button>
					</div>

					<div class="flex flex-1 flex-col p-3">
						<h3 class="text-sm font-medium leading-snug group-hover:text-primary transition-colors">{product.name}</h3>

						<div class="mt-auto pt-2">
							{#if product.salePrice}
								<div class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
									<span class="numeric text-base font-semibold text-primary">${product.salePrice.toLocaleString()}</span>
									<span class="numeric text-xs text-surface-muted-fg line-through">${product.price.toLocaleString()}</span>
								</div>
							{:else}
								<span class="numeric text-base font-semibold">${product.price.toLocaleString()}</span>
							{/if}
						</div>

						{#if showQuickAdd}
							<button
								onclick={(e) => { e.preventDefault(); e.stopPropagation(); window.location.href = `/product/${product.id}`; }}
								class="mt-2 w-full rounded-sm border border-primary py-1.5 text-xs font-medium text-primary transition-colors hover:bg-primary hover:text-white"
							>
								Quick view
							</button>
						{/if}
					</div>
				</a>
			{/each}
		</div>
	</div>
{/if}
