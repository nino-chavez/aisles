<script lang="ts">
	import { getPickItems, removePick, clearPicks, totalPrice, pickCount } from '$lib/stores/picks.svelte';

	let {
		open = false,
		onclose,
	}: {
		open: boolean;
		onclose: () => void;
	} = $props();

	let items = $derived(getPickItems());
	let total = $derived(totalPrice());
	let count = $derived(pickCount());
	let suggestions = $state<Array<{ id: string; name: string; price: number; reason: string }>>([]);
	let loadingSuggestions = $state(false);

	// Fetch AI suggestions when tray opens with items
	$effect(() => {
		if (open && items.length > 0 && suggestions.length === 0) {
			fetchSuggestions();
		}
	});

	async function fetchSuggestions() {
		if (items.length === 0) return;
		loadingSuggestions = true;
		try {
			const res = await fetch('/api/suggest', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					picks: items.map((p) => ({ id: p.id, name: p.name, price: p.price, category: p.category, specs: p.specs })),
				}),
			});
			if (res.ok) {
				const data = await res.json();
				suggestions = data.suggestions || [];
			}
		} catch { /* non-critical */ }
		finally { loadingSuggestions = false; }
	}

	function handleRemove(id: string) {
		removePick(id);
		suggestions = []; // re-fetch on next open
	}
</script>

{#if open}
	<div class="fixed inset-0 z-50 flex justify-end">
		<!-- Overlay -->
		<button
			class="absolute inset-0 bg-neutral-950/30 backdrop-blur-[2px]"
			onclick={onclose}
			aria-label="Close picks"
		></button>

		<!-- Drawer -->
		<div class="relative z-10 flex h-full w-full max-w-md flex-col bg-surface-bg shadow-xl">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-surface-border px-6 py-4">
				<div>
					<h2 class="font-display text-lg">Your Picks ({count})</h2>
					{#if count > 0}
						<p class="text-xs text-surface-muted-fg">${total.toLocaleString()} total</p>
					{/if}
				</div>
				<div class="flex items-center gap-3">
					{#if count > 1}
						<a
							href="/compare"
							onclick={onclose}
							class="rounded-sm bg-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-85"
						>
							Compare
						</a>
					{/if}
					<button onclick={onclose} class="text-surface-muted-fg hover:text-surface-fg" aria-label="Close">
						<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
				</div>
			</div>

			<!-- Items -->
			<div class="flex-1 overflow-y-auto px-6 py-4">
				{#if count === 0}
					<div class="flex h-48 flex-col items-center justify-center text-center">
						<p class="text-surface-muted-fg">No picks yet</p>
						<p class="mt-2 text-xs text-surface-muted-fg">Add products to compare or build a set.</p>
						<button onclick={onclose} class="mt-4 text-sm font-medium text-primary hover:text-secondary">
							Continue browsing
						</button>
					</div>
				{:else}
					<ul class="divide-y divide-surface-border">
						{#each items as item}
							<li class="flex gap-4 py-4">
								{#if item.image}
									<img src={item.image} alt={item.name} class="h-20 w-20 rounded-sm object-cover" loading="lazy" decoding="async" />
								{:else}
									<div class="h-20 w-20 rounded-sm bg-surface-muted"></div>
								{/if}
								<div class="flex flex-1 flex-col">
									<a href="/product/{item.id}" onclick={onclose} class="text-sm font-medium hover:text-primary transition-colors">{item.name}</a>
									<p class="mt-0.5 text-xs text-surface-muted-fg">{item.category}</p>
									<div class="mt-auto flex items-center justify-between">
										<span class="text-sm font-medium">${(item.salePrice ?? item.price).toLocaleString()}</span>
										<button
											onclick={() => handleRemove(item.id)}
											class="text-xs text-surface-muted-fg hover:text-error transition-colors"
										>
											Remove
										</button>
									</div>
								</div>
							</li>
						{/each}
					</ul>

					<!-- AI Suggestions -->
					{#if loadingSuggestions}
						<div class="mt-4 border-t border-surface-border pt-4">
							<p class="text-xs font-medium uppercase tracking-wider text-surface-muted-fg">Suggested</p>
							<div class="mt-2 animate-pulse space-y-2">
								<div class="h-8 rounded bg-surface-muted"></div>
								<div class="h-8 rounded bg-surface-muted"></div>
							</div>
						</div>
					{:else if suggestions.length > 0}
						<div class="mt-4 border-t border-surface-border pt-4">
							<p class="text-xs font-medium uppercase tracking-wider text-surface-muted-fg">Suggested for you</p>
							<ul class="mt-2 space-y-2">
								{#each suggestions as suggestion}
									<li>
										<a
											href="/product/{suggestion.id}"
											onclick={onclose}
											class="flex items-center justify-between rounded-sm border border-surface-border px-3 py-2 text-sm transition-colors hover:bg-surface-muted"
										>
											<div>
												<span class="font-medium">{suggestion.name}</span>
												<span class="ml-2 text-xs text-surface-muted-fg">{suggestion.reason}</span>
											</div>
											<span class="text-xs font-medium">${suggestion.price.toLocaleString()}</span>
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				{/if}
			</div>

			<!-- Footer -->
			{#if count > 0}
				<div class="border-t border-surface-border px-6 py-4">
					<div class="flex gap-3">
						<a
							href="/compare"
							onclick={onclose}
							class="flex-1 rounded-sm bg-surface-fg py-3 text-center text-sm font-semibold text-surface-bg transition-opacity hover:opacity-85"
						>
							Compare ({count})
						</a>
						<button
							onclick={() => { clearPicks(); suggestions = []; }}
							class="rounded-sm border border-surface-border px-4 py-3 text-sm text-surface-muted-fg transition-colors hover:text-surface-fg"
						>
							Clear
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}
