<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibbleProduct, KibbleZoneAdapterBinding } from './types';
	import type { KibblePlpSort } from '$lib/brand/reference/kibble-plp';

	let {
		eyebrow,
		title,
		breadcrumbs,
		sortLabel,
		sortOptions,
		selectedSort,
		productCount,
		productSingular,
		productPlural,
		emptyMessage,
		products,
		productHrefs,
		loadMoreHref,
		loadMoreLabel,
		zoneAdapter,
	}: {
		eyebrow: string;
		title: string;
		breadcrumbs: Array<{ label: string; href?: string }>;
		sortLabel: string;
		sortOptions: Array<{ value: KibblePlpSort; label: string }>;
		selectedSort: KibblePlpSort;
		productCount: number;
		productSingular: string;
		productPlural: string;
		emptyMessage: string;
		products: KibbleProduct[];
		productHrefs: Partial<Record<string, string>>;
		loadMoreHref: string | null;
		loadMoreLabel: string;
		zoneAdapter?: KibbleZoneAdapterBinding<any>;
	} = $props();

	function submitSort(event: Event) {
		(event.currentTarget as HTMLSelectElement).form?.requestSubmit();
	}
</script>

<section class="kibble-reference kc-reference-section kc-reference-category" aria-labelledby="kibble-category-heading">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			<ol>
				{#each breadcrumbs as crumb, index (`${index}-${crumb.label}`)}
					<li>
						{#if crumb.href && index < breadcrumbs.length - 1}
							<a class="kc-reference-focus" href={crumb.href}>{crumb.label}</a>
						{:else}
							<span aria-current="page">{crumb.label}</span>
						{/if}
					</li>
				{/each}
			</ol>
		</nav>

		<header class="kc-reference-category__header" data-kibble-zone-instance={zoneAdapter?.instanceId} data-kibble-zone-status={zoneAdapter?.sharedStatus} data-kibble-zone-content-kind={zoneAdapter?.sharedContentKind} data-kibble-zone-adapter={zoneAdapter?.adapterId} data-kibble-zone-variant={zoneAdapter?.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter?.inputSha256}>
			<div>
				<p class="kc-reference-eyebrow">{zoneAdapter?.content.props.eyebrow ?? eyebrow}</p>
				<h1 id="kibble-category-heading">{zoneAdapter?.content.props.headline ?? title}</h1>
			</div>
			<div class="kc-reference-category__controls">
				<p class="kc-reference-category__count">{zoneAdapter?.content.props.body ?? `${productCount} ${productCount === 1 ? productSingular : productPlural}`}</p>
				<form method="get" class="kc-reference-category__sort">
					<label for="kibble-category-sort">{sortLabel}</label>
					<select id="kibble-category-sort" name="sort" value={selectedSort} onchange={submitSort}>
						{#each sortOptions as option (option.value)}
							<option value={option.value}>{option.label}</option>
						{/each}
					</select>
				</form>
			</div>
		</header>

		{#if products.length > 0}
			<div class="kc-reference-product-grid">
				{#each products as product (product.entityId)}
					<KibbleProductCard product={product} productHref={productHrefs[product.id]} />
				{/each}
			</div>
		{:else}
			<p class="kc-reference-category__empty">{emptyMessage}</p>
		{/if}

		{#if loadMoreHref}
			<div class="kc-reference-category__pagination">
				<a class="kc-reference-focus" href={loadMoreHref}>{loadMoreLabel}</a>
			</div>
		{/if}
	</div>
</section>
