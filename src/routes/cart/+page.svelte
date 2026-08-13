<script lang="ts">
	import type { PageData } from './$types';
	import { KibbleCartReference } from '$lib/components/kibble';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.renderMode === 'reference-preserve' ? 'Cart — Kibble & Co.' : 'Cart'}</title></svelte:head>

{#if data.renderMode === 'reference-preserve' && data.kibbleCart}
	<KibbleCartReference {...data.kibbleCart} />
{:else}
	<section class="mx-auto max-w-3xl px-6 py-24 text-center"><h1 class="text-3xl">Cart is unavailable.</h1><a href="/" class="mt-8 inline-flex text-primary">Return home</a></section>
{/if}
