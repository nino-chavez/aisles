<script lang="ts">
	import type { Component } from 'svelte';
	import { onMount } from 'svelte';
	import type { PageData } from './$types';
	import type { Layout } from '$lib/schema/layout';
	import LayoutRenderer from '$lib/components/layouts/LayoutRenderer.svelte';
	import { KibbleHomeReference } from '$lib/components/kibble';
	import type { KibbleDevInspectorData, KibbleLivePreviewStatus } from '$lib/components/kibble/kibble-dev-inspector';
	import type { KibbleProduct, KibbleZoneAdapterBinding } from '$lib/components/kibble/types';
	import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
	import { KIBBLE_PARITY_FIXED_DATA_IDENTITY } from '$lib/brand/reference/kibble-parity';
	import { picksContextForPrompt } from '$lib/stores/picks.svelte';

	let { data }: { data: PageData } = $props();

	let aiLayout = $state<Layout | null>(null);
	let aiError = $state<string | null>(null);
	let overridePersona = $state<string | null>(null);
	let DevInspector = $state<Component<{ inspector: KibbleDevInspectorData; livePreview?: KibbleLivePreviewStatus; sessionId?: string | null; hideHref?: string }> | null>(null);
	let previewProducts = $state<KibbleProduct[] | null>(null);
	let previewFeaturedZoneAdapters = $state<KibbleZoneAdapterBinding[] | null>(null);
	let previewInspector = $state<KibbleDevInspectorData | null>(null);
	let livePreviewStatus = $state<KibbleLivePreviewStatus>({ state: 'waiting' });
	let signalLabOpen = $state(false);
	let currentPersona = $derived(overridePersona ?? data.persona ?? 'gatherer');
	let inspectorHideHref = $derived(data.observeEnableHref ?? '/?observe=true');
	let activeHomeZoneAdapters = $derived(data.kibbleHome ? {
		...data.kibbleHome.zoneAdapters,
		...(previewFeaturedZoneAdapters ? { featuredRows: previewFeaturedZoneAdapters } : {}),
	} : undefined);

	onMount(() => {
		const syncSignalLab = () => { signalLabOpen = window.location.hash === '#kibble-signal-lab'; };
		syncSignalLab();
		window.addEventListener('hashchange', syncSignalLab);
		return () => window.removeEventListener('hashchange', syncSignalLab);
	});

	$effect(() => {
		if (!data.kibbleHomeInspector || !signalLabOpen || DevInspector) return;
		void import('$lib/components/kibble/KibbleDevInspector.svelte').then(({ default: component }) => {
			DevInspector = component;
		});
	});

	// A navigation establishes a new approved shelf. Do not carry a demo preview
	// or an in-flight response across that PageData boundary.
	$effect(() => {
		data;
		previewProducts = null;
		previewFeaturedZoneAdapters = null;
		previewInspector = null;
		livePreviewStatus = { state: 'waiting' };
	});

	$effect(() => {
		if (data.renderMode !== 'reference-preserve' || !data.kibbleHomeInspector) return;
		const trustedInspector = data.kibbleHomeInspector;
		let disposed = false;
		let cleanup: (() => void) | undefined;
		void import('$lib/components/kibble/kibble-live-preview').then(({ expectationFromTrustedInspector, listenForKibbleLivePreview }) => {
			if (disposed) return;
			const expectation = expectationFromTrustedInspector(trustedInspector);
			if (!expectation) {
				livePreviewStatus = { state: 'failed' };
				return;
			}
			cleanup = listenForKibbleLivePreview({
				expectation,
				getCurrentProductIds: () => (previewProducts ?? data.kibbleHome?.products ?? []).map(({ id }) => id),
				onApplied: (preview) => {
					previewProducts = preview.products;
					previewFeaturedZoneAdapters = preview.featuredZoneAdapters ?? null;
					previewInspector = preview.inspector;
				},
				onStatus: (status) => { livePreviewStatus = status; },
			});
		});
		return () => {
			disposed = true;
			cleanup?.();
		};
	});

	// Fetch an AI-generated layout for categorySlug "home" on mount, and again
	// whenever the inferred persona changes. Failure/timeout leaves aiLayout
	// null, so the static markup below (the existing homepage) keeps rendering.
	$effect(() => {
		if (data.renderMode === 'reference-preserve') return;
		fetchLayout(currentPersona);
	});

	// Listen for inference updates from the client-side signal pipeline, same
	// as the category page — a mid-session persona shift triggers a refetch.
	$effect(() => {
		const handleInferenceUpdate = (e: Event) => {
			const inference = (e as CustomEvent).detail;
			if (inference?.primary && inference.primary !== currentPersona) {
				overridePersona = inference.primary;
			}
		};

		window.addEventListener('aisles-inference-update', handleInferenceUpdate);
		return () => window.removeEventListener('aisles-inference-update', handleInferenceUpdate);
	});

	async function fetchLayout(persona: string) {
		if (data.renderMode === 'reference-preserve') return;
		aiError = null;

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 30000);

			const res = await fetch('/api/layout/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					persona,
					categorySlug: 'home',
					picksContext: picksContextForPrompt(),
					probabilities: data.inference?.probabilities,
					incentives: data.incentivesPromptContext,
				}),
				signal: controller.signal,
			});

			clearTimeout(timeout);

			if (!res.ok) {
				const err = await res.json();
				throw new Error(err.message || 'Layout generation failed');
			}

			const contentType = res.headers.get('content-type') || '';

			if (contentType.includes('application/json')) {
				// Cache hit — complete JSON response
				const result = await res.json();
				aiLayout = result.layout;
			} else {
				// Cache miss — SSE stream of partial objects
				const reader = res.body?.getReader();
				if (!reader) throw new Error('No response body');

				const decoder = new TextDecoder();
				let buffer = '';

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					buffer += decoder.decode(value, { stream: true });

					const lines = buffer.split('\n\n');
					buffer = lines.pop() || '';

					for (const chunk of lines) {
						const line = chunk.trim();
						if (!line.startsWith('data: ')) continue;

						const payload = JSON.parse(line.slice(6));

						if (payload.__done) {
							aiLayout = payload.layout;
						} else if (payload.__error) {
							throw new Error(payload.message);
						} else if (payload.sections?.length) {
							// Partial layout — render sections as they arrive
							aiLayout = payload as Layout;
						}
					}
				}
			}
		} catch (err) {
			aiError = err instanceof Error ? err.message : 'Unknown error';
			console.error('AI homepage layout generation failed, using static homepage:', aiError);
		}
	}

