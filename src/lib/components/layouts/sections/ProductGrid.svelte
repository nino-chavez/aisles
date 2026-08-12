<script lang="ts">
	import type { Product } from '$lib/types';
	import { addPick, isPicked, removePick } from '$lib/stores/picks.svelte';

	let {
		columns = 2,
		products,
		imageRatio = 'landscape',
		showDescription = true,
		showSpecs = false,
		showQuickAdd = false,
	}: {
		columns: 2 | 3 | 4;
		products: Product[];
		imageRatio?: 'landscape' | 'square';
		showDescription?: boolean;
		showSpecs?: boolean;
		showQuickAdd?: boolean;
	} = $props();

	const gridClass = $derived(
		columns === 4
			? 'grid gap-px overflow-hidden rounded-sm border border-surface-border bg-surface-border sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
			: columns === 3
				? 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3'
				: 'grid gap-x-6 gap-y-10 sm:grid-cols-2'
	);

	const isCompact = $derived(columns >= 3);
</script>

<div class={gridClass}>
	{#each products as product}
		<a
			href="/product/{product.id}"
			class="group {isCompact ? 'flex flex-col bg-surface-card' : ''}"
		>
			<!-- Image -->
			<div class="relative overflow-hidden {isCompact ? '' : 'rounded-sm'} bg-surface-muted {imageRatio === 'square' ? 'aspect-square' : 'aspect-[4/3]'}">
				{#if product.image}
					<img
						src={product.image}
						alt={product.imageAlt}
						width={columns >= 3 ? 400 : 600}
						height={imageRatio === 'square' ? (columns >= 3 ? 400 : 600) : (columns >= 3 ? 300 : 450)}
						decoding="async"
						class="h-full w-full object-cover {isCompact ? 'transition-opacity group-hover:opacity-90' : 'transition-transform duration-500 group-hover:scale-[1.02]'}"
						loading="lazy"
					/>
				{/if}
				<!-- Pick toggle -->
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

			<!-- Info -->
			<div class="{isCompact ? 'flex flex-1 flex-col p-4' : 'mt-4'}">
				<h3 class="{isCompact ? 'text-sm font-medium leading-snug' : 'font-display text-lg'} group-hover:text-primary transition-colors">
					{product.name}
				</h3>

				{#if showDescription && !isCompact}
					<p class="mt-1.5 line-clamp-2 text-sm leading-relaxed text-surface-muted-fg">{product.description}</p>
				{/if}

				{#if showSpecs && Object.keys(product.specs).length > 0}
					<p class="mt-1 text-xs text-surface-muted-fg">
						{Object.values(product.specs).slice(0, 2).join(' · ')}
					</p>
				{/if}

				<div class="{isCompact ? 'mt-auto pt-3' : 'mt-3'}">
					{#if product.salePrice}
						<div class="flex items-baseline gap-2">
							<span class="{isCompact ? 'text-base font-semibold' : 'font-medium'} text-primary numeric">${product.salePrice.toLocaleString()}</span>
							<span class="text-{isCompact ? 'xs' : 'sm'} text-surface-muted-fg line-through numeric">${product.price.toLocaleString()}</span>
						</div>
					{:else}
						<span class="{isCompact ? 'text-base font-semibold' : 'font-medium'} numeric">${product.price.toLocaleString()}</span>
					{/if}
				</div>

				{#if showQuickAdd}
					<button
						onclick={async (e) => {
							e.preventDefault();
							e.stopPropagation();
							const btn = e.currentTarget;
							btn.textContent = 'Adding...';
							btn.disabled = true;
							try {
								const res = await fetch('/api/cart', {
									method: 'POST',
									headers: { 'Content-Type': 'application/json' },
									body: JSON.stringify({ productEntityId: product.entityId }),
								});
								if (res.ok) {
									const data = await res.json();
									btn.textContent = 'Added!';
									window.dispatchEvent(new CustomEvent('cart-updated', { detail: { itemCount: data.itemCount } }));
									setTimeout(() => { btn.textContent = 'Add to Cart'; btn.disabled = false; }, 1500);
								} else {
									btn.textContent = 'Failed';
									setTimeout(() => { btn.textContent = 'Add to Cart'; btn.disabled = false; }, 1500);
								}
							} catch {
								btn.textContent = 'Failed';
								setTimeout(() => { btn.textContent = 'Add to Cart'; btn.disabled = false; }, 1500);
							}
						}}
						class="mt-3 w-full rounded-sm bg-surface-fg py-2 text-xs font-medium text-surface-bg transition-opacity hover:opacity-85 disabled:opacity-50"
					>
						Add to Cart
					</button>
				{/if}
			</div>
		</a>
	{/each}
</div>
