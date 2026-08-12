<script lang="ts">
	let {
		sectionLabel = '',
		columns,
		tiles,
	}: {
		sectionLabel?: string;
		columns: 2 | 3 | 4 | 5;
		tiles: Array<{ label: string; image: string; href: string; description?: string }>;
	} = $props();

	const gridClass = $derived(
		columns === 5
			? 'grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
			: columns === 4
				? 'grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-4'
				: columns === 3
					? 'grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
					: 'grid gap-4 grid-cols-1 sm:grid-cols-2'
	);
</script>

{#if tiles.length > 0}
	<div class="mb-10">
		{#if sectionLabel}
			<h2 class="mb-5 text-center font-display text-2xl tracking-tight">{sectionLabel}</h2>
		{/if}

		<div class={gridClass}>
			{#each tiles as tile}
				<a
					href={tile.href}
					class="group block"
				>
					<div class="aspect-[4/3] overflow-hidden rounded-md bg-surface-muted shadow-sm transition-shadow group-hover:shadow-md">
						{#if tile.image}
							<img
								src={tile.image}
								alt={tile.label}
								class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
								loading="lazy"
							/>
						{/if}
					</div>
					<p class="mt-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-surface-fg group-hover:text-primary">
						{tile.label}
					</p>
					{#if tile.description}
						<p class="mt-1.5 text-center text-sm leading-relaxed text-surface-muted-fg">
							{tile.description}
						</p>
					{/if}
				</a>
			{/each}
		</div>
	</div>
{/if}
