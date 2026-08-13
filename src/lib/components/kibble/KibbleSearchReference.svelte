<script lang="ts">
	import './kibble-reference.css';
	import KibbleProductCard from './KibbleProductCard.svelte';
	import type { KibbleProduct, KibbleSearchResponseProvenance, KibbleZoneAdapterBinding } from './types';

	let {
		query,
		products,
		productHrefs = {},
		pageInfo,
		loadMoreHref,
		policyVersion,
		responseProvenance,
		zoneAdapter,
		availabilityMessage = '',
	}: {
		query: string;
		products?: KibbleProduct[];
		productHrefs?: Partial<Record<string, string>>;
		pageInfo?: { hasNextPage: boolean; endCursor: string | null };
		loadMoreHref?: string | null;
		policyVersion?: string;
		responseProvenance?: KibbleSearchResponseProvenance;
		zoneAdapter?: KibbleZoneAdapterBinding<any> | null;
		availabilityMessage?: string;
	} = $props();

	const title = $derived(query ? `Results for "${query}"` : 'Search');
	const renderedProducts = $derived(products ?? []);
	const renderedPageInfo = $derived(pageInfo ?? { hasNextPage: false, endCursor: null });
</script>

<div
	class="kibble-reference kc-reference-route kc-reference-search-page"
	data-kibble-route-shell="search"
	data-kibble-route-policy={policyVersion}
	data-reference-id={responseProvenance?.referenceId}
	data-reference-contract-version={responseProvenance?.referenceVersion}
	data-reference-fixture-sha256={responseProvenance?.fixedDataIdentity}
	data-reference-provenance-source={responseProvenance?.source}
	data-reference-route={responseProvenance?.routePath}
	data-reference-surface={responseProvenance ? 'search' : undefined}
	data-kibble-search-cursor={responseProvenance?.cursor ?? undefined}
	data-kibble-search-page-size={responseProvenance?.pageSize}
	data-kibble-search-catalog-sha256={responseProvenance?.catalogSha256}
	data-kibble-search-result-sha256={responseProvenance?.resultSha256}
	aria-labelledby="kibble-search-heading"
>
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			<a class="kc-reference-focus" href="/">Home</a><span aria-hidden="true">/</span><span aria-current="page">Search</span>
		</nav>

		<header class="kc-reference-route__header">
			<h1 id="kibble-search-heading" class="kc-reference-display">{title}</h1>
			<form class="kc-reference-search-page__form" method="get" action="/search" role="search">
				<label class="kc-reference-sr-only" for="kibble-route-search">Search products</label>
				<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
				<input id="kibble-route-search" class="kc-reference-focus" name="q" type="search" value={query} maxlength="160" placeholder="Search products…" />
			</form>
			{#if query}<p class="kc-reference-route__meta">{renderedProducts.length} {renderedProducts.length === 1 ? 'product' : 'products'}{renderedPageInfo.hasNextPage ? ' (more available)' : ''}</p>{/if}
		</header>

		{#if renderedProducts.length > 0}
			<div class="kc-reference-search-page__results">
				{#each renderedProducts as product (product.entityId)}<KibbleProductCard {product} productHref={productHrefs[product.id]} />{/each}
			</div>
			{#if loadMoreHref}<div class="kc-reference-category__pagination"><a class="kc-reference-focus" href={loadMoreHref}>Load more</a></div>{/if}
		{:else if zoneAdapter}
			<div class="kc-reference-route__empty" data-kibble-zone-instance={zoneAdapter.instanceId} data-kibble-zone-status={zoneAdapter.sharedStatus} data-kibble-zone-content-kind={zoneAdapter.sharedContentKind} data-kibble-zone-adapter={zoneAdapter.adapterId} data-kibble-zone-variant={zoneAdapter.componentVariantId} data-kibble-zone-input-sha256={zoneAdapter.inputSha256}>
				<p class="kc-reference-eyebrow">{zoneAdapter.content.props.eyebrow}</p>
				<h2>{zoneAdapter.content.props.headline}</h2>
				<p>{zoneAdapter.content.props.body}</p>
				<a class="kc-reference-route__text-link kc-reference-focus" href="/">Browse all categories</a>
			</div>
		{:else if availabilityMessage}<div class="kc-reference-route__empty"><p>{availabilityMessage}</p></div>{/if}
	</div>
</div>