</script>

<svelte:head>
	<title>{data.renderMode === 'reference-preserve' ? data.brandName : `${data.brandName} — ${data.brandTagline}`}</title>
	<meta name="description" content={data.renderMode === 'reference-preserve' && data.kibbleHome ? data.kibbleHome.hero.body : data.homepage.heroBody} />
</svelte:head>

{#if data.renderMode === 'reference-preserve' && data.kibbleHome}
	{#if data.kibbleHomeInspector && signalLabOpen && DevInspector}
		<DevInspector
			inspector={previewInspector ?? data.kibbleHomeInspector}
			livePreview={livePreviewStatus}
			sessionId={data.sessionId}
			hideHref={inspectorHideHref}
		/>
	{/if}
	<div
		data-reference-id={KIBBLE_REFERENCE_CONTRACT.id}
		data-reference-contract-version={KIBBLE_REFERENCE_CONTRACT.version}
		data-reference-fixture={KIBBLE_REFERENCE_CONTRACT.source.fixturePath}
		data-reference-fixture-sha256={KIBBLE_PARITY_FIXED_DATA_IDENTITY}
	>
		<KibbleHomeReference
			hero={data.kibbleHome.hero}
			products={previewProducts ?? data.kibbleHome.products}
			productHrefs={data.kibbleHome.productHrefs}
			categories={data.kibbleHome.categories}
			serviceProof={data.kibbleHome.serviceProof}
			featuredCopy={data.kibbleHome.featuredCopy}
			browseHref={data.kibbleHome.browseHref}
			categoryTitle={data.kibbleHome.categoryTitle}
			categoryEyebrow={data.kibbleHome.categoryEyebrow}
			zoneAdapters={activeHomeZoneAdapters}
		/>
	</div>
{:else}
<!-- Returning visitor banner — chrome, not layout content: shown regardless of aiLayout -->
{#if data.storedPersona && data.storedCategory}
	<div class="border-b border-surface-border bg-surface-muted">
		<div class="mx-auto max-w-7xl px-6 py-3 text-center text-sm text-surface-muted-fg">
			Welcome back — <a href="/category/{data.storedCategory}" class="font-medium text-primary hover:text-secondary">continue browsing {data.storedCategory.replace('-', ' ')}</a>
		</div>
	</div>
{/if}

{#if aiLayout}
	<!-- Sections are page-content, not chrome: they need the same gutter the
	     static homepage and the category page give their content, or copy runs
	     flush to the viewport edge on wide screens. -->
	<div class="mx-auto max-w-7xl px-6 py-8">
		<LayoutRenderer layout={aiLayout} products={data.products} />
	</div>
{:else}

<!-- Hero -->
<section class="border-b border-surface-border">
	<div class="mx-auto max-w-7xl px-6 py-20 sm:py-28 lg:py-36">
		<div class="max-w-xl">
			<h1 class="text-4xl leading-tight sm:text-5xl lg:text-6xl">
				{data.homepage.heroHeadline}
			</h1>
			<p class="mt-6 text-lg leading-relaxed text-surface-muted-fg">
				{data.homepage.heroBody}
			</p>
			<div class="mt-10 flex flex-wrap gap-3">
				{#each data.categories.map((c, i) => ({ label: c.name, href: `/category/${c.slug}`, primary: i === 0 })) as cta}
					<a
						href={cta.href}
						class="inline-flex items-center rounded-sm px-5 py-2.5 text-sm font-medium transition-colors
							{cta.primary
								? 'bg-surface-fg text-surface-bg hover:opacity-85'
								: 'border border-surface-border text-surface-fg hover:bg-surface-fg hover:text-surface-bg'}"
					>
						{cta.label}
					</a>
				{/each}
			</div>
		</div>
	</div>
</section>

<!-- Featured products -->
{#if data.featured.length > 0}
	<section class="mx-auto max-w-7xl px-6 py-16 lg:py-20">
		<h2 class="text-3xl">Featured</h2>
		<div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
			{#each data.featured as product}
				<a href="/product/{product.id}" class="group">
					<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-muted">
						{#if product.image}
							<img
								src={product.image}
								alt={product.imageAlt}
								width={400}
								height={300}
								decoding="async"
								class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
								loading="lazy"
							/>
						{/if}
					</div>
					<div class="mt-4">
						<h3 class="font-display text-lg group-hover:text-primary transition-colors">{product.name}</h3>
						<div class="mt-1">
							{#if product.salePrice}
								<span class="font-medium text-primary numeric">${product.salePrice.toLocaleString()}</span>
								<span class="ml-1 text-sm text-surface-muted-fg line-through numeric">${product.price.toLocaleString()}</span>
							{:else}
								<span class="font-medium numeric">${product.price.toLocaleString()}</span>
							{/if}
						</div>
					</div>
				</a>
			{/each}
		</div>
	</section>
{/if}

<!-- Category grid -->
<section class="border-t border-surface-border">
	<div class="mx-auto max-w-7xl px-6 py-16 lg:py-20">
		<h2 class="text-3xl">Shop by Category</h2>
		<div class="mt-10 grid gap-px overflow-hidden rounded-sm border border-surface-border bg-surface-border sm:grid-cols-2">
			{#each data.categories as cat}
				<a
					href="/category/{cat.slug}"
					class="group relative flex flex-col justify-end bg-surface-card p-8 transition-colors hover:bg-surface-muted"
					style="min-height: 180px;"
				>
					<h3 class="font-display text-xl">{cat.name}</h3>
					<span class="mt-2 text-sm text-primary group-hover:underline">Browse &rarr;</span>
				</a>
			{/each}
		</div>
	</div>
</section>

<!-- Editorial band -->
<section class="border-t border-surface-border bg-surface-muted">
	<div class="mx-auto max-w-7xl px-6 py-16 lg:py-20">
		<div class="grid items-center gap-12 lg:grid-cols-2">
			<div>
				<h2 class="text-3xl">{data.homepage.editorialHeadline}</h2>
				<p class="mt-4 text-surface-muted-fg leading-relaxed">
					{data.homepage.editorialBody}
				</p>
				{#if data.categories[0]}
					<a
						href="/category/{data.categories[0].slug}"
						class="mt-6 inline-block text-sm font-medium text-primary hover:text-secondary"
					>
						Start browsing &rarr;
					</a>
				{/if}
			</div>
			{#if data.featured[0]?.image}
				<div class="aspect-[4/3] overflow-hidden rounded-sm bg-surface-border">
					<img src={data.featured[0].image} alt={data.featured[0].imageAlt} class="h-full w-full object-cover" loading="lazy" decoding="async" />
				</div>
			{:else}
				<div class="aspect-[4/3] rounded-sm bg-surface-border"></div>
			{/if}
		</div>
	</div>
</section>

<!-- Value props -->
<section class="mx-auto max-w-7xl px-6 py-16 lg:py-20">
	<div class="grid gap-12 sm:grid-cols-3">
		{#each data.homepage.valueProps as prop}
			<div>
				<h3 class="font-display text-lg">{prop.title}</h3>
				<p class="mt-2 text-sm leading-relaxed text-surface-muted-fg">
					{prop.body}
				</p>
			</div>
		{/each}
	</div>
</section>

{/if}

{/if}
