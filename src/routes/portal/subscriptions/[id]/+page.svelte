<script lang="ts">
	import type { PageData } from './$types';
	import { KibbleSubscriptionsReference } from '$lib/components/kibble';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>Subscription detail — {data.kibbleSubscriptions.brandName}</title><meta name="robots" content="noindex" /></svelte:head>

<div data-reference-recipe={data.kibbleSubscriptions.recipeId}>
	<KibbleSubscriptionsReference {...data.kibbleSubscriptions} />
</div>
