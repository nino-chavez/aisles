<script lang="ts">
	import './kibble-reference.css';

	let {
		query = '',
		availabilityMessage,
		policyVersion,
	}: {
		query?: string;
		availabilityMessage: string;
		policyVersion?: string;
	} = $props();

	const title = $derived(query ? `Results for "${query}"` : 'Search');
</script>

<section class="kibble-reference kc-reference-route kc-reference-search-page" data-kibble-route-shell="search" data-kibble-route-policy={policyVersion} aria-labelledby="kibble-search-heading">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			<a class="kc-reference-focus" href="/">Home</a>
			<span aria-hidden="true">/</span>
			<span aria-current="page">Search</span>
		</nav>

		<header class="kc-reference-route__header">
			<h1 id="kibble-search-heading" class="kc-reference-display">{title}</h1>
			<form class="kc-reference-search-page__form" method="get" action="/search" role="search">
				<label class="kc-reference-sr-only" for="kibble-route-search">Search products</label>
				<input id="kibble-route-search" name="q" type="search" value={query} maxlength="160" placeholder="Search products" />
				<button class="kc-reference-button kc-reference-button--primary kc-reference-focus" type="submit">Search</button>
			</form>
			<p class="kc-reference-route__meta">Results unavailable</p>
		</header>

		<div class="kc-reference-route__empty" data-kibble-backend-state="unavailable">
			<p>{availabilityMessage}</p>
			<p class="kc-reference-route__supporting">You can change the query or browse the catalog without starting a search service request.</p>
			<a class="kc-reference-route__text-link kc-reference-focus" href="/">Browse all categories</a>
		</div>
	</div>
</section>
