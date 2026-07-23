<script lang="ts">
	import type { Layout } from '$lib/schema/layout';
	import type { Product } from '$lib/types';
	import EditorialHeader from './sections/EditorialHeader.svelte';
	import HeroProduct from './sections/HeroProduct.svelte';
	import ProductGrid from './sections/ProductGrid.svelte';
	import CategoryHeader from './sections/CategoryHeader.svelte';

	let { layout, products }: { layout: Layout; products: Product[] } = $props();

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
	{/if}
{/each}
