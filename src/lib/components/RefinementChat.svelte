<script lang="ts">
	import type { Layout } from '$lib/schema/layout';
	import { getBrand } from '$lib/brand/config';

	let {
		persona,
		categorySlug,
		currentLayout,
		onLayoutUpdate,
	}: {
		persona: string;
		categorySlug: string;
		currentLayout: Layout | null;
		onLayoutUpdate: (layout: Layout) => void;
	} = $props();

	let isOpen = $state(false);
	let message = $state('');
	let isLoading = $state(false);
	let constraints = $state<string[]>([]);
	let chatHistory = $state<Array<{ role: 'user' | 'assistant'; text: string; conflict?: boolean }>>([]);

	const brand = getBrand();

	// Brand-aware quick actions
	const quickActionsByDomain: Record<string, string[]> = {
		'DTC home furniture': ['Under $500', 'Something in leather', 'More compact options', 'Show me everything on sale', 'Best for small spaces'],
		'consumer audio & electronics': ['Under $100', 'Best battery life', 'With ANC', 'Wireless only', 'Good for gaming'],
		'outdoor lifestyle & fire': ['Under $200', 'Portable options', 'Best for camping', 'Smokeless only', 'Good for gifting'],
	};
	const quickActions = quickActionsByDomain[brand.domain] || quickActionsByDomain['DTC home furniture'];

	async function sendMessage(text: string) {
		if (!text.trim() || isLoading) return;

		const userMessage = text.trim();
		message = '';
		chatHistory = [...chatHistory, { role: 'user', text: userMessage }];
		isLoading = true;

		try {
			const res = await fetch('/api/refine', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					message: userMessage,
					currentLayout,
					persona,
					categorySlug,
					constraints,
				}),
			});

			if (!res.ok) throw new Error('Refinement failed');

			const data = await res.json();

			if (data.layout) {
				constraints = [...constraints, data.newConstraint];
				onLayoutUpdate(data.layout);

				chatHistory = [...chatHistory, {
					role: 'assistant',
					text: data.chatResponse || `Updated — showing ${data.layout.productOrder?.length || '?'} products.`,
					conflict: data.constraintConflict || false,
				}];
			}
		} catch {
			chatHistory = [...chatHistory, {
				role: 'assistant',
				text: 'Sorry, I couldn\'t process that. Try a different refinement.',
			}];
		} finally {
			isLoading = false;
		}
	}

	function removeConstraint(index: number) {
		constraints = constraints.filter((_, i) => i !== index);
		// Re-send with remaining constraints to regenerate layout
		sendMessage(`Remove the "${constraints[index]}" filter and show me the updated results`);
	}

	function handleSubmit(e: Event) {
		e.preventDefault();
		sendMessage(message);
	}
</script>

<!-- Floating trigger pill -->
{#if !isOpen}
	<button
		onclick={() => isOpen = true}
		class="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-full border border-surface-border bg-surface-card px-5 py-3 text-sm font-medium shadow-lg transition-all hover:shadow-xl hover:border-primary/30"
	>
		<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
		{#if constraints.length > 0}
			Refine ({constraints.length})
		{:else}
			Need help narrowing it down?
		{/if}
	</button>
{/if}

<!-- Chat panel -->
{#if isOpen}
	<div class="fixed bottom-6 right-6 z-40 flex w-96 max-w-[calc(100vw-3rem)] flex-col rounded-lg border border-surface-border bg-surface-card shadow-2xl">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-surface-border px-4 py-3">
			<div>
				<p class="text-sm font-medium">Refine your browse</p>
				{#if constraints.length > 0}
					<p class="text-xs text-surface-muted-fg">{constraints.length} active filter{constraints.length > 1 ? 's' : ''}</p>
				{/if}
			</div>
			<button onclick={() => isOpen = false} class="text-surface-muted-fg hover:text-surface-fg">
				<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
			</button>
		</div>

		<!-- Active constraints (clickable to remove) -->
		{#if constraints.length > 0}
			<div class="flex flex-wrap gap-1.5 border-b border-surface-border px-4 py-2">
				{#each constraints as constraint, i}
					<button
						onclick={() => removeConstraint(i)}
						class="group flex items-center gap-1 rounded-sm bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
						title="Click to remove"
					>
						{constraint}
						<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="opacity-0 group-hover:opacity-100 transition-opacity"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
					</button>
				{/each}
			</div>
		{/if}

		<!-- Chat messages -->
		<div class="max-h-64 flex-1 overflow-y-auto px-4 py-3">
			{#if chatHistory.length === 0}
				<p class="text-sm text-surface-muted-fg">Tell me what you're looking for, or try a quick action below.</p>
			{/if}

			{#each chatHistory as msg}
				<div class="mb-3 {msg.role === 'user' ? 'text-right' : ''}">
					<div class="inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm
						{msg.role === 'user'
							? 'bg-surface-fg text-surface-bg'
							: msg.conflict
								? 'bg-warning/10 text-warning border border-warning/20'
								: 'bg-surface-muted text-surface-muted-fg'}">
						{msg.text}
					</div>
				</div>
			{/each}

			{#if isLoading}
				<div class="mb-3">
					<div class="inline-block rounded-lg bg-surface-muted px-3 py-2 text-sm text-surface-muted-fg">
						<span class="animate-pulse">Reshaping the page...</span>
					</div>
				</div>
			{/if}
		</div>

		<!-- Quick actions (show only when no conversation yet) -->
		{#if chatHistory.length === 0}
			<div class="flex flex-wrap gap-1.5 border-t border-surface-border px-4 py-2">
				{#each quickActions as action}
					<button
						onclick={() => sendMessage(action)}
						class="rounded-sm border border-surface-border px-2.5 py-1 text-xs text-surface-muted-fg transition-colors hover:border-primary/30 hover:text-surface-fg"
					>
						{action}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Input -->
		<form onsubmit={handleSubmit} class="flex items-center border-t border-surface-border px-4 py-3">
			<input
				type="text"
				bind:value={message}
				placeholder="Under $200, wireless, best for running..."
				disabled={isLoading}
				class="flex-1 bg-transparent text-sm placeholder:text-surface-muted-fg focus:outline-none disabled:opacity-50"
			/>
			<button
				type="submit"
				disabled={isLoading || !message.trim()}
				class="ml-2 rounded-sm bg-surface-fg px-3 py-1.5 text-xs font-medium text-surface-bg transition-opacity hover:opacity-85 disabled:opacity-30"
			>
				Send
			</button>
		</form>
	</div>
{/if}
