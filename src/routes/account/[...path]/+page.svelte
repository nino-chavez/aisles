<script lang="ts">
	import type { PageData } from './$types';
	import { KibbleAccountReference, KibbleSubscriptionsReference } from '$lib/components/kibble';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Account — Kibble &amp; Co.</title></svelte:head>

<div data-reference-recipe={data.kibbleAccount.recipeId}>
	{#if data.kibbleAccount.subtype === 'subscriptions'}
		<KibbleSubscriptionsReference
			subtype="account"
			brandName={data.kibbleAccount.brandName}
			availabilityMessage={data.kibbleAccount.availabilityMessage}
			policyVersion={data.kibbleAccount.policyVersion}
			services={data.kibbleAccount.services}
			customerSessionState={data.kibbleAccount.customerSessionState}
		/>
	{:else}
		<KibbleAccountReference {...data.kibbleAccount} />
	{/if}
</div>
