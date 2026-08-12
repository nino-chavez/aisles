<script lang="ts">
	import type { Layout } from '$lib/schema/layout';
	import type { Product } from '$lib/types';
	import EditorialHeader from './sections/EditorialHeader.svelte';
	import HeroProduct from './sections/HeroProduct.svelte';
	import ProductGrid from './sections/ProductGrid.svelte';
	import CategoryHeader from './sections/CategoryHeader.svelte';
	import EditorialHero from './sections/EditorialHero.svelte';
	import LifestylePriceHero from './sections/LifestylePriceHero.svelte';
	import ImageGallery from './sections/ImageGallery.svelte';
	import ProductCarousel from './sections/ProductCarousel.svelte';
	import CategoryTileGrid from './sections/CategoryTileGrid.svelte';
	import ServiceCalloutsGrid from './sections/ServiceCalloutsGrid.svelte';
	import ClusterChipRow from './sections/ClusterChipRow.svelte';

	let { layout, products }: { layout: Layout; products: Product[] } = $props();

	/**
	 * Asset identity is resolved here, never authored by the model: the layout
	 * schema carries product references, and image URLs and routes come from the
	 * catalog record. The model is never shown a real URL, so anything it wrote
	 * itself would be a plausible-looking invention.
	 */
	function productHref(product: Product): string {
		return `/product/${product.id}`;
	}

	/** Resolve a product ID to the full product object */
	function resolveProduct(productId: string): Product | undefined {
		return products.find((p) => p.id === productId || String(p.entityId) === productId);
	}

	/** Resolve an array of product refs to full product objects */
	function resolveProducts(refs: Array<{ productId: string }>): Product[] {
		return refs
			.map((ref) => resolveProduct(ref.productId))
			.filter((p): p is Product => p !== undefined);
	}
</script>

{#each layout.sections as section}
	{#if section.component === 'editorial-header' && section.props?.eyebrow}
		<EditorialHeader
			eyebrow={section.props.eyebrow}
			headline={section.props.headline}
			body={section.props.body}
		/>
	{:else if section.component === 'hero-product' && section.props?.product?.productId}
		{@const product = resolveProduct(section.props.product.productId)}
		{#if product}
			<HeroProduct {product} showSpecs={section.props.showSpecs} />
		{/if}
	{:else if section.component === 'product-grid' && section.props?.products?.length}
		{@const gridProducts = resolveProducts(section.props.products)}
		<ProductGrid
			columns={section.props.columns}
			products={gridProducts}
			imageRatio={section.props.imageRatio}
			showDescription={section.props.showDescription}
			showSpecs={section.props.showSpecs}
			showQuickAdd={section.props.showQuickAdd}
		/>
	{:else if section.component === 'category-header' && section.props?.title}
		<CategoryHeader
			title={section.props.title}
			subtitle={section.props.subtitle}
			showSort={section.props.showSort}
			showFilter={section.props.showFilter}
		/>
	{:else if section.component === 'editorial-hero' && section.props?.product?.productId}
		{@const product = resolveProduct(section.props.product.productId)}
		{#if product?.image}
			<EditorialHero
				image={product.image}
				eyebrow={section.props.eyebrow}
				headline={section.props.headline}
				body={section.props.body}
				ctaLabel={section.props.ctaLabel}
				ctaHref={productHref(product)}
				textPosition={section.props.textPosition}
			/>
		{/if}
	{:else if section.component === 'lifestyle-price-hero' && section.props?.product?.productId}
		{@const product = resolveProduct(section.props.product.productId)}
		{#if product?.image}
			<LifestylePriceHero
				image={product.image}
				category={section.props.category}
				priceLabel={section.props.priceLabel}
				ctaLabel={section.props.ctaLabel}
				ctaHref={productHref(product)}
			/>
		{/if}
	{:else if section.component === 'image-gallery' && section.props?.product?.productId}
		{@const product = resolveProduct(section.props.product.productId)}
		{#if product?.image}
			<ImageGallery
				images={[{ url: product.image, alt: product.imageAlt || product.name }]}
				productName={product.name}
			/>
		{/if}
	{:else if section.component === 'product-carousel' && section.props?.products?.length}
		{@const carouselProducts = resolveProducts(section.props.products)}
		<ProductCarousel
			title={section.props.title}
			products={carouselProducts}
			showQuickAdd={section.props.showQuickAdd}
		/>
	{:else if section.component === 'category-tile-grid' && section.props?.tiles?.length}
		{@const tiles = section.props.tiles
			.map((tile) => {
				const product = resolveProduct(tile.product.productId);
				return product?.image
					? {
							label: tile.label,
							description: tile.description,
							image: product.image,
							href: productHref(product),
						}
					: null;
			})
			.filter((tile) => tile !== null)}
		<CategoryTileGrid sectionLabel={section.props.sectionLabel} columns={section.props.columns} {tiles} />
	{:else if section.component === 'service-callouts-grid' && section.props?.callouts?.length}
		<ServiceCalloutsGrid columns={section.props.columns} callouts={section.props.callouts} />
	{:else if section.component === 'cluster-chip-row' && section.props?.chips?.length}
		{@const chips = section.props.chips
			.map((chip) => {
				const product = resolveProduct(chip.product.productId);
				return product ? { label: chip.label, href: productHref(product) } : null;
			})
			.filter((chip) => chip !== null)}
		<ClusterChipRow sectionLabel={section.props.sectionLabel} {chips} />
	{/if}
{/each}
