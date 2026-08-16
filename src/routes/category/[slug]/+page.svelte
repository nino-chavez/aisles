<script lang="ts">
	import type { PageData } from './$types';
	import type { Layout } from '$lib/schema/layout';
	import type { PersonaInference } from '$lib/signals/types';
	import { PERSONAS } from '$lib/signals/types';
	import LayoutRenderer from '$lib/components/layouts/LayoutRenderer.svelte';
	import GathererLayout from '$lib/components/layouts/GathererLayout.svelte';
	import HunterLayout from '$lib/components/layouts/HunterLayout.svelte';
	import ResearcherLayout from '$lib/components/layouts/ResearcherLayout.svelte';
	import GifterLayout from '$lib/components/layouts/GifterLayout.svelte';
	import RefinementChat from '$lib/components/RefinementChat.svelte';
	import { picksContextForPrompt } from '$lib/stores/picks.svelte';
	import { getEmitter } from '$lib/signals/emitter';
	import { KibbleCategoryReference, KibbleTierCategory } from '$lib/components/kibble';
	import { KIBBLE_REFERENCE_CONTRACT } from '$lib/brand/reference/kibble';
	import {
		KIBBLE_PLP_DEFAULT_PRESENTATION,
		materializeKibblePlpPresentation,
		snapshotKibblePlpPresentation,
	} from '$lib/brand/reference/kibble-presentation-decisions';
	import type { KibblePlpLivePreview } from '$lib/components/kibble/kibble-plp-live-preview';

	let { data }: { data: PageData } = $props();

	let aiLayout = $state<Layout | null>(null);
	let aiMeta = $state<{ generationTimeMs: number; persona: string; cacheHit?: boolean } | null>(null);
	let aiError = $state<string | null>(null);
	let isUpgrading = $state(true);
	let overridePersona = $state<string | null>(null);
	let sessionCost = $state<{ totalCost: number; generations: number; tokens: number; cacheHitRate: number } | null>(null);
	let legacyPersona = $derived(data.renderMode === 'reference-preserve' ? 'gatherer' : (data.persona ?? 'gatherer'));
	let legacyProducts = $derived(data.renderMode === 'reference-preserve' ? [] : (data.products ?? []));
	let currentPersona = $derived(overridePersona ?? legacyPersona);
	type KibblePlpData = NonNullable<PageData['kibbleCategory']>;
	let previewProducts = $state<KibblePlpData['products'] | null>(null);
	let previewRankingAdapter = $state<KibblePlpLivePreview['zoneAdapter'] | null>(null);
	let previewPlpZoneArtifacts = $state<KibblePlpLivePreview['zoneArtifacts'] | null>(null);
	let previewPlpPresentation = $state<ReturnType<typeof materializeKibblePlpPresentation> | null>(null);
	let defaultPlpPresentation = $derived(data.kibbleCategory ? materializeKibblePlpPresentation(KIBBLE_PLP_DEFAULT_PRESENTATION, data.kibbleCategory) : null);
	let activePlpPresentation = $derived(previewPlpPresentation ?? defaultPlpPresentation);

	$effect(() => {
		data;
		previewProducts = null;
		previewRankingAdapter = null;
		previewPlpZoneArtifacts = null;
		previewPlpPresentation = null;
	});

	$effect(() => {
		const category = data.kibbleCategory;
		const decision = category?.productRanking;
		if (data.renderMode !== 'reference-preserve' || !category || !decision?.eligible) return;
		const products = category.products;
		let active = true;
		let cleanup: (() => void) | undefined;
		void import('$lib/components/kibble/kibble-plp-live-preview').then(({ listenForKibblePlpLivePreview }) => {
			if (!active) return;
			cleanup = listenForKibblePlpLivePreview({
				expectation: { routePath: decision.routePath, sort: decision.sort, cursor: decision.cursor, policyVersion: decision.policyVersion, reference: { id: KIBBLE_REFERENCE_CONTRACT.id, version: KIBBLE_REFERENCE_CONTRACT.version }, prefixIds: decision.prefixIds, tailIds: decision.tailIds, expectedInputSha256: decision.expectedInputSha256, title: category.title, productCount: category.productCount, productSingular: category.productSingular, productPlural: category.productPlural },
				products,
				getCurrentPresentation: () => snapshotKibblePlpPresentation(activePlpPresentation ?? materializeKibblePlpPresentation(KIBBLE_PLP_DEFAULT_PRESENTATION, category)),
				onApplied: (preview) => {
					previewProducts = preview.products as KibblePlpData['products'];
					previewRankingAdapter = preview.zoneAdapter;
					previewPlpZoneArtifacts = preview.zoneArtifacts;
					previewPlpPresentation = materializeKibblePlpPresentation(preview.presentationDecision, category);
				},
				onStatus: (status) => window.dispatchEvent(new CustomEvent('aisles-kibble-plp-model-status', { detail: status })),
			});
			window.dispatchEvent(new CustomEvent('aisles-kibble-plp-model-ready'));
		});
		return () => { active = false; cleanup?.(); };
	});

	// Fetch AI-generated layout on mount / persona change
	// Track category to reset layout on navigation
	let lastCategory = $state('');

	$effect(() => {
		if (data.renderMode === 'reference-preserve') {
			isUpgrading = false;
			return;
		}
		const persona = currentPersona;
		const slug = data.category.slug;

		// Clear stale layout when category changes
		if (slug !== lastCategory) {
			aiLayout = null;
			aiMeta = null;
			lastCategory = slug;
		}

		fetchLayout(persona);
	});

	// Listen for inference updates from the signal pipeline
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
		isUpgrading = true;
		aiError = null;

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 30000);

			const res = await fetch('/api/layout/stream', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					persona,
					categorySlug: data.category.slug,
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
				aiMeta = result.meta;
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

					// Parse SSE events from buffer
					const lines = buffer.split('\n\n');
					buffer = lines.pop() || ''; // Keep incomplete chunk

					for (const chunk of lines) {
						const line = chunk.trim();
						if (!line.startsWith('data: ')) continue;

						const payload = JSON.parse(line.slice(6));

						if (payload.__done) {
							// Final validated layout
							aiLayout = payload.layout;
							aiMeta = payload.meta;
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
			console.error('AI layout generation failed, using static layout:', aiError);
		} finally {
			isUpgrading = false;
		}
	}

	// Fetch session cost data in dev mode
	$effect(() => {
		if (!data.devMode) return;

		async function fetchCost() {
			try {
				const sessionId = data.sessionId;
				if (!sessionId) return;
				const res = await fetch(`/api/observe/logs?session=${sessionId}&limit=50`);
				const { logs } = await res.json();
				if (!logs?.length) return;
				const totalCost = logs.reduce((s: number, l: any) => s + (l.estimatedCost ?? 0), 0);
				const tokens = logs.reduce((s: number, l: any) => s + (l.inputTokens ?? 0) + (l.outputTokens ?? 0), 0);
				const cacheHits = logs.filter((l: any) => l.cacheHit).length;
				sessionCost = {
					totalCost,
					generations: logs.length,
					tokens,
					cacheHitRate: Math.round((cacheHits / logs.length) * 100),
				};
			} catch { /* non-critical */ }
		}

		fetchCost();
	});

	// Track scroll depth on category pages
	$effect(() => {
		let maxDepth = 0;
		let emitted25 = false;
		let emitted50 = false;
		let emitted75 = false;

		const handleScroll = () => {
			const scrollTop = window.scrollY;
			const docHeight = document.documentElement.scrollHeight - window.innerHeight;
			if (docHeight <= 0) return;
			const depth = Math.round((scrollTop / docHeight) * 100);
			if (depth <= maxDepth) return;
			maxDepth = depth;

			const emitter = getEmitter();
			if (!emitter) return;

			if (depth >= 75 && !emitted75) {
				emitted75 = true;
				emitter.emit('interact.scroll_depth', { depth: 75, category: data.category.slug });
			} else if (depth >= 50 && !emitted50) {
				emitted50 = true;
				emitter.emit('interact.scroll_depth', { depth: 50, category: data.category.slug });
			} else if (depth >= 25 && !emitted25) {
				emitted25 = true;
				emitter.emit('interact.scroll_depth', { depth: 25, category: data.category.slug });
			}
		};

		window.addEventListener('scroll', handleScroll, { passive: true });
		return () => window.removeEventListener('scroll', handleScroll);
	});

	/** Format a probability as a percentage string */
	function pct(n: number): string {
		return `${Math.round(n * 100)}%`;
	}
</script>

<svelte:head>
	<title>{data.renderMode === 'reference-preserve' ? data.category.name : `${data.category.name} — ${data.persona} view`}</title>
	<meta name="description" content={data.renderMode === 'reference-preserve' ? `Browse ${data.category.name}. ${data.kibbleCategory?.productCount ?? 0} products available.` : `Browse ${data.category.name} — personalized for ${legacyPersona} shoppers. ${legacyProducts.length} products available.`} />
</svelte:head>

{#if data.tierCategory}
	<KibbleTierCategory
		category={data.tierCategory.category}
		breadcrumb={data.tierCategory.breadcrumb}
		subcategories={data.tierCategory.children}
		products={data.tierCategory.products}
		hasMore={data.tierCategory.hasMore}
		totalItems={data.tierCategory.totalItems}
	/>
{:else if data.renderMode === 'reference-preserve' && data.kibbleCategory}
	<KibbleCategoryReference
		{...data.kibbleCategory}
		products={previewProducts ?? data.kibbleCategory.products}
		zoneAdapter={previewPlpZoneArtifacts?.header ?? data.kibbleCategory.zoneAdapter}
		productRankingZoneAdapter={previewRankingAdapter}
		marketingZoneArtifact={previewPlpZoneArtifacts?.marketing ?? null}
	/>
{:else}
<div class="mx-auto max-w-7xl px-6 py-8">
	<!-- Dev mode panel -->
	{#if data.devMode}
		{@const inf = data.inference}
		<div class="mb-6 rounded-sm border border-accent/30 bg-accent/5 p-4">
			<div class="flex items-center justify-between">
				<div>
					<p class="text-xs font-medium uppercase tracking-wider text-accent">Dev Mode — Inference Engine</p>
					<p class="mt-1 text-sm text-surface-muted-fg">
						Primary: <span class="font-semibold text-surface-fg">{currentPersona}</span>
						({pct(inf.probabilities[inf.primary])} prob, {pct(inf.confidence)} confidence gap)
						&middot; Source: <span class="font-medium">{inf.dominantSource}</span>
						&middot; Signals: {inf.signalCount}
						{#if inf.shift.detected}
							&middot; <span class="font-semibold text-warning">SHIFT: {inf.shift.from} &rarr; {inf.primary}</span>
						{/if}
						{#if aiMeta}
							&middot; Layout in {aiMeta.generationTimeMs}ms
							{#if aiMeta.cacheHit}
								&middot; <span class="font-medium text-accent">CACHE HIT</span>
							{/if}
						{/if}
						{#if aiError}
							&middot; <span class="text-error">Fallback: {aiError}</span>
						{/if}
					</p>

					<!-- Probability vector bar -->
					<div class="mt-2 flex items-center gap-3 text-xs">
						{#each PERSONAS as p}
							<div class="flex items-center gap-1.5">
								<span class="font-medium {p === inf.primary ? 'text-surface-fg' : 'text-surface-muted-fg'}">{p}</span>
								<div class="h-1.5 w-16 rounded-full bg-surface-muted">
									<div
										class="h-full rounded-full {p === inf.primary ? 'bg-accent' : 'bg-surface-muted-fg/40'}"
										style="width: {inf.probabilities[p] * 100}%"
									></div>
								</div>
								<span class="tabular-nums text-surface-muted-fg">{pct(inf.probabilities[p])}</span>
							</div>
						{/each}
					</div>

					<!-- Modifiers -->
					<div class="mt-1.5 flex gap-3 text-xs text-surface-muted-fg">
						<span>price sensitivity: {pct(inf.modifiers.priceSensitivity)}</span>
						<span>urgency: {pct(inf.modifiers.urgency)}</span>
						<span>familiarity: {pct(inf.modifiers.familiarityWithStore)}</span>
					</div>

					<!-- Session API Cost -->
					{#if sessionCost}
						<div class="mt-1.5 flex gap-3 text-xs">
							<span class="text-surface-muted-fg">Session cost: <span class="font-mono font-medium text-surface-fg">${sessionCost.totalCost.toFixed(4)}</span></span>
							<span class="text-surface-muted-fg">{sessionCost.generations} generations</span>
							<span class="text-surface-muted-fg">{sessionCost.tokens.toLocaleString()} tokens</span>
							<span class="text-surface-muted-fg">cache: {sessionCost.cacheHitRate}%</span>
						</div>
					{/if}

					{#if data.sessionContext}
						<p class="mt-1.5 text-xs text-surface-muted-fg">
							Visit #{data.sessionContext.visitCount}
							{#if data.sessionContext.storedPersona}
								&middot; Previous: {data.sessionContext.storedPersona} on {data.sessionContext.storedCategory}
							{/if}
							{#if data.sessionContext.searchQuery}
								&middot; Query: "{data.sessionContext.searchQuery}"
							{/if}
							{#if inf.shift.trigger}
								&middot; Shift trigger: {inf.shift.trigger}
							{/if}
						</p>
					{/if}
				</div>

				<!-- Persona toggle — all 4 personas -->
				<div class="flex flex-col gap-1.5">
					{#each PERSONAS as persona}
						<button
							onclick={() => overridePersona = persona}
							class="rounded-sm px-3 py-1 text-xs font-medium transition-colors
								{currentPersona === persona
									? 'bg-accent text-white'
									: 'border border-surface-border text-surface-muted-fg hover:text-surface-fg'}"
						>
							{persona.charAt(0).toUpperCase() + persona.slice(1)}
						</button>
					{/each}
				</div>
			</div>

			<!-- Show AI reasoning and raw schema -->
			{#if aiLayout}
				<details class="mt-3">
					<summary class="cursor-pointer text-xs text-accent hover:underline">View AI reasoning & schema</summary>
					<div class="mt-2 rounded-sm bg-surface-card p-3">
						<p class="text-sm text-surface-muted-fg"><strong>Reasoning:</strong> {aiLayout.reasoning}</p>
						<pre class="mt-2 max-h-64 overflow-auto rounded-sm bg-neutral-950 p-3 text-xs text-neutral-300">{JSON.stringify(aiLayout, null, 2)}</pre>
					</div>
				</details>
			{/if}

			<!-- Signal breakdown — which rules fired and why -->
			{#if inf.ruleMatches?.length > 0}
				<details class="mt-2" open>
					<summary class="cursor-pointer text-xs text-accent hover:underline">Signal breakdown ({inf.ruleMatches.length} rules fired)</summary>
					<div class="mt-2 overflow-x-auto">
						<table class="w-full text-xs">
							<thead>
								<tr class="border-b border-surface-border text-left text-surface-muted-fg">
									<th class="pb-1 pr-3">Rule</th>
									<th class="pb-1 pr-3">Reason</th>
									<th class="pb-1 pr-3">Weight</th>
									<th class="pb-1">Score Impact</th>
								</tr>
							</thead>
							<tbody>
								{#each inf.ruleMatches as match}
									<tr class="border-b border-surface-border/50">
										<td class="py-1.5 pr-3 font-mono text-surface-fg">{match.ruleName}</td>
										<td class="py-1.5 pr-3 text-surface-muted-fg">{match.reason}</td>
										<td class="py-1.5 pr-3 tabular-nums text-surface-muted-fg">{match.weight.toFixed(1)}</td>
										<td class="py-1.5">
											{#each ['gatherer', 'hunter', 'researcher', 'gifter'] as p}
												{#if (match.adjustment as any)[p]}
													<span class="mr-1.5 rounded-sm px-1 py-0.5 text-[10px] font-medium
														{p === inf.primary ? 'bg-accent/15 text-accent' : 'bg-surface-muted text-surface-muted-fg'}">
														{p}: +{((match.adjustment as any)[p] * match.weight).toFixed(2)}
													</span>
												{/if}
											{/each}
											{#if match.adjustment.priceSensitivity}
												<span class="mr-1.5 rounded-sm bg-warning/10 px-1 py-0.5 text-[10px] text-warning">price +{(match.adjustment.priceSensitivity * match.weight).toFixed(2)}</span>
											{/if}
											{#if match.adjustment.urgency}
												<span class="mr-1.5 rounded-sm bg-error/10 px-1 py-0.5 text-[10px] text-error">urgency +{(match.adjustment.urgency * match.weight).toFixed(2)}</span>
											{/if}
											{#if match.adjustment.familiarityWithStore}
												<span class="rounded-sm bg-info/10 px-1 py-0.5 text-[10px] text-info">familiarity +{(match.adjustment.familiarityWithStore * match.weight).toFixed(2)}</span>
											{/if}
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</details>
			{:else}
				<p class="mt-2 text-xs text-surface-muted-fg">No inference rules fired — using base prior (gatherer: 0.3, hunter: 0.2, researcher: 0.2, gifter: 0.1)</p>
			{/if}

			<!-- Raw inference JSON (collapsed) -->
			<details class="mt-2">
				<summary class="cursor-pointer text-xs text-accent hover:underline">View raw inference JSON</summary>
				<pre class="mt-2 max-h-48 overflow-auto rounded-sm bg-neutral-950 p-3 text-xs text-neutral-300">{JSON.stringify(inf, null, 2)}</pre>
			</details>
		</div>
	{/if}

	<!-- Content area: show static fallback instantly, upgrade to AI layout when ready -->
	{#if aiLayout}
		<LayoutRenderer layout={aiLayout} products={legacyProducts} />
	{:else if isUpgrading}
		<!-- Skeleton: editorial header + product grid placeholder -->
		<div class="animate-pulse">
			<div class="mb-2 h-4 w-32 rounded bg-surface-muted"></div>
			<div class="mb-3 h-10 w-3/4 rounded bg-surface-muted"></div>
			<div class="mb-8 h-16 w-2/3 rounded bg-surface-muted"></div>
			<div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{#each Array(6) as _}
					<div>
						<div class="aspect-[4/3] rounded bg-surface-muted"></div>
						<div class="mt-3 h-4 w-3/4 rounded bg-surface-muted"></div>
						<div class="mt-2 h-4 w-1/3 rounded bg-surface-muted"></div>
					</div>
				{/each}
			</div>
		</div>
	{:else if currentPersona === 'gatherer'}
		<GathererLayout category={data.category} products={legacyProducts} />
	{:else if currentPersona === 'hunter'}
		<HunterLayout category={data.category} products={legacyProducts} />
	{:else if currentPersona === 'researcher'}
		<ResearcherLayout category={data.category} products={legacyProducts} />
	{:else if currentPersona === 'gifter'}
		<GifterLayout category={data.category} products={legacyProducts} />
	{:else}
		<GathererLayout category={data.category} products={legacyProducts} />
	{/if}

	<!-- Personalizing indicator — subtle pill at bottom-left -->
	{#if isUpgrading}
		<div class="fixed bottom-20 left-6 z-30 flex items-center gap-2 rounded-full bg-surface-card px-4 py-2 text-xs text-surface-muted-fg shadow-md border border-surface-border">
			<span class="inline-block h-1.5 w-1.5 rounded-full bg-accent animate-pulse"></span>
			Personalizing...
		</div>
	{/if}
</div>

<!-- Refinement chat — floats over the page -->
{#if !isUpgrading}
	<RefinementChat
		persona={currentPersona}
		categorySlug={data.category.slug}
		currentLayout={aiLayout}
		onLayoutUpdate={(newLayout) => { aiLayout = newLayout; }}
	/>
{/if}

{/if}
