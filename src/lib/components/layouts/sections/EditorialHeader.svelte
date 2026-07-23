<script lang="ts">
	let { eyebrow, headline, body }: { eyebrow: string; headline: string; body: string } = $props();
</script>

<div class="mb-12">
	<p class="text-xs font-medium uppercase tracking-widest text-surface-muted-fg">{eyebrow}</p>
	<h1 class="mt-3 text-3xl sm:text-4xl">{headline}</h1>
	<p class="mt-4 max-w-lg text-surface-muted-fg leading-relaxed">{body}</p>
</div>
