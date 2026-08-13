<script lang="ts">
	import type { PageData } from './$types';
	import { KibbleUnavailableReference } from '$lib/components/kibble';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{data.kibbleAccount ? 'Account — Kibble & Co.' : 'Account'}</title></svelte:head>

{#if data.kibbleAccount}
	<div data-reference-recipe={data.kibbleAccount.recipeId}><KibbleUnavailableReference surface="account" {...data.kibbleAccount} /></div>
{:else}
	<section class="mx-auto max-w-3xl px-6 py-24 text-center"><h1 class="text-3xl">Account is unavailable.</h1><a href="/" class="mt-8 inline-flex text-primary">Return home</a></section>
{/if}
