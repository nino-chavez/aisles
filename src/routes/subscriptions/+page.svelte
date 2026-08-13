<script lang="ts">
	import type { PageData } from './$types';
	import { KibbleSubscriptionsReference } from '$lib/components/kibble';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Your subscriptions — Kibble &amp; Co.</title></svelte:head>

<div data-reference-recipe={data.kibbleSubscriptions.recipeId}>
	<KibbleSubscriptionsReference {...data.kibbleSubscriptions} />
</div>
