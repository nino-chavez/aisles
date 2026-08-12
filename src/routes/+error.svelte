<script lang="ts">
	import { page } from '$app/stores';
	import { KibbleErrorReference } from '$lib/components/kibble';

	let { status, error }: { status: number; error: App.Error } = $props();
	let renderMode = $derived($page.data.renderMode);
</script>

<svelte:head>
	<title>{status} — Page unavailable</title>
</svelte:head>

{#if renderMode === 'reference-preserve'}
	<KibbleErrorReference {status} message={error.message} {...$page.data.kibbleError} />
{:else}
	<section class="mx-auto max-w-3xl px-6 py-24 text-center">
		<p class="text-sm text-surface-muted-fg">Error {status}</p>
		<h1 class="mt-3 text-3xl">This page is unavailable.</h1>
		<p class="mt-4 text-surface-muted-fg">{error.message}</p>
		<a href="/" class="mt-8 inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-white">Return home</a>
	</section>
{/if}
