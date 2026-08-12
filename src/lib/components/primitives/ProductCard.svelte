<script lang="ts">
	import PriceLabel from './PriceLabel.svelte';

	type CardProduct = {
		id: string;
		name: string;
		price: number;
		listPrice?: number | null;
		salePrice?: number | null;
		image?: string;
		imageAlt?: string;
		brand?: string;
		category?: string;
		badges?: string[];
		rating?: number | null;
		reviewCount?: number | null;
	};

	let {
		product,
		aspectRatio = '5:6',
		size = 'md',
		showBadges = true,
		showRating = false,
		showBrand = false,
		hrefPrefix = '/product/',
		quickAdd,
	}: {
		product: CardProduct;
		/** Media box aspect ratio. Apparel/general default 5:6; home 4:3; square 1:1. */
		aspectRatio?: '5:6' | '4:3' | '1:1';
		size?: 'sm' | 'md' | 'lg';
		showBadges?: boolean;
		showRating?: boolean;
		showBrand?: boolean;
		hrefPrefix?: string;
		/** Optional snippet for an inline quick-add CTA. */
		quickAdd?: import('svelte').Snippet<[CardProduct]>;
	} = $props();

	const ratioClass = $derived(
		{ '5:6': 'aspect-[5/6]', '4:3': 'aspect-[4/3]', '1:1': 'aspect-square' }[aspectRatio]
	);

	const sizeClass = $derived(
		{ sm: 'text-xs', md: 'text-sm', lg: 'text-base' }[size]
	);

	function badgeClass(label: string): string {
		const l = label.toLowerCase();
		if (l === 'new') return 'bg-accent text-white';
		if (l === 'deal' || l === 'sale') return 'bg-primary text-white';
		if (l === 'clearance') return 'bg-error text-white';
		return 'bg-surface-fg text-surface-bg';
	}

	const finalPrice = $derived(product.salePrice ?? product.price);
	const compareAt = $derived(
		product.salePrice && product.salePrice < product.price
			? product.price
			: product.listPrice ?? null
	);
</script>

<a
	href="{hrefPrefix}{product.id}"
	class="group flex flex-col overflow-hidden rounded-md bg-surface-card shadow-sm transition-shadow hover:shadow-md"
>
	<div class="relative {ratioClass} max-h-[min(70vh,640px)] overflow-hidden bg-surface-muted">
		{#if product.image}
			<img
				src={product.image}
				alt={product.imageAlt ?? product.name}
				loading="lazy"
				decoding="async"
				class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
			/>
		{/if}

		{#if showBadges && product.badges && product.badges.length > 0}
			<div class="absolute left-2 top-2 flex flex-col gap-1">
				{#each product.badges as badge}
					<span class="rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider {badgeClass(badge)}">
						{badge}
					</span>
				{/each}
			</div>
		{/if}
	</div>

	<div class="flex flex-1 flex-col gap-1.5 p-3">
		{#if showBrand && product.brand}
			<span class="text-[0.6875rem] font-semibold uppercase tracking-wider text-surface-muted-fg">{product.brand}</span>
		{/if}

		<p class="{sizeClass} font-medium leading-snug text-surface-fg group-hover:text-primary">{product.name}</p>

		{#if showRating && typeof product.rating === 'number'}
			<div class="flex items-center gap-1 text-[0.6875rem] text-surface-muted-fg">
				<span aria-hidden="true" class="text-warning">{'★'.repeat(Math.round(product.rating))}{'☆'.repeat(5 - Math.round(product.rating))}</span>
				{#if product.reviewCount}<span class="numeric">({product.reviewCount})</span>{/if}
			</div>
		{/if}

		<PriceLabel price={finalPrice} listPrice={compareAt} size={size === 'lg' ? 'md' : 'sm'} />

		{#if quickAdd}
			<div class="mt-2">
				{@render quickAdd(product)}
			</div>
		{/if}
	</div>
</a>
