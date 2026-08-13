<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibblePdpCopy, KibblePdpProduct, KibbleProductOption, KibbleProduct } from './types';

	let {
		product,
		breadcrumbs,
		options,
		relatedProducts,
		relatedProductHrefs,
		purchaseUnavailableLabel,
		purchaseUnavailableBody,
		relatedHeading,
		copy,
	}: {
		product: KibblePdpProduct;
		breadcrumbs: Array<{ label: string; href?: string }>;
		options: KibbleProductOption[];
		relatedProducts: KibbleProduct[];
		relatedProductHrefs: Record<string, string>;
		purchaseUnavailableLabel: string;
		purchaseUnavailableBody: string;
		relatedHeading: string;
		copy: KibblePdpCopy;
	} = $props();

	let activeImage = $state(0);
	const gallery = $derived(product.images.length > 0 ? product.images : product.image ? [{ url: product.image, alt: product.imageAlt }] : []);
	const currentImage = $derived(gallery[activeImage] ?? null);
	const salePrice = $derived(typeof product.salePrice === 'number' && product.salePrice < product.price ? product.salePrice : null);

	function money(value: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currencyCode || 'USD' }).format(value);
	}
</script>

<article class="kibble-reference kc-reference-pdp" data-kibble-pdp-recipe="fixed-catalog-display-only">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			{#each breadcrumbs as crumb, index}
				{#if crumb.href}<a class="kc-reference-focus" href={crumb.href}>{crumb.label}</a>{:else}<span aria-current="page">{crumb.label}</span>{/if}
				{#if index < breadcrumbs.length - 1}<span aria-hidden="true">/</span>{/if}
			{/each}
		</nav>

		<div class="kc-reference-pdp__layout">
			<section class="kc-reference-pdp__gallery" aria-label={`${product.name} ${copy.galleryLabel}`}>
				{#if gallery.length > 1}
					<div class="kc-reference-pdp__thumbnails" aria-label={copy.galleryImagesLabel}>
						{#each gallery as image, index (image.url)}
							<button type="button" class:kc-reference-pdp__thumbnail--active={activeImage === index} class="kc-reference-pdp__thumbnail kc-reference-focus" onclick={() => activeImage = index} aria-label={`${copy.viewImageLabel} ${index + 1} ${product.name}`}>
								<img src={image.url} alt="" width="80" height="80" loading="lazy" />
							</button>
						{/each}
					</div>
				{/if}
				<div class="kc-reference-pdp__primary-image">
					{#if currentImage}<img src={currentImage.url} alt={currentImage.alt || product.name} width="1200" height="1200" loading="eager" />{:else}<span>{copy.imageUnavailableLabel}</span>{/if}
				</div>
			</section>

			<section class="kc-reference-pdp__details">
				{#if product.category}<p class="kc-reference-eyebrow">{product.category}</p>{/if}
				<h1 class="kc-reference-display">{product.name}</h1>
				<div class="kc-reference-pdp__price" aria-label={copy.priceLabel}>
					{#if salePrice !== null}<span class="kc-reference-price">{money(salePrice)}</span><s>{money(product.price)}</s>{:else}<span class="kc-reference-price">{money(product.price)}</span>{/if}
				</div>
				{#if product.sku}<p class="kc-reference-pdp__sku">{copy.skuLabel}: {product.sku}</p>{/if}
				<p class:kc-reference-pdp__stock--in={product.isInStock === true} class="kc-reference-pdp__stock">{product.isInStock === true ? copy.inStockLabel : product.isInStock === false ? copy.outOfStockLabel : copy.availabilityUnavailableLabel}</p>

				{#if options.length > 0}
					<fieldset class="kc-reference-pdp__options" disabled aria-describedby="purchase-unavailable">
						<legend>{copy.optionsLegend}</legend>
						{#each options as option (option.entityId)}
							<label>{option.displayName}{option.isRequired ? ` ${copy.requiredSuffix}` : ''}
								<select aria-label={option.displayName}>{#each option.values as value (value.entityId)}<option selected={value.isDefault}>{value.label}</option>{/each}</select>
							</label>
						{/each}
					</fieldset>
				{/if}

				<aside class="kc-reference-pdp__purchase-unavailable" id="purchase-unavailable" aria-live="polite">
					<p class="kc-reference-eyebrow">{purchaseUnavailableLabel}</p>
					<p>{purchaseUnavailableBody}</p>
				</aside>

				{#if product.description}<section class="kc-reference-pdp__description"><h2>{copy.detailsHeading}</h2><p>{product.description}</p></section>{/if}
				{#if Object.keys(product.specs).length > 0}<dl class="kc-reference-pdp__specs">{#each Object.entries(product.specs) as [label, value]}<div><dt>{label}</dt><dd>{value}</dd></div>{/each}</dl>{/if}
			</section>
		</div>
	</div>

	{#if relatedProducts.length > 0}
		<section class="kc-reference-pdp__related"><div class="kc-reference-container"><h2 class="kc-reference-display">{relatedHeading}</h2><div class="kc-reference-product-grid">{#each relatedProducts as related (related.entityId)}<KibbleProductCard product={related} productHref={relatedProductHrefs[related.id]} />{/each}</div></div></section>
	{/if}
</article>
