<script lang="ts">
	import './kibble-reference.css';
	import type { KibbleAutoRefillOffer, KibbleProduct } from './types';

	let {
		product,
		productHref,
		merchantBrand,
		autoRefill,
		presentation = 'catalog-card',
	}: {
		product: KibbleProduct;
		productHref: string;
		merchantBrand?: string;
		autoRefill?: KibbleAutoRefillOffer | null;
		presentation?: 'catalog-card' | 'featured-tile';
	} = $props();

	const vendor = $derived(merchantBrand ?? product.specs.Brand ?? product.specs.brand ?? null);
	const salePrice = $derived(
		typeof product.salePrice === 'number' && product.salePrice < product.price
			? product.salePrice
			: null,
	);
	const currentPrice = $derived(autoRefill?.price ?? salePrice ?? product.price);
	const compareAt = $derived(autoRefill || salePrice !== null ? product.price : null);

	function money(value: number): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: 'USD',
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		}).format(value);
	}
</script>

<a
	href={productHref}
	class:kc-reference-product-card--featured={presentation === 'featured-tile'}
	class="kibble-reference kc-reference-product-card kc-reference-focus"
>
	<div class="kc-reference-product-card__media">
		{#if product.image}
			<img src={product.image} alt={product.imageAlt || product.name} width="600" height="600" loading="lazy" decoding="async" />
		{/if}
	</div>
	<div class="kc-reference-product-card__body">
		{#if vendor}<p class="kc-reference-eyebrow kc-reference-product-card__brand">{vendor}</p>{/if}
		<h3 class="kc-reference-product-card__name">{product.name}</h3>
		<div class="kc-reference-product-card__pricing">
			<span class="kc-reference-price kc-reference-product-card__current">{money(currentPrice)}</span>
			{#if compareAt !== null}<span class="kc-reference-price kc-reference-product-card__old">{money(compareAt)}</span>{/if}
		</div>
		{#if autoRefill}
			<span class="kc-reference-autorefill-seal kc-reference-product-card__seal">
				Auto-Refill · save {autoRefill.savingsPercent}%{#if autoRefill.cadenceLabel} · {autoRefill.cadenceLabel}{/if}
			</span>
		{/if}
	</div>
</a>
