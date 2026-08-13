<script lang="ts">
	import './kibble-reference.css';

	let {
		surface,
		query = '',
		heading,
		message,
		returnLabel,
	}: {
		surface: 'search' | 'cart' | 'checkout' | 'account';
		query?: string;
		heading: string;
		message: string;
		returnLabel: string;
	} = $props();

	const searchLabel = $derived(query ? `Results for “${query}”` : 'Search');
</script>

<section class="kibble-reference kc-reference-section kc-reference-unavailable" data-kibble-unavailable-surface={surface} aria-labelledby="kibble-unavailable-heading">
	<div class="kc-reference-container">
		<nav class="kc-reference-breadcrumbs" aria-label="Breadcrumb">
			<a class="kc-reference-focus" href="/">Home</a>
			<span aria-hidden="true">/</span>
			<span aria-current="page">{heading}</span>
		</nav>

		<header class="kc-reference-unavailable__header">
			<h1 id="kibble-unavailable-heading" class="kc-reference-display">{surface === 'search' ? searchLabel : heading}</h1>
			{#if surface === 'search'}
				<div class="kc-reference-unavailable__search" aria-label="Search products unavailable">
					<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
					<input type="search" value={query} placeholder="Search products" disabled aria-label="Search products unavailable" />
				</div>
			{/if}
		</header>

		<div class="kc-reference-unavailable__body">
			<p>{message}</p>
			<a href="/" class="kc-reference-button kc-reference-button--primary kc-reference-focus">{returnLabel}</a>
		</div>
	</div>
</section>
