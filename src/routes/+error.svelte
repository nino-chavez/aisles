<script lang="ts">
	import { page } from '$app/stores';
	import { KibbleErrorReference } from '$lib/components/kibble';

	let chromeMode = $derived($page.data.chromeMode);
	let status = $derived($page.status);
	let errorMessage = $derived($page.error?.message ?? 'This page is temporarily unavailable.');
	let errorPolicyAttribute = $derived(
		$page.data.kibbleErrorPolicy?.policies
			.map((policy: { surface: string; policyVersion: string }) => `${policy.surface}:${policy.policyVersion}`)
			.join(','),
	);
</script>

<svelte:head>
	<title>{status} — Page unavailable</title>
</svelte:head>

{#if chromeMode === 'reference'}
	<div
		data-reference-id={$page.data.kibbleErrorPolicy?.referenceId}
		data-reference-contract-version={$page.data.kibbleErrorPolicy?.referenceVersion}
		data-reference-policy={errorPolicyAttribute}
	>
		<KibbleErrorReference {status} message={errorMessage} {...$page.data.kibbleError} />
	</div>
{:else}
	<section class="mx-auto max-w-3xl px-6 py-24 text-center">
		<p class="text-sm text-surface-muted-fg">Error {status}</p>
		<h1 class="mt-3 text-3xl">This page is unavailable.</h1>
		<p class="mt-4 text-surface-muted-fg">{errorMessage}</p>
		<a href="/" class="mt-8 inline-flex min-h-11 items-center rounded-sm bg-primary px-5 text-sm font-medium text-white">Return home</a>
	</section>
{/if}
