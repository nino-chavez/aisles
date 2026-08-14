<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibblePdpBundle, KibblePdpCopy, KibblePdpProduct, KibbleProductOption, KibbleProduct, KibbleZoneAdapterBinding } from './types';
	type RelatedContent = { component: 'product-carousel'; props: { title: string; products: Array<{ productId: string; role: 'standard' }>; showQuickAdd: false } };

	let {
		product,
		bundle,
		breadcrumbs,
		options,
		relatedProducts,
		relatedProductHrefs,
		purchaseUnavailableLabel,
		purchaseUnavailableBody,
		relatedHeading,
		copy,
		zoneAdapter,
		relatedModelDecision = null,
	}: {
		product: KibblePdpProduct;
		bundle: KibblePdpBundle | null;
		breadcrumbs: Array<{ label: string; href?: string }>;
		options: KibbleProductOption[];
		relatedProducts: KibbleProduct[];
		relatedProductHrefs: Record<string, string>;
		purchaseUnavailableLabel: string;
		purchaseUnavailableBody: string;
		relatedHeading: string;
		copy: KibblePdpCopy;
		zoneAdapter?: KibbleZoneAdapterBinding<any> | null;
		relatedModelDecision?: { zoneId: 'pdp.related'; routePath: string } | null;
	} = $props();

	let activeImage = $state(0);
	const gallery = $derived(bundle?.contents.some(({ image }) => image)
		? bundle.contents.map(({ brand, title, image }) => ({ url: image, alt: `${brand} ${title}` }))
		: product.images.length > 0
			? product.images
			: product.image
				? [{ url: product.image, alt: product.imageAlt }]
				: []);
	const currentImage = $derived(gallery[activeImage] ?? null);
	const salePrice = $derived(typeof product.salePrice === 'number' && product.salePrice < product.price ? product.salePrice : null);
	const relatedByEntityId = $derived(new Map(relatedProducts.map((related) => [String(related.entityId), related])));

	function money(value: number): string {
		return new Intl.NumberFormat('en-US', { style: 'currency', currency: product.currencyCode || 'USD' }).format(value);
	}

	$effect(() => {
		if (activeImage >= gallery.length) activeImage = 0;
	});
</script>

<article class="kibble-reference kc-reference-pdp" data-kibble-pdp-recipe="fixed-catalog-display-only">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label={copy.breadcrumbLabel}>
			{#each breadcrumbs as crumb, index}
				{#if crumb.href}<a class="kc-reference-focus" href={crumb.href}>{crumb.label}</a>{:else}<span aria-current="page">{crumb.label}</span>{/if}
				{#if index < breadcrumbs.length - 1}<span aria-hidden="true">/</span>{/if}
			{/each}
		</nav>

		<div class="kc-reference-pdp__layout">
			<div role="group" class:kc-reference-pdp__gallery--with-thumbnails={gallery.length > 1} class="kc-reference-pdp__gallery" data-gallery-count={gallery.length} aria-label={`${product.name} ${copy.galleryLabel}`}>
				{#if gallery.length > 1}
					<div class="kc-reference-pdp__thumbnails" aria-label={copy.galleryImagesLabel}>
						{#each gallery as image, index (image.url)}
							<button type="button" class:kc-reference-pdp__thumbnail--active={activeImage === index} class="kc-reference-pdp__thumbnail kc-reference-focus" onclick={() => activeImage = index} aria-label={`${copy.viewImageLabel} ${index + 1} ${product.name}`} aria-pressed={activeImage === index} aria-current={activeImage === index ? 'true' : undefined}>
								<img src={image.url} alt="" width="80" height="80" loading="lazy" />
							</button>
						{/each}
					</div>
				{/if}
				<div class="kc-reference-pdp__primary-image">
					{#if currentImage}<img src={currentImage.url} alt={currentImage.alt || product.name} width="1200" height="1200" loading="eager" />{:else}<span>{copy.imageUnavailableLabel}</span>{/if}
				</div>
			</div>

			<div class="kc-reference-pdp__details">
				{#if product.category}<p class="kc-reference-eyebrow">{product.category}</p>{/if}
				<h1 class="kc-reference-display">{product.name}</h1>
				{#if bundle}<p class="kc-reference-pdp__bundle-summary">{copy.bundleEyebrow} · {bundle.contents.length} {bundle.contents.length === 1 ? copy.bundleProductSingular : copy.bundleProductPlural}</p>{/if}
				<div class="kc-reference-pdp__price" aria-label={copy.priceLabel}>
					{#if salePrice !== null}<span class="kc-reference-price">{money(salePrice)}</span><s>{money(product.price)}</s>{:else}<span class="kc-reference-price">{money(product.price)}</span>{/if}
				</div>
				{#if product.sku}<p class="kc-reference-pdp__sku">{copy.skuLabel}: {product.sku}</p>{/if}
				<p class:kc-reference-pdp__stock--in={product.isInStock === true} class="kc-reference-pdp__stock">{product.isInStock === true ? copy.inStockLabel : product.isInStock === false ? copy.outOfStockLabel : copy.availabilityUnavailableLabel}</p>

				{#if bundle}
					<div class="kc-reference-pdp__bundle-contents">
						<h2 class="kc-reference-eyebrow">{copy.bundleContentsHeading}</h2>
						<ul>
							{#each bundle.contents as content (content.title)}
								<li>
									<img src={content.image} alt={`${content.brand} ${content.title}`} width="56" height="56" loading="lazy" />
									<div><strong>{content.title}</strong><span>{content.brand} · {content.role}</span></div>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

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

				{#if product.description}<div class="kc-reference-pdp__description"><h2>{copy.detailsHeading}</h2><div>{@html product.description}</div></div>{/if}
				{#if Object.keys(product.specs).length > 0}<dl class="kc-reference-pdp__specs">{#each Object.entries(product.specs) as [label, value]}<div><dt>{label}</dt><dd>{value}</dd></div>{/each}</dl>{/if}
			</div>
		</div>
	</div>

	{#if zoneAdapter}
		<div id="kibble-pdp-related" tabindex="-1" class="kc-reference-pdp__related" data-kibble-zone-instance={zoneAdapter.instanceId} data-kibble-zone-status={zoneAdapter.sharedStatus} data-kibble-zone-content-kind={zoneAdapter.sharedContentKind} data-kibble-zone-adapter={zoneAdapter.adapterId} data-kibble-zone-variant={zoneAdapter.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter.inputSha256} data-aisles-zone-instance={zoneAdapter.instanceId} data-aisles-zone-label={zoneAdapter.instanceId} data-aisles-authority={zoneAdapter.decisionMode ?? 'fixed'} data-aisles-model-calls={zoneAdapter.modelCallCount ?? 0} data-aisles-model-eligible={relatedModelDecision?.zoneId === 'pdp.related' ? 'true' : undefined} data-aisles-pdp-model-eligible={relatedModelDecision?.zoneId === 'pdp.related' ? 'true' : undefined}><div class="kc-reference-container"><h2 class="kc-reference-display">{zoneAdapter.content.props.title}</h2><div class="kc-reference-product-grid">{#each zoneAdapter.content.props.products as productRef (productRef.productId)}{@const related = relatedByEntityId.get(productRef.productId)}{#if related}<KibbleProductCard product={related} productHref={relatedProductHrefs[related.id]} />{/if}{/each}</div></div></div>
	{/if}
</article>
