<script lang="ts">
	/**
	 * Trust strip with iconified value props. Icons dispatch from a fixed set
	 * of brand-aligned line SVGs keyed by name (`shipping`, `returns`,
	 * `rewards`, `store`, `gift`, `quality`, `secure`, `support`) rather than
	 * rendering `c.icon` as text — that would let the generator emit emoji or
	 * arbitrary glyphs. Unknown icon keys render a neutral outline circle so
	 * the input can never break the visual system.
	 */

	let {
		columns = 4,
		callouts,
	}: {
		columns?: 3 | 4;
		callouts: Array<{ icon: string; label: string; body?: string }>;
	} = $props();

	const colClass = $derived(
		columns === 3
			? 'grid-cols-1 sm:grid-cols-3'
			: 'grid-cols-2 sm:grid-cols-4'
	);

	function key(name: string): string {
		return name.trim().toLowerCase().replace(/[^a-z]/g, '');
	}
</script>

{#if callouts.length > 0}
	<div class="mb-10 rounded-sm border border-surface-muted bg-surface-muted/30 px-6 py-6 sm:px-8 sm:py-8">
		<div class="grid gap-6 {colClass}">
			{#each callouts as c (c.label)}
				{@const k = key(c.icon)}
				<div class="flex flex-col items-center gap-2 text-center">
					<span class="text-primary" aria-hidden="true">
						{#if k === 'shipping' || k === 'truck' || k === 'delivery' || k === 'freeshipping'}
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 7h11v9H3z" />
								<path d="M14 10h4l3 3v3h-7" />
								<circle cx="7.5" cy="17.5" r="1.5" />
								<circle cx="17.5" cy="17.5" r="1.5" />
							</svg>
						{:else if k === 'returns' || k === 'return' || k === 'refund' || k === 'exchange'}
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 7v6h6" />
								<path d="M3 13a9 9 0 1 0 3-7" />
							</svg>
						{:else if k === 'rewards' || k === 'loyalty' || k === 'bucks' || k === 'points' || k === 'star'}
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 3l2.6 5.5 5.9.6-4.4 4.2 1.2 5.9L12 16.8l-5.3 2.4 1.2-5.9L3.5 9.1l5.9-.6z" />
							</svg>
						{:else if k === 'store' || k === 'pin' || k === 'location' || k === 'locator' || k === 'bopis' || k === 'pickup'}
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 21s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
								<circle cx="12" cy="9" r="2.5" />
							</svg>
						{:else if k === 'gift' || k === 'present'}
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
								<rect x="3" y="9" width="18" height="11" rx="1" />
								<path d="M3 13h18" />
								<path d="M12 9v11" />
								<path d="M8 9c0-2 1-4 4-4s4 2 4 4" />
							</svg>
						{:else if k === 'quality' || k === 'sparkle' || k === 'value'}
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 3v3" />
								<path d="M12 18v3" />
								<path d="M4.5 12h-1.5" />
								<path d="M21 12h-1.5" />
								<circle cx="12" cy="12" r="4" />
							</svg>
						{:else if k === 'secure' || k === 'lock' || k === 'safe' || k === 'shield'}
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
								<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" />
							</svg>
						{:else if k === 'support' || k === 'help' || k === 'chat' || k === 'service'}
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 12a8 8 0 1 1-2.6-5.9L21 4v5h-5" />
								<path d="M12 8v4l3 2" />
							</svg>
						{:else}
							<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">
								<circle cx="12" cy="12" r="9" />
							</svg>
						{/if}
					</span>
					<p class="text-xs font-semibold uppercase tracking-wider text-surface-fg sm:text-sm">{c.label}</p>
					{#if c.body}
						<p class="text-[11px] leading-relaxed text-surface-muted-fg sm:text-xs">{c.body}</p>
					{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}
