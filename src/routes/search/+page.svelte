<script lang="ts">
	import type { PageData } from './$types';
	import HunterLayout from '$lib/components/layouts/HunterLayout.svelte';
	import GathererLayout from '$lib/components/layouts/GathererLayout.svelte';
	import RefinementChat from '$lib/components/RefinementChat.svelte';
	import type { Layout } from '$lib/schema/layout';
	import { KibbleSearchReference } from '$lib/components/kibble';
	import {
		KIBBLE_SEARCH_DEFAULT_PRESENTATION,
		materializeKibbleSearchPresentation,
		snapshotKibbleSearchPresentation,
	} from '$lib/brand/reference/kibble-presentation-decisions';

	let { data }: { data: PageData } = $props();
	let refinedLayout = $state<Layout | null>(null);
	const results = $derived(data.results ?? []);
	type KibbleSearchData = NonNullable<PageData['kibbleSearch']>;
	let previewZoneAdapter = $state<KibbleSearchData['zoneAdapter'] | null>(null);
	let searchModelCallCount = $state(0);

	$effect(() => {
		data;
		previewZoneAdapter = null;
		searchModelCallCount = 0;
	});

	$effect(() => {
		const search = data.kibbleSearch;
		const decision = search?.searchModelDecision;
		if (data.renderMode !== 'reference-preserve' || !search || !decision || !search.zoneAdapter) return;
		let active = true;
		let cleanup: (() => void) | undefined;
		void import('$lib/components/kibble/kibble-bounded-copy-live-preview').then(({ listenForKibbleBoundedCopyLivePreview }) => {
			if (!active) return;
			cleanup = listenForKibbleBoundedCopyLivePreview({
				expectation: { surface: 'search', routePath: '/search', query: search.query, policyVersion: decision.policyVersion },
				requestEvent: 'aisles-kibble-search-model-request',
				getCurrentPresentation: () => snapshotKibbleSearchPresentation(materializeKibbleSearchPresentation(KIBBLE_SEARCH_DEFAULT_PRESENTATION, search.query)),
				onApplied: (preview) => { previewZoneAdapter = preview.zoneAdapter as KibbleSearchData['zoneAdapter']; searchModelCallCount = preview.modelCallCount; },
				onStatus: (status) => window.dispatchEvent(new CustomEvent('aisles-kibble-search-model-status', { detail: status })),
			});
			window.dispatchEvent(new CustomEvent('aisles-kibble-search-model-ready'));
		});
		return () => { active = false; cleanup?.(); };
	});
</script>

<svelte:head>
	<title>{data.renderMode === 'reference-preserve' ? 'Search — Kibble & Co.' : `Search: ${data.query}`}</title>
</svelte:head>

{#if data.renderMode === 'reference-preserve' && data.kibbleSearch}
	<KibbleSearchReference {...data.kibbleSearch} zoneAdapter={previewZoneAdapter ?? data.kibbleSearch.zoneAdapter} presentationModelCallCount={searchModelCallCount} />
{:else}
<div class="mx-auto max-w-7xl px-6 py-8">
	<!-- Dev mode: persona shift detection -->
	{#if data.devMode && data.personaShift}
		<div class="mb-6 rounded-sm border border-warning/30 bg-warning/5 p-4">
			<p class="text-xs font-medium uppercase tracking-wider text-warning">Persona Shift Detected</p>
			<p class="mt-1 text-sm text-surface-muted-fg">
				Stored persona: <span class="font-semibold">{data.storedPersona}</span> →
				New signals: <span class="font-semibold text-surface-fg">{data.persona}</span>
				({Math.round(data.confidence * 100)}% confidence)
			</p>
			<p class="mt-1 text-xs text-surface-muted-fg">
				Query "{data.query}" conflicts with stored model. System adapted to current intent.
			</p>
		</div>
	{/if}

	{#if results.length === 0}
		<div class="py-24 text-center">
			<h1 class="text-2xl">No results for "{data.query}"</h1>
			<p class="mt-2 text-surface-muted-fg">Try a different search or browse our categories.</p>
			<div class="mt-6 flex justify-center gap-4">
				<a href="/category/living-room" class="text-sm font-medium text-primary hover:text-secondary">Living Room</a>
				<a href="/category/office" class="text-sm font-medium text-primary hover:text-secondary">Office</a>
			</div>
		</div>
	{:else if data.suggestedCategory}
		<!-- Route to category page with persona-appropriate layout -->
		<div class="mb-6">
			<p class="text-sm text-surface-muted-fg">
				{data.resultCount} results for "<span class="text-surface-fg">{data.query}</span>"
				{#if data.devMode}
					— persona: {data.persona} ({Math.round(data.confidence * 100)}%)
				{/if}
			</p>
		</div>

		{#if data.persona === 'hunter'}
			<HunterLayout
				category={{ name: `Results for "${data.query}"`, slug: 'search' }}
			products={results}
			/>
		{:else}
			<GathererLayout
				category={{ name: `Results for "${data.query}"`, slug: 'search' }}
			products={results}
			/>
		{/if}
	{:else}
		<h1 class="text-2xl">{data.resultCount} results for "{data.query}"</h1>
		<div class="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
			{#each results as product}
				<a href="/product/{product.id}" class="group">
					<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
						{#if product.image}
							<img src={product.image} alt={product.imageAlt} class="h-full w-full object-cover" loading="lazy" />
						{/if}
					</div>
					<div class="mt-3">
						<h3 class="text-sm font-medium group-hover:text-primary">{product.name}</h3>
						<span class="mt-1 text-sm font-medium">${product.price}</span>
					</div>
				</a>
			{/each}
		</div>
	{/if}
</div>

{/if}

<!-- Refinement chat — floats over the page, same as category pages -->
{#if data.renderMode !== 'reference-preserve' && results.length > 0 && (data.suggestedCategory || data.persona)}
	<RefinementChat
		persona={data.persona}
		categorySlug={data.suggestedCategory || 'living-room'}
		currentLayout={refinedLayout}
		onLayoutUpdate={(newLayout) => { refinedLayout = newLayout; }}
	/>
{/if}
