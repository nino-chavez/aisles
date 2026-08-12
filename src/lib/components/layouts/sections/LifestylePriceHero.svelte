<script lang="ts">
	let {
		image,
		category,
		priceLabel,
		ctaLabel,
		ctaHref,
	}: {
		image: string;
		category: string;
		priceLabel: string;
		ctaLabel: string;
		ctaHref: string;
	} = $props();
</script>

{#if image}
	<a
		href={ctaHref}
		class="group relative mb-6 block overflow-hidden rounded-sm bg-surface-muted"
	>
		<!-- Capped so a full-bleed hero box can't inflate past the fold on wide viewports. -->
		<div class="aspect-[16/7] max-h-[min(70vh,640px)] sm:aspect-[16/6]">
			<img
				src={image}
				alt={category}
				class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
				loading="lazy"
			/>
		</div>

		<!-- Bold price overlay, anchored to the right — the featured-price hero pattern. -->
		<div class="absolute inset-0 flex items-center justify-end p-8 sm:p-12">
			<div class="flex flex-col items-end gap-2 text-right">
				<p class="text-xs font-semibold uppercase tracking-[0.18em] text-surface-fg drop-shadow-sm">
					{category}
				</p>
				<p class="numeric font-display text-4xl font-bold text-primary drop-shadow-md sm:text-5xl">
					{priceLabel}
				</p>
				<span class="mt-2 inline-flex items-center justify-center rounded-sm bg-primary px-5 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-opacity group-hover:opacity-90">
					{ctaLabel}
				</span>
			</div>
		</div>
	</a>
{/if}
