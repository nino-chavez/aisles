<script lang="ts">
	/**
	 * Themed merchandising bins on PLP: 3-8 curated themes shown as a row of
	 * chip-style links above the product grid, each spanning subcategories.
	 * Chip labels render in tracking-wide uppercase; the section label, when
	 * present, renders sentence-case to match editorial voice.
	 */

	let {
		sectionLabel,
		chips,
	}: {
		sectionLabel?: string;
		chips: Array<{ label: string; href: string }>;
	} = $props();
</script>

{#if chips.length > 0}
	<section class="border-y border-surface-border py-4">
		{#if sectionLabel}
			<p class="mb-2 px-6 text-sm text-surface-muted-fg">{sectionLabel}</p>
		{/if}
		<ul class="flex flex-wrap items-stretch gap-x-6 gap-y-3 px-6">
			{#each chips as chip}
				<li>
					<a
						href={chip.href}
						class="inline-block py-1 text-xs font-semibold uppercase tracking-[0.18em] text-surface-fg underline decoration-1 underline-offset-[6px] transition-colors hover:text-primary"
					>
						{chip.label}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}
