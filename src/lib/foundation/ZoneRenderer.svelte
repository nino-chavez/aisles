<script lang="ts">
	/**
	 * ZoneRenderer — dispatches a resolved zone to the matching section
	 * component. The page's load function calls `resolveZone()` and passes
	 * the resolution here; the page never branches on source, ZoneRenderer
	 * only dispatches on `content.component`.
	 *
	 * Hidden semantic: when `resolution.content === null`, render no DOM.
	 *
	 * Seven of the nine dispatched components below (`EditorialHero`,
	 * `LifestylePriceHero`, `ImageGallery`, `ProductCarousel`,
	 * `CategoryTileGrid`, `ServiceCalloutsGrid`, `ClusterChipRow`) do not
	 * exist yet; a parallel work stream is adding them under
	 * `$lib/components/layouts/sections/`. These imports will not resolve
	 * until that lands — that is expected, not a bug in this file. Prop
	 * shapes for the six with a bealls-aisles equivalent are ported from
	 * that equivalent's real prop signature; `image-gallery` has no
	 * bealls-aisles zone equivalent (it is PDP scaffold there), so its
	 * prop shape below is inferred and may need adjusting once the real
	 * component lands.
	 *
	 * bealls-aisles wraps each item in a `DevZoneBadge` (zone id / source /
	 * layer overlay for dev mode). Aisles has no equivalent component and
	 * building one is outside this port's scope (`src/lib/foundation/`
	 * only) — omitted here rather than invented.
	 */

	import type { ZoneResolution } from './resolve-zone';
	import type { Product } from '$lib/types';
	import EditorialHeader from '$lib/components/layouts/sections/EditorialHeader.svelte';
	import ProductGrid from '$lib/components/layouts/sections/ProductGrid.svelte';
	import EditorialHero from '$lib/components/layouts/sections/EditorialHero.svelte';
	import LifestylePriceHero from '$lib/components/layouts/sections/LifestylePriceHero.svelte';
	import ImageGallery from '$lib/components/layouts/sections/ImageGallery.svelte';
	import ProductCarousel from '$lib/components/layouts/sections/ProductCarousel.svelte';
	import CategoryTileGrid from '$lib/components/layouts/sections/CategoryTileGrid.svelte';
	import ServiceCalloutsGrid from '$lib/components/layouts/sections/ServiceCalloutsGrid.svelte';
	import ClusterChipRow from '$lib/components/layouts/sections/ClusterChipRow.svelte';

	let {
		resolution,
		products = [],
	}: {
		resolution: ZoneResolution;
		/** Catalog for resolving ProductRef[] in carousel/grid blocks. */
		products?: Product[];
	} = $props();

	function resolveProducts(refs: Array<{ productId: string }> = []): Product[] {
		return refs
			.map((ref) => products.find((p) => p.id === ref.productId || String(p.entityId) === ref.productId))
			.filter((p): p is Product => p !== undefined);
	}

	type BlockContent = { component: string; props: Record<string, unknown> };

	function isBlockContent(c: unknown): c is BlockContent {
		return typeof c === 'object' && c !== null && 'component' in c && 'props' in c;
	}

	let items = $derived.by((): BlockContent[] => {
		if (resolution.content === null || resolution.content === undefined) return [];
		if (Array.isArray(resolution.content)) {
			return resolution.content.filter(isBlockContent);
		}
		return isBlockContent(resolution.content) ? [resolution.content] : [];
	});
</script>

{#each items as item (item.component + JSON.stringify(item.props).slice(0, 32))}
	{#if item.component === 'editorial-header'}
		<EditorialHeader
			eyebrow={item.props.eyebrow as string}
			headline={item.props.headline as string}
			body={item.props.body as string}
		/>
	{:else if item.component === 'product-grid'}
		{@const gridProducts = resolveProducts((item.props.products as Array<{ productId: string }>) ?? [])}
		{#if gridProducts.length > 0}
			<ProductGrid
				columns={item.props.columns as 2 | 3 | 4}
				products={gridProducts}
				imageRatio={item.props.imageRatio as 'landscape' | 'square'}
				showDescription={item.props.showDescription as boolean}
				showSpecs={item.props.showSpecs as boolean}
				showQuickAdd={item.props.showQuickAdd as boolean}
			/>
		{/if}
	{:else if item.component === 'editorial-hero'}
		<EditorialHero
			image={item.props.image as string}
			eyebrow={item.props.eyebrow as string | undefined}
			headline={item.props.headline as string}
			body={item.props.body as string | undefined}
			ctaLabel={item.props.ctaLabel as string | undefined}
			ctaHref={item.props.ctaHref as string | undefined}
			textPosition={item.props.textPosition as 'left' | 'center' | 'right'}
		/>
	{:else if item.component === 'lifestyle-price-hero'}
		<LifestylePriceHero
			image={item.props.image as string}
			category={item.props.category as string}
			priceLabel={item.props.priceLabel as string}
			ctaLabel={item.props.ctaLabel as string}
			ctaHref={item.props.ctaHref as string}
		/>
	{:else if item.component === 'image-gallery'}
		<ImageGallery
			images={item.props.images as Array<{ url: string; alt: string }>}
			productName={(item.props.productName as string) ?? ''}
		/>
	{:else if item.component === 'product-carousel'}
		{@const carouselProducts = resolveProducts((item.props.products as Array<{ productId: string }>) ?? [])}
		{#if carouselProducts.length > 0}
			<ProductCarousel
				title={item.props.title as string}
				products={carouselProducts}
				showQuickAdd={item.props.showQuickAdd as boolean | undefined}
			/>
		{/if}
	{:else if item.component === 'category-tile-grid'}
		<CategoryTileGrid
			sectionLabel={item.props.sectionLabel as string | undefined}
			columns={item.props.columns as 2 | 3 | 4 | 5}
			tiles={item.props.tiles as Array<{ label: string; image: string; href: string; description?: string }>}
		/>
	{:else if item.component === 'service-callouts-grid'}
		<ServiceCalloutsGrid
			columns={item.props.columns as 3 | 4}
			callouts={item.props.callouts as Array<{ icon: string; label: string; body?: string }>}
		/>
	{:else if item.component === 'cluster-chip-row'}
		<ClusterChipRow
			sectionLabel={item.props.sectionLabel as string | undefined}
			chips={item.props.chips as Array<{ label: string; href: string }>}
		/>
	{/if}
{/each}
