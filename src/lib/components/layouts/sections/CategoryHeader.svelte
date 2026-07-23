<script lang="ts">
	let {
		title,
		subtitle = '',
		showSort = false,
		showFilter = false,
	}: {
		title: string;
		subtitle?: string;
		showSort?: boolean;
		showFilter?: boolean;
	} = $props();
</script>

<div class="mb-6 flex flex-wrap items-end justify-between gap-4">
	<div>
		<h1 class="text-2xl">{title}</h1>
		{#if subtitle}
			<p class="mt-1 text-sm text-surface-muted-fg">{subtitle}</p>
		{/if}
	</div>
	{#if showFilter || showSort}
		<div class="flex gap-2">
			{#if showFilter}
				<button class="rounded-sm border border-surface-border px-3 py-1.5 text-xs font-medium text-surface-muted-fg transition-colors hover:border-neutral-400 hover:text-surface-fg">
					Filter
				</button>
			{/if}
			{#if showSort}
				<select class="rounded-sm border border-surface-border bg-surface-card px-3 py-1.5 text-xs font-medium text-surface-muted-fg">
					<option>Price: Low to High</option>
					<option>Price: High to Low</option>
					<option>Newest</option>
				</select>
			{/if}
		</div>
	{/if}
</div>
