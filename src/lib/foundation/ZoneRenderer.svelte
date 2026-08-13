<script lang="ts">
	/**
	 * ZoneRenderer — dispatches a resolved zone to the matching section
	 * component. The page's load function calls `resolveZone()` and passes
	 * the resolution here; the page never branches on source, ZoneRenderer
	 * only dispatches on `content.component`.
	 *
	 * Hidden semantic: when `resolution.content === null`, render no DOM.
	 *
	 * Asset-backed sections accept only ProductRef identities. This renderer
	 * resolves images and destinations from the trusted product catalog; zone
	 * content cannot carry raw URLs, hrefs, classes, or CSS.
	 *
	 * bealls-aisles wraps each item in a `DevZoneBadge` (zone id / source /
	 * layer overlay for dev mode). Aisles has no equivalent component and
	 * building one is outside this port's scope (`src/lib/foundation/`
	 * only) — omitted here rather than invented.
	 */

	import type { ZoneResolution } from './resolve-zone';
	import type { Product } from '$lib/types';
	import { materializeZoneComponent, type MaterializedZoneComponent } from './autonomy-zone-materializer';
	import { parseZoneContent } from './zone-schemas';
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

	type BlockContent = { component: string; props: Record<string, unknown> };

	function isBlockContent(c: unknown): c is BlockContent {
		return typeof c === 'object' && c !== null && 'component' in c && 'props' in c;
	}

	let items = $derived.by((): MaterializedZoneComponent[] => {
		const parsed = parseZoneContent(resolution.family, resolution.content);
		if (!parsed.ok || parsed.content === null) return [];
		const rawItems = Array.isArray(parsed.content)
			? parsed.content.filter(isBlockContent)
			: isBlockContent(parsed.content) ? [parsed.content] : [];
		return rawItems
			.map((item) => materializeZoneComponent(item, products))
			.filter((item): item is MaterializedZoneComponent => item !== null);
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
		<ProductGrid {...item.props} />
	{:else if item.component === 'editorial-hero'}
		<EditorialHero {...item.props} />
	{:else if item.component === 'lifestyle-price-hero'}
		<LifestylePriceHero {...item.props} />
	{:else if item.component === 'image-gallery'}
		<ImageGallery {...item.props} />
	{:else if item.component === 'product-carousel'}
		<ProductCarousel {...item.props} />
	{:else if item.component === 'category-tile-grid'}
		<CategoryTileGrid {...item.props} />
	{:else if item.component === 'service-callouts-grid'}
		<ServiceCalloutsGrid {...item.props} />
	{:else if item.component === 'cluster-chip-row'}
		<ClusterChipRow {...item.props} />
	{/if}
{/each}
